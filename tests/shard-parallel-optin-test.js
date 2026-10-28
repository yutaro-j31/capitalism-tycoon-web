'use strict';

// Stage 1: tests/run-all-shard.js can run an enabled shard in parallel when TEST_SHARD_PARALLELISM >= 2, and is
// otherwise byte-for-byte the serial runner. The production runner files are copied unchanged into a temp directory
// whose owned tests are stubs, so this drives the real code paths without running the real suite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const shardConfig = require('./run-all-shards.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-optin-'));
const PASS = "console.log('PASS stub')";
const SLOW = "setTimeout(()=>console.log('PASS stub'),120)";
const sleepForever = 'setInterval(()=>{},1000)';
const alive = pid => { try { const st = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return st.slice(st.lastIndexOf(')') + 2)[0] !== 'Z'; } catch { return false; } };
const waitDead = async (pids, ms = 8000) => { for (let t = 0; t < ms; t += 50) { if (!pids.some(alive)) return true; await new Promise(r => setTimeout(r, 50)); } return false; };

function build(shard, overrides = {}, configPatch = null) {
  const dir = fs.mkdtempSync(path.join(TMP, `${shard}-`));
  fs.mkdirSync(path.join(dir, 'tests')); fs.mkdirSync(path.join(dir, 'scripts'));
  for (const f of ['run-all.js', 'run-all-shard.js', 'run-all-shards.json']) fs.copyFileSync(path.join(ROOT, 'tests', f), path.join(dir, 'tests', f));
  fs.copyFileSync(path.join(ROOT, 'scripts', 'parallel-shard-runner.js'), path.join(dir, 'scripts', 'parallel-shard-runner.js'));
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'parallel-shard-runner.config.json'), 'utf8'));
  if (configPatch) configPatch(config);
  fs.writeFileSync(path.join(dir, 'scripts', 'parallel-shard-runner.config.json'), JSON.stringify(config));
  const scripts = {};
  for (const label of shardConfig[shard]) {
    const body = overrides[label] || SLOW;
    if (label.startsWith('test:')) scripts[label] = `node -e "${body.replace(/"/g, '\\"')}"`;
    else { fs.mkdirSync(path.dirname(path.join(dir, label)), { recursive: true }); fs.writeFileSync(path.join(dir, label), body); }
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'sandbox', scripts }));
  return dir;
}
const run = (dir, shard, env = {}) => childProcess.spawnSync(process.execPath, ['tests/run-all-shard.js'], { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, TEST_SHARD: shard, TEST_SHARD_PARALLELISM: '', ...env } });
const norm = text => text.replace(/total=[\d.]+s/g, 'total=Xs').replace(/in [\d.]+s/g, 'in Xs').replace(/(::notice title=Shard \w+ timing::\S+) [\d.]+s/g, '$1 Xs');
const summary = text => /canonical-test-shard-summary: shard=(\w) contractOnly=(\w+) executed=(\d+) seen=(\d+) total=[\d.]+s/.exec(text);
const noticeLabels = text => [...text.matchAll(/::notice title=Shard \w+ timing::(\S+) [\d.]+s/g)].map(m => m[1]).sort();

