import type { FastifyInstance } from 'fastify';
import { eq, and, gt, isNull } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import { LoginSchema, RefreshSchema, LdapLoginSchema } from '@cra/shared';
import { issueTokenPair } from '../lib/tokens.js';
import { getLdapConfig } from '../lib/ldap-config.js';
import { authenticateLdap } from '../lib/ldap-auth.js';

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/token — local email+password login
  fastify.post('/auth/token', async (req, reply) => {
    const body = LoginSchema.parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user || user.status !== 'active' || !user.passwordHash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

    const tokens = await issueTokenPair(fastify, user.userId, user.email);
    return tokens;
  });

  // POST /api/v1/auth/ldap — AD/LDAP bind login. Tried first by the web client
  // when LDAP is enabled (see GET /settings/auth-methods), falling back to
  // /auth/token on failure.
  fastify.post('/auth/ldap', async (req, reply) => {
    const cfg = getLdapConfig();
    if (!cfg || !cfg.enabled) return reply.code(404).send({ error: 'LDAP not enabled' });

    const body = LdapLoginSchema.parse(req.body);
    let result;
    try {
      result = await authenticateLdap(cfg, body.username, body.password);
    } catch (err) {
      fastify.log.error(err, '[ldap] authentication error');
      return reply.code(502).send({ error: 'LDAP server error' });
    }
    if (!result) return reply.code(401).send({ error: 'Invalid credentials' });

    const [user] = await db.select().from(users).where(eq(users.userId, result.userId)).limit(1);
    if (!user || user.status !== 'active') return reply.code(401).send({ error: 'Unauthorized' });

    const tokens = await issueTokenPair(fastify, user.userId, user.email);
    return tokens;
  });

  // POST /api/v1/auth/refresh
  fastify.post('/auth/refresh', async (req, reply) => {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ))
      .limit(1);

    if (!stored) return reply.code(401).send({ error: 'Invalid or expired refresh token' });

    const [user] = await db.select().from(users).where(eq(users.userId, stored.userId)).limit(1);
    if (!user || user.status !== 'active') return reply.code(401).send({ error: 'Unauthorized' });

    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenId, stored.tokenId));

    const tokens = await issueTokenPair(fastify, user.userId, user.email);
    return tokens;
  });

  // GET /api/v1/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req) => {
    const [user] = await db
      .select({
        userId: users.userId,
        email: users.email,
        name: users.name,
        organization: users.organization,
        department: users.department,
        status: users.status,
        mfaEnabled: users.mfaEnabled,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.userId, req.user.sub))
      .limit(1);

    return user;
  });

  // POST /api/v1/me/change-password
  fastify.post('/me/change-password', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 12) {
      return reply.code(400).send({ error: 'New password must be at least 12 characters' });
    }

    const [user] = await db.select().from(users).where(eq(users.userId, req.user.sub)).limit(1);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) return reply.code(401).send({ error: 'Current password incorrect' });

    const newHash = await argon2.hash(newPassword);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.userId, req.user.sub));

    return { ok: true };
  });
}
