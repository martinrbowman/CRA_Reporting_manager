import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { productVersions } from '../db/schema.js';
import { CreateVersionSchema, UpdateVersionSchema } from '@cra/shared';
import { audit } from '../lib/audit.js';

export default async function versionRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // POST /api/v1/products/:productId/versions
  fastify.post('/products/:productId/versions', can('products:write'), async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const body = CreateVersionSchema.parse(req.body);
    const [version] = await db.insert(productVersions).values({
      productId,
      versionString: body.versionString,
      buildNumber: body.buildNumber,
      commitHash: body.commitHash,
      buildDateUtc: body.buildDateUtc ? new Date(body.buildDateUtc) : undefined,
      releaseType: body.releaseType,
      releaseStatus: body.releaseStatus,
      releaseNotes: body.releaseNotes,
    }).returning();
    await audit(req, 'create', 'version', version!.versionId, { productId });
    return reply.code(201).send(version);
  });

  // GET /api/v1/versions/:versionId
  fastify.get('/versions/:versionId', auth, async (req, reply) => {
    const { versionId } = req.params as { versionId: string };
    const [version] = await db.select().from(productVersions)
      .where(eq(productVersions.versionId, versionId)).limit(1);
    if (!version) return reply.code(404).send({ error: 'Version not found' });
    return version;
  });

  // PATCH /api/v1/versions/:versionId
  fastify.patch('/versions/:versionId', can('products:write'), async (req, reply) => {
    const { versionId } = req.params as { versionId: string };
    const body = UpdateVersionSchema.parse(req.body);
    const update = {
      ...body,
      buildDateUtc: body.buildDateUtc ? new Date(body.buildDateUtc) : undefined,
      updatedAt: new Date(),
    };
    const [updated] = await db.update(productVersions)
      .set(update)
      .where(eq(productVersions.versionId, versionId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Version not found' });
    await audit(req, 'update', 'version', versionId);
    return updated;
  });
}
