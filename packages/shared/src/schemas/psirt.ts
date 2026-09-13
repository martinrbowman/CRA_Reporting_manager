import { z } from 'zod';
import { SeverityLevel, ExploitationStatus } from '../enums.js';

export const CreatePsirtCaseSchema = z.object({
  vulnerabilityId: z.string().uuid().optional(),
  intakeSource: z.string().min(1),
  reporterCategory: z.string().optional(),
  initialSummary: z.string().min(1),
  productMatchResult: z.string().optional(),
  validityDecision: z.string().optional(),
  reproducibilityStatus: z.string().optional(),
  severityAssessment: z.enum(SeverityLevel).optional(),
  exposureAssessment: z.string().optional(),
  exploitationAssessment: z.enum(ExploitationStatus).optional(),
  regulatoryAssessment: z.string().optional(),
  customerImpactAssessment: z.string().optional(),
  priority: z.string().optional(),
  assignedOwner: z.string().optional(),
  slaDeadlines: z.record(z.string()).default({}),
  nextAction: z.string().optional(),
});

export const UpdatePsirtCaseSchema = CreatePsirtCaseSchema.omit({ vulnerabilityId: true }).partial().extend({
  caseStatus: z.enum(['open', 'closed', 'on_hold']).optional(),
});

export type CreatePsirtCaseInput = z.infer<typeof CreatePsirtCaseSchema>;
export type UpdatePsirtCaseInput = z.infer<typeof UpdatePsirtCaseSchema>;
