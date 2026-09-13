import { z } from 'zod';
import { NotificationType, NotificationDeliveryStatus } from '../enums.js';

export const CreateNotificationSchema = z.object({
  vulnerabilityId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  notificationType: z.enum(NotificationType),
  recipientType: z.string().min(1),
  recipient: z.string().optional(),
  sentAtUtc: z.string().datetime(),
  channel: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  deliveryStatus: z.enum(NotificationDeliveryStatus).default('queued'),
});

export const UpdateNotificationSchema = z.object({
  deliveryStatus: z.enum(NotificationDeliveryStatus).optional(),
  deliveryReceipt: z.string().optional(),
  recipient: z.string().optional(),
  body: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof UpdateNotificationSchema>;
