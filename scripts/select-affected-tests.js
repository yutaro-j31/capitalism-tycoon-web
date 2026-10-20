#!/usr/bin/env node
'use strict';
// Local pre-push verification: choose the Node tests a change can affect and optionally run them,
// so contributors and agents do not use GitHub CI as the development loop. It is a selector, not
// a replacement for the canonical A–L suite or for real WebKit: the final gate stays in CI.
//
//   node scripts/select-affected-tests.js [--base origin/main] [--run] [--jobs 4] [--json] [--broad]
//
// Test files are collected from the canonical registry: literal paths in tests/run-all.js plus every
// `node <file>` inside the package.json scripts that run-all.js (or a workflow) calls via `npm run`.
// A test is selected when any of these holds for a changed file:
//   1. the changed file is itself a canonical or workflow test;
//   2. a workflow path filter matches it: every node test the workflow runs, directly or through
//      `npm run`, is selected (directory-wide filters such as js/** only with --broad);
//   3. it is a production module (js/<name>.js): every canonical test whose source mentions
//      `<name>.js`, `<name>` or the module's camelCase registry key;
//   4. always-on contracts: test registration, shard matrix and workflow path contracts, plus the
//      Phase 0.5 / 1 / 2 permanent acceptance gates and the cash writer ratchet whenever js/ changes
//      (their lexical writer inventories react to any production source edit, comments included).
// WebKit tests (-webkit-test.js) are listed separately; this environment may not have WebKit.
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = path.resolve(process.env.AFFECTED_TESTS_ROOT || path.join(__dirname, '..'));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const BASE = option('--base', 'origin/main');
const JOBS = Math.max(1, Number(option('--jobs', '4')) || 4);
const BROAD = args.includes('--broad');

const ALWAYS = ['tests/test-registration-contract-test.js', 'tests/shard-matrix-contract.js', 'tests/workflow-path-filter-contract-test.js'];
const CORE_MODULES = ['runtime', 'data', 'engine', 'simulation-rng', 'finance', 'economic-operation', 'economic-settlement', 'save-v9', 'semantic-hash-v2'];
const ON_PRODUCTION_CHANGE = ['tests/phase0-5-acceptance-gate-test.js', 'tests/phase1-acceptance-gate-test.js',
  'tests/phase2-acceptance-gate-test.js', 'tests/cash-writer-ratchet-test.js', 'tests/javascript-module-split-test.js'];

function git(argv) { return childProcess.execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8' }); }
function changedFiles() {
  const committed = git(['diff', '--name-only', `${BASE}...HEAD`]).split('\n');
  const local = git(['diff', '--name-only', 'HEAD']).split('\n');
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...new Set([...committed, ...local, ...untracked].filter(Boolean))].sort();
}
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
// `node [flags] <file>` invocations in a shell command; flags such as --max-old-space-size are kept.
const NODE_RUN = /node((?:\s+--[\w=-]+)*)\s+((?:tests|scripts)\/[\w./-]+\.c?js)/g;
const FLAGS = new Map();
function nodeRuns(text) {
  return [...text.matchAll(NODE_RUN)].map(m => { const flags = m[1].trim().split(/\s+/).filter(Boolean); if (flags.length) FLAGS.set(m[2], flags); return m[2]; });
}
let scripts;
function npmScript(name) {
  scripts ??= JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};
  return nodeRuns(scripts[name] || '');
}
// Node tests a command text runs, through literal `node` steps and `npm run <script>`.
function testsIn(text) {
  return [...nodeRuns(text), ...[...text.matchAll(/npm run ([\w:.-]+)/g)].flatMap(m => npmScript(m[1]))];
}
function camel(name) { return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()); }
function globToRegExp(glob) {
  // `**/` matches zero or more directories (GitHub Actions semantics); a trailing `**` matches anything.
  const body = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*').replace(/\u0001/g, '(?:.*/)?').replace(/\u0000/g, '.*');
  return new RegExp(`^${body}$`);
}

// Workflow path filters and the node test steps they guard (plain-text parse; no YAML dependency).
function workflows() {
  const dir = path.join(ROOT, '.github', 'workflows');
  return fs.readdirSync(dir).filter(name => /\.ya?ml$/.test(name)).map(name => {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const patterns = new Set();
    let inPaths = false;
    for (const line of text.split('\n')) {
      if (/^\s*paths:\s*$/.test(line)) { inPaths = true; continue; }
      const item = inPaths && line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/);
      if (item) patterns.add(item[1]);
      else if (inPaths && line.trim()) inPaths = false;
    }
    // Split into jobs: a job that reads ${{ matrix.* }} needs its matrix environment (shard index,
    // output path), so its commands are listed as CI-only and never run locally.
    const tests = new Set(), ciOnly = new Set();
    const jobsAt = text.search(/^jobs:\s*$/m);
    const jobs = jobsAt < 0 ? [text] : text.slice(jobsAt).split(/^(?=  [\w-]+:\s*$)/m);
    for (const job of jobs) for (const t of testsIn(job)) if (exists(t)) (job.includes('${{ matrix.') ? ciOnly : tests).add(t);
    // A directory-wide filter (e.g. js/**) guards a broad campaign; only --broad selects it.
    return { name, patterns: [...patterns].map(p => ({ glob: p, re: globToRegExp(p), broad: /^[\w.-]+\/\*\*$/.test(p) })), tests: [...tests], ciOnly: [...ciOnly] };
  });
}

