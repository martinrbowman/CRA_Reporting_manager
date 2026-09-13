import { randomBytes, createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, userRoles, roles, refreshTokens } from '../db/schema.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 28800; // 8h, matches default JWT_EXPIRY

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Shared by local login, OAuth callback, and LDAP login so role/permission
// resolution and refresh-token issuance aren't triplicated across auth routes.
export async function issueTokenPair(fastify: FastifyInstance, userId: string, email: string): Promise<TokenPair> {
  const userRoleRows = await db
    .select({ roleName: roles.roleName, permissions: roles.permissions })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.roleId))
    .where(eq(userRoles.userId, userId));

  const roleNames = userRoleRows.map((r) => r.roleName);
  const permissions = [...new Set(userRoleRows.flatMap((r) => (r.permissions as string[]) ?? []))];

  const accessToken = fastify.jwt.sign({ sub: userId, email, roles: roleNames, permissions });

  const rawRefresh = randomBytes(48).toString('hex');
  const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.userId, userId));

  return { accessToken, refreshToken: rawRefresh, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}
