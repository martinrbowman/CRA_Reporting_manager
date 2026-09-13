import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (permission: string) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  await fastify.register(jwt, {
    secret,
    sign: { expiresIn: process.env['JWT_EXPIRY'] ?? '8h' },
  });

  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.decorate('requirePermission', (permission: string) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
        if (!req.user.permissions.includes(permission)) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    };
  });
});
