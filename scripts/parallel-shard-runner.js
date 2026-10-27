#!/usr/bin/env node
'use strict';
// Stage-0 parallel shard runner. NOT connected to tests/run-all-shard.js or any workflow: it is a standalone
// module/CLI that executes the commands a canonical shard owns, with bounded concurrency, and proves the run.
//
//   node scripts/parallel-shard-runner.js --shard J --concurrency 4 [--order longest-first --timings t.json]
//        [--serial label,label | --serial-config scripts/parallel-shard-runner.config.json]
//        [--test-timeout-sec 1800] [--run-timeout-sec 0] [--no-fail-fast] [--sample-ms 250] [--leftover-grace-ms 2000] [--report r.json] [--write-timings t.json]
//   node scripts/parallel-shard-runner.js --shard J --enumerate-only      # list (and digest) what would run
//   node scripts/parallel-shard-runner.js --shard A --audit               # static shared-state audit (heuristic)
//   node scripts/parallel-shard-runner.js --commands-file cmds.json ...   # explicit [{label?,command,args}] list
//
// Enumeration reuses the production code path: tests/run-all-shard.js is loaded in a child process whose
// spawnSync only RECORDS the commands the shard owns (nothing executes), so the list cannot drift from the runner.
// Differences from the serial runner (intentional, documented in docs/parallel-shard-runner.md):
//   * a command killed by a signal, timed out, over the output cap or failing to spawn is a FAILURE here; the serial
//     runner only checks `result.status` and therefore treats status === null (signal / ENOBUFS / spawn error) as a pass;
//   * on the first failure the remaining running commands are terminated (serial stops launching new ones);
//   * commands run in `recorded` order or `longest-first` order; serial-group commands always run alone, first.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGE_BYTES = (() => { try { return Number(childProcess.execFileSync('getconf', ['PAGESIZE'], { encoding: 'utf8' })) || 4096; } catch { return 4096; } })();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function labelOf(command, args = []) {
  if (command === 'npm' && args[0] === 'run') return String(args[1] || 'npm-run');
  if (command === 'node' && args[0]) return path.relative(ROOT, path.resolve(ROOT, String(args[0]))).split(path.sep).join('/');
  return [command, ...args].join(' ');
}

// ---- enumeration -------------------------------------------------------------------------------------------
const ENUMERATOR = `
const cp = require('node:child_process'), fs = require('node:fs');
const rec = [];
cp.spawnSync = (command, args) => { rec.push({ command, args: [...(args || [])] }); return { status: 0, signal: null, stdout: '', stderr: '', pid: 0, output: [null, '', ''] }; };
process.on('exit', () => fs.writeFileSync(process.env.PSR_ENUM_OUT, JSON.stringify(rec)));
require(process.env.PSR_RUNNER);
`;

function digestOf(items) {
  return crypto.createHash('sha256').update(JSON.stringify(items.map(i => [i.label, i.command, i.args]))).digest('hex');
}

function enumerateShard(shard, { root = ROOT } = {}) {
  const out = path.join(require('node:os').tmpdir(), `psr-enum-${process.pid}-${Date.now()}-${shard}.json`);
  const result = childProcess.spawnSync(process.execPath, ['-e', ENUMERATOR], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, TEST_SHARD: shard, TEST_SHARD_CONTRACT: '', PSR_ENUM_OUT: out, PSR_RUNNER: path.join(root, 'tests', 'run-all-shard.js') }
  });
  let rec = null;
  try { rec = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { /* reported below */ } finally { fs.rmSync(out, { force: true }); }
  if (result.status !== 0 || !rec) throw new Error(`shard ${shard} enumeration failed (exit ${result.status}): ${String(result.stderr || result.stdout).slice(-600)}`);
  return rec.map((c, index) => ({ index, label: labelOf(c.command, c.args), command: c.command, args: c.args }));
}

