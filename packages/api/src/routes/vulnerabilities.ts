import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vulnerabilityCases, vulnerabilityEvents } from '../db/schema.js';
import { CreateVulnerabilitySchema, UpdateVulnerabilitySchema, CreateVulnerabilityEventSchema } from '@cra/shared';
import { audit } from '../lib/audit.js';

export default async function vulnerabilityRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // POST /api/v1/vulnerabilities
  fastify.post('/vulnerabilities', can('vulnerabilities:write'), async (req, reply) => {
    const body = CreateVulnerabilitySchema.parse(req.body);
    const [vuln] = await db.insert(vulnerabilityCases).values({
      externalId: body.externalId,
      productId: body.productId,
      affectedVersionRange: body.affectedVersionRange,
      affectedComponents: body.affectedComponents,
      discoveryDateUtc: new Date(body.discoveryDateUtc),
      discoverySource: body.discoverySource,
      reporterIdentity: body.reporterIdentity,
      reporterContact: body.reporterContact,
      intakeChannel: body.intakeChannel,
      initialSeverity: body.initialSeverity,
      currentSeverity: body.currentSeverity,
      exploitationStatus: body.exploitationStatus,
      exploitEvidence: body.exploitEvidence,
      impactSummary: body.impactSummary,
      exposureScope: body.exposureScope,
      affectedCustomersEstimate: body.affectedCustomersEstimate,
      assignedAnalyst: body.assignedAnalyst,
      assignedEngineer: body.assignedEngineer,
      remediationPlan: body.remediationPlan,
      workaroundAvailable: body.workaroundAvailable,
      regulatoryReportRequired: body.regulatoryReportRequired,
    }).returning();

    await db.insert(vulnerabilityEvents).values({
      vulnerabilityId: vuln!.vulnerabilityId,
      eventType: 'Received',
      actor: req.user.email,
      actionTaken: 'Vulnerability case created',
      notes: `Intake channel: ${body.intakeChannel}`,
    });

    await audit(req, 'create', 'vulnerability', vuln!.vulnerabilityId);
    return reply.code(201).send(vuln);
  });

  // GET /api/v1/vulnerabilities
  fastify.get('/vulnerabilities', auth, async () => {
    return db.select().from(vulnerabilityCases)
      .orderBy(desc(vulnerabilityCases.discoveryDateUtc));
  });

  // GET /api/v1/vulnerabilities/:vulnerabilityId
  fastify.get('/vulnerabilities/:vulnerabilityId', auth, async (req, reply) => {
    const { vulnerabilityId } = req.params as { vulnerabilityId: string };
    const [vuln] = await db.select().from(vulnerabilityCases)
      .where(eq(vulnerabilityCases.vulnerabilityId, vulnerabilityId)).limit(1);
    if (!vuln) return reply.code(404).send({ error: 'Vulnerability not found' });
    return vuln;
  });

  // PATCH /api/v1/vulnerabilities/:vulnerabilityId
  fastify.patch('/vulnerabilities/:vulnerabilityId', can('vulnerabilities:write'), async (req, reply) => {
    const { vulnerabilityId } = req.params as { vulnerabilityId: string };
    const body = UpdateVulnerabilitySchema.parse(req.body);
    const { discoveryDateUtc, fixReleaseDateUtc, customerAdvisoryDateUtc,
            regulatoryReportSubmittedDateUtc, closureDateUtc, ...rest } = body;
    const [updated] = await db.update(vulnerabilityCases)
      .set({
        ...rest,
        ...(discoveryDateUtc && { discoveryDateUtc: new Date(discoveryDateUtc) }),
        ...(fixReleaseDateUtc && { fixReleaseDateUtc: new Date(fixReleaseDateUtc) }),
        ...(customerAdvisoryDateUtc && { customerAdvisoryDateUtc: new Date(customerAdvisoryDateUtc) }),
        ...(regulatoryReportSubmittedDateUtc && { regulatoryReportSubmittedDateUtc: new Date(regulatoryReportSubmittedDateUtc) }),
        ...(closureDateUtc && { closureDateUtc: new Date(closureDateUtc) }),
        updatedAt: new Date(),
      })
      .where(eq(vulnerabilityCases.vulnerabilityId, vulnerabilityId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Vulnerability not found' });
    await audit(req, 'update', 'vulnerability', vulnerabilityId, body as Record<string, unknown>);
    return updated;
  });

  // POST /api/v1/vulnerabilities/:vulnerabilityId/events
  fastify.post('/vulnerabilities/:vulnerabilityId/events', can('vulnerabilities:write'), async (req, reply) => {
    const { vulnerabilityId } = req.params as { vulnerabilityId: string };
    const body = CreateVulnerabilityEventSchema.parse(req.body);
    const [event] = await db.insert(vulnerabilityEvents).values({
      vulnerabilityId,
      eventTimestampUtc: body.eventTimestampUtc ? new Date(body.eventTimestampUtc) : new Date(),
      eventType: body.eventType,
      actor: body.actor ?? req.user.email,
      actionTaken: body.actionTaken,
      decisionMade: body.decisionMade,
      evidenceReference: body.evidenceReference,
      notes: body.notes,
    }).returning();
    await audit(req, 'create', 'vulnerability_event', event!.eventId, { vulnerabilityId });
    return reply.code(201).send(event);
  });

  // GET /api/v1/vulnerabilities/:vulnerabilityId/events
  fastify.get('/vulnerabilities/:vulnerabilityId/events', auth, async (req) => {
    const { vulnerabilityId } = req.params as { vulnerabilityId: string };
    return db.select().from(vulnerabilityEvents)
      .where(eq(vulnerabilityEvents.vulnerabilityId, vulnerabilityId))
      .orderBy(vulnerabilityEvents.eventTimestampUtc);
  });
}
