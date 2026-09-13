#!/usr/bin/env bash
# Bring up the full stack (db + api + web) under Docker or Podman —
# auto-detected, see lib/engine-detect.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
# shellcheck source=lib/engine-detect.sh
source scripts/lib/engine-detect.sh

echo "Container engine: $ENGINE ($COMPOSE)"

mkdir -p backups logs config

# ── First run: generate .env with random secrets ────────────────────────────
if [ ! -f .env ]; then
  echo "No .env found — generating one from .env.example with random secrets."
  cp .env.example .env

  if command -v openssl &>/dev/null; then
    JWT_SECRET_VAL="$(openssl rand -hex 32)"
    DB_PASSWORD_VAL="$(openssl rand -hex 16)"
  else
    JWT_SECRET_VAL="$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)"
    DB_PASSWORD_VAL="$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)"
  fi

  # macOS/BSD sed and GNU sed both accept -i '' vs -i differently; use a portable temp-file swap.
  sed "s#^JWT_SECRET=.*#JWT_SECRET=${JWT_SECRET_VAL}#" .env > .env.tmp && mv .env.tmp .env
  sed "s#^DB_PASSWORD=.*#DB_PASSWORD=${DB_PASSWORD_VAL}#" .env > .env.tmp && mv .env.tmp .env
  sed "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://cra_user:${DB_PASSWORD_VAL}@db:5432/cra_platform#" .env > .env.tmp && mv .env.tmp .env

  echo "Generated .env with random JWT_SECRET and DB_PASSWORD."
fi

# ── ADMIN_EMAIL is required — refuse to start without it ────────────────────
# shellcheck disable=SC1091
source .env
if [ -z "${ADMIN_EMAIL:-}" ]; then
  echo ""
  echo "ADMIN_EMAIL is not set in .env — the platform needs this to bootstrap the" >&2
  echo "initial admin user. Edit .env, set ADMIN_EMAIL=you@example.com, then re-run" >&2
  echo "this script." >&2
  exit 1
fi

# ── LDAP config: default to disabled if not yet configured ──────────────────
if [ ! -f config/ldap.yml ]; then
  cp config/ldap.example.yml config/ldap.yml
  echo "No config/ldap.yml found — copied the example (LDAP disabled by default)."
  echo "Edit config/ldap.yml and set enabled: true to turn on AD/LDAP login."
fi

echo ""
echo "Building and starting services..."
$COMPOSE up -d --build

echo ""
echo "Waiting for services to become healthy..."
for _ in $(seq 1 30); do
  if $COMPOSE ps 2>/dev/null | grep -q "healthy"; then
    break
  fi
  sleep 3
done

echo ""
$COMPOSE ps

WEB_PORT_VAL="${WEB_PORT:-80}"
echo ""
echo "CRA Compliance Platform running at: http://localhost:${WEB_PORT_VAL}"

# One-time admin password only ever appears in the api container's boot log
# the first time it seeds an admin user — surface it here so it isn't missed.
ADMIN_LINE="$($COMPOSE logs api 2>/dev/null | grep -A2 "Admin user created" || true)"
if [ -n "$ADMIN_LINE" ]; then
  echo ""
  echo "─────────────────────────────────────────────────────────"
  echo "$ADMIN_LINE"
  echo "─────────────────────────────────────────────────────────"
fi
