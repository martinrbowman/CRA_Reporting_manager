import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { incidents } from '../db/schema.js';
import { audit } from '../lib/audit.js';

const CreateIncidentSchema = z.object({
  relatedVulnerabilityId: z.string().uuid().optional(),
  affectedProductIds: z.array(z.string().uuid()).default([]),
  detectionDateUtc: z.string().datetime(),
  confirmationDateUtc: z.string().datetime().optional(),
  incidentCategory: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  exploitationMethod: z.string().optional(),
  impactedSystems: z.array(z.string()).default([]),
  containmentActions: z.string().optional(),
  eradicationActions: z.string().optional(),
  recoveryActions: z.string().optional(),
  forensicEvidence: z.string().optional(),
  rootCause: z.string().optional(),
  lessonsLearned: z.string().optional(),
  regulatorNotified: z.boolean().default(false),
  customerNotified: z.boolean().default(false),
  closureDateUtc: z.string().datetime().optional(),
});

const UpdateIncidentSchema = z.object({
  affectedProductIds: z.array(z.string().uuid()).optional(),
  confirmationDateUtc: z.string().datetime().optional(),
  incidentCategory: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  exploitationMethod: z.string().optional(),
  impactedSystems: z.array(z.string()).optional(),
  containmentActions: z.string().optional(),
  eradicationActions: z.string().optional(),
  recoveryActions: z.string().optional(),
  forensicEvidence: z.string().optional(),
  rootCause: z.string().optional(),
  lessonsLearned: z.string().optional(),
  regulatorNotified: z.boolean().optional(),
  customerNotified: z.boolean().optional(),
  closureDateUtc: z.string().datetime().optional(),
});

export default async function incidentRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  fastify.get('/incidents', auth, async () => {
    return db.query.incidents.findMany({
      orderBy: [desc(incidents.detectionDateUtc)],
    });
  });

  fastify.post('/incidents', can('incidents:write'), async (req, reply) => {
    const body = CreateIncidentSchema.parse(req.body);
    const [incident] = await db.insert(incidents).values({
      ...body,
      detectionDateUtc: new Date(body.detectionDateUtc),
      confirmationDateUtc: body.confirmationDateUtc ? new Date(body.confirmationDateUtc) : undefined,
      closureDateUtc: body.closureDateUtc ? new Date(body.closureDateUtc) : undefined,
    }).returning();
    await audit(req, 'create', 'incident', incident!.incidentId, body as Record<string, unknown>);
    return reply.code(201).send(incident);
  });

  fastify.get('/incidents/:incidentId', auth, async (req, reply) => {
    const { incidentId } = req.params as { incidentId: string };
    const incident = await db.query.incidents.findFirst({
      where: eq(incidents.incidentId, incidentId),
    });
    if (!incident) return reply.code(404).send({ error: 'Incident not found' });
    return incident;
  });

  fastify.patch('/incidents/:incidentId', can('incidents:write'), async (req, reply) => {
    const { incidentId } = req.params as { incidentId: string };
    const body = UpdateIncidentSchema.parse(req.body);
    const { confirmationDateUtc, closureDateUtc, ...rest } = body;
    const [updated] = await db.update(incidents)
      .set({
        ...rest,
        ...(confirmationDateUtc && { confirmationDateUtc: new Date(confirmationDateUtc) }),
        ...(closureDateUtc && { closureDateUtc: new Date(closureDateUtc) }),
      })
      .where(eq(incidents.incidentId, incidentId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Incident not found' });
    await audit(req, 'update', 'incident', incidentId, body as Record<string, unknown>);
    return updated;
  });
}
