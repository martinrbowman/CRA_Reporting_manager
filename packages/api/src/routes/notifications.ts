import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';
import { CreateNotificationSchema, UpdateNotificationSchema } from '@cra/shared';
import { audit } from '../lib/audit.js';
import { sendNotificationEmail } from '../lib/smtp.js';

export default async function notificationRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const can = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  fastify.get('/notifications', auth, async (req) => {
    const q = req.query as { vulnerabilityId?: string; incidentId?: string };
    if (q.vulnerabilityId) {
      return db.query.notifications.findMany({
        where: eq(notifications.vulnerabilityId, q.vulnerabilityId),
        orderBy: [desc(notifications.sentAtUtc)],
      });
    }
    if (q.incidentId) {
      return db.query.notifications.findMany({
        where: eq(notifications.incidentId, q.incidentId),
        orderBy: [desc(notifications.sentAtUtc)],
      });
    }
    return db.query.notifications.findMany({
      orderBy: [desc(notifications.sentAtUtc)],
      limit: 200,
    });
  });

  fastify.post('/notifications', can('notifications:write'), async (req, reply) => {
    const body = CreateNotificationSchema.parse(req.body);
    const [notif] = await db.insert(notifications).values({
      ...body,
      sentAtUtc: new Date(body.sentAtUtc),
    }).returning();
    await audit(req, 'create', 'notification', notif!.notificationId, body as Record<string, unknown>);
    return reply.code(201).send(notif);
  });

  fastify.get('/notifications/:notificationId', auth, async (req, reply) => {
    const { notificationId } = req.params as { notificationId: string };
    const notif = await db.query.notifications.findFirst({
      where: eq(notifications.notificationId, notificationId),
    });
    if (!notif) return reply.code(404).send({ error: 'Notification not found' });
    return notif;
  });

  // POST /api/v1/notifications/:notificationId/send — attempt delivery.
  // Fixed vs. source: routes through lib/smtp.ts's getSmtpConfig() (DB config
  // with env fallback) instead of building a transport from raw env vars
  // directly, so this and the Settings > SMTP tab always agree on config.
  fastify.post('/notifications/:notificationId/send', can('notifications:write'), async (req, reply) => {
    const { notificationId } = req.params as { notificationId: string };
    const notif = await db.query.notifications.findFirst({
      where: eq(notifications.notificationId, notificationId),
    });
    if (!notif) return reply.code(404).send({ error: 'Notification not found' });
    if (notif.deliveryStatus === 'delivered') {
      return reply.code(409).send({ error: 'Already delivered' });
    }

    let deliveryReceipt: string;
    if (notif.recipient) {
      try {
        const result = await sendNotificationEmail(
          notif.subject ?? `CRA Platform notification [${notif.notificationType}]`,
          notif.body ?? '',
          [notif.recipient],
        );
        deliveryReceipt = result ? `smtp:${result.messageId}` : `manual:${new Date().toISOString()}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.update(notifications)
          .set({ deliveryStatus: 'failed', deliveryReceipt: `error:${message}` })
          .where(eq(notifications.notificationId, notificationId));
        return reply.code(502).send({ error: 'SMTP delivery failed', detail: message });
      }
    } else {
      deliveryReceipt = `manual:${new Date().toISOString()}`;
    }

    const [updated] = await db.update(notifications)
      .set({ deliveryStatus: 'sent', deliveryReceipt })
      .where(eq(notifications.notificationId, notificationId))
      .returning();
    await audit(req, 'update', 'notification', notificationId, { deliveryStatus: 'sent' });
    return updated;
  });

  fastify.patch('/notifications/:notificationId', can('notifications:write'), async (req, reply) => {
    const { notificationId } = req.params as { notificationId: string };
    const body = UpdateNotificationSchema.parse(req.body);
    const [updated] = await db.update(notifications)
      .set(body)
      .where(eq(notifications.notificationId, notificationId))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'Notification not found' });
    await audit(req, 'update', 'notification', notificationId, body as Record<string, unknown>);
    return updated;
  });
}
