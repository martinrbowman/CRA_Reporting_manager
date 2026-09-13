import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { approvals, psirtCases, patches, vulnerabilityCases, craReports } from '../db/schema.js';
import { CreateApprovalSchema, DecideApprovalSchema, ApprovalObjectType } from '@cra/shared';
import { audit } from '../lib/audit.js';

// Trimmed vs. source: only object types relevant to the PSIRT/reporting-only
// fork survive — conformity_assessment, tara, and risk_acceptance were
// dropped along with their modules.
type ObjectType = typeof ApprovalObjectType[number];

async function applyDecision(
  objectType: ObjectType,
  objectId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
) {
  switch (objectType) {
    case 'psirt_case':
      if (decision === 'approved') {
        await db.update(psirtCases)
          .set({ caseStatus: 'closed', updatedAt: new Date() })
          .where(eq(psirtCases.caseId, objectId));
      }
      break;

    case 'patch':
      await db.update(patches)
        .set({ approvalStatus: decision })
        .where(eq(patches.patchId, objectId));
      break;

    case 'vulnerability_severity':
      if (decision === 'approved') {
        await db.update(vulnerabilityCases)
          .set({ triageStatus: 'validated', updatedAt: new Date() })
          .where(eq(vulnerabilityCases.vulnerabilityId, objectId));
      }
      break;

    case 'cra_report':
      if (decision === 'approved') {
        await db.update(craReports)
          .set({ status: 'pending_approval', approvedBy: decidedBy, updatedAt: new Date() })
          .where(eq(craReports.reportId, objectId));
      } else {
        await db.update(craReports)
          .set({ status: 'rejected', rejectionReason: 'Approval rejected', approvedBy: null, updatedAt: new Date() })
          .where(eq(craReports.reportId, objectId));
      }
      break;
  }
}

export default async function approvalRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // GET /api/v1/approvals?objectType=&objectId=&status=
  fastify.get('/approvals', auth, async (req) => {
    const { objectType, objectId, status } = req.query as Record<string, string>;
    const conditions = [];
    if (objectType) conditions.push(eq(approvals.objectType, objectType));
    if (objectId) conditions.push(eq(approvals.objectId, objectId));
    if (status) conditions.push(eq(approvals.status, status as 'pending' | 'approved' | 'rejected' | 'superseded'));
    return db.select().from(approvals)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(approvals.createdAt));
  });

  // POST /api/v1/approvals — submit record for approval
  fastify.post('/approvals', auth, async (req, reply) => {
    const body = CreateApprovalSchema.parse(req.body);

    // Supersede any existing pending approval for same object
    await db.update(approvals)
      .set({ status: 'superseded' })
      .where(and(
        eq(approvals.objectType, body.objectType),
        eq(approvals.objectId, body.objectId),
        eq(approvals.status, 'pending'),
      ));

    if (body.objectType === 'cra_report') {
      // Clear any stale approvedBy from a prior cycle — see the gate in
      // routes/cra-reports.ts, which checks the approvals table directly
      // rather than this field, but a stale value here would still mislead
      // the UI into showing "approved" before the new request is decided.
      await db.update(craReports)
        .set({ status: 'pending_approval', approvedBy: null, updatedAt: new Date() })
        .where(eq(craReports.reportId, body.objectId));
    }

    const [approval] = await db.insert(approvals).values({
      objectType: body.objectType,
      objectId: body.objectId,
      approvalType: body.approvalType,
      requestedBy: req.user.email,
      evidenceReference: body.evidenceReference ?? null,
      delegated: body.delegated ?? false,
      delegatedFrom: body.delegatedFrom ?? null,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
    }).returning();

    await audit(req, 'request_approval', body.objectType, body.objectId, { approvalType: body.approvalType, delegated: body.delegated });
    return reply.code(201).send(approval);
  });

  // PATCH /api/v1/approvals/:approvalId — decide (approvals:write required)
  fastify.patch('/approvals/:approvalId', can('approvals:write'), async (req, reply) => {
    const { approvalId } = req.params as { approvalId: string };
    const body = DecideApprovalSchema.parse(req.body);

    const [existing] = await db.select().from(approvals)
      .where(eq(approvals.approvalId, approvalId)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Approval not found' });
    if (existing.status !== 'pending') {
      return reply.code(409).send({ error: `Approval already ${existing.status}` });
    }

    // Segregation of duties: approver cannot be the same person who requested
    const decidedBy = req.user.email;
    if (decidedBy === existing.requestedBy) {
      return reply.code(403).send({
        error: 'Self-approval not permitted. The approver must be a different user than the requestor.',
      });
    }

    if (existing.expiryDate && new Date(existing.expiryDate) < new Date()) {
      return reply.code(409).send({ error: 'Approval window has expired' });
    }

    const [updated] = await db.update(approvals)
      .set({
        status: body.decision,
        decidedBy,
        decisionDateUtc: new Date(),
        rationale: body.rationale ?? null,
        reviewNotes: body.reviewNotes ?? null,
      })
      .where(eq(approvals.approvalId, approvalId))
      .returning();

    await applyDecision(existing.objectType as ObjectType, existing.objectId, body.decision, decidedBy);
    await audit(req, `approval_${body.decision}`, existing.objectType, existing.objectId, { approvalId, rationale: body.rationale });

    return updated;
  });
}
