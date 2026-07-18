# test-sandbox

A skill for running project tests and rapid prototypes inside **disposable
Docker containers**, so the host machine stays clean. Point it at any TypeScript
frontend or Java backend and its tests run in a minimal Alpine container that is
deleted the moment it exits.

**Philosophy: containers die, the host stays pristine.** Anything that could
break your OS, occupy a port, or leave build junk behind is trapped in a
throwaway container — never on your machine.

This repository follows the [Agent Skills](https://agentskills.io) layout
demonstrated by [anthropics/skills](https://github.com/anthropics/skills): each
skill is a self-contained folder with a `SKILL.md` (YAML frontmatter +
instructions) plus optional `scripts/`, `references/`, and `examples/`.

## Install

One-line install (fetches the installer from GitHub, no clone needed):

```bash
curl -fsSL https://raw.githubusercontent.com/mathofjesus/docker-sandbox/main/install.sh | bash
```

This auto-detects your agent harness (Claude Code, Cursor, Codex, Hermes) and
copies `skills/test-sandbox/` into its skills directory. Flags:

```bash
bash install.sh --list            # show detected harness + target, then exit
bash install.sh --target <dir>   # force a destination directory
```

From a local clone you can also run the Node installer directly:

```bash
node bin/install.js               # auto-detect harness
node bin/install.js --target ./out
```

## Repository layout

```
install.sh                      # curl|bash installer shim (no npx needed)
bin/
  install.js                   # Node installer: detect harness + copy skill
skills/
  test-sandbox/
    SKILL.md                  # instructions + metadata agents load
    LICENSE.txt               # Apache-2.0
    scripts/
      run.sh                  # black-box test runner (--help for usage)
    references/
      validation.md           # recipes exercised on real projects, with results
```

## What it supports

| Layer    | Stack |
| :------- | :---- |
| Frontend | TypeScript — React / Vue / Angular / Preact — Vitest or Jest |
| E2E      | Playwright (Chromium, Firefox, WebKit) |
| Backend  | Java 21 + Spring Boot + Maven or Gradle |
| Database | PostgreSQL 15 — Testcontainers or a named container |

## Quick start

The bundled script runs the common cases. Run it with `--help` first.

```bash
skills/test-sandbox/scripts/run.sh --help
skills/test-sandbox/scripts/run.sh --kind node   --dir ./frontend
skills/test-sandbox/scripts/run.sh --kind node   --dir ./mobile --expo
skills/test-sandbox/scripts/run.sh --kind maven  --dir ./backend
```

For E2E, PostgreSQL, and full-stack recipes, see
[`skills/test-sandbox/SKILL.md`](./skills/test-sandbox/SKILL.md).

## Using as an agent skill

`SKILL.md` carries valid YAML frontmatter (`name`, `description`, `license`) and
is written to be loaded by agent harnesses (Claude Code, Cursor, Codex, Hermes).

**Claude Code** — register this repo as a plugin marketplace, then install:

```bash
/plugin marketplace add mathofjesus/docker-sandbox
```

**Other harnesses** — copy `skills/test-sandbox/` into your skills directory, or
use the installer above. The harness loads it when a task mentions throwaway
prototypes, mockups, quick tests, PoCs, spikes, or isolated testing.

## Requirements

Docker 20.10+, ~6 GB free RAM, 2 vCPU.

## Validation

The recipes were exercised against real projects inside containers (Maven
multi-module → BUILD SUCCESS; Preact/Vitest → 16 tests; Expo/Jest → 35 tests).
The `run.sh` installer path was tested end-to-end (local clone and `curl | bash`
from GitHub). See
[`skills/test-sandbox/references/validation.md`](./skills/test-sandbox/references/validation.md).

## Disclaimer

Provided for demonstration and educational purposes. Test thoroughly in your own
environment before relying on it for critical tasks.

## License

Apache-2.0 — see [`skills/test-sandbox/LICENSE.txt`](./skills/test-sandbox/LICENSE.txt).
