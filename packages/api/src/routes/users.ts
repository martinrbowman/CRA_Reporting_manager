import type { FastifyInstance } from 'fastify';
import { eq, desc, and, gte, lte, ilike } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { db } from '../db/index.js';
import { users, roles, userRoles, auditEvents } from '../db/schema.js';
import { CreateUserSchema, UpdateUserSchema, CreateRoleSchema } from '@cra/shared';
import { audit } from '../lib/audit.js';

export default async function userRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // GET /api/v1/roles
  fastify.get('/roles', auth, async () => {
    return db.select().from(roles).orderBy(roles.roleName);
  });

  // POST /api/v1/roles
  fastify.post('/roles', can('users:write'), async (req, reply) => {
    const body = CreateRoleSchema.parse(req.body);
    const [role] = await db.insert(roles).values({
      roleName: body.roleName,
      description: body.description,
      permissions: body.permissions,
    }).returning();
    await audit(req, 'create', 'role', role!.roleId);
    return reply.code(201).send(role);
  });

  // GET /api/v1/users
  fastify.get('/users', auth, async () => {
    return db.select({
      userId: users.userId,
      email: users.email,
      name: users.name,
      organization: users.organization,
      department: users.department,
      status: users.status,
      mfaEnabled: users.mfaEnabled,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).orderBy(users.name);
  });

  // POST /api/v1/users
  fastify.post('/users', can('users:write'), async (req, reply) => {
    const body = CreateUserSchema.parse(req.body);
    const passwordHash = await argon2.hash(body.password);

    const [user] = await db.insert(users).values({
      email: body.email,
      passwordHash,
      name: body.name,
      organization: body.organization,
      department: body.department,
      jobFunction: body.jobFunction,
      managerId: body.managerId,
    }).returning();

    if (!user) return reply.code(500).send({ error: 'Failed to create user' });

    if (body.roleIds.length > 0) {
      await db.insert(userRoles).values(
        body.roleIds.map((roleId) => ({
          userId: user.userId,
          roleId,
          assignedBy: req.user.email,
        })),
      );
    }

    await audit(req, 'create', 'user', user.userId);
    return reply.code(201).send({ ...user, passwordHash: undefined });
  });

  // GET /api/v1/users/:userId
  fastify.get('/users/:userId', auth, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const [user] = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const { passwordHash: _, ...safe } = user;
    return safe;
  });

  // PATCH /api/v1/users/:userId
  fastify.patch('/users/:userId', can('users:write'), async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const body = UpdateUserSchema.parse(req.body);
    const [updated] = await db.update(users).set({ ...body, updatedAt: new Date() })
      .where(eq(users.userId, userId)).returning();
    if (!updated) return reply.code(404).send({ error: 'User not found' });
    await audit(req, 'update', 'user', userId, body as Record<string, unknown>);
    const { passwordHash: _, ...safe } = updated;
    return safe;
  });

  // POST /api/v1/users/:userId/reset-password
  fastify.post('/users/:userId/reset-password', can('users:write'), async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { newPassword } = req.body as { newPassword: string };
    if (!newPassword || newPassword.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }
    const passwordHash = await argon2.hash(newPassword);
    const [updated] = await db.update(users).set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.userId, userId)).returning({ userId: users.userId });
    if (!updated) return reply.code(404).send({ error: 'User not found' });
    await audit(req, 'reset_password', 'user', userId);
    return { ok: true };
  });

  // DELETE (deactivate) /api/v1/users/:userId
  fastify.delete('/users/:userId', can('users:write'), async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const [updated] = await db.update(users)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(users.userId, userId)).returning({ userId: users.userId });
    if (!updated) return reply.code(404).send({ error: 'User not found' });
    await audit(req, 'deactivate', 'user', userId);
    return { ok: true };
  });

  // GET /api/v1/permissions
  fastify.get('/permissions', auth, async () => {
    const allRoles = await db.select({ permissions: roles.permissions }).from(roles);
    const perms = [...new Set(allRoles.flatMap((r) => (r.permissions as string[]) ?? []))].sort();
    return perms;
  });

  // GET /api/v1/audit-log?objectType=&actor=&from=&to=&limit=&offset=
  fastify.get('/audit-log', auth, async (req) => {
    const { objectType, actor, from, to, limit = '100', offset = '0' } = req.query as Record<string, string>;

    const conditions = [];
    if (objectType) conditions.push(eq(auditEvents.objectType, objectType));
    if (actor) conditions.push(ilike(auditEvents.actor, `%${actor}%`));
    if (from) conditions.push(gte(auditEvents.eventTimestampUtc, new Date(from)));
    if (to) conditions.push(lte(auditEvents.eventTimestampUtc, new Date(to)));

    return db.select().from(auditEvents)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditEvents.eventTimestampUtc))
      .limit(Math.min(Number(limit), 500))
      .offset(Number(offset));
  });

  // GET /api/v1/audit-log/:objectId
  fastify.get('/audit-log/:objectId', auth, async (req) => {
    const { objectId } = req.params as { objectId: string };
    return db.select().from(auditEvents)
      .where(eq(auditEvents.objectId, objectId))
      .orderBy(desc(auditEvents.eventTimestampUtc));
  });
}
