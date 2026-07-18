#!/usr/bin/env node
// test-sandbox installer.
//
// Resolves the target skills directory for the harness it finds installed, then
// copies skills/test-sandbox/ into it. Idempotent: re-running updates in place.
//
// Flags:
//   --target <dir>   Force a destination directory (overrides auto-detect).
//   --list            Print the detected harness + target and exit.
//   --help            Show usage.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const SKILL_NAME = 'test-sandbox';
const here = __dirname;
const repoRoot = path.resolve(here, '..');
const skillSrc = path.join(repoRoot, 'skills', SKILL_NAME);

function usage() {
  console.log(`test-sandbox installer

Copies skills/${SKILL_NAME}/ into your agent's skills directory.

USAGE
  npx github:mathofjesus/docker-sandbox [flags]
  node bin/install.js [flags]

FLAGS
  --target <dir>   Install into <dir> instead of auto-detecting.
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

function home() {
  return os.homedir();
}

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
  // None present yet — default to the most common one so a fresh install lands
  // where `claude` expects it.
  return { name: 'Claude Code (default)', dir: path.join(home(), '.claude', 'skills') };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function parseArgs(argv) {
  const out = { target: null, list: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--list') out.list = true;
    else if (a === '--target') out.target = argv[++i];
    else { console.error(`test-sandbox: unknown flag: ${a}`); process.exit(2); }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); process.exit(0); }

  if (!fs.existsSync(skillSrc)) {
    console.error(`test-sandbox: source not found at ${skillSrc}`);
    console.error('  Run this from the cloned repo or via the npx one-liner.');
    process.exit(1);
  }

  const detected = detectTarget();
  const target = args.target
    ? { name: 'explicit --target', dir: path.resolve(args.target) }
    : detected;

  if (args.list) {
    console.log(`harness : ${target.name}`);
    console.log(`target  : ${target.dir}`);
    console.log(`source  : ${skillSrc}`);
    process.exit(0);
  }

  fs.mkdirSync(target.dir, { recursive: true });
  const dest = path.join(target.dir, SKILL_NAME);
  copyDir(skillSrc, dest);

  console.log(`test-sandbox: installed -> ${dest}`);
  console.log(`harness   : ${target.name}`);
  console.log('done. Restart your agent (or /plugin reload) to load it.');
}

main();