function canonicalTests() {
  const source = fs.readFileSync(path.join(ROOT, 'tests', 'run-all.js'), 'utf8');
  const literal = [...source.matchAll(/['"]((?:tests|scripts)\/[\w./-]+\.c?js)['"]/g)].map(m => m[1]);
  const viaNpm = [...source.matchAll(/['"](test:[\w:.-]+)['"]/g)].flatMap(m => npmScript(m[1]));
  return [...new Set([...literal, ...viaNpm])].filter(exists);
}

function select(files) {
  const reasons = new Map();
  const add = (test, why) => { if (!exists(test)) return; if (!reasons.has(test)) reasons.set(test, new Set()); reasons.get(test).add(why); };
  ALWAYS.forEach(t => add(t, 'always-on contract'));
  const production = files.filter(f => /^js\/[\w.-]+\.js$/.test(f));
  if (production.length) ON_PRODUCTION_CHANGE.forEach(t => add(t, 'production source changed'));
  const flows = workflows(), canonical = canonicalTests();
  const ciOnly = new Set(flows.flatMap(w => w.ciOnly).filter(t => !canonical.includes(t)));
  const runnable = new Set([...canonical, ...flows.flatMap(w => [...w.tests, ...w.ciOnly])]);
  for (const file of files) if (runnable.has(file)) add(file, 'changed test');
  for (const w of flows.filter(flow => flow.patterns.length)) {
    const hit = files.find(f => w.patterns.some(p => (!p.broad || BROAD) && p.re.test(f)));
    if (hit) [...w.tests, ...w.ciOnly].forEach(t => add(t, `${w.name} paths: ${hit}`));
  }
  if (production.length) {
    const corpus = canonical.map(t => ({ t, text: fs.readFileSync(path.join(ROOT, t), 'utf8') }));
    for (const file of production) {
      const base = path.basename(file, '.js'), key = camel(base);
      for (const { t, text } of corpus) if (text.includes(`${base}.js`) || new RegExp(`modules\\??\\.${key}\\b`).test(text)) add(t, `references ${file}`);
    }
    // Tests that boot the whole game through tests/harness.js load every module transitively. A change
    // to a core module (state, RNG, accounting, save) reaches them without any textual reference.
    const core = production.filter(f => CORE_MODULES.includes(path.basename(f, '.js')));
    if (core.length) for (const { t, text } of corpus) if (/require\(['"]\.\/harness['"]\)/.test(text)) add(t, `boots the game; core module ${core[0]} changed`);
  }
  const all = [...reasons.keys()].sort(), row = t => ({ test: t, reasons: [...reasons.get(t)] });
  return {
    base: BASE, changedFiles: files,
    ciOnly: all.filter(t => ciOnly.has(t)).map(row),
    node: all.filter(t => !t.endsWith('-webkit-test.js') && !ciOnly.has(t)).map(row),
    webkit: all.filter(t => t.endsWith('-webkit-test.js')).map(t => ({ test: t, reasons: [...reasons.get(t)] }))
  };
}

function runAll(tests) {
  const queue = [...tests], results = [];
  return new Promise(resolve => {
    let active = 0;
    const next = () => {
      if (!queue.length && !active) return resolve(results);
      while (active < JOBS && queue.length) {
        const test = queue.shift(), started = Date.now();
        active++;
        const child = childProcess.spawn(process.execPath, [...(FLAGS.get(test) || []), test], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        let tail = '';
        const keep = chunk => { tail = (tail + chunk).slice(-4000); };
        child.stdout.on('data', keep); child.stderr.on('data', keep);
        child.on('close', code => {
          active--;
          results.push({ test, code, seconds: Math.round((Date.now() - started) / 100) / 10, tail: code ? tail : '' });
          console.log(`${code === 0 ? 'PASS' : 'FAIL'} ${test} (${results.at(-1).seconds}s)`);
          next();
        });
      }
    };
    next();
  });
}

module.exports = { select, globToRegExp, camel, canonicalTests };

if (require.main === module) {
  const plan = select(changedFiles());
  if (args.includes('--json')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
  console.log(`base ${BASE}; ${plan.changedFiles.length} changed file(s); ${plan.node.length} Node test(s), ${plan.webkit.length} WebKit test(s)`);
  for (const row of plan.node) console.log(`  ${row.test}  <- ${row.reasons.join('; ')}`);
  if (plan.ciOnly.length) console.log('CI-only (needs a workflow matrix environment; not run here):');
  for (const row of plan.ciOnly) console.log(`  ${row.test}  <- ${row.reasons.join('; ')}`);
  if (plan.webkit.length) console.log('WebKit (run on a WebKit-capable machine; not run here):');
  for (const row of plan.webkit) console.log(`  ${row.test}  <- ${row.reasons.join('; ')}`);
  if (!args.includes('--run')) process.exit(0);
  runAll(plan.node.map(row => row.test)).then(results => {
    const failed = results.filter(r => r.code !== 0);
    for (const r of failed) console.log(`\n--- ${r.test} (exit ${r.code})\n${r.tail}`);
    console.log(`\n${results.length - failed.length}/${results.length} PASS${plan.webkit.length ? `; ${plan.webkit.length} WebKit test(s) NOT RUN` : ''}`);
    process.exit(failed.length ? 1 : 0);
  });
}
