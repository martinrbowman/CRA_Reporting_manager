import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patches } from '../db/schema.js';
import { audit } from '../lib/audit.js';

const CreatePatchSchema = z.object({
  vulnerabilityId: z.string().uuid(),
  productId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  fixVersionId: z.string().uuid().optional(),
  patchType: z.string().min(1),
  implementationReference: z.string().optional(),
  testPlan: z.string().optional(),
  testEvidence: z.string().optional(),
  distributionMethod: z.string().optional(),
  rolloutPlan: z.string().optional(),
  rollbackPlan: z.string().optional(),
  advisoryReference: z.string().optional(),
  customerInstructions: z.string().optional(),
  releaseDateUtc: z.string().datetime().optional(),
});

const UpdatePatchSchema = z.object({
  patchType: z.string().optional(),
  implementationReference: z.string().optional(),
  testPlan: z.string().optional(),
  testEvidence: z.string().optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected', 'superseded']).optional(),
  releaseDateUtc: z.string().datetime().optional(),
  distributionMethod: z.string().optional(),
  rolloutPlan: z.string().optional(),
  rolloutStatus: z.string().optional(),
  rollbackPlan: z.string().optional(),
  advisoryReference: z.string().optional(),
  customerInstructions: z.string().optional(),
  verificationStatus: z.string().optional(),
  fixVersionId: z.string().uuid().optional(),
});

export default async function patchRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  fastify.get('/patches', auth, async (req) => {
    const { vulnerabilityId } = req.query as { vulnerabilityId?: string };
    if (vulnerabilityId) {
      return db.query.patches.findMany({
        where: eq(patches.vulnerabilityId, vulnerabilityId),
        orderBy: [desc(patches.createdAt)],
      });
    }
    return db.query.patches.findMany({ orderBy: [desc(patches.createdAt)] });
  });

  fastify.post('/patches', can('vulnerabilities:write'), async (req, reply) => {
    const body = CreatePatchSchema.parse(req.body);
    const [patch] = await db.insert(patches).values({
      ...body,
      releaseDateUtc: body.releaseDateUtc ? new Date(body.releaseDateUtc) : undefined,
    }).returning();
    await audit(req, 'create', 'patch', patch!.patchId, body as Record<string, unknown>);
    return reply.code(201).send(patch);
  });

  fastify.get('/patches/:patchId', auth, async (req, reply) => {
    const { patchId } = req.params as { patchId: string };
    const patch = await db.query.patches.findFirst({ where: eq(patches.patchId, patchId) });
    if (!patch) return reply.code(404).send({ error: 'Patch not found' });
    return patch;
  });

  fastify.patch('/patches/:patchId', can('vulnerabilities:write'), async (req, reply) => {
    const { patchId } = req.params as { patchId: string };
    const body = UpdatePatchSchema.parse(req.body);
    const { releaseDateUtc, ...rest } = body;
    const [updated] = await db.update(patches)
      .set({ ...rest, ...(releaseDateUtc && { releaseDateUtc: new Date(releaseDateUtc) }) })
      .where(eq(patches.patchId, patchId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Patch not found' });
    await audit(req, 'update', 'patch', patchId, body as Record<string, unknown>);
    return updated;
  });

  fastify.delete('/patches/:patchId', can('vulnerabilities:write'), async (req, reply) => {
    const { patchId } = req.params as { patchId: string };
    const [deleted] = await db.delete(patches).where(eq(patches.patchId, patchId)).returning();
    if (!deleted) return reply.code(404).send({ error: 'Patch not found' });
    await audit(req, 'delete', 'patch', patchId, {});
    return reply.code(204).send();
  });
}
