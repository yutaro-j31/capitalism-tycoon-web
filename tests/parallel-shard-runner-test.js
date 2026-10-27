'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const runner = require('../scripts/parallel-shard-runner');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'psr-test-'));
const node = (label, code, extra = {}) => ({ label, command: 'node', args: ['-e', code], ...extra });
const items = list => list.map((c, index) => ({ index, label: c.label, command: c.command, args: c.args || [], env: c.env }));
const alive = pid => {
  try {
    const st = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return st.slice(st.lastIndexOf(')') + 2)[0] !== 'Z';
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ESRCH') return false;
    try { process.kill(pid, 0); return true; } catch { return false; }
  }
};
const waitDead = async (pids, ms = 6000) => {
  for (let t = 0; t < ms; t += 50) { if (!pids.some(alive)) return true; await new Promise(r => setTimeout(r, 50)); }
  return false;
};
const sleepForever = 'setInterval(()=>{},1000)';

(async () => {
  // ---- enumeration is the production code path, reproducible, and partitions the canonical suite ----------------
  const first = runner.enumerateShard('J'), second = runner.enumerateShard('J');
  assert.deepEqual(first, second, 'same input -> same enumerated list in the same order');
  assert.equal(runner.digestOf(first), runner.digestOf(second));
  const shardConfig = require('./run-all-shards.json');
  const all = new Map();
  for (const shard of 'ABCDEFGHIJKL') {
    const list = runner.enumerateShard(shard);
    assert.ok(list.length > 0, `shard ${shard} owns commands`);
    for (const item of list) {
      assert.ok(!all.has(item.label), `${item.label} is owned by exactly one shard (${all.get(item.label)} and ${shard})`);
      all.set(item.label, shard);
    }
    if (shard !== 'A') assert.deepEqual(new Set(list.map(i => i.label)), new Set(shardConfig[shard]), `shard ${shard} enumeration equals tests/run-all-shards.json`);
  }
  const contract = childProcess.spawnSync(process.execPath, ['tests/run-all-shard.js'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TEST_SHARD: 'A', TEST_SHARD_CONTRACT: '1' } });
  assert.equal(contract.status, 0, 'production shard contract run');
  const seen = Number(/seen=(\d+)/.exec(contract.stdout)[1]);
  assert.equal(all.size, seen, 'the 12 enumerations together cover every canonical command the production runner sees');

  // ---- scheduling -------------------------------------------------------------------------------------------------
  const sched = items(['a', 'b', 'c', 'd', 'e'].map(l => node(l, '0')));
  const recorded = runner.scheduleOrder(sched, { serial: ['c'] });
  assert.deepEqual(recorded.serialPhase.map(i => i.label), ['c']);
  assert.deepEqual(recorded.parallelPhase.map(i => i.label), ['a', 'b', 'd', 'e']);
  const lpt = runner.scheduleOrder(sched, { order: 'longest-first', timings: { d: 50, b: 50, e: 10 } });
  assert.deepEqual(lpt.parallelPhase.map(i => i.label), ['b', 'd', 'e', 'a', 'c'], 'longest first, ties and unknown timings keep recorded order');
  assert.throws(() => runner.scheduleOrder(sched, { serial: ['nope'] }), /serial labels not in the enumerated list: nope/);
  assert.throws(() => runner.scheduleOrder(sched, { order: 'random' }), /unknown order/);

  // ---- count reconciliation -----------------------------------------------------------------------------------------
  const done = (i, state) => ({ index: i, label: String(i), state });
  assert.deepEqual(runner.reconcile(items([node('0', '0'), node('1', '0')]), { 0: done(0, 'passed'), 1: done(1, 'passed') }, { aborted: false }), { passed: 2, failed: 0, aborted: 0, notStarted: 0 });
  assert.throws(() => runner.reconcile(items([node('0', '0'), node('1', '0')]), { 0: done(0, 'passed') }, { aborted: false }), /no terminal state/);
  assert.throws(() => runner.reconcile(items([node('0', '0')]), { 0: done(0, 'running') }, { aborted: false }), /no terminal state/);
  assert.throws(() => runner.reconcile(items([node('0', '0')]), { 0: done(0, 'notStarted') }, { aborted: false }), /0\/1 passed without a failure or abort/);
  assert.equal(runner.reconcile(items([node('0', '0')]), { 0: done(0, 'notStarted') }, { aborted: true }).notStarted, 1);

  // ---- identical results at concurrency 1, 2 and 4, in any order; concurrency 1 matches the serial reference -----------------
  const body = i => node(`t${i}`, `setTimeout(()=>{console.log('PASS t${i}');console.error('note ${i}');},${(7 - i) * 40})`);
  const set = items([0, 1, 2, 3, 4, 5, 6].map(body));
  const fingerprint = report => report.results.map(r => [r.label, r.state, r.exitCode, r.stdoutSha256, r.stderrSha256, r.passLines]).sort((a, b) => a[0].localeCompare(b[0]));
  const serialReference = set.map(i => {
    const r = childProcess.spawnSync(i.command, i.args, { encoding: 'utf8' });
    return [i.label, 'passed', r.status, require('node:crypto').createHash('sha256').update(Buffer.from(r.stdout)).digest('hex'), require('node:crypto').createHash('sha256').update(Buffer.from(r.stderr)).digest('hex'), (r.stdout.match(/PASS/g) || []).length];
  }).sort((a, b) => a[0].localeCompare(b[0]));
  const startOrder = [];
  const r1 = await runner.runCommands(set, { concurrency: 1, log: l => { const m = /start (t\d)/.exec(l); if (m) startOrder.push(m[1]); } });
  assert.deepEqual(startOrder, ['t0', 't1', 't2', 't3', 't4', 't5', 't6'], 'concurrency 1 runs in recorded order');
  assert.deepEqual(fingerprint(r1), serialReference, 'concurrency 1 equals the serial reference (exit code, stdout, stderr, PASS lines)');
  assert.equal(r1.ok, true); assert.deepEqual(r1.counts, { enumerated: 7, passed: 7, failed: 0, aborted: 0, notStarted: 0 });
  for (const [concurrency, order, timings] of [[2, 'recorded', {}], [4, 'recorded', {}], [4, 'longest-first', { t6: 9, t5: 8, t4: 7 }], [4, 'longest-first', { t0: 9, t1: 8 }]]) {
    const r = await runner.runCommands(set, { concurrency, order, timings });
    assert.deepEqual(fingerprint(r), serialReference, `concurrency ${concurrency} ${order}: same results as the serial reference`);
    assert.equal(r.enumerationDigest, r1.enumerationDigest);
    assert.ok(r.results.every(x => x.wallMs > 0 && x.stdoutBytes > 0));
  }
  const timed = await runner.runCommands(set, { concurrency: 4 });
  if (process.platform === 'linux') {
    assert.ok(timed.peakSystemMemUsedMb !== null && timed.systemCpuUtilization !== null && timed.results.every(r => r.peakRssMb !== null), 'resources are recorded on Linux');
  }

  // ---- first failure: non-zero outcome, output kept, running siblings terminated, none left behind ---------------------------
  const pidFile = n => path.join(TMP, `pid-${n}`);
  const slow = n => node(`slow${n}`, `require('fs').writeFileSync(${JSON.stringify(pidFile(n))},String(process.pid));${sleepForever}`);
  const failing = node('fails', `require('fs').writeFileSync(${JSON.stringify(pidFile('f'))},'x');setTimeout(()=>{console.log('partial stdout');console.error('the reason');process.exit(3)},700)`);
  const t0 = Date.now();
  const failed = await runner.runCommands(items([slow(1), slow(2), failing, node('never-started', "console.log('PASS')")]), { concurrency: 3 });
  assert.equal(failed.ok, false); assert.equal(failed.firstFailure, 'fails'); assert.equal(failed.firstFailureResult.exitCode, 3);
  assert.equal(failed.firstFailureResult.stdout.toString(), 'partial stdout\n'); assert.equal(failed.firstFailureResult.stderr.toString(), 'the reason\n');
  assert.deepEqual(failed.counts, { enumerated: 4, passed: 0, failed: 1, aborted: 2, notStarted: 1 });
  assert.equal(failed.results[3].state, 'notStarted', 'nothing new starts after the first failure');
  assert.ok(Date.now() - t0 < 15000, 'siblings were terminated instead of running to completion');
  assert.ok(await waitDead([1, 2].map(n => Number(fs.readFileSync(pidFile(n), 'utf8')))), 'terminated siblings are gone');
  const keepGoing = await runner.runCommands(items([node('ok1', "console.log('PASS')"), node('bad', 'process.exit(5)'), node('ok2', "console.log('PASS')")]), { concurrency: 2, failFast: false });
  assert.deepEqual(keepGoing.counts, { enumerated: 3, passed: 2, failed: 1, aborted: 0, notStarted: 0 }); assert.equal(keepGoing.ok, false);

  // ---- abnormal endings are failures (the serial runner's `if (result.status)` passes them) -------------------------------------
  const killedSelf = "process.kill(process.pid,'SIGKILL')";
  assert.equal(childProcess.spawnSync('node', ['-e', killedSelf]).status, null, 'a signal death leaves spawnSync status null, which the serial runner treats as a pass');
  const abnormal = await runner.runCommands(items([node('signal', killedSelf), { label: 'missing', command: 'definitely-not-a-command-psr', args: [] }, node('flood', "process.stdout.write('x'.repeat(2e6))")]), { concurrency: 1, failFast: false, maxBuffer: 100000 });
  assert.deepEqual(abnormal.results.map(r => [r.label, r.state]), [['signal', 'failed'], ['missing', 'failed'], ['flood', 'failed']]);
  assert.match(abnormal.results[0].reason, /signal SIGKILL/); assert.match(abnormal.results[1].reason, /spawn error/); assert.match(abnormal.results[2].reason, /maxBuffer/);

  // ---- timeout kills the whole process group, including grandchildren ------------------------------------------------------------
  const gcFile = path.join(TMP, 'grandchild');
  const withGrandchild = node('timeout', `const c=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(sleepForever)}],{stdio:'ignore'});require('fs').writeFileSync(${JSON.stringify(gcFile)},String(c.pid));${sleepForever}`);
  const tStart = Date.now();
  const timedOut = await runner.runCommands(items([withGrandchild]), { testTimeoutMs: 700 });
  assert.equal(timedOut.results[0].state, 'failed'); assert.match(timedOut.results[0].reason, /timeout after 700ms/);
  assert.ok(Date.now() - tStart < 12000);
  assert.ok(await waitDead([Number(fs.readFileSync(gcFile, 'utf8'))]), 'no process left after a timeout');
  const runTimeout = await runner.runCommands(items([withGrandchild, node('other', sleepForever)]), { concurrency: 2, runTimeoutMs: 600 });
  assert.equal(runTimeout.abortedReason, 'run-timeout'); assert.equal(runTimeout.ok, false);
  assert.ok(await waitDead([Number(fs.readFileSync(gcFile, 'utf8'))]), 'no process left after the whole-run timeout');

  // ---- a passing command that leaves a background process behind is reported and cleaned up ---------------------------------------
  const bgFile = path.join(TMP, 'background');
  const leaky = node('leaky', `const c=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(sleepForever)}],{stdio:'ignore'});c.unref();require('fs').writeFileSync(${JSON.stringify(bgFile)},String(c.pid));console.log('PASS')`);
  const leak = await runner.runCommands(items([leaky]), {});
  assert.equal(leak.results[0].state, 'passed'); assert.equal(leak.results[0].leftoverProcesses, process.platform === 'linux');
  assert.ok(await waitDead([Number(fs.readFileSync(bgFile, 'utf8'))]), 'leftover background process was terminated');

  // ---- shared-state isolation: serial-group commands never overlap anything; the detector itself is proven by a negative control -----
  const lock = path.join(TMP, 'lock');
  const mutator = label => node(label, `const fs=require('fs');let fd;try{fd=fs.openSync(${JSON.stringify(lock)},'wx')}catch(e){console.error('OVERLAP');process.exit(9)}setTimeout(()=>{fs.closeSync(fd);fs.unlinkSync(${JSON.stringify(lock)})},500)`);
  const isolated = await runner.runCommands(items([mutator('mut1'), node('x', "setTimeout(()=>{},200)"), mutator('mut2'), node('y', "setTimeout(()=>{},200)")]), { concurrency: 4, serial: ['mut1', 'mut2'], failFast: false });
  assert.equal(isolated.ok, true, 'serial group serialises the file-sharing commands');
  assert.deepEqual(isolated.serial, ['mut1', 'mut2']);
  const raced = await runner.runCommands(items([mutator('mut1'), mutator('mut2')]), { concurrency: 2, failFast: false });
  assert.equal(raced.ok, false, 'negative control: without the serial group the shared lock is violated and detected');
  assert.ok(raced.results.some(r => r.exitCode === 9));

  // ---- the static shared-state audit finds writers through requires and npm script bodies ----------------------------------------
  fs.mkdirSync(path.join(TMP, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'tests', 'helper.js'), "require('fs').writeFileSync('x','y');\n");
  fs.writeFileSync(path.join(TMP, 'tests', 'a-test.js'), "require('./helper');\n");
  fs.writeFileSync(path.join(TMP, 'tests', 'pure-test.js'), "console.log(1);\n");
  fs.writeFileSync(path.join(TMP, 'package.json'), JSON.stringify({ scripts: { 'test:x': 'node tests/a-test.js && node tests/pure-test.js' } }));
  const audit = runner.scanSharedState([{ label: 'direct', command: 'node', args: ['tests/a-test.js'] }, { label: 'pure', command: 'node', args: ['tests/pure-test.js'] }, { label: 'test:x', command: 'npm', args: ['run', 'test:x', '--silent'] }], { root: TMP });
  assert.deepEqual(Object.keys(audit).sort(), ['direct', 'test:x'], 'writers found through a relative require and through an npm script; a pure test is not flagged');

  // ---- CLI: exit code and report propagate; SIGTERM terminates the children ---------------------------------------------------------
  const cli = ['scripts/parallel-shard-runner.js'];
  const cmdFile = path.join(TMP, 'cmds.json');
  fs.writeFileSync(cmdFile, JSON.stringify([{ label: 'one', command: 'node', args: ['-e', "console.log('PASS one')"] }, { label: 'two', command: 'node', args: ['-e', "console.error('bad');process.exit(7)"] }]));
  const out = childProcess.spawnSync(process.execPath, [...cli, '--commands-file', cmdFile, '--concurrency', '2', '--no-fail-fast', '--report', path.join(TMP, 'r.json'), '--write-timings', path.join(TMP, 't.json')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.status, 7, 'CLI exits with the failing command\'s status'); assert.match(out.stderr, /::error title=Test suite failed::two/); assert.match(out.stdout, /parallel-shard-summary: .*enumerated=2 passed=1 failed=1/);
  const report = JSON.parse(fs.readFileSync(path.join(TMP, 'r.json'), 'utf8'));
  assert.equal(report.counts.enumerated, 2); assert.equal(report.firstFailure, 'two');
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(TMP, 't.json'), 'utf8'))), ['one']);
  const sleepers = path.join(TMP, 'sleepers.json'); const sleeperPids = [1, 2].map(n => path.join(TMP, `sleeper-${n}`));
  fs.writeFileSync(sleepers, JSON.stringify(sleeperPids.map((f, i) => ({ label: `s${i}`, command: 'node', args: ['-e', `require('fs').writeFileSync(${JSON.stringify(f)},String(process.pid));${sleepForever}`] }))));
  const child = childProcess.spawn(process.execPath, [...cli, '--commands-file', sleepers, '--concurrency', '2'], { cwd: ROOT, stdio: 'ignore' });
  const exited = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal })));
  for (let t = 0; t < 8000 && !sleeperPids.every(f => fs.existsSync(f) && fs.readFileSync(f, 'utf8')); t += 50) await new Promise(r => setTimeout(r, 50));
  child.kill('SIGTERM');
  const result = await exited;
  assert.equal(result.code, 143, 'runner exits 143 on SIGTERM');
  assert.ok(await waitDead(sleeperPids.map(f => Number(fs.readFileSync(f, 'utf8')))), 'SIGTERM to the runner leaves no test process behind');

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('parallel-shard-runner-test: ok');
})().catch(error => { console.error(error); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(1); });
