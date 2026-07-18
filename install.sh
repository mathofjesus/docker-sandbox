#!/usr/bin/env bash
# test-sandbox — installer shim.
#
# Two paths:
#   * Local clone: run the bundled Node installer directly (offline-safe).
#   * curl | bash: fetch bin/install.js from GitHub raw into a temp dir, then
#     run it. No npx, no package.json required.
#
# One-line install:
#   curl -fsSL https://raw.githubusercontent.com/mathofjesus/docker-sandbox/main/install.sh | bash
#
# Local clone:
#   bash install.sh [flags]
set -euo pipefail

REPO="mathofjesus/docker-sandbox"
RAW="https://raw.githubusercontent.com/${REPO}/main"

# Require Node >=18.
if ! command -v node >/dev/null 2>&1; then
  echo "test-sandbox: Node.js (>=18) required. Install:" >&2
  echo "  macOS:   brew install node" >&2
  echo "  Linux:   see https://nodejs.org or use nvm (https://github.com/nvm-sh/nvm)" >&2
  exit 1
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "test-sandbox: Node $NODE_MAJOR too old. Need Node >=18." >&2
  echo "  Upgrade: https://nodejs.org" >&2
  exit 1
fi

# Path 1: inside a repo clone — use the local installer.
here="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" 2>/dev/null && pwd)" || here=""
if [ -n "$here" ] && [ -f "$here/bin/install.js" ]; then
  exec node "$here/bin/install.js" "$@"
fi

# Path 2: curl | bash — fetch installer from GitHub raw.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
echo "test-sandbox: fetching installer from GitHub (${REPO})..."
curl -fsSL "${RAW}/bin/install.js" -o "$tmp/install.js"
exec node "$tmp/install.js" --repo "$REPO" "$@"

