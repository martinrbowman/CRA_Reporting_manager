# Admin Guide

## Users and roles

Settings → Users lets an admin invite users (email, name, roles) and
deactivate accounts (soft delete — sets status to `disabled`, doesn't erase
history). Two roles are seeded by default:

- **admin** — every permission: `products:write, vulnerabilities:write,
  psirt:write, users:write, approvals:write, incidents:write,
  notifications:write, admin:backup`.
- **psirt_analyst** — case-handling permissions:
  `vulnerabilities:write, psirt:write, incidents:write, notifications:write,
  approvals:write`.

Create additional roles under Settings → Users → Roles with any subset of
those permission strings. There's no per-resource (row-level) permission
model — permissions gate entire route groups.

A user with no role can log in and view records but cannot create or edit
anything (read endpoints don't require a specific permission, only
authentication).

## Authentication methods

Three methods can be active at once; when both LDAP and local passwords are
enabled for an org, the platform tries **LDAP first, falling back to local**
on failure. The login page is a single email/password form regardless of
which methods are active — there's no visible mode switch.

### Local (email + password)

Always available. Passwords are argon2-hashed, minimum 12 characters at
creation (8 for an admin-triggered reset). No configuration needed.

### Microsoft Entra ID (SSO)

Settings → OAuth/SSO → Microsoft. This is standard Entra ID OAuth2/OIDC
(`login.microsoftonline.com/{tenant}/oauth2/v2.0/...`) — set up an app
registration in Entra ID:

1. Register an app in the Entra admin center.
2. Redirect URI: `<your-api-public-url>/api/v1/oauth/microsoft/callback`
   (e.g. `https://cra.example.com/api/v1/oauth/microsoft/callback`).
3. Copy the Application (client) ID, create a client secret, and note your
   Tenant ID (or Directory ID).
4. In Settings → OAuth/SSO, enable Microsoft, paste the client ID/secret and
   tenant ID, save.

A generic OIDC provider is also available (Settings → OAuth/SSO → Single
Sign-On) if you need a non-Entra IdP — same fields plus a discovery URL.

### AD / LDAP

Configured via a file, **not** the web UI — `config/ldap.yml` (copy from
`config/ldap.example.yml`). This is deliberate: bind credentials for the
directory service account are ops-managed infrastructure config, not
something exposed for editing through an HTTP API.

Key fields (full reference with comments in the example file):

- `enabled` — must be `true` to activate LDAP login.
- `host`, `port`, `useTLS` — directory server connection.
- `bindDN`, `bindCredentials` — a **read-only service account**, not an
  admin/domain-admin account. It only needs to search the directory.
- `userSearchBase`, `userSearchFilter` — where and how to find a user by the
  username they type. Default filter `(sAMAccountName={{username}})` is for
  Active Directory; use `(uid={{username}})` for generic LDAP/OpenLDAP.
- `groupSearchAttr` / `groupSearchBase` — group membership lookup. AD style:
  leave `groupSearchBase` unset, `groupSearchAttr: memberOf` reads the
  group list directly off the user entry. Generic LDAP reverse-lookup style
  (groupOfNames/posixGroup): set `groupSearchBase` to the group OU and
  `groupSearchAttr` to the membership attribute name (e.g. `member`).
- `groupRoleMap` — list of `{group, role}` pairs; matched groups grant the
  named role. Re-evaluated on every login (a group change takes effect next
  sign-in, not retroactively).
- `defaultRole` — role granted when no group matches (omit for "no role by
  default").

After editing the file: **Settings → LDAP/AD** shows a read-only summary
(bind password always masked) with two actions — "Test Connection" (attempts
the service-account bind and reports success/failure) and "Reload Config"
(re-reads the file without restarting the API — do this after any edit).

## SMTP / notifications

Settings → SMTP. If left unconfigured (`SMTP_HOST` empty), the Notifications
page still works — sending a notification records it as manually dispatched
(`manual:<timestamp>`) rather than actually emailing it, so the workflow
doesn't block on having email set up.

## Backups

Settings → Backups. "Create backup" runs `pg_dump` (custom format) into the
`backups/` directory (mounted as a volume in Docker — persists across
container restarts, not committed to git). Restore accepts an uploaded
`.dump` file and runs `pg_restore --clean`. Requires `admin:backup`.

## Audit log

Settings → Audit Log (or `GET /api/v1/audit-log`). Every mutating action
across the platform — case creation/updates, approval decisions, SMTP/LDAP
config changes, report exports, backups — is recorded with actor, action,
object type/ID, timestamp, and IP. It's append-only; there's no UI to edit
or delete entries.
