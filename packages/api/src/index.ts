import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fp from 'fastify-plugin';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import versionRoutes from './routes/versions.js';
import vulnerabilityRoutes from './routes/vulnerabilities.js';
import psirtRoutes from './routes/psirt.js';
import notificationRoutes from './routes/notifications.js';
import incidentRoutes from './routes/incidents.js';
import adminRoutes from './routes/admin.js';
import approvalRoutes from './routes/approvals.js';
import patchRoutes from './routes/patches.js';
import craReportRoutes from './routes/cra-reports.js';
import settingsRoutes from './routes/settings.js';
import oauthRoutes from './routes/oauth.js';
import { loadLdapConfig } from './lib/ldap-config.js';

const PORT = Number(process.env['API_PORT'] ?? 3001);
const HOST = process.env['API_HOST'] ?? '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
    transport: process.env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameSrc: ["'none'"],
      formAction: ["'none'"],
    },
  },
});

const corsOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';
if (corsOrigin === '*') {
  throw new Error('CORS_ORIGIN cannot be wildcard — set a specific origin (credentials:true is incompatible with wildcard)');
}
await fastify.register(cors, {
  origin: corsOrigin,
  credentials: true,
});
await fastify.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — no SBOM/evidence uploads in this fork
});

// Load LDAP config once at boot (config/ldap.yml, ops-managed — see lib/ldap-config.ts).
// Absence is not fatal: LDAP is optional, local/OAuth auth still work.
try {
  const ldapCfg = loadLdapConfig();
  fastify.log.info(`LDAP auth: ${ldapCfg?.enabled ? 'enabled' : 'not configured'}`);
} catch (err) {
  fastify.log.error(err, 'Failed to load config/ldap.yml — LDAP auth disabled');
}

// Auth plugin (decorates fastify.authenticate)
await fastify.register(fp(authPlugin));

// All routes under /api/v1
await fastify.register(async (v1) => {
  await v1.register(authRoutes);
  await v1.register(userRoutes);
  await v1.register(productRoutes);
  await v1.register(versionRoutes);
  await v1.register(vulnerabilityRoutes);
  await v1.register(psirtRoutes);
  await v1.register(notificationRoutes);
  await v1.register(incidentRoutes);
  await v1.register(adminRoutes);
  await v1.register(approvalRoutes);
  await v1.register(patchRoutes);
  await v1.register(craReportRoutes);
  await v1.register(settingsRoutes);
  await v1.register(oauthRoutes);
}, { prefix: '/api/v1' });

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler
fastify.setErrorHandler((error, _req, reply) => {
  fastify.log.error(error);

  if (error.name === 'ZodError') {
    return reply.code(400).send({ error: 'Validation error', details: error.message });
  }
  if (error.statusCode) {
    const code = error.statusCode as number;
    return reply.code(code).send({ error: code >= 500 ? 'Internal server error' : error.message });
  }
  return reply.code(500).send({ error: 'Internal server error' });
});

try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`CRA API listening on ${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
