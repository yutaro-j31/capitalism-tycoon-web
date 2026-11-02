'use strict';
// Offline retained I serial evidence only. Never executes/qualifies parallel I.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto'), zlib = require('node:zlib');
const runner = require('./parallel-shard-runner');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const ids = rows => rows.map(({ label, command, args }) => ({ label, command, args }));
const unique = (rows, key, count) => { assert.equal(rows.length, count); assert.equal(new Set(rows.map(r => r[key])).size, count); };
function identity(r) {
  assert.equal(r.platform, 'linux'); assert.equal(r.identity.consistent, true);
  const i = r.identity; assert.ok(Number.isSafeInteger(i.nodePid) && i.nodePid > 0);
  for (const row of [i.self, i.numbered]) { assert.equal(row.pid, i.nodePid); assert.equal(row.pgrp, i.self.pgrp); assert.equal(row.startTicks, i.self.startTicks); }
  assert.match(i.self.startTicks, /^\d+$/); assert.ok(Number.isSafeInteger(i.self.pgrp) && i.self.pgrp > 0);
  assert.match(i.selfPidNamespace, /^pid:\[\d+\]$/); assert.equal(i.selfPidNamespace, i.numberedPidNamespace);
}
function auditOne(full, plan, controls, expected, diagnosticSha) {
  assert.equal(expected.commandCount, 8); assert.match(expected.runnerSha256, /^[a-f0-9]{64}$/);
  assert.equal(expected.commands.length, 8); assert.equal(runner.digestOf(expected.commands), expected.enumerationDigest);
  assert.match(expected.sourceSha, /^[a-f0-9]{40}$/); assert.match(diagnosticSha, /^[a-f0-9]{40}$/);
  for (const r of [full, plan, controls]) {
    identity(r); assert.equal(r.sourceSha, diagnosticSha); assert.equal(r.node, full.node);
    assert.equal(r.runnerSha256, expected.runnerSha256); assert.equal(r.cpuModel, full.cpuModel);
    assert.equal(r.physicalMemoryBytes, full.physicalMemoryBytes); assert.equal(r.logicalCpus, full.logicalCpus);
    assert.deepEqual(r.rescueCleanup || [], []); assert.ok(!r.error);
  }
  assert.match(full.node, /^v(22|24)\./); assert.ok(typeof full.cpuModel === 'string' && full.cpuModel.length);
  assert.ok(Number.isSafeInteger(full.logicalCpus) && full.logicalCpus > 0);
  assert.ok(Number.isSafeInteger(full.physicalMemoryBytes) && full.physicalMemoryBytes > 0);
  assert.equal(plan.mode, 'i-plan-only'); assert.equal(plan.ok, null); assert.equal(plan.planValidated, true); assert.deepEqual(plan.runs, []);
  for (const p of [plan.iSerialPlan, full.iSerialPlan]) {
    for (const key of ['sourceSha', 'commandCount', 'enumerationDigest']) assert.deepEqual(p[key], expected[key]);
    assert.deepEqual(ids(p.commands), ids(expected.commands)); assert.equal(p.concurrency, 1);
    assert.deepEqual(p.plannedParallelLevels, []); assert.equal(p.runtimeExecuted, false);
    assert.equal(p.outputParity, null); assert.equal(p.parallelExecutionQualified, false); assert.equal(p.productionAuthorized, false);
  }
  const contract = line => { const m = /^canonical-test-shard-summary: shard=I contractOnly=true executed=0 seen=(\d+) total=[\d.]+s$/.exec(line); assert.ok(m); assert.equal(Number(m[1]), 628); };
  contract(full.contractSummary); contract(plan.iSerialPlan.contractSummary); contract(full.iSerialPlan.contractSummary);
  assert.equal(controls.ok, true);
  const names = ['clean-command', 'normally-finishing-background', 'detected-background-cleaned', 'pipe-holder-cleaned', 'real-pair-serial', 'real-pair-parallel-1', 'real-pair-parallel-2', 'real-pair-parallel-3'];
  assert.deepEqual(controls.runs.map(r => r.name), names);
  for (const [i, c] of controls.runs.entries()) {
    const n = i < 4 ? 1 : 2; assert.equal(c.result.ok, true);
    assert.deepEqual(c.result.counts, { enumerated: n, passed: n, failed: 0, aborted: 0, notStarted: 0 });
    assert.equal(c.result.concurrency, i < 5 ? 1 : 2);
    unique(c.result.results, 'index', n);
    for (const item of c.result.results) { assert.equal(item.state, 'passed'); assert.equal(item.exitCode, 0); assert.equal(item.signal, null); assert.equal(item.reason, null); }
    for (const key of ['abortedReason', 'firstFailure', 'firstFailureResult']) assert.equal(c.result[key], null);
    assert.deepEqual(c.result.results.map(r => r.leftoverProcesses), Array(n).fill(i === 2 || i === 3));
    assert.deepEqual(c.classifications.map(r => r.classification), Array(n).fill(i === 2 || i === 3 ? 'observed-and-cleaned' : 'clean'));
  }
  assert.equal(full.mode, 'i-serial-only'); assert.equal(full.ok, true); assert.equal(full.outputParity, null);
  assert.equal(full.targetSourceSha, expected.sourceSha); assert.equal(full.trackedSourceCleanAfter, true);
  unique(full.commands, 'index', 8); assert.deepEqual(full.commands.map(c => c.index), [0,1,2,3,4,5,6,7]);
  assert.deepEqual(ids(full.commands), ids(expected.commands)); assert.equal(full.runs.length, 1);
  const round = full.runs[0], r = round.result; assert.equal(round.name, 'full-i-serial');
  assert.equal(r.ok, true); assert.equal(r.concurrency, 1); assert.equal(r.order, 'recorded');
  for (const key of ['abortedReason', 'firstFailure', 'firstFailureResult']) assert.equal(r[key], null);
  assert.equal(r.enumerationDigest, expected.enumerationDigest);
  assert.deepEqual(r.counts, { enumerated: 8, passed: 8, failed: 0, aborted: 0, notStarted: 0 });
  assert.ok(Number.isFinite(r.wallMs) && r.wallMs > 0);
  assert.ok(Number.isFinite(r.peakSystemMemInUseMb) && r.peakSystemMemInUseMb > 0);
  assert.ok(r.peakSystemMemInUseMb * 1048576 <= full.physicalMemoryBytes / 2);
  assert.ok(Number.isFinite(r.systemCpuUtilization) && r.systemCpuUtilization >= 0 && r.systemCpuUtilization <= 1);
  for (const key of ['runnerCpuSeconds','cpuSecondsSampled']) assert.ok(Number.isFinite(r[key]) && r[key] >= 0);
  unique(r.results, 'index', 8); unique(round.outputs, 'index', 8); unique(round.trace, 'pid', 8); unique(round.classifications, 'label', 8);
  assert.deepEqual(ids(r.results), ids(expected.commands));
  assert.deepEqual(round.after.map(a => a.waitedMs), [0, 100, 2000]);
  const groups = round.after.at(-1).groups; unique(groups, 'pid', 8);
  for (const [i, item] of r.results.entries()) {
    assert.equal(item.index, i); assert.equal(item.state, 'passed'); assert.equal(item.exitCode, 0);
    assert.equal(item.signal, null); assert.equal(item.reason, null); assert.equal(item.leftoverProcesses, false);
    for (const key of ['wallMs', 'cpuMs', 'peakRssMb']) assert.ok(Number.isFinite(item[key]) && item[key] >= 0);
    assert.ok(item.wallMs > 0);
    const out = round.outputs[i]; assert.equal(out.index, i); assert.equal(out.label, item.label); assert.equal(out.state, 'passed');
    for (const stream of ['stdout', 'stderr']) {
      const encoded = out[stream + 'Base64']; assert.equal(typeof encoded, 'string');
      const bytes = Buffer.from(encoded, 'base64'); assert.equal(bytes.toString('base64'), encoded);
      assert.equal(bytes.length, item[stream + 'Bytes']); assert.equal(sha(bytes), item[stream + 'Sha256']);
    }
    const stdout = Buffer.from(out.stdoutBase64, 'base64').toString('utf8');
    assert.equal(stdout.split('\n').length - 1, item.stdoutLines); assert.equal((stdout.match(/PASS/g) || []).length, item.passLines);
    const traces = round.trace.filter(t => t.command === item.command && JSON.stringify(t.args) === JSON.stringify(item.args)); assert.equal(traces.length, 1);
    const t = traces[0]; assert.ok(Number.isSafeInteger(t.pid) && t.pid > 0); assert.equal(t.code, 0); assert.equal(t.signal, null);
    assert.deepEqual(t.snapshots.map(s => s.phase), ['spawn','exit','close-before-runner-cleanup']);
    const times = t.snapshots.map(s => Date.parse(s.at)); assert.ok(times.every(Number.isFinite) && times[0] <= times[1] && times[1] <= times[2]);
    const spawned = t.snapshots.filter(s => s.phase === 'spawn'); assert.equal(spawned.length, 1);
    assert.equal(spawned[0].target.pid, t.pid); assert.equal(spawned[0].target.pgrp, t.pid);
    const g = groups.filter(g => g.pid === t.pid); assert.equal(g.length, 1); assert.deepEqual(g[0].members, []);
    const c = round.classifications.filter(c => c.pid === t.pid && c.label === item.label); assert.equal(c.length, 1); assert.equal(c[0].classification, 'clean');
  }
  const longestCommands = [...r.results].sort((a,b) => b.wallMs-a.wallMs).slice(0,3).map(i => ({ label:i.label, wallMs:i.wallMs, sampledPeakGroupRssMb:i.peakRssMb, sampledCpuMs:i.cpuMs }));
  assert.deepEqual(full.iSerialSummary, { commandCount:8, sampleMs:100, wallMs:r.wallMs, sampledPeakSystemMemInUseMb:r.peakSystemMemInUseMb, longestCommands, outputParity:null, parallelExecutionQualified:false, productionAuthorized:false });
  return { node:full.node, cpuModel:full.cpuModel, logicalCpus:full.logicalCpus, physicalMemoryBytes:full.physicalMemoryBytes, wallMs:r.wallMs, sampledPeakMiB:r.peakSystemMemInUseMb, longestCommands, outputs:round.outputs };
}
function auditPair(nodes, expected, diagnosticSha) {
  assert.equal(nodes.length, 2);
  const audited = nodes.map(n => auditOne(n.full, n.plan, n.controls, expected, diagnosticSha));
  assert.deepEqual(audited.map(r => Number(/^v(\d+)/.exec(r.node)[1])).sort(), [22,24]);
  const differences = [];
  for (let i=0;i<8;i++) for (const stream of ['stdout','stderr']) {
    const bytes = audited.map(a => Buffer.from(a.outputs[i][stream+'Base64'],'base64'));
    if (!bytes[0].equals(bytes[1])) differences.push({ label:expected.commands[i].label, stream, sha256:bytes.map(sha), bytes:bytes.map(b=>b.length) });
  }
  return { status:differences.length ? 'cross-node-output-review-required' : 'serial-evidence-verified', sourceSha:expected.sourceSha, nodes:audited.map(({outputs,...r})=>r), differences, parallelExecutionQualified:false, productionAuthorized:false };
}
function readArchive(bytes, hash, expected) {
  assert.equal(sha(bytes), hash, 'archive hash mismatch');
  const pack=JSON.parse(zlib.gunzipSync(bytes,{maxOutputLength:4*1024*1024}));
  assert.equal(pack.schema,'i-serial-evidence-pack-v1'); assert.equal(pack.sourceSha,expected.sourceSha);
  for (const key of ['runId','attempt']) assert.ok(Number.isSafeInteger(pack[key]) && pack[key] > 0, `positive ${key} provenance required`);
  for (const key of ['headSha','diagnosticMergeSha']) assert.match(pack[key] || '', /^[a-f0-9]{40}$/, `${key} provenance required`);
  unique(pack.artifacts,'major',2);
  for (const key of ['artifactId','jobId','zipSha256']) unique(pack.artifacts,key,2);
  const nodes=pack.artifacts.map(a=>{
    assert.ok([22,24].includes(a.major)); assert.match(a.zipSha256,/^[a-f0-9]{64}$/);
    for (const key of ['artifactId','jobId']) assert.ok(Number.isSafeInteger(a[key]) && a[key] > 0, `positive ${key} provenance required`);
    assert.deepEqual(a.files.map(f=>f.name).sort(),[`full-i-node-${a.major}.json`,`i-plan-node-${a.major}.json`,`node-${a.major}.json`].sort());
    const files=Object.fromEntries(a.files.map(f=>{ const raw=Buffer.from(f.base64,'base64'); assert.equal(raw.toString('base64'),f.base64); assert.equal(sha(raw),f.sha256); return [f.name,JSON.parse(raw.toString('utf8'))]; }));
    // All three files must belong to the Node major declared by this artifact.
    // Pair-wide coverage alone would accept two consistently swapped labels.
    for (const report of Object.values(files)) assert.match(report.node || '', new RegExp(`^v${a.major}\\.`), 'artifact Node label/report mismatch');
    return { full:files[`full-i-node-${a.major}.json`],plan:files[`i-plan-node-${a.major}.json`],controls:files[`node-${a.major}.json`] };
  });
  return { pack, nodes, audit:auditPair(nodes,expected,pack.diagnosticMergeSha) };
}
module.exports={auditOne,auditPair,readArchive};
if(require.main===module) { try { assert.equal(process.argv.length,5); const r=readArchive(fs.readFileSync(process.argv[2]),process.argv[3],JSON.parse(fs.readFileSync(process.argv[4]))); console.log(JSON.stringify(r.audit,null,2)); if(r.audit.differences.length)process.exitCode=2; } catch(e){console.error(e.stack);process.exitCode=1;} }
