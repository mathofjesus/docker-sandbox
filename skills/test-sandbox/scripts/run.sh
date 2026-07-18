#!/usr/bin/env bash
# run.sh — disposable Docker test sandbox.
# Runs a project's tests inside a throwaway Alpine container and deletes it on
# exit. Source is mounted read-only and copied to a writable path inside, so the
# host repo is never modified.
set -euo pipefail

CPUS=2
MEM=4g
DIR="$PWD"
KIND=""

usage() {
  cat <<'EOF'
run.sh — run project tests inside a disposable Docker container.

USAGE:
  run.sh --kind <node|maven|gradle> [options]

KINDS:
  node     Frontend TS tests via `npm test` (node:20-alpine).
           Deletes node_modules + lockfile, then `npm install` (regenerates
           Linux-native deps). Add --expo for React Native/Expo projects.
  maven    Backend tests via `mvn clean test` (maven:3.9-eclipse-temurin-21-alpine).
           Caches deps in a named volume across runs.
  gradle   Backend tests via `./gradlew clean test --no-daemon`.

OPTIONS:
  --kind <k>     Required. One of: node, maven, gradle.
  --dir <path>   Project directory to test. Default: current directory.
  --expo         (node only) add --legacy-peer-deps for Expo/RN peer conflicts.
  --cpus <n>     CPU cap. Default: 2.
  --mem <size>   Memory cap. Default: 4g (2g OOMs on E2E/Maven).
  -h, --help     Show this help.

EXAMPLES:
  run.sh --kind node --dir ./frontend
  run.sh --kind node --dir ./mobile --expo
  run.sh --kind maven --dir ./backend
  run.sh --kind gradle

The container runs with --rm and self-deletes. Named dependency caches
(sandbox-m2, sandbox-gradle) persist across runs; remove with
`docker volume rm sandbox-m2 sandbox-gradle`.
EOF
}

EXPO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --kind) KIND="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --expo) EXPO=1; shift ;;
    --cpus) CPUS="$2"; shift 2 ;;
    --mem) MEM="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

[ -n "$KIND" ] || { echo "error: --kind is required" >&2; usage; exit 2; }
[ -d "$DIR" ] || { echo "error: dir not found: $DIR" >&2; exit 2; }
command -v docker >/dev/null || { echo "error: docker not installed" >&2; exit 3; }

ABS="$(cd "$DIR" && pwd)"
echo ">> sandbox: kind=$KIND dir=$ABS cpus=$CPUS mem=$MEM"

case "$KIND" in
  node)
    INSTALL="npm install --no-audit --no-fund"
    [ "$EXPO" -eq 1 ] && INSTALL="$INSTALL --legacy-peer-deps"
    docker run --rm --cpus="$CPUS" --memory="$MEM" -v "$ABS":/src:ro node:20-alpine sh -c "
      cp -r /src /test && cd /test && rm -rf node_modules package-lock.json
      $INSTALL
      npm test
    "
    ;;
  maven)
    docker run --rm --cpus="$CPUS" --memory="$MEM" \
      -v "$ABS":/src:ro -v sandbox-m2:/root/.m2 \
      maven:3.9-eclipse-temurin-21-alpine sh -c '
      cp -r /src /app && cd /app && mvn -q clean test
    '
    ;;
  gradle)
    docker run --rm --cpus="$CPUS" --memory="$MEM" \
      -v "$ABS":/src:ro -v sandbox-gradle:/root/.gradle \
      eclipse-temurin:21-alpine sh -c '
      cp -r /src /app && cd /app && ./gradlew clean test --no-daemon
    '
    ;;
  *) echo "error: unknown kind: $KIND" >&2; usage; exit 2 ;;
esac

echo ">> done (container removed; host clean)"
