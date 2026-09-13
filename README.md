# CRA Compliance Platform

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

A minimal platform for the EU Cyber Resilience Act's PSIRT / vulnerability-handling
and Article 14 regulator-reporting obligations — the vulnerability-reporting
obligation applies from **11 September 2026** (Regulation (EU) 2024/2847).

This is a deliberately slim fork: it covers PSIRT case intake, vulnerability
case tracking, Art. 14 24h/72h/14-day SLA clocks and report generation
(including PDF export), patches, incidents, notifications, maker-checker
approvals, an audit trail, and user management with local password, Microsoft
Entra ID SSO, and AD/LDAP authentication.

**Not included** (by design — see `docs/`): TARA/STRIDE threat modeling, SBOM
ingestion or CVE auto-scanning, conformity assessment, supplier tracking,
telemetry ingestion.

## Quick start

```bash
./scripts/start.sh
```

First run generates `.env` (random `JWT_SECRET`/`DB_PASSWORD`) and
`config/ldap.yml` (LDAP disabled by default) if they don't exist yet. You
must set `ADMIN_EMAIL` in `.env` before it will start — the script tells you
so and exits if it's missing. Works with Docker or Podman, auto-detected.

The one-time generated admin password is printed to the terminal on first
boot only — capture it, then rotate it after logging in.

See `docs/install.md` for full setup (bare-metal/PM2 path included),
`docs/admin-guide.md` for configuring SSO/LDAP/SMTP and managing users, and
`docs/user-guide.md` for the PSIRT/reporting workflow.

## Local development

```bash
./scripts/dev.sh --with-db   # or omit --with-db if you run Postgres yourself
```

## Monorepo layout

- `packages/shared` — Zod schemas and enums shared by api and web.
- `packages/api` — Fastify + Drizzle ORM + Postgres backend.
- `packages/web` — React + Vite + Tailwind frontend.

## Troubleshooting

- **`./scripts/start.sh` errors "No container engine found"** — install
  Docker (with the Compose plugin) or Podman 4+, or use the bare-metal path
  in `docs/install.md` instead.
- **Port 80 already in use** — set `WEB_PORT` in `.env` to something else
  (e.g. `WEB_PORT=8080`) before running `start.sh`.
- **Postgres already running locally on 5432** — either stop it, or run the
  bundled `db` container on a different host port and point `DATABASE_URL`
  at it (see `docs/install.md` → "Using an external Postgres").
- **Forgot the admin password** — it's only ever printed once, to the
  terminal, on first boot. Recover access by connecting to the database
  directly and clearing `password_hash` for your admin user, or by running
  `pnpm --filter @cra/api db:seed` again with `ADMIN_EMAIL` set to a new
  address (it won't touch an existing admin, but will create a fresh one if
  none exists yet — if one already does, reset a user's password instead via
  Settings → Users → Reset pwd once you're logged in as any admin).
- **LDAP login not working** — check `config/ldap.yml` has `enabled: true`
  and use Settings → LDAP/AD → Test Connection to verify the bind account
  can reach the directory; see `docs/admin-guide.md`.

## Software Bill of Materials

CycloneDX SBOMs for each package are in `sbom/` (`shared.cdx.json`,
`api.cdx.json`, `web.cdx.json`). Regenerate after any dependency change with:

```bash
./scripts/generate-sbom.sh
```

## Contributing

See `CONTRIBUTING.md`. Security issues go through `SECURITY.md`, not public
issues.

## License

AGPL-3.0-or-later — see [`LICENSE`](LICENSE). A commercial license is also
available for organizations that don't want the AGPL's network-source-
disclosure obligation, or that want support/custom development — see
[`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md).
