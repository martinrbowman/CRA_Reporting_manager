import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { platformSettings } from '../db/schema.js';
import { audit } from '../lib/audit.js';
import { sendTestEmail } from '../lib/smtp.js';
import { getLdapConfig, reloadLdapConfig, maskedLdapStatus } from '../lib/ldap-config.js';
import ldap from 'ldapjs';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface OauthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  tenantId?: string;      // Microsoft Entra ID only
  discoveryUrl?: string;  // generic OIDC only
}

export interface OauthConfig {
  microsoft: OauthProviderConfig;
  oidc: OauthProviderConfig;
}

const SmtpSchema = z.object({
  host: z.string(),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().default(''),
  pass: z.string().default(''),
  from: z.string().default(''),
});

const OauthProviderSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().default(''),
  clientSecret: z.string().default(''),
  tenantId: z.string().optional(),
  discoveryUrl: z.string().optional(),
});

const OauthSchema = z.object({
  microsoft: OauthProviderSchema,
  oidc: OauthProviderSchema,
});

const SMTP_DEFAULTS: SmtpConfig = { host: '', port: 587, secure: false, user: '', pass: '', from: '' };
const OAUTH_DEFAULTS: OauthConfig = {
  microsoft: { enabled: false, clientId: '', clientSecret: '', tenantId: '' },
  oidc: { enabled: false, clientId: '', clientSecret: '', discoveryUrl: '' },
};

async function getSetting<T>(key: string, defaults: T): Promise<T> {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  return row ? { ...defaults, ...(row.value as Partial<T>) } : defaults;
}

async function upsertSetting(key: string, value: unknown, actor: string) {
  await db.insert(platformSettings)
    .values({ key, value: value as Record<string, unknown>, updatedBy: actor })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: value as Record<string, unknown>, updatedAt: new Date(), updatedBy: actor },
    });
}

export default async function settingsRoutes(fastify: FastifyInstance) {
  const admin = (p: string) => ({ preHandler: [fastify.requirePermission(p)] });

  // ── SMTP ────────────────────────────────────────────────────────────────────

  fastify.get('/settings/smtp', admin('users:write'), async () => {
    const cfg = await getSetting<SmtpConfig>('smtp', SMTP_DEFAULTS);
    return { ...cfg, pass: cfg.pass ? '••••••••' : '' };
  });

  fastify.patch('/settings/smtp', admin('users:write'), async (req) => {
    const body = SmtpSchema.parse(req.body);
    const existing = await getSetting<SmtpConfig>('smtp', SMTP_DEFAULTS);
    const toSave: SmtpConfig = {
      ...body,
      pass: body.pass === '••••••••' ? existing.pass : body.pass,
    };
    await upsertSetting('smtp', toSave, req.user.email);
    await audit(req, 'update', 'platform_setting', 'smtp', { host: toSave.host });
    return { ok: true };
  });

  fastify.post('/settings/smtp/test', admin('users:write'), async (req, reply) => {
    const { to } = req.body as { to?: string };
    const cfg = await getSetting<SmtpConfig>('smtp', SMTP_DEFAULTS);
    if (!cfg.host) return reply.code(400).send({ error: 'SMTP not configured' });
    try {
      await sendTestEmail(cfg, to ?? req.user.email);
      return { ok: true };
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  // ── OAuth / Entra ID ──────────────────────────────────────────────────────────

  fastify.get('/settings/oauth', admin('users:write'), async () => {
    const cfg = await getSetting<OauthConfig>('oauth', OAUTH_DEFAULTS);
    const mask = (p: OauthProviderConfig): OauthProviderConfig => ({
      ...p,
      clientSecret: p.clientSecret ? '••••••••' : '',
    });
    return { microsoft: mask(cfg.microsoft), oidc: mask(cfg.oidc) };
  });

  fastify.patch('/settings/oauth', admin('users:write'), async (req) => {
    const body = OauthSchema.parse(req.body);
    const existing = await getSetting<OauthConfig>('oauth', OAUTH_DEFAULTS);
    const merge = (incoming: OauthProviderConfig, prev: OauthProviderConfig): OauthProviderConfig => ({
      ...incoming,
      clientSecret: incoming.clientSecret === '••••••••' ? prev.clientSecret : incoming.clientSecret,
    });
    const toSave: OauthConfig = {
      microsoft: merge(body.microsoft, existing.microsoft),
      oidc: merge(body.oidc, existing.oidc),
    };
    await upsertSetting('oauth', toSave, req.user.email);
    await audit(req, 'update', 'platform_setting', 'oauth', {
      providers: Object.entries(toSave).filter(([, v]) => v.enabled).map(([k]) => k),
    });
    return { ok: true };
  });

  // Public — login page uses this to show enabled provider buttons.
  fastify.get('/settings/oauth/providers', async () => {
    const cfg = await getSetting<OauthConfig>('oauth', OAUTH_DEFAULTS);
    return {
      microsoft: cfg.microsoft.enabled,
      oidc: cfg.oidc.enabled && !!cfg.oidc.discoveryUrl,
    };
  });

  // ── LDAP / AD (file-based config, read-only through the API) ─────────────────

  // Public — login page uses this to decide whether to try /auth/ldap first.
  fastify.get('/settings/auth-methods', async () => {
    const cfg = getLdapConfig();
    return { ldapEnabled: !!cfg?.enabled };
  });

  fastify.get('/settings/ldap', admin('users:write'), async () => {
    return maskedLdapStatus();
  });

  fastify.post('/settings/ldap/reload', admin('users:write'), async (req) => {
    const cfg = reloadLdapConfig();
    await audit(req, 'reload', 'platform_setting', 'ldap', { enabled: cfg?.enabled ?? false });
    return maskedLdapStatus();
  });

  fastify.post('/settings/ldap/test', admin('users:write'), async (req, reply) => {
    const cfg = getLdapConfig();
    if (!cfg) return reply.code(400).send({ error: 'config/ldap.yml not found or invalid' });
    const client = ldap.createClient({
      url: `${cfg.useTLS ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port}`,
      timeout: 5000,
      connectTimeout: 5000,
    });
    // See lib/ldap-auth.ts's createClient — without this, a connection-level
    // failure here crashes the whole API process, not just this request.
    client.on('error', () => {});
    try {
      await new Promise<void>((resolve, reject) => {
        client.bind(cfg.bindDN, cfg.bindCredentials, (err) => (err ? reject(err) : resolve()));
      });
      await audit(req, 'test_connection', 'platform_setting', 'ldap', { ok: true });
      return { ok: true };
    } catch (err) {
      await audit(req, 'test_connection', 'platform_setting', 'ldap', { ok: false });
      return reply.code(502).send({ error: (err as Error).message });
    } finally {
      client.unbind();
    }
  });
}
