#!/usr/bin/env bash
# Bare-metal / PM2 deployment path — no containers. Used for e.g. embedded
# ARM (Raspberry Pi) targets where running three containers is unnecessary
# overhead. Requires: Node >=22.5, pnpm >=9, PM2 (`npm i -g pm2`), a system
# nginx, and a reachable Postgres (local or remote — set DATABASE_URL in .env).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v pm2 &>/dev/null; then
  echo "pm2 not found. Install it with: npm install -g pm2" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env not found. Copy .env.example to .env, fill in DATABASE_URL/JWT_SECRET/ADMIN_EMAIL, then re-run." >&2
  exit 1
fi
# shellcheck disable=SC1091
source .env
if [ -z "${ADMIN_EMAIL:-}" ]; then
  echo "ADMIN_EMAIL is not set in .env — required to bootstrap the initial admin user." >&2
  exit 1
fi

if [ ! -f config/ldap.yml ]; then
  cp config/ldap.example.yml config/ldap.yml
  echo "No config/ldap.yml found — copied the example (LDAP disabled by default)."
fi

echo "Installing dependencies and building..."
pnpm install --frozen-lockfile
pnpm --filter @cra/shared build
pnpm --filter @cra/api build
pnpm --filter @cra/web build

echo "Running migrations and seed..."
pnpm --filter @cra/api db:migrate
pnpm --filter @cra/api db:seed

mkdir -p logs

echo "Starting API under PM2..."
pm2 start ecosystem.config.js --env production
pm2 save

NGINX_CONF="nginx/cra-platform.generated.conf"
sed "s#__APP_DIR__#${REPO_ROOT}#g" nginx/cra-platform.conf > "$NGINX_CONF"

echo ""
echo "API running under PM2 (see: pm2 status, pm2 logs cra-api)."
echo ""
echo "Generated nginx config at ${NGINX_CONF}."
echo "Install it and reload nginx, e.g.:"
echo "  sudo cp ${NGINX_CONF} /etc/nginx/sites-available/cra-platform.conf"
echo "  sudo ln -sf /etc/nginx/sites-available/cra-platform.conf /etc/nginx/sites-enabled/cra-platform.conf"
echo "  sudo nginx -t && sudo systemctl reload nginx"
