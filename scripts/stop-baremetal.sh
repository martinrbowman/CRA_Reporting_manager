#!/usr/bin/env bash
set -euo pipefail

if ! command -v pm2 &>/dev/null; then
  echo "pm2 not found." >&2
  exit 1
fi

pm2 stop cra-api
echo "CRA API stopped (still registered with PM2 — 'pm2 delete cra-api' to remove it entirely)."
