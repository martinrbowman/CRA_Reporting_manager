import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { psirtCases } from '../db/schema.js';
import { CreatePsirtCaseSchema, UpdatePsirtCaseSchema } from '@cra/shared';
import { audit } from '../lib/audit.js';
import { computeSlaDeadlines, slaStatus } from '../lib/sla.js';

export default async function psirtRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // POST /api/v1/psirt/cases
  fastify.post('/psirt/cases', can('psirt:write'), async (req, reply) => {
    const body = CreatePsirtCaseSchema.parse(req.body);
    const clockStart = new Date();
    const deadlines = computeSlaDeadlines(clockStart);
    const [psirtCase] = await db.insert(psirtCases).values({
      vulnerabilityId: body.vulnerabilityId,
      intakeSource: body.intakeSource,
      reporterCategory: body.reporterCategory,
      initialSummary: body.initialSummary,
      productMatchResult: body.productMatchResult,
      validityDecision: body.validityDecision,
      reproducibilityStatus: body.reproducibilityStatus,
      severityAssessment: body.severityAssessment,
      exposureAssessment: body.exposureAssessment,
      exploitationAssessment: body.exploitationAssessment,
      regulatoryAssessment: body.regulatoryAssessment,
      customerImpactAssessment: body.customerImpactAssessment,
      priority: body.priority,
      assignedOwner: body.assignedOwner,
      slaClockStart: clockStart,
      slaDeadlines: deadlines,
      nextAction: body.nextAction,
    }).returning();
    await audit(req, 'create', 'psirt_case', psirtCase!.caseId);
    return reply.code(201).send(psirtCase);
  });

  // GET /api/v1/psirt/cases
  fastify.get('/psirt/cases', auth, async () => {
    return db.select().from(psirtCases).orderBy(desc(psirtCases.intakeTimestampUtc));
  });

  // GET /api/v1/psirt/cases/:caseId
  fastify.get('/psirt/cases/:caseId', auth, async (req, reply) => {
    const { caseId } = req.params as { caseId: string };
    const [psirtCase] = await db.select().from(psirtCases)
      .where(eq(psirtCases.caseId, caseId)).limit(1);
    if (!psirtCase) return reply.code(404).send({ error: 'PSIRT case not found' });
    return psirtCase;
  });

  // PATCH /api/v1/psirt/cases/:caseId
  fastify.patch('/psirt/cases/:caseId', can('psirt:write'), async (req, reply) => {
    const { caseId } = req.params as { caseId: string };
    const body = UpdatePsirtCaseSchema.parse(req.body);
    const [updated] = await db.update(psirtCases)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(psirtCases.caseId, caseId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'PSIRT case not found' });
    await audit(req, 'update', 'psirt_case', caseId, body as Record<string, unknown>);
    return updated;
  });

  // POST /api/v1/psirt/cases/:caseId/art14-submit
  fastify.post('/psirt/cases/:caseId/art14-submit', can('psirt:write'), async (req, reply) => {
    const { caseId } = req.params as { caseId: string };
    const { type } = req.body as { type: 'earlyWarning' | 'notification' | 'finalReport' };
    const colMap = {
      earlyWarning: { earlyWarningSentAt: new Date() },
      notification: { notificationSentAt: new Date() },
      finalReport: { finalReportSentAt: new Date() },
    } as const;
    if (!colMap[type]) return reply.code(400).send({ error: 'Invalid submission type' });
    const [updated] = await db.update(psirtCases)
      .set({ ...colMap[type], updatedAt: new Date() })
      .where(eq(psirtCases.caseId, caseId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'PSIRT case not found' });
    await audit(req, `art14_submit_${type}`, 'psirt_case', caseId);
    return updated;
  });

  // POST /api/v1/psirt/cases/:caseId/reset-sla
  fastify.post('/psirt/cases/:caseId/reset-sla', can('psirt:write'), async (req, reply) => {
    const { caseId } = req.params as { caseId: string };
    const clockStart = new Date();
    const deadlines = computeSlaDeadlines(clockStart);
    const [updated] = await db.update(psirtCases)
      .set({ slaClockStart: clockStart, slaDeadlines: deadlines, updatedAt: new Date() })
      .where(eq(psirtCases.caseId, caseId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'PSIRT case not found' });
    await audit(req, 'reset_sla', 'psirt_case', caseId);
    return updated;
  });

  // GET /api/v1/psirt/sla-summary
  fastify.get('/psirt/sla-summary', auth, async () => {
    const allOpen = await db.select().from(psirtCases)
      .where(eq(psirtCases.caseStatus, 'open'));

    return allOpen.map((c) => {
      const deadlines = (c.slaDeadlines ?? {}) as Record<string, string>;
      const status = slaStatus(deadlines, c.caseStatus !== 'open');
      const now = Date.now();
      const nextDeadline = Object.entries(deadlines)
        .map(([k, iso]) => ({ key: k, iso, ms: new Date(iso).getTime() - now }))
        .filter((d) => d.ms > 0)
        .sort((a, b) => a.ms - b.ms)[0] ?? null;
      return {
        caseId: c.caseId,
        initialSummary: c.initialSummary,
        priority: c.priority,
        slaStatus: status,
        slaClockStart: c.slaClockStart,
        deadlines,
        nextDeadlineKey: nextDeadline?.key ?? null,
        nextDeadlineIso: nextDeadline?.iso ?? null,
        nextDeadlineMsRemaining: nextDeadline?.ms ?? null,
        assignedOwner: c.assignedOwner,
      };
    });
  });
}
