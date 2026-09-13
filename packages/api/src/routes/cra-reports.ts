import type { FastifyInstance } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { craReports, vulnerabilityCases, incidents, products, manufacturers, approvals } from '../db/schema.js';
import { CreateCraReportSchema, UpdateCraReportSchema, StartReportQueueSchema } from '@cra/shared';
import { audit } from '../lib/audit.js';
import { REPORT_DEADLINES_MS, reportDeadline, type ReportDeadlineType } from '../lib/sla.js';
import { createReportPdf, type ReportExportData } from '../lib/report-export.js';

export default async function craReportRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // GET /api/v1/cra/reports
  fastify.get('/cra/reports', auth, async (req) => {
    const q = req.query as {
      reportType?: string;
      status?: string;
      vulnerabilityId?: string;
      incidentId?: string;
    };
    const conditions = [];
    if (q.reportType) conditions.push(eq(craReports.reportType, q.reportType as 'early_warning' | 'full_notification' | 'final_report'));
    if (q.status) conditions.push(eq(craReports.status, q.status as 'draft' | 'pending_approval' | 'submitted' | 'rejected'));
    if (q.vulnerabilityId) conditions.push(eq(craReports.vulnerabilityId, q.vulnerabilityId));
    if (q.incidentId) conditions.push(eq(craReports.incidentId, q.incidentId));

    return db.select().from(craReports)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(craReports.createdAt));
  });

  // GET /api/v1/cra/reports/:reportId
  fastify.get('/cra/reports/:reportId', auth, async (req, reply) => {
    const { reportId } = req.params as { reportId: string };
    const [report] = await db.select().from(craReports)
      .where(eq(craReports.reportId, reportId)).limit(1);
    if (!report) return reply.code(404).send({ error: 'CRA report not found' });
    return report;
  });

  // GET /api/v1/cra/reports/:reportId/export.pdf
  fastify.get('/cra/reports/:reportId/export.pdf', auth, async (req, reply) => {
    const { reportId } = req.params as { reportId: string };
    const [report] = await db.select().from(craReports)
      .where(eq(craReports.reportId, reportId)).limit(1);
    if (!report) return reply.code(404).send({ error: 'CRA report not found' });

    let vuln: { externalId: string | null; impactSummary: string | null } | undefined;
    if (report.vulnerabilityId) {
      [vuln] = await db.select({
        externalId: vulnerabilityCases.externalId,
        impactSummary: vulnerabilityCases.impactSummary,
      }).from(vulnerabilityCases).where(eq(vulnerabilityCases.vulnerabilityId, report.vulnerabilityId)).limit(1);
    }

    let product: { productName: string; modelNumber: string | null; manufacturerName: string } | null = null;
    if (report.productId) {
      const [row] = await db.select({
        productName: products.productName,
        modelNumber: products.modelNumber,
        manufacturerName: manufacturers.legalName,
      })
        .from(products)
        .innerJoin(manufacturers, eq(products.manufacturerId, manufacturers.manufacturerId))
        .where(eq(products.productId, report.productId))
        .limit(1);
      product = row ?? null;
    }

    const exportData: ReportExportData = {
      reportId: report.reportId,
      reportType: report.reportType,
      status: report.status,
      regulator: report.regulator,
      referenceNumber: report.referenceNumber,
      deadlineUtc: report.deadlineUtc,
      submittedAtUtc: report.submittedAtUtc,
      submittedBy: report.submittedBy,
      content: (report.content ?? {}) as Record<string, unknown>,
      product,
      vulnerabilityExternalId: vuln?.externalId ?? null,
      vulnerabilitySummary: vuln?.impactSummary ?? null,
    };

    const pdfDoc = createReportPdf(exportData);
    await audit(req, 'export_pdf', 'cra_report', reportId);

    // Piping straight to reply.raw bypasses Fastify's own header-writing step
    // (that only happens on reply.send()) — headers must be set directly on
    // the raw response, and reply.hijack() tells Fastify not to touch the
    // reply itself once we've taken over the response stream.
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cra-report-${report.reportType}-${report.reportId}.pdf"`,
    });
    pdfDoc.pipe(reply.raw);
    pdfDoc.end();
  });

  // POST /api/v1/cra/reports/early-warning
  fastify.post('/cra/reports/early-warning', can('psirt:write'), async (req, reply) => {
    const body = CreateCraReportSchema.parse(req.body);
    const now = new Date();
    const [report] = await db.insert(craReports).values({
      reportType: 'early_warning',
      deadlineUtc: reportDeadline('early_warning', now),
      ...body,
    }).returning();
    await audit(req, 'create', 'cra_report', report!.reportId, { reportType: 'early_warning' });
    return reply.code(201).send(report);
  });

  // POST /api/v1/cra/reports/full-notification
  fastify.post('/cra/reports/full-notification', can('psirt:write'), async (req, reply) => {
    const body = CreateCraReportSchema.parse(req.body);
    const now = new Date();
    const [report] = await db.insert(craReports).values({
      reportType: 'full_notification',
      deadlineUtc: reportDeadline('full_notification', now),
      ...body,
    }).returning();
    await audit(req, 'create', 'cra_report', report!.reportId, { reportType: 'full_notification' });
    return reply.code(201).send(report);
  });

  // POST /api/v1/cra/reports/final-report
  fastify.post('/cra/reports/final-report', can('psirt:write'), async (req, reply) => {
    const body = CreateCraReportSchema.parse(req.body);
    const now = new Date();
    const [report] = await db.insert(craReports).values({
      reportType: 'final_report',
      deadlineUtc: reportDeadline('final_report', now),
      ...body,
    }).returning();
    await audit(req, 'create', 'cra_report', report!.reportId, { reportType: 'final_report' });
    return reply.code(201).send(report);
  });

  // PATCH /api/v1/cra/reports/:reportId
  fastify.patch('/cra/reports/:reportId', can('psirt:write'), async (req, reply) => {
    const { reportId } = req.params as { reportId: string };
    const body = UpdateCraReportSchema.parse(req.body);

    const [existing] = await db.select().from(craReports)
      .where(eq(craReports.reportId, reportId)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'CRA report not found' });
    if (existing.status === 'submitted') {
      return reply.code(409).send({ error: 'Submitted reports cannot be edited' });
    }

    // Maker-checker gate: a report can only be submitted once its most
    // recent approval request (if any) was decided 'approved' — checked
    // against the approvals table directly rather than trusting
    // craReports.status, since 'pending_approval' covers both "awaiting
    // decision" and "approved, not yet submitted" states.
    if (body.status === 'submitted') {
      const [latestApproval] = await db.select({ status: approvals.status })
        .from(approvals)
        .where(and(eq(approvals.objectType, 'cra_report'), eq(approvals.objectId, reportId)))
        .orderBy(desc(approvals.createdAt))
        .limit(1);
      if (!latestApproval || latestApproval.status !== 'approved') {
        return reply.code(409).send({ error: 'Report must be approved before it can be submitted — request approval first.' });
      }
    }

    const submittedAtUtc = body.status === 'submitted' ? new Date() : undefined;
    const submittedBy = body.status === 'submitted' ? req.user.email : undefined;

    const [updated] = await db.update(craReports)
      .set({
        ...body,
        ...(submittedAtUtc ? { submittedAtUtc, submittedBy } : {}),
        updatedAt: new Date(),
      })
      .where(eq(craReports.reportId, reportId))
      .returning();

    await audit(req, 'update', 'cra_report', reportId, body as Record<string, unknown>);
    return updated;
  });

  // POST /api/v1/cra/report-queue/:entityId/start
  fastify.post('/cra/report-queue/:entityId/start', can('psirt:write'), async (req, reply) => {
    const { entityId } = req.params as { entityId: string };
    const body = StartReportQueueSchema.parse(req.body ?? {});

    const [vuln] = await db.select({ vulnerabilityId: vulnerabilityCases.vulnerabilityId, discoveryDate: vulnerabilityCases.discoveryDateUtc })
      .from(vulnerabilityCases)
      .where(eq(vulnerabilityCases.vulnerabilityId, entityId))
      .limit(1);

    const [incident] = !vuln
      ? await db.select({ incidentId: incidents.incidentId, detectionDate: incidents.detectionDateUtc })
          .from(incidents)
          .where(eq(incidents.incidentId, entityId))
          .limit(1)
      : [undefined];

    if (!vuln && !incident) {
      return reply.code(404).send({ error: 'Entity not found in vulnerability_cases or incidents' });
    }

    const clockStart = vuln ? new Date(vuln.discoveryDate) : new Date(incident!.detectionDate);
    const now = new Date();
    const baseTime = clockStart > now ? clockStart : now;

    const sharedFields = {
      vulnerabilityId: vuln ? entityId : undefined,
      incidentId: incident ? entityId : undefined,
      psirtCaseId: body.psirtCaseId,
      productId: body.productId,
      regulator: body.regulator,
      content: {},
    };

    const reportTypes = Object.keys(REPORT_DEADLINES_MS) as ReportDeadlineType[];
    const inserted = await Promise.all(
      reportTypes.map((type) =>
        db.insert(craReports).values({
          reportType: type,
          deadlineUtc: reportDeadline(type, baseTime),
          ...sharedFields,
        }).returning(),
      ),
    );

    const reports = inserted.map((r) => r[0]!);
    for (const r of reports) {
      await audit(req, 'create', 'cra_report', r.reportId, { reportType: r.reportType, source: 'queue_start' });
    }

    return reply.code(201).send({ reports, entityType: vuln ? 'vulnerability' : 'incident', entityId });
  });
}
