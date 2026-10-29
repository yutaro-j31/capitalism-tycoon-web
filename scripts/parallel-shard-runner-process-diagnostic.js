#!/usr/bin/env node
'use strict';

// One-off, read-only diagnosis of E's residue report. Does not enable a canonical shard.
// Refuses to run/kill process groups when Node PIDs and procfs use different namespaces.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const runner = require('./parallel-shard-runner');
const ROOT = path.resolve(__dirname, '..');
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
function selfTest() {
  const fields = ['S', '11', '23', '23', ...Array(15).fill('0'), '991', '0'];
  const parsed = parseStat(`42 (test name) with close)) ${fields.join(' ')}`);
  assert.equal(parsed.pid, 42); assert.equal(parsed.pgrp, 23); assert.equal(parsed.startTicks, '991');
  assert.equal(classify(false, false, []), 'unverifiable-pid-namespace');
  assert.equal(classify(true, true, []), 'observed-and-cleaned');
  assert.equal(classify(true, false, [{ pid: 12 }]), 'still-alive-after-run');
  assert.equal(classify(true, false, []), 'clean');
}

async function main() {
  selfTest();
  if (process.argv.includes('--self-test')) { console.log('process diagnostic self-test: PASS'); return; }
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
    async function run(name, commands, concurrency, expected) {
      trace = [];
      const items = commands.map((c, i) => ({ ...c, index: i }));
      const record = { name, trace, result: null, after: [] }; report.runs.push(record);
      const result = await runner.runCommands(items, { cwd: ROOT, concurrency, testTimeoutMs: 240000,
        runTimeoutMs: 300000, sampleMs: 100, log: line => console.log(line) });
      record.result = result;
      for (const wait of [0, 100, 2000]) {
        if (wait) await delay(wait);
        record.after.push({ waitedMs: wait, groups: trace.map(t => ({ pid: t.pid, members: members(t.pid) })) });
      }
      const final = record.after.at(-1);
      record.classifications = trace.map((t, i) => ({ label: items[i].label, pid: t.pid,
        classification: classify(true, result.results[i].leftoverProcesses, final.groups[i].members.filter(p => p.state !== 'Z')) }));
      save();
      for (const t of trace) {
        const spawn = t.snapshots.find(s => s.phase === 'spawn');
        assert.ok(spawn?.target && spawn.target.pid === t.pid && spawn.target.pgrp === t.pid,
          `${name}: child PID resolves to its own detached process group`);
      }
      assert.ok(record.classifications.every(c => c.classification !== 'still-alive-after-run'), `${name}: live process after cleanup`);
      assert.equal(result.ok, true, `${name}: all commands must pass`);
      assert.equal(result.counts.passed, commands.length);
      for (let i = 0; i < expected.length; i++) assert.equal(result.results[i].leftoverProcesses, expected[i], `${name}: residue flag for ${items[i].label}`);
      console.log(`process-diagnostic: ${name} ${JSON.stringify(record.classifications)}`);
      return result;
    }
    try {
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
