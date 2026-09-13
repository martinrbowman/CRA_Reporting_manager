// Idempotent — safe to run on every container boot (see Dockerfile CMD) and
// safe to re-run manually via `pnpm --filter @cra/api db:seed`. Skips role
// creation if roles already exist, and skips admin bootstrap entirely once
// any user holds the admin role.
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as argon2 from 'argon2';
import * as schema from './schema.js';

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client, { schema });

const ALL_WRITE_PERMISSIONS = [
  'products:write', 'vulnerabilities:write', 'psirt:write', 'users:write',
  'approvals:write', 'incidents:write', 'notifications:write', 'admin:backup',
];

const ROLE_DEFS = [
  {
    roleName: 'admin',
    description: 'Full platform access',
    permissions: ALL_WRITE_PERMISSIONS,
  },
  {
    roleName: 'psirt_analyst',
    description: 'PSIRT case handling, vulnerability triage, incident response, notifications',
    permissions: [
      'vulnerabilities:write', 'psirt:write', 'incidents:write',
      'notifications:write', 'approvals:write',
    ],
  },
];

// Upsert standard roles — safe to re-run.
await db.insert(schema.roles).values(ROLE_DEFS).onConflictDoNothing();

const adminRole = await db.query.roles.findFirst({
  where: (r, { eq }) => eq(r.roleName, 'admin'),
});
const roleId = adminRole?.roleId;
if (!roleId) throw new Error('Could not find admin role after seed');

// Bootstrap the initial admin user, only if no user holds the admin role yet.
const existingAdminAssignment = await db.query.userRoles.findFirst({
  where: (ur, { eq }) => eq(ur.roleId, roleId),
});

if (existingAdminAssignment) {
  console.log('An admin user already exists — skipping admin bootstrap.');
} else {
  const email = process.env['ADMIN_EMAIL'];
  if (!email) {
    throw new Error(
      'ADMIN_EMAIL must be set to bootstrap the initial admin user (no default is provided). ' +
      'Set it in .env and re-run: pnpm --filter @cra/api db:seed',
    );
  }

  let password = process.env['ADMIN_PASSWORD'];
  let generated = false;
  if (!password) {
    password = randomBytes(18).toString('base64url'); // 24-char random secret
    generated = true;
  }

  const passwordHash = await argon2.hash(password);
  const [user] = await db.insert(schema.users)
    .values({ email, passwordHash, name: 'Platform Admin' })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log(`User ${email} already exists but holds no admin role — assign one manually.`);
  } else {
    await db.insert(schema.userRoles).values({ userId: user.userId, roleId, assignedBy: 'seed' });
    console.log('\nAdmin user created:');
    console.log(`  Email: ${email}`);
    if (generated) {
      console.log(`  Password: ${password}`);
      console.log('  ^ ONE-TIME ONLY — not stored anywhere else. Rotate it after first login.\n');
    } else {
      console.log('  Password: (from ADMIN_PASSWORD env var)\n');
    }
  }
}

await client.end();
