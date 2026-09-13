import ldap from 'ldapjs';
import { eq, and } from 'drizzle-orm';
import type { LdapConfig } from '@cra/shared';
import { db } from '../db/index.js';
import { users, userLdapAccounts, roles, userRoles } from '../db/schema.js';

interface LdapAttribute { type: string; values: string[] }
interface LdapEntryPojo { objectName: string; attributes: LdapAttribute[] }

function createClient(cfg: LdapConfig) {
  const url = `${cfg.useTLS ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port}`;
  const client = ldap.createClient({ url, timeout: 5000, connectTimeout: 5000 });
  // ldapjs emits 'error' on the client for connection-level failures (DNS
  // failure, refused connection, etc.) in addition to passing an error to
  // the pending operation's callback — without a listener here, that's an
  // unhandled EventEmitter error and crashes the whole process.
  client.on('error', () => {});
  return client;
}

function bindAsync(client: ldap.Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => (err ? reject(err) : resolve()));
  });
}

function searchAsync(client: ldap.Client, base: string, options: ldap.SearchOptions): Promise<LdapEntryPojo[]> {
  return new Promise((resolve, reject) => {
    const entries: LdapEntryPojo[] = [];
    client.search(base, options, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => entries.push(entry.pojo as unknown as LdapEntryPojo));
      res.on('error', reject);
      res.on('end', () => resolve(entries));
    });
  });
}

function attr(entry: LdapEntryPojo, type: string): string[] {
  return entry.attributes.find((a) => a.type.toLowerCase() === type.toLowerCase())?.values ?? [];
}

function cnOf(dnOrCn: string): string {
  const match = /^cn=([^,]+)/i.exec(dnOrCn);
  return (match ? match[1] : dnOrCn).trim().toLowerCase();
}

// RFC 4515 filter-value escaping — @types/ldapjs doesn't declare (and this
// ldapjs version doesn't export) a helper for this, so it's done by hand.
function escapeFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

export interface LdapAuthResult {
  userId: string;
}

// Service-account search + user-bind-verify pattern: bind as the configured
// service account, resolve the target user's DN and group memberships, then
// re-bind a fresh client as that DN with the user's own password to verify.
// This works across AD and generic LDAP without assuming a bindable DN
// template (unlike direct-bind, which breaks for non-UPN/nested-OU setups).
export async function authenticateLdap(cfg: LdapConfig, username: string, password: string): Promise<LdapAuthResult | null> {
  const client = createClient(cfg);
  try {
    await bindAsync(client, cfg.bindDN, cfg.bindCredentials);

    const groupAttr = cfg.groupSearchAttr || 'memberOf';
    const filter = cfg.userSearchFilter.replace('{{username}}', escapeFilterValue(username));
    const entries = await searchAsync(client, cfg.userSearchBase, {
      filter,
      scope: 'sub',
      attributes: ['dn', 'mail', 'cn', groupAttr],
    });

    const entry = entries[0];
    if (!entry) return null;

    const dn = entry.objectName;
    const mail = attr(entry, 'mail')[0] ?? `${username}@ldap.local`;
    const displayName = attr(entry, 'cn')[0] ?? username;
    const directGroups = attr(entry, groupAttr);

    let groups = directGroups;
    if (cfg.groupSearchBase && directGroups.length === 0) {
      // Reverse-lookup style (generic LDAP groupOfNames/posixGroup): the user
      // entry doesn't carry its own group list, so search the group tree for
      // entries whose membership attribute references this user's DN.
      const groupEntries = await searchAsync(client, cfg.groupSearchBase, {
        filter: `(${groupAttr}=${escapeFilterValue(dn)})`,
        scope: 'sub',
        attributes: ['cn'],
      });
      groups = groupEntries.flatMap((g) => attr(g, 'cn'));
    }

    const userClient = createClient(cfg);
    try {
      await bindAsync(userClient, dn, password);
    } catch {
      return null;
    } finally {
      userClient.unbind();
    }

    const userId = await findOrCreateLdapUser(dn, username, mail, displayName);
    await syncRolesFromGroups(userId, groups, cfg);
    return { userId };
  } finally {
    client.unbind();
  }
}

async function findOrCreateLdapUser(dn: string, username: string, mail: string, displayName: string): Promise<string> {
  const [existing] = await db.select({ userId: userLdapAccounts.userId })
    .from(userLdapAccounts).where(eq(userLdapAccounts.dn, dn)).limit(1);
  if (existing) return existing.userId;

  const [byEmail] = await db.select({ userId: users.userId }).from(users).where(eq(users.email, mail)).limit(1);

  let userId: string;
  if (byEmail) {
    userId = byEmail.userId;
  } else {
    const [created] = await db.insert(users).values({
      email: mail,
      name: displayName,
      passwordHash: '',
    }).returning({ userId: users.userId });
    userId = created!.userId;
  }

  await db.insert(userLdapAccounts).values({ userId, dn, username }).onConflictDoNothing();
  return userId;
}

// Re-synced on every login rather than set once, matching the "permissions
// flattened at token-issue time" pattern already accepted for JWTs — a group
// membership change in AD/LDAP takes effect on the user's next login.
async function syncRolesFromGroups(userId: string, groups: string[], cfg: LdapConfig): Promise<void> {
  const normalizedGroups = groups.map(cnOf);
  const matchedRoleNames = new Set<string>();
  for (const mapping of cfg.groupRoleMap) {
    if (normalizedGroups.includes(cnOf(mapping.group))) matchedRoleNames.add(mapping.role);
  }
  if (matchedRoleNames.size === 0 && cfg.defaultRole) matchedRoleNames.add(cfg.defaultRole);
  if (matchedRoleNames.size === 0) return;

  const roleRows = await db.select({ roleId: roles.roleId, roleName: roles.roleName }).from(roles);
  const roleIdsToAssign = roleRows.filter((r) => matchedRoleNames.has(r.roleName)).map((r) => r.roleId);
  if (roleIdsToAssign.length === 0) return;

  await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.assignedBy, 'ldap-sync')));
  await db.insert(userRoles).values(
    roleIdsToAssign.map((roleId) => ({ userId, roleId, assignedBy: 'ldap-sync' })),
  ).onConflictDoNothing();
}
