#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
# shellcheck source=lib/engine-detect.sh
source scripts/lib/engine-detect.sh

$COMPOSE down
echo "CRA Compliance Platform stopped."
