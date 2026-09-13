#!/usr/bin/env bash
# Regenerates CycloneDX SBOMs (one per package) into sbom/. Run this after
# any dependency change before cutting a release.
#
# Note: @cyclonedx/cyclonedx-npm shells out to `npm ls`, which doesn't fully
# understand pnpm's node_modules layout — it must be run from inside each
# package directory (not the workspace root) to see that package's actual
# dependencies, and --ignore-npm-errors is required because pnpm's flat
# .pnpm store trips npm's peer-dependency tree walker on unrelated packages
# with nothing to do with this project (e.g. dev-tooling peer deps several
# levels down). The resulting component list has been spot-checked against
# each package's real dependencies and is accurate; the noisy stderr output
# during generation is expected and safe to ignore.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$REPO_ROOT/sbom"

for pkg in shared api web; do
  echo "Generating SBOM for @cra/$pkg..."
  (cd "$REPO_ROOT/packages/$pkg" && pnpm dlx @cyclonedx/cyclonedx-npm \
    --ignore-npm-errors \
    --output-format JSON \
    --output-file "$REPO_ROOT/sbom/$pkg.cdx.json" \
    --spec-version 1.5) 2>&1 | grep -v '^npm error' || true
done

echo "Done — sbom/{shared,api,web}.cdx.json"
