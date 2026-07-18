---
name: test-sandbox
description: Toolkit for running project tests and rapid prototypes inside disposable Docker containers so the host stays clean. Use when a task is a throwaway prototype, mockup, quick-and-dirty test, PoC, or spike, or when tests open ports / spawn headless browsers / could destabilize the host. Covers TypeScript frontends (React/Vue/Angular/Preact + Vitest/Jest, Playwright E2E) and Java 21 + Spring Boot backends (Maven/Gradle), with PostgreSQL via Testcontainers or a named container.
license: Complete terms in LICENSE.txt
---

# Test Sandbox

Run tests inside throwaway Docker containers. Anything that could break the OS,
hog a port, or leave build junk behind is trapped in a container that is deleted
on exit. **Containers die, the host stays pristine.**

## Quick path: the bundled script

A black-box runner handles the common cases. Run it with `--help` first; do not
read its source unless you need to customize.

```bash
scripts/run.sh --help
scripts/run.sh --kind node   --dir ./frontend      # Vitest/Jest
scripts/run.sh --kind node   --dir ./mobile --expo # Expo/React Native
scripts/run.sh --kind maven  --dir ./backend       # Spring Boot / Maven
scripts/run.sh --kind gradle --dir .               # Gradle
```

The script mounts the source read-only, copies it to a writable path inside the
container, installs deps, runs `npm test` / `mvn clean test` / `gradlew test`,
and removes the container on exit. For E2E, Postgres, or full-stack, use the
manual recipes below.

## Golden rules

1. Base images: minimal Alpine — `node:20-alpine`, `maven:3.9-eclipse-temurin-21-alpine`, `eclipse-temurin:21-alpine`.
2. Resource cap: `--cpus=2 --memory=4g`. 4 GB is the safe default — E2E (Playwright + 3 browsers) and Maven/Gradle builds OOM at 2 GB.
3. Always `--rm` so the container self-deletes.
4. Mount source `:ro`, copy to a writable path inside, build there. Never let the container write back into the repo.
5. Address other containers by name on a shared `docker network` — never `localhost`.
6. Tear everything down afterwards; verify with `docker ps -a`, `docker network ls`, `docker volume ls`.

## When NOT to use

- Production/staging deploys — use real infrastructure.
- Workloads needing persistence or volumes that must survive.
- A permanent host-bound port, or multi-host orchestration (use Kubernetes/Compose).

## Manual recipes

### Frontend unit tests (Vitest/Jest)

```bash
docker run --rm --cpus=2 --memory=4g -v "$PWD":/src:ro node:20-alpine sh -c '
  cp -r /src /test && cd /test && rm -rf node_modules package-lock.json
  npm install --no-audit --no-fund
  npm test
'
```

`test` in package.json must be non-watch (`"vitest run"` or `"jest"`). Expo/RN
projects need `--legacy-peer-deps` on install (see Pitfalls).

### Frontend E2E multi-browser (Playwright)

Serve the built app in one container, run Playwright from another on a shared
network. Reference the server by container name.

```bash
docker network create app_net
docker run -d --rm --name app_serve --network app_net --cpus=2 --memory=4g \
  -v "$PWD":/src:ro node:20-alpine sh -c '
    cp -r /src /app && cd /app && rm -rf node_modules package-lock.json
    npm install --no-audit --no-fund && npm run build
    npx --yes http-server dist -p 5173 -c-1
  '
docker run --rm --name app_test --network app_net --cpus=2 --memory=4g \
  -v "$PWD":/src:ro node:20-alpine sh -c '
    cp -r /src /test && cd /test && rm -rf node_modules package-lock.json
    npm install --no-audit --no-fund
    npx playwright install --with-deps chromium firefox webkit
    BASE_URL=http://app_serve:5173 npm run test:e2e
  '
docker kill app_serve; docker network rm app_net
```

### Backend tests (Maven / Gradle)

```bash
# Maven
docker run --rm --cpus=2 --memory=4g \
  -v "$PWD":/src:ro -v sandbox-m2:/root/.m2 \
  maven:3.9-eclipse-temurin-21-alpine sh -c '
  cp -r /src /app && cd /app && mvn -q clean test
'
# Gradle
docker run --rm --cpus=2 --memory=4g \
  -v "$PWD":/src:ro -v sandbox-gradle:/root/.gradle \
  eclipse-temurin:21-alpine sh -c '
  cp -r /src /app && cd /app && ./gradlew clean test --no-daemon
'
```

### PostgreSQL — two options

Testcontainers is **not** daemonless; it spawns real containers via the Docker
socket. Pick one:

**A. Testcontainers** — mount the host socket. Test config uses
`spring.datasource.url=jdbc:tc:postgresql:15:///testdb`.

```bash
docker run --rm --cpus=2 --memory=4g \
  -v "$PWD":/src:ro -v sandbox-m2:/root/.m2 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  maven:3.9-eclipse-temurin-21-alpine sh -c '
  cp -r /src /app && cd /app && mvn -q clean test
'
```

Trade-off: the socket grants the container control of the host Docker daemon.
Fine locally; avoid on shared/untrusted CI runners.

**B. Named Postgres container** (no socket, closer to production):

```bash
docker network create pg_net
docker run -d --rm --name pg --network pg_net --cpus=1 --memory=1g \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=testdb \
  postgres:15-alpine
docker run --rm --network pg_net --cpus=2 --memory=4g \
  -v "$PWD":/src:ro -v sandbox-m2:/root/.m2 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://pg:5432/testdb \
  -e SPRING_DATASOURCE_USERNAME=test -e SPRING_DATASOURCE_PASSWORD=test \
  maven:3.9-eclipse-temurin-21-alpine sh -c '
  cp -r /src /app && cd /app && mvn -q clean test
'
docker kill pg; docker network rm pg_net
```

## Pitfalls

- **Foreign lockfile on Alpine** — a Windows/macOS `package-lock.json` pins
  platform binaries (`@esbuild/win32-x64`) and fails on musl. Fix:
  `rm -rf node_modules package-lock.json` before `npm install`.
- **Expo / React Native** — strict peer ranges make `npm install` fail with
  ERESOLVE. Fix: add `--legacy-peer-deps`.
- **`:ro` blocks the build** — Maven/Gradle/npm write to `target/`,
  `node_modules/`, `dist/`. Copy source to a writable path first.
- **Playwright browsers** — install with OS deps:
  `npx playwright install --with-deps chromium firefox webkit`.
- **`localhost` inside a container** points to that container. Use container
  names on a shared network.
- **Testcontainers** needs the Docker socket (recipe A) or use a named Postgres
  container (recipe B).
- **OOMKilled** — Gradle + Playwright + browsers crash at 2 GB. Use 4 GB, or
  split unit and E2E into separate runs.

## Teardown checklist

- `docker ps -a` — no leftover containers
- `docker network ls` — no custom networks (app_net, pg_net)
- `docker volume ls` — remove caches you don't want (`sandbox-m2`, `sandbox-gradle`)
- Tests exited 0; no `localhost` in cross-container URLs

## Reference files

- `references/validation.md` — recipes exercised against real projects (Maven,
  Vitest, Expo/Jest) with results.
- `scripts/run.sh` — the black-box runner (`--help` for usage).

## Requirements

Docker 20.10+, ~6 GB free RAM, 2 vCPU, ~2 GB disk for cached images.
