#!/usr/bin/env node
'use strict';

// Branch-only E/K diagnosis. Does not enable a canonical shard.
// Refuses to run/kill process groups when Node PIDs and procfs use different namespaces.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const sha256 = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');
const runner = require('./parallel-shard-runner');
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const ROOT = option('--root') ? path.resolve(option('--root')) : path.resolve(__dirname, '..');
const fullShard = process.argv.includes('--full-e') ? 'E' : option('--full-shard');
if (fullShard && !['E', 'K'].includes(fullShard)) throw new Error('full-shard diagnosis supports E or K only');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseStat(text) {
  const end = text.lastIndexOf(')');
  if (end < 0) throw new Error('invalid proc stat');
  const f = text.slice(end + 2).trim().split(/\s+/);
  return { pid: Number(text.slice(0, text.indexOf(' '))), state: f[0], ppid: Number(f[1]),
    pgrp: Number(f[2]), session: Number(f[3]), startTicks: f[19] };
}
function stat(pid) { try { return parseStat(fs.readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return null; } }
function link(p) { try { return fs.readlinkSync(p); } catch { return null; } }
function identity() {
  const self = stat('self'), numbered = stat(process.pid);
  const consistent = Boolean(self && numbered && self.pid === process.pid && numbered.pid === process.pid &&
    self.startTicks === numbered.startTicks && self.pgrp === numbered.pgrp);
  return { nodePid: process.pid, self, numbered, consistent,
    selfPidNamespace: link('/proc/self/ns/pid'), numberedPidNamespace: link(`/proc/${process.pid}/ns/pid`),
    procMount: fs.existsSync('/proc/mounts') ? fs.readFileSync('/proc/mounts', 'utf8').split('\n').filter(l => l.split(' ')[1] === '/proc') : [] };
}
function members(pgid) {
  return fs.readdirSync('/proc').filter(n => /^\d+$/.test(n)).map(stat)
    .filter(p => p && p.pgrp === pgid);
}
function live(pgid) { return members(pgid).filter(p => p.state !== 'Z'); }
function classify(consistent, observed, remaining) {
  if (!consistent) return 'unverifiable-pid-namespace';
  if (remaining.length) return 'still-alive-after-run';
  return observed ? 'observed-and-cleaned' : 'clean';
}
function traceItem(items, event) {
  const matches = items.filter(c => c.command === event.command && JSON.stringify(c.args) === JSON.stringify(event.args));
  assert.equal(matches.length, 1, 'every traced process uniquely matches an enumerated command');
  return matches[0];
}
function compareOutputs(reference, result) {
  assert.equal(result.enumerationDigest, reference.enumerationDigest);
  assert.equal(result.results.length, reference.results.length);
  for (let i = 0; i < reference.results.length; i++)
    for (const field of ['label', 'state', 'exitCode', 'signal', 'stdoutSha256', 'stderrSha256', 'stdoutBytes', 'stderrBytes', 'stdoutLines', 'passLines'])
      assert.deepEqual(result.results[i][field], reference.results[i][field], `${reference.results[i].label}: ${field} parity`);
}
// Keep byte-exact evidence separate from the runner's non-enumerable buffers.
// Only used by this optional diagnostic; canonical reports remain unchanged.
function retainedOutputs(results) {
  return results.map(r => {
    const evidence = { index: r.index, label: r.label, state: r.state };
    if (r.state === 'notStarted') return { ...evidence, unavailable: 'not-started' };
    for (const stream of ['stdout', 'stderr']) {
      const bytes = r[stream];
      assert.ok(Buffer.isBuffer(bytes), `${r.label}: ${stream} capture missing`);
      assert.equal(bytes.length, r[`${stream}Bytes`], `${r.label}: ${stream} capture length`);
      assert.equal(sha256(bytes), r[`${stream}Sha256`], `${r.label}: ${stream} capture hash`);
      evidence[`${stream}Base64`] = bytes.toString('base64');
    }
    return evidence;
  });
}
function contractSummary(shard, text) {
  return new RegExp(`canonical-test-shard-summary: shard=${shard} contractOnly=true executed=0 seen=\\d+[^\\n]*`).exec(text)?.[0];
}
function assertMemory(peakMiB, physicalBytes) {
  assert.ok(Number.isFinite(peakMiB) && peakMiB > 0, 'K memory measurement must be present');
  assert.ok(Number.isFinite(physicalBytes) && physicalBytes > 0, 'physical memory must be present');
  assert.ok(peakMiB * 1048576 <= physicalBytes / 2, 'K peak in-use system memory must not exceed 50%');
}
async function outputSelfTest() {
  const binary = [0, 255, 195, 40, 10]; // Includes invalid UTF-8: text decoding would lose evidence.
  const commands = [{ index: 0, label: 'binary-control', command: process.execPath,
    args: ['-e', `process.stdout.write(Buffer.from(${JSON.stringify(binary)}));process.stderr.write('expected stderr');`] }];
  const actual = await runner.runCommands(commands, { testTimeoutMs: 10000, runTimeoutMs: 15000 });
  assert.equal(actual.ok, true);
  const before = JSON.stringify(actual);
  const retained = JSON.parse(JSON.stringify(retainedOutputs(actual.results)));
  assert.deepEqual([...Buffer.from(retained[0].stdoutBase64, 'base64')], binary);
  assert.equal(Buffer.from(retained[0].stderrBase64, 'base64').toString(), 'expected stderr');
  assert.equal(JSON.stringify(actual), before, 'capture must not mutate runner status or flags');
  const changedCapture = { ...actual.results[0], stdout: Buffer.from('changed'), stderr: actual.results[0].stderr };
  assert.throws(() => retainedOutputs([changedCapture]), /capture length/);
  changedCapture.stdout = Buffer.from([1, ...binary.slice(1)]);
  assert.throws(() => retainedOutputs([changedCapture]), /capture hash/);
  assert.throws(() => retainedOutputs([{ ...actual.results[0] }]), /capture missing/);
  assert.deepEqual(retainedOutputs([{ index: 1, label: 'unstarted', state: 'notStarted' }]),
    [{ index: 1, label: 'unstarted', state: 'notStarted', unavailable: 'not-started' }]);
  // Empty streams and failed commands must also survive JSON without being called passed.
  const failed = await runner.runCommands([{ index: 0, label: 'failed-control', command: process.execPath,
    args: ['-e', 'process.exit(7)'] }], { testTimeoutMs: 10000, runTimeoutMs: 15000 });
  assert.equal(failed.ok, false); assert.equal(failed.results[0].exitCode, 7);
  assert.deepEqual(retainedOutputs(failed.results)[0],
    { index: 0, label: 'failed-control', state: 'failed', stdoutBase64: '', stderrBase64: '' });
}
function selfTest() {
  assert.equal(contractSummary('K', 'canonical-test-shard-summary: shard=K contractOnly=true executed=0 seen=628 total=0.000s\n'), 'canonical-test-shard-summary: shard=K contractOnly=true executed=0 seen=628 total=0.000s');
  assert.equal(contractSummary('E', 'canonical-test-shard-summary: shard=K contractOnly=true executed=0 seen=628'), undefined);
  assertMemory(50, 100 * 1048576);
  assert.throws(() => assertMemory(51, 100 * 1048576), /50%/);
  assert.throws(() => assertMemory(null, 100 * 1048576), /must be present/);
  const fields = ['S', '11', '23', '23', ...Array(15).fill('0'), '991', '0'];
  const parsed = parseStat(`42 (test name) with close)) ${fields.join(' ')}`);
  assert.equal(parsed.pid, 42); assert.equal(parsed.pgrp, 23); assert.equal(parsed.startTicks, '991');
  assert.equal(classify(false, false, []), 'unverifiable-pid-namespace');
  assert.equal(classify(true, true, []), 'observed-and-cleaned');
  assert.equal(classify(true, false, [{ pid: 12 }]), 'still-alive-after-run');
  assert.equal(classify(true, false, []), 'clean');
  const items = [{ index: 0, command: 'node', args: ['a'] }, { index: 1, command: 'node', args: ['b'] }];
  assert.equal(traceItem(items, { command: 'node', args: ['b'] }).index, 1, 'longest-first spawn order must preserve result identity');
  assert.throws(() => traceItem(items, { command: 'node', args: ['missing'] }));
  const reference = { enumerationDigest: 'same', results: [{ label: 'a', stdoutSha256: 'original', stderrSha256: 'empty' }] };
  compareOutputs(reference, structuredClone(reference));
  const changed = structuredClone(reference); changed.results[0].stderrSha256 = 'changed';
  assert.throws(() => compareOutputs(reference, changed), /stderrSha256 parity/);

}

async function main() {
  selfTest();
  if (process.argv.includes('--self-test')) { await outputSelfTest(); console.log('process diagnostic self-test: PASS'); return; }
  const outputIndex = process.argv.indexOf('--report');
  const output = outputIndex < 0 ? path.join(ROOT, 'artifacts/process-diagnostic/report.json') : path.resolve(process.argv[outputIndex + 1]);
  const report = { node: process.version, platform: process.platform, sourceSha: process.env.GITHUB_SHA || null,
    runnerSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'parallel-shard-runner.js'))).digest('hex'),
    cpuModel: os.cpus()[0]?.model, logicalCpus: os.cpus().length, physicalMemoryBytes: os.totalmem(),
    identity: identity(), runs: [], ok: false };
  const save = () => { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); };
  const knownGroups = new Set();
  try {
    assert.equal(report.platform, 'linux', 'this diagnostic requires Linux procfs');
    assert.equal(report.identity.consistent, true,
      'Node PID and /proc PID do not match: residue/RSS evidence is unqualified; no test groups launched');
    const originalSpawn = cp.spawn;
    let trace = [];
    cp.spawn = function(command, args, options) {
      const child = originalSpawn.call(this, command, args, options);
      if (options?.detached && child.pid) {
        const event = { command, args, pid: child.pid, snapshots: [] };
        knownGroups.add(child.pid); trace.push(event);
        const snap = phase => event.snapshots.push({ phase, at: new Date().toISOString(),
          target: stat(child.pid), group: members(child.pid), signalProbe: (() => {
            try { process.kill(-child.pid, 0); return 'exists'; } catch (e) { return e.code; }
          })() });
        child.on('spawn', () => snap('spawn'));
        child.on('exit', (code, signal) => { event.code = code; event.signal = signal; snap('exit'); });
        child.on('close', () => snap('close-before-runner-cleanup'));
      }
      return child;
    };
    const command = (label, body) => ({ label, command: process.execPath, args: ['-e', body] });
    async function run(name, commands, concurrency, expected, scheduling = {}) {
      trace = [];
      const items = commands.map((c, i) => ({ ...c, index: i }));
      const record = { name, trace, result: null, after: [] }; report.runs.push(record);
      const result = await runner.runCommands(items, { cwd: ROOT, concurrency, ...scheduling, testTimeoutMs: fullShard ? 1500000 : 240000,
        runTimeoutMs: fullShard ? 3000000 : 300000, sampleMs: 100, log: line => console.log(line) });
      record.result = result;
      if (process.argv.includes('--retain-output')) record.outputs = retainedOutputs(result.results);
      for (const wait of [0, 100, 2000]) {
        if (wait) await delay(wait);
        record.after.push({ waitedMs: wait, groups: trace.map(t => ({ pid: t.pid, members: members(t.pid) })) });
      }
      const final = record.after.at(-1);
      record.classifications = trace.map((t, i) => {
        const item = traceItem(items, t);
        return { label: item.label, pid: t.pid,
          classification: classify(true, result.results[item.index].leftoverProcesses, final.groups[i].members.filter(p => p.state !== 'Z')) };
      });
      save();
      for (const t of trace) {
        const spawn = t.snapshots.find(s => s.phase === 'spawn');
        assert.ok(spawn?.target && spawn.target.pid === t.pid && spawn.target.pgrp === t.pid,
          `${name}: child PID resolves to its own detached process group`);
      }
      assert.ok(record.classifications.every(c => c.classification !== 'still-alive-after-run'), `${name}: live process after cleanup`);
      assert.equal(result.ok, true, `${name}: all commands must pass`);
      assert.deepEqual(result.counts, { enumerated: commands.length, passed: commands.length, failed: 0, aborted: 0, notStarted: 0 });
      if (fullShard === 'K') assertMemory(result.peakSystemMemInUseMb, report.physicalMemoryBytes);
      for (let i = 0; i < expected.length; i++) assert.equal(result.results[i].leftoverProcesses, expected[i], `${name}: residue flag for ${items[i].label}`);
      console.log(`process-diagnostic: ${name} ${JSON.stringify(record.classifications)}`);
      return result;
    }
    try {
      if (fullShard) {
        const source = cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
        assert.equal(source.status, 0); report.targetSourceSha = source.stdout.trim();
        assert.equal(report.targetSourceSha, option('--source-sha'), 'diagnose the pinned source HEAD');
        assert.equal(fs.readFileSync(path.join(ROOT, 'scripts/parallel-shard-runner.js'), 'utf8'),
          fs.readFileSync(path.join(__dirname, 'parallel-shard-runner.js'), 'utf8'), 'target and diagnostic use identical runner source');
        const commands = runner.enumerateShard(fullShard, { root: ROOT });
        const count = fullShard === 'E' ? 33 : 29;
        assert.equal(commands.length, count, `all ${count} ${fullShard} commands`);
        if (fullShard === 'K') {
          report.sharedStateAudit = runner.scanSharedState(commands, { root: ROOT });
          assert.deepEqual(report.sharedStateAudit, {}, 'new K shared-state patterns need review before running');
        }
        report.commands = commands;
        const contract = cp.spawnSync(process.execPath, ['tests/run-all-shard.js'], { cwd: ROOT, encoding: 'utf8',
          env: { ...process.env, TEST_SHARD: fullShard, TEST_SHARD_CONTRACT: '1' }, maxBuffer: 64 * 1024 * 1024 });
        assert.equal(contract.status, 0, contract.stderr);
        report.contractSummary = contractSummary(fullShard, contract.stdout);
        assert.ok(report.contractSummary, 'same-source contract summary');
        const prefix = `full-${fullShard.toLowerCase()}`;
        const reference = await run(`${prefix}-serial`, commands, 1, Array(count).fill(false));
        const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/parallel-shard-runner.config.json'), 'utf8'));
        const timings = fullShard === 'E' ? cfg.timings.E : Object.fromEntries(reference.results.map(r => [r.label, r.wallMs / 1000]));
        report.schedulingTimings = timings;
        for (const concurrency of fullShard === 'K' ? [2, 4] : [2]) {
          const parallel = await run(`${prefix}-parallel-${concurrency}`, commands, concurrency, Array(count).fill(false),
            { order: 'longest-first', timings, serial: cfg.serial[fullShard] || [] });
          compareOutputs(reference, parallel);
        }
        report.outputParity = true; report.ok = true;
        return;
      }
      const forever = 'setInterval(()=>{},1000)';
      const background = (stdio, body) => `const c=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(body)}],{stdio:${JSON.stringify(stdio)}});c.unref();console.log('PASS background parent');`;
      await run('clean-command', [command('clean', "console.log('PASS clean')")], 1, [false]);
      await run('normally-finishing-background', [command('normal-background', background('inherit', 'setTimeout(()=>{},100)'))], 1, [false]);
      await run('detected-background-cleaned', [command('background-ignore', background('ignore', forever))], 1, [true]);
      await run('pipe-holder-cleaned', [command('background-pipe', background('inherit', forever))], 1, [true]);

      const weekly = { label: 'tests/weekly-cashflow-bridge-test.js', command: process.execPath, args: ['tests/weekly-cashflow-bridge-test.js'] };
      const partner = { label: 'tests/real-estate-agency-credit-line-test.js', command: process.execPath, args: ['tests/real-estate-agency-credit-line-test.js'] };
      const reference = await run('real-pair-serial', [weekly, partner], 1, [false, false]);
      for (let repeat = 1; repeat <= 3; repeat++) {
        const result = await run(`real-pair-parallel-${repeat}`, [weekly, partner], 2, [false, false]);
        for (let i = 0; i < 2; i++) for (const field of ['label', 'exitCode', 'signal', 'stdoutSha256', 'stderrSha256', 'stdoutBytes', 'stderrBytes'])
          assert.deepEqual(result.results[i][field], reference.results[i][field], `real pair ${repeat}: ${field} parity`);
      }
      report.ok = true;
    } finally { cp.spawn = originalSpawn; }
  } catch (e) { report.error = e.stack; process.exitCode = 1; console.error(e.stack); }
  finally {
    // A failing diagnostic must not leak its own known groups. Never signal procfs-selected PIDs.
    if (report.identity.consistent) for (const pgid of knownGroups) if (live(pgid).length) {
      report.rescueCleanup ||= []; report.rescueCleanup.push({ pgid, before: members(pgid) });
      try { process.kill(-pgid, 'SIGKILL'); } catch (e) { report.rescueCleanup.at(-1).error = e.code; }
      report.ok = false; process.exitCode = 1;
    }
    save();
    console.log(`process-diagnostic-result: ok=${report.ok} node=${process.version} namespaceConsistent=${report.identity.consistent}`);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
