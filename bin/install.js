#!/usr/bin/env node
// test-sandbox installer.
//
// Resolves the target skills directory for the harness it finds installed, then
// installs skills/test-sandbox/ into it. Two source modes:
//   * local  — copy from a repo clone (default; offline-safe).
//   * remote — fetch files from GitHub raw when invoked via `curl | bash`
//             (no clone, no package.json, no npx).
//
// Idempotent: re-running updates in place.
//
// Flags:
//   --target <dir>   Force a destination directory (overrides auto-detect).
//   --repo <slug>    GitHub repo slug (default: mathofjesus/docker-sandbox).
//   --list            Print the detected harness + target and exit.
//   --help            Show usage.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const SKILL_NAME = 'test-sandbox';
const here = __dirname;
const repoRoot = path.resolve(here, '..');
const localSkill = path.join(repoRoot, 'skills', SKILL_NAME);

function usage() {
  console.log(`test-sandbox installer

Installs skills/${SKILL_NAME}/ into your agent's skills directory.

USAGE
  curl -fsSL https://raw.githubusercontent.com/mathofjesus/docker-sandbox/main/install.sh | bash
  npx github:mathofjesus/docker-sandbox        (if you have the full clone)
  node bin/install.js [flags]

FLAGS
  --target <dir>   Install into <dir> instead of auto-detecting.
  --repo <slug>    GitHub repo slug (default: mathofjesus/docker-sandbox).
  --list            Show the detected harness + target, then exit.
  --help            Show this message.

Detected harnesses (in priority order):
  Claude Code  ~/.claude/skills
  Cursor       ~/.cursor/skills
  Codex        ~/.codex/skills
  Hermes       ~/.hermes/skills/testing
  Fallback     ./skills (next to this installer)
`);
}

function home() { return os.homedir(); }

function detectTarget() {
  const candidates = [
    { name: 'Claude Code', dir: path.join(home(), '.claude', 'skills') },
    { name: 'Cursor', dir: path.join(home(), '.cursor', 'skills') },
    { name: 'Codex', dir: path.join(home(), '.codex', 'skills') },
    { name: 'Hermes', dir: path.join(home(), '.hermes', 'skills', 'testing') },
  ];
  for (const c of candidates) {
    if (fs.existsSync(c.dir)) return c;
  }
  return { name: 'Claude Code (default)', dir: path.join(home(), '.claude', 'skills') };
}

// Fetch a single file from GitHub raw into a local path.
function fetchRaw(repo, file, dest) {
  const url = `https://raw.githubusercontent.com/${repo}/main/${file}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const fd = fs.createWriteStream(dest);
      res.pipe(fd);
      fd.on('finish', () => fd.close(() => resolve(dest)));
    }).on('error', reject);
  });
}

// Recursively copy a local dir.
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Fetch the skill tree from GitHub raw. We know the fixed file set.
async function fetchSkill(repo, dest) {
  const files = [
    'SKILL.md',
    'LICENSE.txt',
    'scripts/run.sh',
    'references/validation.md',
  ];
  fs.mkdirSync(dest, { recursive: true });
  for (const f of files) {
    const out = path.join(dest, f);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await fetchRaw(repo, `skills/${SKILL_NAME}/${f}`, out);
  }
}

function parseArgs(argv) {
  const out = { target: null, repo: 'mathofjesus/docker-sandbox', list: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--list') out.list = true;
    else if (a === '--target') out.target = argv[++i];
    else if (a === '--repo') out.repo = argv[++i];
    else { console.error(`test-sandbox: unknown flag: ${a}`); process.exit(2); }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); process.exit(0); }

  const detected = detectTarget();
  const target = args.target
    ? { name: 'explicit --target', dir: path.resolve(args.target) }
    : detected;

  if (args.list) {
    console.log(`harness : ${target.name}`);
    console.log(`target  : ${target.dir}`);
    console.log(`source  : ${fs.existsSync(localSkill) ? localSkill : 'GitHub raw (' + args.repo + ')'}`);
    process.exit(0);
  }

  fs.mkdirSync(target.dir, { recursive: true });
  const dest = path.join(target.dir, SKILL_NAME);

  if (fs.existsSync(localSkill)) {
    copyDir(localSkill, dest);
    console.log(`test-sandbox: installed (local) -> ${dest}`);
  } else {
    await fetchSkill(args.repo, dest);
    console.log(`test-sandbox: installed (github:${args.repo}) -> ${dest}`);
  }

  console.log(`harness   : ${target.name}`);
  console.log('done. Restart your agent (or /plugin reload) to load it.');
}

main().catch((e) => {
  console.error(`test-sandbox: install failed: ${e.message}`);
  process.exit(1);
});
