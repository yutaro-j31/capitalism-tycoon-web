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
//   1. the changed file is itself a canonical, workflow or execution-registry test;
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
// Removes // and /* */ comments outside string literals (a rough lexer; good enough for reference matching).
function stripComments(text) {
  let out = '', i = 0, quote = null;
  while (i < text.length) {
    const ch = text[i], next = text[i + 1];
    if (quote) { out += ch; if (ch === '\\') { out += next ?? ''; i += 2; continue; } if (ch === quote) quote = null; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; i++; continue; }
    if (ch === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '/' && next === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; out += ' '; continue; }
    out += ch; i++;
  }
  return out;
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

const PR_EVENTS = ['pull_request', 'pull_request_target'];
// Top-level `||` alternatives of a condition (parentheses and quotes respected).
function alternatives(condition) {
  const parts = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < condition.length; i++) {
    const c = condition[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === '|' && condition[i + 1] === '|') { parts.push(condition.slice(start, i)); start = i + 2; i++; }
  }
  parts.push(condition.slice(start));
  return parts;
}
// A job is CI-only when it reads ${{ matrix.* }} (shard index, output path), consumes artifacts of
// upstream jobs, or carries a job-level `if:` that cannot hold on a pull request. A condition is
// read conservatively: when one of its top-level `||` alternatives compares github.event_name with a
// pull-request event, the job is PR-capable. Otherwise it is CI-only when it depends on
// workflow_dispatch inputs or on github.event.workflow_run, or compares github.event_name only with
// other events.
function ciOnlyJob(job) {
  if (job.includes('${{ matrix.') || /actions\/download-artifact@/.test(job)) return true;
  const lines = job.split('\n'), at = lines.findIndex(line => /^    if:/.test(line));
  if (at < 0) return false;
  let condition = lines[at].replace(/^    if:\s*>?-?/, '');
  for (let i = at + 1; i < lines.length && /^      /.test(lines[i]); i++) condition += ` ${lines[i].trim()}`;
  const prEvent = new RegExp(`github\\.event_name\\s*==\\s*['"](?:${PR_EVENTS.join('|')})['"]`);
  if (alternatives(condition).some(alt => prEvent.test(alt))) return false;
  if (/\binputs\./.test(condition) || /github\.event\.workflow_run\b/.test(condition)) return true;
  return /github\.event_name\s*==/.test(condition);
}

