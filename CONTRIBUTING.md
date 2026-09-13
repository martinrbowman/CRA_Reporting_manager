# Contributing

## Dev setup

```bash
pnpm install
pnpm --filter @cra/shared build
./scripts/dev.sh --with-db   # or omit --with-db and run Postgres yourself
```

See `docs/install.md` for the full setup story (Docker/Podman, bare-metal/PM2).

## Before opening a PR

```bash
pnpm -r run typecheck
pnpm -r run build
```

Both must pass — CI runs the same checks on every PR. There's no automated
test suite yet; if you're adding non-trivial logic (SLA calculations, the
LDAP bind flow, the approval state machine), a quick note in the PR
description of how you manually verified it is appreciated.

## Scope

This is a deliberately slim fork of a larger CRA compliance platform — it
covers PSIRT case management, vulnerability tracking, Art. 14 reporting,
users/roles, and local/Entra-ID/LDAP auth. TARA/STRIDE threat modeling, SBOM
ingestion, and conformity assessment are out of scope by design (see
`README.md`) — PRs reintroducing that surface area will likely be declined
unless there's a specific reason this fork's scope should grow.

## Licensing

This project is AGPL-3.0-or-later (see `LICENSE`) with an optional
commercial license (see `COMMERCIAL-LICENSE.md`). By submitting a PR, you
agree your contribution is licensed under the same terms as the rest of the
project, and — since the project is dual-licensed — that the maintainer may
also license your contribution commercially under the terms in
`COMMERCIAL-LICENSE.md`. If that's not something you're comfortable with,
please say so in the PR and we can work out an alternative, or you're
welcome to fork under the AGPL instead.

## Reporting bugs

Use GitHub Issues for functional bugs. For security vulnerabilities, see
`SECURITY.md` instead — please don't file those as public issues.
