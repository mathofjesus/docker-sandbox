# Validation runs

The recipes in `SKILL.md` and the bundled `scripts/run.sh` were executed
against real projects, each inside a disposable `--rm` container capped at
`--cpus=2 --memory=4g`. All passed. Host: Docker 29.x, 18 GB RAM.

## Summary

| Stack | Recipe | Image | Result |
| :- | :- | :- | :- |
| Java 21 + Spring Boot + Maven (multi-module) | Maven | `maven:3.9-eclipse-temurin-21-alpine` | BUILD SUCCESS, exit 0 |
| Preact + TypeScript + Vite + Vitest | Frontend unit | `node:20-alpine` | 3 files, 16 tests passed, exit 0 |
| Expo / React Native + Jest (jest-expo) | Frontend unit | `node:20-alpine` | 4 suites, 35 tests passed, exit 0 |

## Details

### Backend — Maven

```sh
docker run --rm --cpus=2 --memory=4g \
  -v "$PWD":/src:ro -v sandbox-m2:/root/.m2 \
  maven:3.9-eclipse-temurin-21-alpine sh -c '
  cp -r /src /app && cd /app && mvn -q clean test
'
```

Result: `BUILD SUCCESS`. Only benign JVM/byte-buddy agent warnings. The named
`sandbox-m2` volume caches dependencies for subsequent runs.

### Frontend unit — Vitest

```sh
docker run --rm --cpus=2 --memory=4g -v "$PWD":/src:ro node:20-alpine sh -c '
  cp -r /src /test && cd /test && rm -rf node_modules package-lock.json
  npm install --no-audit --no-fund
  npm test
'
```

Result: `Test Files 3 passed (3) · Tests 16 passed (16)`.

### Frontend unit — Jest (Expo / React Native)

Same recipe, **but the plain `npm install` failed** with a peer-dependency
conflict (Expo/RN pins strict peer ranges). Re-running with
`--legacy-peer-deps` fixed it:

```sh
docker run --rm --cpus=2 --memory=4g -v "$PWD":/src:ro node:20-alpine sh -c '
  cp -r /src /test && cd /test && rm -rf node_modules package-lock.json
  npm install --no-audit --no-fund --legacy-peer-deps
  npm test
'
```

Result: `Test Suites: 4 passed, 4 total · Tests: 35 passed, 35 total`. React
`act()` warnings appeared but are not failures.

**Lesson (now in SKILL.md pitfalls):** Expo/React Native projects need
`--legacy-peer-deps` on `npm install`; a vanilla install aborts on peer
conflicts.

## Bundled script

`scripts/run.sh --kind node --dir <path>` was run end-to-end against the Vitest
project above:

```
>> sandbox: kind=node dir=... cpus=2 mem=4g
 Test Files  3 passed (3)
      Tests  16 passed (16)
>> done (container removed; host clean)
SCRIPT_EXIT=0
```

The script auto-removed its container and left the host clean. Run it with
`--help` for all options.

## Teardown

`--rm` containers self-delete on exit. After the runs, `docker ps -a` was empty.
Remove named cache volumes explicitly when done:

```sh
docker volume rm sandbox-m2 sandbox-gradle
```

Do not delete pre-existing containers/volumes from other sessions — only clean
what the sandbox created.
