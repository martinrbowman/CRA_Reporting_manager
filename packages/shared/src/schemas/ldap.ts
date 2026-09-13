import { z } from 'zod';

// Validates config/ldap.yml. LDAP config is file-based (ops-managed), never
// written through the API — this schema is used to parse+validate the file
// at boot and on manual reload, and to type the (secret-masked) status
// response the Settings > LDAP/AD tab reads.
export const GroupRoleMapEntrySchema = z.object({
  group: z.string().min(1),
  role: z.string().min(1),
});

export const LdapConfigSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(389),
  useTLS: z.boolean().default(false),
  bindDN: z.string().min(1),
  bindCredentials: z.string().min(1),
  userSearchBase: z.string().min(1),
  userSearchFilter: z.string().min(1).default('(uid={{username}})'),
  groupSearchBase: z.string().optional(),
  groupSearchAttr: z.string().optional(),
  groupRoleMap: z.array(GroupRoleMapEntrySchema).default([]),
  defaultRole: z.string().optional(),
});

export type LdapConfig = z.infer<typeof LdapConfigSchema>;
export type GroupRoleMapEntry = z.infer<typeof GroupRoleMapEntrySchema>;

export const LdapLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LdapLoginInput = z.infer<typeof LdapLoginSchema>;
