import { z } from 'zod';
import { CraReportStatus } from '../enums.js';

export const CreateCraReportSchema = z.object({
  vulnerabilityId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  psirtCaseId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  regulator: z.string().optional(),
  content: z.record(z.unknown()).optional().default({}),
});

export const UpdateCraReportSchema = z.object({
  status: z.enum(CraReportStatus).optional(),
  regulator: z.string().optional(),
  referenceNumber: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  approvedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const StartReportQueueSchema = z.object({
  productId: z.string().uuid().optional(),
  regulator: z.string().optional(),
  psirtCaseId: z.string().uuid().optional(),
});

export type CreateCraReportInput = z.infer<typeof CreateCraReportSchema>;
export type UpdateCraReportInput = z.infer<typeof UpdateCraReportSchema>;
export type StartReportQueueInput = z.infer<typeof StartReportQueueSchema>;
