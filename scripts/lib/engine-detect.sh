#!/usr/bin/env bash
# Sourced by scripts/start.sh, stop.sh, dev.sh. Resolves which container
# engine + compose implementation is available and exports:
#   COMPOSE               — the command to run (e.g. "docker compose")
#   ENGINE                — "docker" or "podman"
#   COMPOSE_HEALTH_TRUSTED — "1" if this compose implementation honors
#                            `depends_on: condition: service_healthy`,
#                            "0" if start.sh needs to poll healthchecks itself
#                            (standalone podman-compose has historically been
#                            inconsistent about this).
set -euo pipefail

if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
  ENGINE="docker"
  COMPOSE_HEALTH_TRUSTED="1"
elif command -v podman &>/dev/null && podman compose version &>/dev/null 2>&1; then
  COMPOSE="podman compose"
  ENGINE="podman"
  COMPOSE_HEALTH_TRUSTED="1"
elif command -v podman-compose &>/dev/null; then
  COMPOSE="podman-compose"
  ENGINE="podman"
  COMPOSE_HEALTH_TRUSTED="0"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
  ENGINE="docker"
  COMPOSE_HEALTH_TRUSTED="1"
else
  echo "No container engine found. Install Docker (with the compose plugin) or Podman (>=4, with 'podman compose', or podman-compose)." >&2
  exit 1
fi

export COMPOSE ENGINE COMPOSE_HEALTH_TRUSTED
