import { z } from 'zod';
import { ReleaseType, ReleaseStatus } from '../enums.js';

// Trimmed for the PSIRT/reporting-only fork: build-signing/hardware-targeting/
// feature-flag fields belonged to the dropped conformity/TARA modules.
export const CreateVersionSchema = z.object({
  versionString: z.string().min(1),
  buildNumber: z.string().optional(),
  commitHash: z.string().optional(),
  buildDateUtc: z.string().datetime().optional(),
  releaseType: z.enum(ReleaseType),
  releaseStatus: z.enum(ReleaseStatus).default('planned'),
  releaseNotes: z.string().optional(),
});

export const UpdateVersionSchema = CreateVersionSchema.partial();

export type CreateVersionInput = z.infer<typeof CreateVersionSchema>;
export type UpdateVersionInput = z.infer<typeof UpdateVersionSchema>;
