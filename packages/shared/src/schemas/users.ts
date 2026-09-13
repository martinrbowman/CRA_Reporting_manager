import { z } from 'zod';
import { UserStatus } from '../enums.js';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
  organization: z.string().optional(),
  department: z.string().optional(),
  jobFunction: z.string().optional(),
  managerId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  organization: z.string().optional(),
  department: z.string().optional(),
  jobFunction: z.string().optional(),
  managerId: z.string().uuid().optional(),
  status: z.enum(UserStatus).optional(),
  mfaEnabled: z.boolean().optional(),
});

export const CreateRoleSchema = z.object({
  roleName: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
