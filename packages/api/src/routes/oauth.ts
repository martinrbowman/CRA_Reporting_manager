import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userOauthAccounts, platformSettings } from '../db/schema.js';
import { issueTokenPair } from '../lib/tokens.js';
import type { OauthConfig, OauthProviderConfig } from './settings.js';

// Entra ID only (+ a generic-OIDC escape hatch) — Google/GitHub dropped per
// the fork's scope. "microsoft" here already IS Entra ID OAuth2/OIDC
// (login.microsoftonline.com/{tenantId}/... v2.0 endpoints) — no new auth
// protocol work needed, just user-facing relabeling.
const OAUTH_DEFAULTS: OauthConfig = {
  microsoft: { enabled: false, clientId: '', clientSecret: '', tenantId: '' },
  oidc: { enabled: false, clientId: '', clientSecret: '', discoveryUrl: '' },
};

// In-memory CSRF state store. Acceptable for a single-instance deployment
// (this platform's target); would need a DB-backed nonce table if ever run
// as >1 API replica behind a load balancer.
const stateStore = new Map<string, { provider: string; expiresAt: number }>();

function pruneStates() {
  const now = Date.now();
  for (const [k, v] of stateStore) if (v.expiresAt < now) stateStore.delete(k);
}

async function getOauthConfig(): Promise<OauthConfig> {
  const [row] = await db.select().from(platformSettings)
    .where(eq(platformSettings.key, 'oauth')).limit(1);
  return row ? { ...OAUTH_DEFAULTS, ...(row.value as Partial<OauthConfig>) } : OAUTH_DEFAULTS;
}

interface UserInfo { providerId: string; email: string; name: string }

async function exchangeMicrosoftCode(code: string, redirectUri: string, cfg: OauthProviderConfig): Promise<UserInfo> {
  const tenant = cfg.tenantId || 'organizations';
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, grant_type: 'authorization_code',
      client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri,
      scope: 'openid profile email',
    }),
  });
  const tokens = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokens.access_token) throw new Error(tokens.error ?? 'Microsoft Entra ID token exchange failed');

  const infoRes = await fetch('https://graph.microsoft.com/oidc/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const info = await infoRes.json() as { sub: string; email: string; name: string };
  return { providerId: info.sub, email: info.email, name: info.name };
}

async function exchangeOidcCode(code: string, redirectUri: string, cfg: OauthProviderConfig): Promise<UserInfo> {
  if (!cfg.discoveryUrl) throw new Error('OIDC discovery URL not configured');
  const disc = await fetch(`${cfg.discoveryUrl.replace(/\/$/, '')}/.well-known/openid-configuration`);
  const { token_endpoint, userinfo_endpoint } = await disc.json() as { token_endpoint: string; userinfo_endpoint: string };

  const tokenRes = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, grant_type: 'authorization_code',
      client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri,
    }),
  });
  const tokens = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokens.access_token) throw new Error(tokens.error ?? 'OIDC token exchange failed');

  const infoRes = await fetch(userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const info = await infoRes.json() as { sub: string; email: string; name: string };
  return { providerId: info.sub, email: info.email, name: info.name };
}

async function findOrCreateOauthUser(provider: string, userInfo: UserInfo): Promise<string> {
  const [existing] = await db.select({ userId: userOauthAccounts.userId })
    .from(userOauthAccounts)
    .where(and(eq(userOauthAccounts.provider, provider), eq(userOauthAccounts.providerId, userInfo.providerId)))
    .limit(1);
  if (existing) return existing.userId;

  const [byEmail] = await db.select({ userId: users.userId })
    .from(users).where(eq(users.email, userInfo.email)).limit(1);

  let userId: string;
  if (byEmail) {
    userId = byEmail.userId;
  } else {
    const [created] = await db.insert(users).values({
      email: userInfo.email,
      name: userInfo.name,
      passwordHash: '',
    }).returning({ userId: users.userId });
    userId = created!.userId;
  }

  await db.insert(userOauthAccounts).values({
    userId, provider, providerId: userInfo.providerId, providerEmail: userInfo.email,
  }).onConflictDoNothing();

  return userId;
}

export default async function oauthRoutes(fastify: FastifyInstance) {
  const base = process.env['CORS_ORIGIN'] ?? 'http://localhost';

  function callbackUri(provider: string) {
    const apiBase = process.env['API_PUBLIC_URL'] ?? base.replace(/:\d+$/, ':3001');
    return `${apiBase}/api/v1/oauth/${provider}/callback`;
  }

  fastify.get('/oauth/:provider', async (req, reply) => {
    const { provider } = req.params as { provider: string };
    const cfg = await getOauthConfig();
    pruneStates();

    const state = crypto.randomUUID();
    stateStore.set(state, { provider, expiresAt: Date.now() + 10 * 60_000 });

    let url: URL;

    if (provider === 'microsoft' && cfg.microsoft.enabled) {
      const tenant = cfg.microsoft.tenantId || 'organizations';
      url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
      url.searchParams.set('client_id', cfg.microsoft.clientId);
      url.searchParams.set('redirect_uri', callbackUri('microsoft'));
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
    } else if (provider === 'oidc' && cfg.oidc.enabled && cfg.oidc.discoveryUrl) {
      const disc = await fetch(`${cfg.oidc.discoveryUrl.replace(/\/$/, '')}/.well-known/openid-configuration`);
      const { authorization_endpoint } = await disc.json() as { authorization_endpoint: string };
      url = new URL(authorization_endpoint);
      url.searchParams.set('client_id', cfg.oidc.clientId);
      url.searchParams.set('redirect_uri', callbackUri('oidc'));
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
    } else {
      return reply.code(404).send({ error: 'Provider not enabled' });
    }

    return reply.redirect(url.toString());
  });

  fastify.get('/oauth/:provider/callback', async (req, reply) => {
    const { provider } = req.params as { provider: string };
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return reply.redirect(`${base}/login?oauth_error=${encodeURIComponent(error)}`);
    }

    const storedState = stateStore.get(state);
    if (!storedState || storedState.provider !== provider || storedState.expiresAt < Date.now()) {
      return reply.redirect(`${base}/login?oauth_error=invalid_state`);
    }
    stateStore.delete(state);

    const cfg = await getOauthConfig();
    let userInfo: UserInfo;

    try {
      if (provider === 'microsoft') userInfo = await exchangeMicrosoftCode(code, callbackUri('microsoft'), cfg.microsoft);
      else if (provider === 'oidc') userInfo = await exchangeOidcCode(code, callbackUri('oidc'), cfg.oidc);
      else return reply.redirect(`${base}/login?oauth_error=unknown_provider`);
    } catch (err) {
      fastify.log.error(err, `[oauth] ${provider} exchange failed`);
      return reply.redirect(`${base}/login?oauth_error=exchange_failed`);
    }

    let userId: string;
    try {
      userId = await findOrCreateOauthUser(provider, userInfo);
    } catch (err) {
      fastify.log.error(err, '[oauth] user lookup/create failed');
      return reply.redirect(`${base}/login?oauth_error=user_error`);
    }

    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.userId, userId)).limit(1);

    // Fixed vs. source: roles are resolved (not hardcoded to []) so SSO users
    // get the same role-based UI behavior as local/LDAP logins. Also fixed:
    // the refresh token is now passed through too (source only sent
    // accessToken), so SSO sessions can silently refresh like local/LDAP
    // ones instead of forcing a full re-auth every JWT_EXPIRY window.
    const tokens = await issueTokenPair(fastify, userId, user!.email);

    return reply.redirect(
      `${base}/#/oauth-callback?accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`,
    );
  });
}