// ---- static shared-state audit (heuristic; reads the test and its relative requires, and npm script bodies) ----
const SHARED_STATE = /writeFileSync|appendFileSync|mkdirSync|createWriteStream|\.listen\(|process\.chdir|\/tmp\/|tmpdir|artifacts\/|rmSync|unlinkSync|renameSync|copyFileSync|process\.env\.[A-Z_]+\s*=/g;

function filesOf(item, root, seen = new Set(), depth = 0) {
  const files = [];
  const addFile = (rel, d) => {
    const abs = path.resolve(root, rel);
    if (seen.has(abs) || !fs.existsSync(abs) || !/\.(c?js)$/.test(abs)) return;
    seen.add(abs); files.push(path.relative(root, abs));
    if (d >= 2) return;
    const src = fs.readFileSync(abs, 'utf8');
    for (const m of src.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const base = path.resolve(path.dirname(abs), m[1]);
      for (const candidate of [base, `${base}.js`, `${base}.cjs`]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) { addFile(path.relative(root, candidate), d + 1); break; }
    }
  };
  if (item.command === 'node' && item.args[0]) addFile(item.args[0], depth);
  if (item.command === 'npm' && item.args[0] === 'run') {
    const script = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts || {})[item.args[1]] || '';
    for (const m of script.matchAll(/node\s+(?:--[\w=-]+\s+)*([\w./-]+\.c?js)/g)) addFile(m[1], depth);
  }
  return files;
}

function scanSharedState(items, { root = ROOT } = {}) {
  const found = {};
  for (const item of items) {
    const hits = new Set();
    for (const file of filesOf(item, root)) for (const m of fs.readFileSync(path.join(root, file), 'utf8').matchAll(SHARED_STATE)) hits.add(`${path.basename(file)}:${m[0]}`);
    if (hits.size) found[item.label] = [...hits].sort();
  }
  return found;
}

// ---- scheduling ------------------------------------------------------------------------------------------------
function scheduleOrder(items, { order = 'recorded', timings = {}, serial = [] } = {}) {
  if (!['recorded', 'longest-first'].includes(order)) throw new Error(`unknown order ${order}`);
  const known = new Set(items.map(i => i.label));
  const unknown = serial.filter(label => !known.has(label));
  if (unknown.length) throw new Error(`serial labels not in the enumerated list: ${unknown.join(', ')}`);
  const serialSet = new Set(serial);
  const serialPhase = items.filter(i => serialSet.has(i.label));
  const parallelPhase = items.filter(i => !serialSet.has(i.label));
  if (order === 'longest-first') parallelPhase.sort((a, b) => (Number(timings[b.label]) || 0) - (Number(timings[a.label]) || 0) || a.index - b.index);
  return { serialPhase, parallelPhase };
}

// Every enumerated command must end in exactly one terminal state; a clean run must have passed all of them.
function reconcile(items, results, { aborted }) {
  const states = new Set(['passed', 'failed', 'aborted', 'notStarted']);
  const counts = { passed: 0, failed: 0, aborted: 0, notStarted: 0 };
  for (const item of items) {
    const r = results[item.index];
    if (!r || !states.has(r.state)) throw new Error(`reconciliation: ${item.label} has no terminal state (${r && r.state})`);
    counts[r.state]++;
  }
  if (Object.keys(results).length !== items.length) throw new Error(`reconciliation: ${Object.keys(results).length} results for ${items.length} commands`);
  if (!aborted && !counts.failed && counts.passed !== items.length) throw new Error(`reconciliation: ${counts.passed}/${items.length} passed without a failure or abort`);
  if (!aborted && counts.passed + counts.failed !== items.length) throw new Error(`reconciliation: ${counts.passed + counts.failed}/${items.length} commands finished without an abort`);
  return counts;
}

