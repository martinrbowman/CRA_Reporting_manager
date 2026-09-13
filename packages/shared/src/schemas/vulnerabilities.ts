import { z } from 'zod';
import { SeverityLevel, ExploitationStatus, TriageStatus, VulnerabilityEventType } from '../enums.js';

export const CreateVulnerabilitySchema = z.object({
  externalId: z.string().optional(),
  productId: z.string().uuid(),
  affectedVersionRange: z.string().min(1),
  affectedComponents: z.array(z.string()).default([]),
  discoveryDateUtc: z.string().datetime(),
  discoverySource: z.string().min(1),
  reporterIdentity: z.string().optional(),
  reporterContact: z.string().optional(),
  intakeChannel: z.string().min(1),
  initialSeverity: z.enum(SeverityLevel),
  currentSeverity: z.enum(SeverityLevel),
  exploitationStatus: z.enum(ExploitationStatus).default('unknown'),
  exploitEvidence: z.string().optional(),
  impactSummary: z.string().optional(),
  exposureScope: z.string().optional(),
  affectedCustomersEstimate: z.number().int().nonnegative().optional(),
  assignedAnalyst: z.string().optional(),
  assignedEngineer: z.string().optional(),
  remediationPlan: z.string().optional(),
  workaroundAvailable: z.boolean().default(false),
  regulatoryReportRequired: z.boolean().default(false),
});

export const UpdateVulnerabilitySchema = CreateVulnerabilitySchema.omit({ productId: true }).partial().extend({
  triageStatus: z.enum(TriageStatus).optional(),
  fixVersionId: z.string().uuid().optional(),
  fixReleaseDateUtc: z.string().datetime().optional(),
  customerAdvisoryDateUtc: z.string().datetime().optional(),
  regulatoryReportSubmittedDateUtc: z.string().datetime().optional(),
  closureDateUtc: z.string().datetime().optional(),
});

export const CreateVulnerabilityEventSchema = z.object({
  eventTimestampUtc: z.string().datetime().optional(),
  eventType: z.enum(VulnerabilityEventType),
  actor: z.string().optional(),
  actionTaken: z.string().optional(),
  decisionMade: z.string().optional(),
  evidenceReference: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateVulnerabilityInput = z.infer<typeof CreateVulnerabilitySchema>;
export type UpdateVulnerabilityInput = z.infer<typeof UpdateVulnerabilitySchema>;
export type CreateVulnerabilityEventInput = z.infer<typeof CreateVulnerabilityEventSchema>;
