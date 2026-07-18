#!/usr/bin/env bash
# test-sandbox — installer shim.
#
# Thin wrapper around bin/install.js (unified Node installer). Every flag you'd
# pass to bin/install.js can be passed here; we just forward them.
#
# One-line install:
#   curl -fsSL https://raw.githubusercontent.com/mathofjesus/docker-sandbox/main/install.sh | bash
#
# Local clone:
#   bash install.sh [flags]
#
# Why a Node installer? It runs everywhere a harness might live (Claude Code,
# Cursor, Codex, Hermes) and resolves each tool's skills directory cross-platform
# without bash/PowerShell quoting bugs.
set -euo pipefail

REPO="mathofjesus/docker-sandbox"

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

# If we're inside the repo clone, run the local installer directly — saves the
# npx round-trip and keeps offline installs working.
here="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" 2>/dev/null && pwd)" || here=""
if [ -n "$here" ] && [ -f "$here/bin/install.js" ]; then
  exec node "$here/bin/install.js" "$@"
fi

# Curl-pipe path: delegate to npx (npm 7+ forwards trailing args to the pkg).
if ! command -v npx >/dev/null 2>&1; then
  echo "test-sandbox: npx required (ships with Node >=18). Reinstall Node.js." >&2
  exit 1
fi

exec npx -y "github:$REPO" "$@"
