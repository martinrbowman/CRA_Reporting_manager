# Security Policy

This project handles vulnerability-management and regulator-reporting data
for the organizations that run it — security issues here are taken
seriously, and (a little ironically, given what the platform is for) we ask
that you handle them the way this platform itself expects: private,
coordinated disclosure before anything public.

## Supported Versions

This project is pre-1.0 and moves fast. Only the `main` branch is supported —
please don't report issues against a version you've patched or forked
yourself without also checking `main`.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, use GitHub's private vulnerability reporting for this repository
(Security tab → "Report a vulnerability"), or email the maintainer directly
(see the maintainer's GitHub profile for contact details). Include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a minimal repro is ideal).
- Affected version/commit.

You should get an initial response within a few days. Once a fix is ready,
we'll coordinate a disclosure timeline with you before anything is made
public, and credit you in the release notes unless you'd prefer otherwise.

## Scope Notes

A few things worth knowing if you're auditing this codebase:

- `config/ldap.yml` and `.env` are intentionally never read or writable
  through the API — LDAP bind credentials and JWT/DB secrets are file/env
  based by design (see `docs/admin-guide.md`), not stored or editable via
  HTTP. If you find a path that exposes or accepts them via the API, that's
  a real finding.
- The maker-checker approval system's self-approval guard
  (`routes/approvals.ts`) is a core security control, not a UX nicety — a
  bypass there is high severity.
- `packages/api/src/lib/ldap-auth.ts` talks to an external LDAP/AD server
  with user-supplied credentials; injection into search filters or DN
  construction there is in scope.
