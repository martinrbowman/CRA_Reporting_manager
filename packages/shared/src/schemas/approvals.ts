import { z } from 'zod';
import { ApprovalObjectType } from '../enums.js';

export const CreateApprovalSchema = z.object({
  objectType: z.enum(ApprovalObjectType),
  objectId: z.string().uuid(),
  approvalType: z.string().min(1),
  evidenceReference: z.string().optional(),
  delegated: z.boolean().optional(),
  delegatedFrom: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
});

export const DecideApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  rationale: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export type CreateApprovalInput = z.infer<typeof CreateApprovalSchema>;
export type DecideApprovalInput = z.infer<typeof DecideApprovalSchema>;