(async () => {
  const jLabels = [...shardConfig.J].sort();
  const dirJ = build('J');

  // ---- default behaviour is the serial runner, whatever the variable holds (unset, empty, 1, invalid) -----------------
  const baseline = run(dirJ, 'J');
  assert.equal(baseline.status, 0, baseline.stderr);
  const [, , , baseExecuted, baseSeen] = summary(baseline.stdout);
  assert.equal(baseExecuted, String(jLabels.length)); assert.deepEqual(noticeLabels(baseline.stdout), jLabels);
  assert.match(baseline.stdout, /\[run-all node \d+\/\d+\] done .* \(exit 0\)/, 'serial log lines are kept');
  for (const value of ['', '1']) {
    const r = run(dirJ, 'J', { TEST_SHARD_PARALLELISM: value });
    assert.equal(r.status, 0, r.stderr); assert.equal(norm(r.stdout), norm(baseline.stdout), `PARALLELISM='${value}' output equals the unset output`); assert.equal(r.stderr, baseline.stderr);
  }
  for (const value of ['0', 'abc', '-3', '2.5']) {
    const r = run(dirJ, 'J', { TEST_SHARD_PARALLELISM: value });
    assert.equal(r.status, 0, r.stderr); assert.equal(norm(r.stdout), norm(baseline.stdout), `invalid PARALLELISM='${value}' still runs serially`);
    assert.match(r.stderr, /::warning::TEST_SHARD_PARALLELISM=.* is not a positive integer; running serially/);
  }
  const contractSerial = run(dirJ, 'J', { TEST_SHARD_CONTRACT: '1' }), contractParallel = run(dirJ, 'J', { TEST_SHARD_CONTRACT: '1', TEST_SHARD_PARALLELISM: '4' });
  assert.equal(norm(contractParallel.stdout), norm(contractSerial.stdout), 'contract mode ignores the variable'); assert.match(contractSerial.stdout, /contractOnly=true executed=0 /);

  // ---- a shard that is not enabled never runs in parallel ------------------------------------------------------------------
  const dirB = build('B');
  const notEnabled = run(dirB, 'B', { TEST_SHARD_PARALLELISM: '4' });
  assert.equal(notEnabled.status, 0, notEnabled.stderr); assert.match(notEnabled.stderr, /shard B is not enabled for parallel execution/);
  assert.doesNotMatch(notEnabled.stdout, /parallel-shard-summary/); assert.equal(summary(notEnabled.stdout)[3], String(shardConfig.B.length));

  // ---- parallel run: same commands, same summary contract, no premature success line --------------------------------------------
  const reportPath = path.join(TMP, 'report.json');
  const par = run(dirJ, 'J', { TEST_SHARD_PARALLELISM: '4', TEST_SHARD_PARALLEL_REPORT: reportPath });
  assert.equal(par.status, 0, par.stderr);
  const [, , , parExecuted, parSeen] = summary(par.stdout);
  assert.equal(parExecuted, baseExecuted); assert.equal(parSeen, baseSeen, 'the same commands are seen');
  assert.deepEqual(noticeLabels(par.stdout), jLabels, 'one timing notice per owned test, same labels');
  assert.doesNotMatch(par.stdout, /\[run-all node|all \d+ test commands/, 'the enumeration pass prints nothing that claims success');
  assert.match(par.stdout, /parallel-shard-summary: shard=J concurrency=4 order=longest-first enumerated=10 passed=10 failed=0 aborted=0 notStarted=0 /);
  if (process.platform === 'linux') assert.match(par.stdout, /peakMemInUseMb=\d+ systemCpu=\d+% runnerCpu=[\d.]+s/);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.counts.enumerated, jLabels.length); assert.equal(report.counts.passed, jLabels.length); assert.equal(report.shard, 'J');
  assert.equal(par.stdout.indexOf('canonical-test-shard-summary') > par.stdout.indexOf('parallel-shard-summary'), true, 'the canonical summary is printed last, at exit');

  // ---- concurrency 2 is a valid setting with the same contract ------------------------------------------------------------------
  const two = run(dirJ, 'J', { TEST_SHARD_PARALLELISM: '2' });
  assert.equal(two.status, 0, two.stderr); assert.match(two.stdout, /parallel-shard-summary: shard=J concurrency=2 /); assert.equal(summary(two.stdout)[3], baseExecuted); assert.equal(summary(two.stdout)[4], baseSeen);

  // ---- failures: same exit status as the serial runner, output kept, running tests terminated, none left behind -----------------
  const target = 'tests/vc-follow-on-save-atomicity-test.js'; assert.ok(shardConfig.J.includes(target));
  const pidFile = n => path.join(TMP, `pid-${n}`);
  const failBody = "console.error('the failure reason');setTimeout(()=>process.exit(3),400)";
  const dirFail = build('J', { [target]: failBody, 'tests/digital-portfolio-breakeven-seeds-test.js': `require('fs').writeFileSync(${JSON.stringify(pidFile('a'))},String(process.pid));${sleepForever}`, 'tests/ramen-supply-payment-terms-negative-test.js': `require('fs').writeFileSync(${JSON.stringify(pidFile('b'))},String(process.pid));${sleepForever}` });
  // two sleepers are running when the failure arrives: the parallel run must stop them (a serial run would wait for them forever)
  const termOnFail = run(dirFail, 'J', { TEST_SHARD_PARALLELISM: '4' });
  assert.equal(termOnFail.status, 3); assert.match(termOnFail.stderr, /the failure reason/);
  const dirFail2 = build('J', { [target]: failBody });
  const serialFail2 = run(dirFail2, 'J'), parFail2 = run(dirFail2, 'J', { TEST_SHARD_PARALLELISM: '4' });
  // The serial runner exits from inside run-all.js, before it has seen every configured label, so its exit handler also reports
  // "Configured shard entries not found" and overwrites the status with 1; the parallel run has seen everything and keeps the test's own 3.
  assert.ok(serialFail2.status === 1 || serialFail2.status === 3); assert.equal(parFail2.status, 3, 'the parallel run exits with the failing test\'s status');
  assert.notEqual(serialFail2.status, 0);
  for (const r of [serialFail2, parFail2]) { assert.match(r.stderr, /::error title=Test suite failed::/); assert.match(r.stderr, /the failure reason/); }
  assert.ok(Number(summary(parFail2.stdout)[3]) >= 1 && Number(summary(parFail2.stdout)[3]) <= jLabels.length, 'executed counts the commands that completed');
  assert.ok(await waitDead([pidFile('a'), pidFile('b')].map(f => Number(fs.readFileSync(f, 'utf8')))), 'sleepers terminated after the first failure are gone');

  // ---- abnormal endings and timeouts are failures; nothing is left running ---------------------------------------------------------
  const killed = run(build('J', { [target]: "process.kill(process.pid,'SIGKILL')" }), 'J', { TEST_SHARD_PARALLELISM: '4' });
  assert.notEqual(killed.status, 0); assert.match(killed.stderr, /::error title=Test suite failed::tests\/vc-follow-on-save-atomicity-test.js/); assert.match(killed.stderr, /abnormal exit: signal SIGKILL/);
  for (const [name, body, detail] of [['SIGABRT (V8 heap exhaustion)', 'process.abort()', /signal SIGABRT/], ['output beyond maxBuffer', "process.stdout.write('x'.repeat(70*1024*1024))", /maxBuffer/]]) {
    const r = run(build('J', { [target]: body }), 'J', { TEST_SHARD_PARALLELISM: '4' });
    assert.notEqual(r.status, 0, `${name} must fail the parallel run`); assert.match(r.stderr, detail, name);
  }
  const dirMissing = build('J'); fs.rmSync(path.join(dirMissing, target));
  const missing = run(dirMissing, 'J', { TEST_SHARD_PARALLELISM: '4' });
  assert.notEqual(missing.status, 0, 'a test file that cannot be run fails the parallel run'); assert.match(missing.stderr, /::error title=Test suite failed::tests\/vc-follow-on-save-atomicity-test.js/);
  const sleeperFile = path.join(TMP, 'sleeper');
  const timedOut = run(build('J', { [target]: `require('fs').writeFileSync(${JSON.stringify(sleeperFile)},String(process.pid));${sleepForever}` }), 'J', { TEST_SHARD_PARALLELISM: '4', TEST_SHARD_PARALLEL_TEST_TIMEOUT_SEC: '1' });
  assert.equal(timedOut.status, 1); assert.match(timedOut.stderr, /timeout after 1000ms/);
  assert.ok(await waitDead([Number(fs.readFileSync(sleeperFile, 'utf8'))]), 'the timed-out test is gone');

  // ---- serial-group isolation, with a negative control ----------------------------------------------------------------------------
  const lock = path.join(TMP, 'lock');
  const mutator = `const fs=require('fs');let fd;try{fd=fs.openSync(${JSON.stringify(lock)},'wx')}catch(e){console.error('OVERLAP');process.exit(9)}setTimeout(()=>{fs.closeSync(fd);fs.unlinkSync(${JSON.stringify(lock)})},600)`;
  const m1 = 'tests/pe-create-deal-save-atomicity-test.js', m2 = 'tests/pe-fund-acquisition-save-atomicity-test.js';
  const isolated = run(build('J', { [m1]: mutator, [m2]: mutator }, c => { c.serial.J = [m1, m2]; }), 'J', { TEST_SHARD_PARALLELISM: '4' });
  assert.equal(isolated.status, 0, isolated.stderr + isolated.stdout);
  const raced = run(build('J', { [m1]: mutator, [m2]: mutator }, c => { c.serial.J = []; c.timings.J = {}; }), 'J', { TEST_SHARD_PARALLELISM: '4' });
  assert.notEqual(raced.status, 0, 'negative control: without the serial group the shared lock is violated and the run fails');

  // ---- SIGTERM to the shard runner leaves no test process behind ------------------------------------------------------------------
  const termDir = build('J', Object.fromEntries(shardConfig.J.map((l, i) => [l, `require('fs').writeFileSync(${JSON.stringify(pidFile(`t${i}`))},String(process.pid));${sleepForever}`])));
  const child = childProcess.spawn(process.execPath, ['tests/run-all-shard.js'], { cwd: termDir, stdio: 'ignore', env: { ...process.env, TEST_SHARD: 'J', TEST_SHARD_PARALLELISM: '4' } });
  const exited = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal })));
  const started = () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => pidFile(`t${i}`)).filter(f => fs.existsSync(f) && fs.readFileSync(f, 'utf8'));
  for (let t = 0; t < 10000 && started().length < 4; t += 50) await new Promise(r => setTimeout(r, 50));
  assert.equal(started().length, 4, 'four tests were running (the concurrency)');
  child.kill('SIGTERM');
  assert.equal((await exited).code, 143);
  assert.ok(await waitDead(started().map(f => Number(fs.readFileSync(f, 'utf8')))), 'SIGTERM leaves no test process behind');

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('shard-parallel-optin-test: ok');
})().catch(error => { console.error(error); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(1); });
