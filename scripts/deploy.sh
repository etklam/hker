#!/usr/bin/env bash
# Build a local release artifact. Deployment is an explicit operator action.
set -euo pipefail
cd "$(dirname "$0")/.."
image="${HKER_IMAGE:-hker:release-candidate}"
docker build -t "$image" .
printf 'Built %s. Follow docs/directory-release-checklist.md for backup, migration preflight and explicit deployment.\n' "$image"
