#!/usr/bin/env bash
# Local development: runs the API and web dev servers natively (hot reload),
# no containers required for them. Pass --with-db to also start just the
# Postgres container (via the detected engine) so you don't need a local
# Postgres install.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ "${1:-}" = "--with-db" ]; then
  # shellcheck source=lib/engine-detect.sh
  source scripts/lib/engine-detect.sh
  if [ ! -f .env ]; then
    echo ".env not found — run scripts/start.sh once first (or copy .env.example manually) to generate secrets." >&2
    exit 1
  fi
  echo "Starting db service via $COMPOSE..."
  $COMPOSE up -d db
fi

if [ ! -d packages/shared/dist ]; then
  echo "Building @cra/shared (first run)..."
  pnpm --filter @cra/shared build
fi

echo "Starting API and web dev servers (Ctrl+C to stop both)..."

pids=()
cleanup() {
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

pnpm --filter @cra/api dev &
pids+=("$!")
pnpm --filter @cra/web dev &
pids+=("$!")

wait
