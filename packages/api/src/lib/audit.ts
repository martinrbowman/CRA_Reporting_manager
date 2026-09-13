import { db } from '../db/index.js';
import { auditEvents } from '../db/schema.js';
import type { FastifyRequest } from 'fastify';

export async function audit(
  req: FastifyRequest,
  action: string,
  objectType: string,
  objectId: string,
  details?: Record<string, unknown>,
) {
  const actor = (req.user as { email?: string } | undefined)?.email ?? 'system';
  const ip = req.ip;

  await db.insert(auditEvents).values({
    actor,
    action,
    objectType,
    objectId,
    details: details ?? null,
    ipAddress: ip,
  });
}