// ---- /proc sampling (Linux; every value is null elsewhere) -----------------------------------------------------
const hasProc = process.platform === 'linux' && fs.existsSync('/proc/self/stat');
function readStat(pid) {
  try {
    const s = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const f = s.slice(s.lastIndexOf(')') + 2).split(' ');
    return { state: f[0], ppid: Number(f[1]), pgrp: Number(f[2]), cpuTicks: Number(f[11]) + Number(f[12]) + Number(f[13]) + Number(f[14]), rssPages: null };
  } catch { return null; }
}
// One /proc scan returns every live (non-zombie) process bucketed by process group.
function procGroups() {
  const groups = new Map();
  if (!hasProc) return groups;
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    const st = readStat(name);
    if (!st || st.state === 'Z') continue;
    let rss = 0; try { rss = Number(fs.readFileSync(`/proc/${name}/statm`, 'utf8').split(' ')[1]) * PAGE_BYTES; } catch { /* exited */ }
    if (!groups.has(st.pgrp)) groups.set(st.pgrp, []);
    groups.get(st.pgrp).push({ pid: Number(name), cpuTicks: st.cpuTicks, rssBytes: rss });
  }
  return groups;
}
function groupAlive(pgid) {
  if (hasProc) return procGroups().has(pgid); // ignores unreaped zombies that no one will ever wait for
  try { process.kill(-pgid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}
function systemSample() {
  if (!hasProc) return null;
  const cpu = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].split(/\s+/).slice(1).map(Number);
  const idle = cpu[3] + (cpu[4] || 0), total = cpu.reduce((a, b) => a + b, 0);
  const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
  return { idle, total, memAvailableKb: Number(/MemAvailable:\s+(\d+)/.exec(meminfo)[1]), memTotalKb: Number(/MemTotal:\s+(\d+)/.exec(meminfo)[1]) };
}
const TICKS = 100; // USER_HZ on Linux

async function killGroup(pgid, graceMs) {
  try { process.kill(-pgid, 'SIGTERM'); } catch (e) { if (e.code === 'ESRCH') return true; }
  for (let waited = 0; waited < graceMs; waited += 50) { if (!groupAlive(pgid)) return true; await delay(50); }
  try { process.kill(-pgid, 'SIGKILL'); } catch { /* already gone */ }
  for (let waited = 0; waited < 5000; waited += 50) { if (!groupAlive(pgid)) return true; await delay(50); }
  return !groupAlive(pgid);
}

// ---- execution -------------------------------------------------------------------------------------------------
async function runCommands(items, opts = {}) {
  const { concurrency = 1, order = 'recorded', timings = {}, serial = [], testTimeoutMs = 0, runTimeoutMs = 0, failFast = true,
    cwd = ROOT, maxBuffer = 64 * 1024 * 1024, sampleMs = 250, killGraceMs = 3000, leftoverGraceMs = 2000, env = process.env, log = () => {}, shardName = 'commands' } = opts;
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be a positive integer');
  const plan = scheduleOrder(items, { order, timings, serial });
  const results = {}; const active = new Map(); let seq = 0; let aborted = null; let firstFailure = null;
  for (const item of items) results[item.index] = { state: 'notStarted', label: item.label, index: item.index };
  const sys0 = systemSample(); let sysMin = sys0 && sys0.memAvailableKb;
  const started = Date.now(); const cpu0 = process.cpuUsage();

  const sampler = hasProc ? setInterval(() => {
    const s = systemSample(); if (s) { sysMin = Math.min(sysMin, s.memAvailableKb); }
    const groups = procGroups();
    for (const [pid, ctx] of active) {
      const members = groups.get(pid); if (!members) continue;
      ctx.peakRssBytes = Math.max(ctx.peakRssBytes, members.reduce((a, m) => a + m.rssBytes, 0));
      ctx.cpuTicks = Math.max(ctx.cpuTicks, members.reduce((a, m) => a + m.cpuTicks, 0));
    }
  }, sampleMs) : null;

  const killActive = async reason => { await Promise.all([...active].map(([pid, ctx]) => { ctx.abortReason = reason; return killGroup(pid, killGraceMs); })); };
  const abortAll = reason => { if (aborted) return; aborted = reason; return killActive(reason); };
  const onExit = () => { for (const pid of active.keys()) { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } } };
  process.on('exit', onExit);
  const runTimer = runTimeoutMs ? setTimeout(() => { abortAll('run-timeout'); }, runTimeoutMs) : null;

  function runOne(item) {
    return new Promise(resolve => {
      if (aborted) return resolve(results[item.index]);
      const ctx = { peakRssBytes: 0, cpuTicks: 0, abortReason: null, out: [], err: [], bytes: 0, reason: null, leftoverKilled: false, exitTimer: null };
      const t0 = process.hrtime.bigint();
      let child;
      const finish = async (code, signal) => {
        const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
        if (child && child.pid) active.delete(child.pid);
        clearTimeout(ctx.timer); clearTimeout(ctx.exitTimer);
        const stillThere = child && child.pid ? groupAlive(child.pid) : false;
        if (stillThere) await killGroup(child.pid, killGraceMs);
        const leftover = stillThere || ctx.leftoverKilled;
        const stdout = Buffer.concat(ctx.out), stderr = Buffer.concat(ctx.err);
        // aborted = terminated by this runner after another command failed (or the run timed out); a command that had
        // already exited 0 by then is still a pass. A timeout / output cap / spawn error / signal / non-zero exit is a failure.
        const cleanExit = code === 0 && !signal && !ctx.reason;
        let state = 'passed', reason = null;
        if (cleanExit) state = 'passed';
        else if (ctx.abortReason) { state = 'aborted'; reason = ctx.abortReason; }
        else if (ctx.reason) { state = 'failed'; reason = ctx.reason; }
        else if (signal) { state = 'failed'; reason = `signal ${signal}`; }
        else { state = 'failed'; reason = `exit ${code}`; }
        const r = { state, reason, label: item.label, index: item.index, command: item.command, args: item.args, exitCode: code, signal: signal || null, wallMs,
          cpuMs: hasProc ? Math.round((ctx.cpuTicks / TICKS) * 1000) : null, peakRssMb: hasProc ? Math.round(ctx.peakRssBytes / 1048576) : null,
          stdoutBytes: stdout.length, stderrBytes: stderr.length, stdoutSha256: crypto.createHash('sha256').update(stdout).digest('hex'),
          stderrSha256: crypto.createHash('sha256').update(stderr).digest('hex'), stdoutLines: stdout.toString('utf8').split('\n').length - 1,
          passLines: (stdout.toString('utf8').match(/PASS/g) || []).length, leftoverProcesses: leftover, finishedSeq: ++seq };
        Object.defineProperty(r, 'stdout', { value: stdout, enumerable: false }); Object.defineProperty(r, 'stderr', { value: stderr, enumerable: false });
        results[item.index] = r;
        log(`[parallel-shard] done ${item.label} in ${(wallMs / 1000).toFixed(1)}s (${state}${reason ? `: ${reason}` : ''})`);
        if (state === 'passed') log(`::notice title=Shard ${shardName} timing::${item.label} ${(wallMs / 1000).toFixed(3)}s`);
        if (state === 'failed' && !firstFailure) { firstFailure = r; if (failFast) await abortAll('first-failure'); }
        resolve(r);
      };
      try {
        child = childProcess.spawn(item.command, item.args, { cwd, env: item.env ? { ...env, ...item.env } : env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) { ctx.reason = `spawn error: ${e.message}`; return finish(null, null); }
      results[item.index] = { ...results[item.index], state: 'running' };
      log(`[parallel-shard] start ${item.label}`);
      if (child.pid) active.set(child.pid, ctx);
      const take = (list, chunk) => { ctx.bytes += chunk.length; if (ctx.bytes > maxBuffer) { if (!ctx.reason) { ctx.reason = 'output exceeded maxBuffer'; killGroup(child.pid, killGraceMs); } return; } list.push(chunk); };
      child.stdout.on('data', c => take(ctx.out, c)); child.stderr.on('data', c => take(ctx.err, c));
      if (testTimeoutMs) ctx.timer = setTimeout(() => { if (!ctx.reason) { ctx.reason = `timeout after ${testTimeoutMs}ms`; killGroup(child.pid, killGraceMs); } }, testTimeoutMs);
      child.on('error', e => { if (!ctx.reason) ctx.reason = `spawn error: ${e.message}`; });
      // The command itself has exited but a descendant may still hold its stdout/stderr pipes, which delays 'close'
      // indefinitely. Give such descendants a short grace to finish, then terminate the group so 'close' can fire.
      child.on('exit', () => {
        ctx.exitTimer = setTimeout(() => { if (child.pid && groupAlive(child.pid)) { ctx.leftoverKilled = true; killGroup(child.pid, killGraceMs); } }, leftoverGraceMs);
      });
      child.on('close', (code, signal) => { finish(code, signal); });
    });
  }

  try {
    for (const item of plan.serialPhase) { if (aborted) break; await runOne(item); } // serial group: alone, in recorded order
    let next = 0;
    const worker = async () => { while (!aborted && next < plan.parallelPhase.length) { const item = plan.parallelPhase[next++]; await runOne(item); } };
    await Promise.all(Array.from({ length: Math.min(concurrency, plan.parallelPhase.length) }, worker));
  } finally {
    clearTimeout(runTimer); if (sampler) clearInterval(sampler); process.removeListener('exit', onExit);
  }
  // Anything still marked running (terminated by an abort) is an aborted command.
  for (const item of items) if (results[item.index].state === 'running') results[item.index] = { ...results[item.index], state: 'aborted', reason: aborted };
  const counts = reconcile(items, results, { aborted: Boolean(aborted) });
  const sys1 = systemSample(); const wallMs = Date.now() - started;
  const cpuUtil = sys0 && sys1 ? 1 - (sys1.idle - sys0.idle) / (sys1.total - sys0.total) : null;
  const ordered = items.map(i => results[i.index]);
  return {
    ok: !aborted && !firstFailure && counts.passed === items.length, abortedReason: aborted, firstFailure: firstFailure && firstFailure.label,
    firstFailureResult: firstFailure, counts: { enumerated: items.length, ...counts }, concurrency, order, serial: plan.serialPhase.map(i => i.label),
    enumerationDigest: digestOf(items), wallMs, systemCpuUtilization: cpuUtil,
    // In use = MemTotal - lowest MemAvailable seen (includes whatever was already running); growth = rise over the start of the run.
    peakSystemMemInUseMb: sys0 ? Math.round((sys0.memTotalKb - sysMin) / 1024) : null,
    peakSystemMemGrowthMb: sys0 ? Math.round((sys0.memAvailableKb - sysMin) / 1024) : null,
    runnerCpuSeconds: (({ user, system }) => (user + system) / 1e6)(process.cpuUsage(cpu0)),
    cpuSecondsSampled: hasProc ? ordered.reduce((a, r) => a + (r.cpuMs || 0), 0) / 1000 : null, results: ordered
  };
}

// ---- CLI -----------------------------------------------------------------------------------------------------------
async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const flag = n => argv.includes(n);
  const shard = opt('--shard');
  let items;
  if (opt('--commands-file')) {
    items = JSON.parse(fs.readFileSync(opt('--commands-file'), 'utf8')).map((c, index) => ({ index, label: c.label || labelOf(c.command, c.args || []), command: c.command, args: c.args || [], env: c.env }));
  } else if (shard) items = enumerateShard(shard);
  else { console.error('usage: --shard <A-L> | --commands-file <json>'); return 2; }
  if (flag('--enumerate-only')) { console.log(JSON.stringify({ shard: shard || null, count: items.length, digest: digestOf(items), labels: items.map(i => i.label) }, null, 2)); return 0; }
  if (flag('--audit')) { console.log(JSON.stringify(scanSharedState(items), null, 2)); return 0; }
  let serial = (opt('--serial', '') || '').split(',').filter(Boolean);
  if (opt('--serial-config') && shard) {
    const cfg = JSON.parse(fs.readFileSync(opt('--serial-config'), 'utf8'));
    const known = new Set(items.map(i => i.label));
    const listed = (cfg.serial && cfg.serial[shard]) || [];
    for (const label of listed) if (!known.has(label)) console.error(`::warning::serial config label not in shard ${shard}: ${label}`);
    serial = serial.concat(listed.filter(l => known.has(l)));
  }
  const timings = opt('--timings') ? JSON.parse(fs.readFileSync(opt('--timings'), 'utf8')) : {};
  const interrupt = signal => { console.error(`[parallel-shard] ${signal}: terminating children`); process.exitCode = signal === 'SIGINT' ? 130 : 143; process.exit(process.exitCode); };
  process.on('SIGINT', () => interrupt('SIGINT')); process.on('SIGTERM', () => interrupt('SIGTERM')); // the 'exit' hook inside runCommands kills the groups
  const report = await runCommands(items, {
    concurrency: Number(opt('--concurrency', '1')), order: opt('--order', 'recorded'), timings, serial,
    testTimeoutMs: Number(opt('--test-timeout-sec', '1800')) * 1000, runTimeoutMs: Number(opt('--run-timeout-sec', '0')) * 1000,
    failFast: !flag('--no-fail-fast'), sampleMs: Number(opt('--sample-ms', '250')), leftoverGraceMs: Number(opt('--leftover-grace-ms', '2000')), shardName: shard || 'commands', log: line => console.log(line)
  });
  if (opt('--report')) fs.writeFileSync(opt('--report'), JSON.stringify(report, null, 2));
  if (opt('--write-timings')) fs.writeFileSync(opt('--write-timings'), JSON.stringify(Object.fromEntries(report.results.filter(r => r.state === 'passed').map(r => [r.label, Number((r.wallMs / 1000).toFixed(1))])), null, 2));
  const c = report.counts;
  console.log(`parallel-shard-summary: shard=${shard || '-'} concurrency=${report.concurrency} order=${report.order} enumerated=${c.enumerated} passed=${c.passed} failed=${c.failed} aborted=${c.aborted} notStarted=${c.notStarted} wall=${(report.wallMs / 1000).toFixed(1)}s digest=${report.enumerationDigest.slice(0, 12)}`);
  if (report.firstFailureResult) {
    const f = report.firstFailureResult;
    console.error(`::error title=Test suite failed::${f.label}`);
    if (f.stdout && f.stdout.length) process.stdout.write(f.stdout);
    if (f.stderr && f.stderr.length) process.stderr.write(f.stderr);
    return typeof f.exitCode === 'number' && f.exitCode > 0 ? f.exitCode : 1;
  }
  if (report.abortedReason === 'run-timeout') return 124;
  return report.ok ? 0 : 1;
}

// ---- opt-in entry for tests/run-all-shard.js (stage 1) ------------------------------------------------------------------
// `planned` is what the production wrapper recorded for the shard instead of running it. Returns the process exit code.
function parseParallelism(raw, shard, getConfig, warn = line => console.error(line)) {
  if (raw === undefined || raw === '') return 1;
  if (!/^\d+$/.test(String(raw)) || Number(raw) < 1) { warn(`::warning::TEST_SHARD_PARALLELISM=${raw} is not a positive integer; running serially`); return 1; }
  const n = Math.min(Number(raw), 8);
  if (n === 1) return 1; // the config is only read when parallel execution is actually requested
  const config = typeof getConfig === 'function' ? getConfig() : getConfig;
  if (!((config.parallelEnabledShards || []).includes(shard))) { warn(`::warning::shard ${shard} is not enabled for parallel execution in scripts/parallel-shard-runner.config.json; running serially`); return 1; }
  return n;
}

function loadConfig() { return JSON.parse(fs.readFileSync(path.join(__dirname, 'parallel-shard-runner.config.json'), 'utf8')); }

async function runShard({ shard, planned, concurrency, executed, env = process.env, log = line => console.log(line), warn = line => console.error(line) }) {
  const config = loadConfig();
  const known = new Set(planned.map(i => i.label));
  const configuredSerial = (config.serial || {})[shard] || [];
  for (const label of configuredSerial) if (!known.has(label)) warn(`::warning::serial config label not owned by shard ${shard}: ${label}`);
  const timings = (config.timings || {})[shard] || {};
  const order = env.TEST_SHARD_PARALLEL_ORDER || (Object.keys(timings).length ? 'longest-first' : 'recorded');
  const interrupt = code => () => process.exit(code); // the 'exit' hook inside runCommands kills every process group
  process.on('SIGINT', interrupt(130)); process.on('SIGTERM', interrupt(143));
  const report = await runCommands(planned, {
    concurrency, order, timings, serial: configuredSerial.filter(l => known.has(l)), shardName: shard, log,
    testTimeoutMs: Number(env.TEST_SHARD_PARALLEL_TEST_TIMEOUT_SEC || 1500) * 1000, runTimeoutMs: Number(env.TEST_SHARD_PARALLEL_RUN_TIMEOUT_SEC || 1680) * 1000
  });
  for (const r of report.results) if (r.state === 'passed' || r.state === 'failed') executed.push({ label: r.label, elapsedMs: r.wallMs });
  if (env.TEST_SHARD_PARALLEL_REPORT) {
    fs.mkdirSync(path.dirname(path.resolve(env.TEST_SHARD_PARALLEL_REPORT)), { recursive: true });
    fs.writeFileSync(env.TEST_SHARD_PARALLEL_REPORT, JSON.stringify({ shard, ...report }, null, 2));
  }
  const c = report.counts;
  log(`parallel-shard-summary: shard=${shard} concurrency=${concurrency} order=${report.order} enumerated=${c.enumerated} passed=${c.passed} failed=${c.failed} aborted=${c.aborted} notStarted=${c.notStarted} wall=${(report.wallMs / 1000).toFixed(1)}s digest=${report.enumerationDigest.slice(0, 12)} peakMemInUseMb=${report.peakSystemMemInUseMb} systemCpu=${report.systemCpuUtilization === null ? 'n/a' : Math.round(report.systemCpuUtilization * 100) + '%'} runnerCpu=${report.runnerCpuSeconds.toFixed(1)}s`);
  const f = report.firstFailureResult;
  if (f) {
    console.error(`::error title=Test suite failed::${f.label}`);
    if (f.signal || f.reason) console.error(`abnormal exit: ${f.reason}`);
    if (f.stdout && f.stdout.length) process.stdout.write(f.stdout);
    if (f.stderr && f.stderr.length) process.stderr.write(f.stderr);
    return typeof f.exitCode === 'number' && f.exitCode > 0 ? f.exitCode : 1;
  }
  if (report.abortedReason === 'run-timeout') { console.error(`::error title=Test suite failed::shard ${shard} exceeded the parallel run timeout`); return 124; }
  return report.ok ? 0 : 1;
}

module.exports = { labelOf, enumerateShard, digestOf, scanSharedState, scheduleOrder, reconcile, runCommands, killGroup, groupAlive, parseParallelism, loadConfig, runShard };
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error); process.exitCode = 3; });