// Events of a workflow's `on:` key (scalar, flow list or block mapping).
function triggers(text) {
  const inline = text.match(/^(?:on|'on'|"on"):[ \t]*(\S.*)$/m);
  if (inline) return inline[1].replace(/[[\]'"]/g, '').split(',').map(e => e.trim()).filter(Boolean);
  const block = text.match(/^(?:on|'on'|"on"):[ \t]*\n((?:[ \t]+.*\n|[ \t]*\n)*)/m);
  return block ? [...block[1].matchAll(/^  (?:- )?['"]?([\w-]+)['"]?:?\s*$/gm)].map(m => m[1]) : [];
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
    // Split into jobs. Commands of a job that cannot run as-is locally are listed as CI-only and never
    // run here: see ciOnlyJob().
    const tests = new Set(), ciOnly = new Set();
    const jobsAt = text.search(/^jobs:\s*$/m);
    const jobs = jobsAt < 0 ? [text] : text.slice(jobsAt).split(/^(?=  [\w-]+:\s*$)/m);
    // A workflow that no pull-request event triggers (workflow_run, push, schedule or
    // workflow_dispatch only) runs in CI context only; all its jobs are CI-only.
    const prTriggered = triggers(text).some(event => PR_EVENTS.includes(event));
    for (const job of jobs) for (const t of testsIn(job)) if (exists(t)) (!prTriggered || ciOnlyJob(job) ? ciOnly : tests).add(t);
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

// Tests executed outside run-all.js through aggregator scripts, as declared in the execution registry.
function registryTests() {
  const file = path.join(ROOT, 'tests', 'test-execution-registry.json');
  return fs.existsSync(file) ? Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).filter(exists) : [];
}

// Local files a test or script reaches through relative `require` calls, transitively (memoized).
const closures = new Map();
function localRequires(file) {
  if (closures.has(file)) return closures.get(file);
  const reached = new Set();
  closures.set(file, reached);
  const stack = [file];
  while (stack.length) {
    const current = stack.pop();
    const text = fs.readFileSync(path.join(ROOT, current), 'utf8');
    for (const m of text.matchAll(/require\(['"](\.\.?\/[\w./-]+)['"]\)/g)) {
      let dep = path.posix.normalize(path.posix.join(path.posix.dirname(current), m[1]));
      if (!/\.(?:c?js|json)$/.test(dep)) dep += '.js';
      // A missing dependency is still recorded, so deleting a helper selects the tests that required it.
      if (!reached.has(dep)) { reached.add(dep); if (exists(dep) && !dep.endsWith('.json')) stack.push(dep); }
    }
  }
  return reached;
}
// True when a test's code (comments stripped) names a file by repo path or quoted basename (memoized code).
const codeCache = new Map();
function referencesPath(test, file) {
  if (!codeCache.has(test)) codeCache.set(test, stripComments(fs.readFileSync(path.join(ROOT, test), 'utf8')));
  const code = codeCache.get(test), base = path.posix.basename(file);
  return code.includes(file) || ['"', "'", '`'].some(q => code.includes(`${q}${base}${q}`));
}
// True when a test reaches tests/harness.js through its local requires (test -> fixture -> harness).
function bootsGame(test) { return localRequires(test).has('tests/harness.js'); }

function select(files) {
  const reasons = new Map();
  const add = (test, why) => { if (!exists(test)) return; if (!reasons.has(test)) reasons.set(test, new Set()); reasons.get(test).add(why); };
  ALWAYS.forEach(t => add(t, 'always-on contract'));
  const production = files.filter(f => /^js\/[\w.-]+\.js$/.test(f));
  if (production.length) ON_PRODUCTION_CHANGE.forEach(t => add(t, 'production source changed'));
  const flows = workflows(), canonical = canonicalTests();
  // CI-only unless some PR-runnable job (or the canonical suite) also runs the test.
  const runsLocally = new Set([...canonical, ...flows.flatMap(w => w.tests)]);
  const ciOnly = new Set(flows.flatMap(w => w.ciOnly).filter(t => !runsLocally.has(t)));
  const runnable = new Set([...canonical, ...registryTests(), ...flows.flatMap(w => [...w.tests, ...w.ciOnly])]);
  for (const file of files) if (runnable.has(file)) add(file, 'changed test');
  // Any changed file under tests/ or scripts/ (helper, fixture, harness, a test that other tests extend, or a
  // deleted file) selects every test that requires it, transitively.
  // Production modules under js/ are matched below; docs (*.md) select only the always-on contracts. Every
  // other changed file (tests/, scripts/, prototypes/, assets/, css/, ...) selects the tests that load it.
  const support = files.filter(f => !/^js\/[\w.-]+\.js$/.test(f) && !/\.md$/i.test(f));
  if (support.length) for (const test of runnable) {
    if (!exists(test)) continue;
    // A literal relative require, or a code reference to the file's repo path or quoted basename
    // (e.g. `require(path.join(ROOT, 'scripts/x.js'))` or `fs.readFileSync(... 'x.js')`).
    const hit = support.find(f => f !== test && (localRequires(test).has(f) || referencesPath(test, f)));
    if (hit) add(test, `requires ${hit}`);
  }
  for (const w of flows.filter(flow => flow.patterns.length)) {
    const hit = files.find(f => w.patterns.some(p => (!p.broad || BROAD) && p.re.test(f)));
    if (hit) [...w.tests, ...w.ciOnly].forEach(t => add(t, `${w.name} paths: ${hit}`));
  }
  if (production.length) {
    // The selector's own test names production files as data; it is not a focused module test.
    const corpus = canonical.filter(t => t !== 'tests/select-affected-tests-test.js').map(t => {
      const text = fs.readFileSync(path.join(ROOT, t), 'utf8');
      return { t, text, code: stripComments(text) };
    });
    const unfocused = [];
    for (const file of production) {
      const base = path.basename(file, '.js'), key = camel(base);
      let focused = 0;
      // Only references in code count as focused; a filename that appears only in a comment still selects the
      // test, but does not suppress the harness fallback below.
      // A multi-word module name is distinctive enough to match as a bare binding (e.g. a destructured
      // `{ playerCrisisRestructuring } = modules`); a one-word name must be read through `modules.`.
      const named = /[A-Z]/.test(key) ? new RegExp(`\\b${key}\\b`) : new RegExp(`modules\\??\\.${key}\\b`);
      for (const { t, text, code } of corpus) {
        if (code.includes(`${base}.js`) || named.test(code)) { add(t, `references ${file}`); focused++; }
        else if (text.includes(`${base}.js`)) add(t, `mentions ${file}`);
      }
      if (!focused && !CORE_MODULES.includes(base)) unfocused.push(file);
    }
    // Fail safe: a module with no focused test (e.g. one that extends a shared namespace such as
    // modules.competitor) is reached only through the booted game, like a core module.
    for (const file of unfocused) for (const { t } of corpus) if (bootsGame(t)) add(t, `boots the game; no focused test for ${file}`);
    // Tests that boot the whole game through tests/harness.js load every module transitively. A change
    // to a core module (state, RNG, accounting, save) reaches them without any textual reference.
    const core = production.filter(f => CORE_MODULES.includes(path.basename(f, '.js')));
    if (core.length) for (const { t } of corpus) if (bootsGame(t)) add(t, `boots the game; core module ${core[0]} changed`);
  }
  const all = [...reasons.keys()].sort(), row = t => ({ test: t, reasons: [...reasons.get(t)] });
  return {
    base: BASE, changedFiles: files,
    ciOnly: all.filter(t => ciOnly.has(t)).map(row),
    node: all.filter(t => !t.endsWith('-webkit-test.js') && !ciOnly.has(t)).map(row),
    webkit: all.filter(t => t.endsWith('-webkit-test.js') && !ciOnly.has(t)).map(row)
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

module.exports = { select, globToRegExp, camel, canonicalTests, triggers, ciOnlyJob };

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
