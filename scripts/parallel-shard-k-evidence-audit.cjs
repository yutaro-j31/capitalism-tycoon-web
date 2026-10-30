'use strict';
// Offline evidence verification; never launches a test workload or enables a shard.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const runner = require('./parallel-shard-runner');
const PIN = '165d924423f1e4bde8be8c801c28b15bbac76e72';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const identities = list => list.map(({ label, command, args }) => ({ label, command, args }));
function unique(list, key, count) {
  assert.equal(list.length, count, `${key}: complete coverage`);
  assert.equal(new Set(list.map(item => item[key])).size, count, `${key}: unique coverage`);
}
function auditOne(report, expected, artifactRoot) {
  assert.equal(report.ok, true); assert.equal(report.outputParity, true); assert.ok(!report.error);
  assert.equal(report.platform, 'linux'); assert.equal(report.targetSourceSha, expected.sha);
  assert.equal(report.runnerSha256, expected.runnerSha256); assert.deepEqual(report.rescueCleanup || [], []);
  const major = /^v(22|24)\./.exec(report.node)?.[1]; assert.ok(major, 'Node22/24 evidence required');
  const identity = report.identity; assert.equal(identity.consistent, true);
  for (const field of ['self', 'numbered']) assert.equal(identity[field].pid, identity.nodePid);
  assert.match(identity.self.startTicks, /^\d+$/);
  assert.ok(Number.isSafeInteger(identity.self.pgrp) && identity.self.pgrp > 0);
  assert.equal(identity.self.startTicks, identity.numbered.startTicks);
  assert.equal(identity.self.pgrp, identity.numbered.pgrp);
  assert.match(identity.selfPidNamespace, /^pid:\[\d+\]$/);
  assert.equal(identity.selfPidNamespace, identity.numberedPidNamespace);
  assert.ok(Number.isSafeInteger(identity.nodePid) && identity.nodePid > 0);
  assert.ok(Number.isFinite(report.physicalMemoryBytes) && report.physicalMemoryBytes > 0);
  assert.ok(Number.isInteger(report.logicalCpus) && report.logicalCpus > 0);
  assert.ok(typeof report.cpuModel === 'string' && report.cpuModel.length > 0);
  assert.equal(expected.commands.length, 29); unique(report.commands, 'label', 29);
  assert.deepEqual(identities(report.commands), identities(expected.commands));
  const seen = /^canonical-test-shard-summary: shard=K contractOnly=true executed=0 seen=(\d+) total=[\d.]+s$/.exec(report.contractSummary);
  assert.ok(seen, 'same-source contract summary required'); assert.equal(Number(seen[1]), expected.seen);
  assert.deepEqual(report.sharedStateAudit, {});
  const names = ['full-k-serial', 'full-k-audited-serial', 'full-k-parallel-2', 'full-k-parallel-4'];
  assert.deepEqual(report.runs.map(r => r.name), names, 'all four passes must finish');
  let reference;
  const rounds = report.runs.map((round, pass) => {
    const r = round.result; assert.equal(r.ok, true); assert.equal(r.abortedReason, null);
    assert.equal(r.firstFailure, null); assert.equal(r.firstFailureResult, null);
    assert.equal(r.order, pass < 2 ? 'recorded' : 'longest-first');
    assert.equal(r.concurrency, [1, 1, 2, 4][pass]); assert.equal(r.enumerationDigest, expected.digest);
    assert.deepEqual(r.counts, { enumerated: 29, passed: 29, failed: 0, aborted: 0, notStarted: 0 });
    assert.ok(Number.isFinite(r.wallMs) && r.wallMs > 0);
    assert.ok(Number.isFinite(r.peakSystemMemInUseMb) && r.peakSystemMemInUseMb > 0);
    assert.ok(r.peakSystemMemInUseMb * 1048576 <= report.physicalMemoryBytes / 2, 'memory <=50%');
    assert.ok(Number.isFinite(r.systemCpuUtilization) && r.systemCpuUtilization >= 0 && r.systemCpuUtilization <= 1);
    assert.ok(Number.isFinite(r.runnerCpuSeconds) && r.runnerCpuSeconds >= 0);
    assert.ok(Number.isFinite(r.cpuSecondsSampled) && r.cpuSecondsSampled >= 0);
    unique(r.results, 'label', 29); unique(round.outputs, 'index', 29); unique(round.trace, 'pid', 29);
    unique(round.classifications, 'label', 29);
    assert.deepEqual(identities(r.results), identities(expected.commands));
    assert.deepEqual(round.after.map(a => a.waitedMs), [0, 100, 2000]);
    const groups = round.after.at(-1).groups; unique(groups, 'pid', 29);
    for (let i = 0; i < 29; i++) {
      const item = r.results[i], output = round.outputs[i]; assert.equal(item.index, i);
      assert.equal(item.state, 'passed'); assert.equal(item.exitCode, 0); assert.equal(item.signal, null);
      assert.equal(item.reason, null); assert.equal(item.leftoverProcesses, false);
      for (const field of ['wallMs', 'cpuMs', 'peakRssMb'])
        assert.ok(Number.isFinite(item[field]) && item[field] >= 0, `command metric ${field} required`);
      assert.ok(item.wallMs > 0);
      assert.equal(output.index, i); assert.equal(output.label, item.label); assert.equal(output.state, 'passed');
      for (const stream of ['stdout', 'stderr']) {
        const encoded = output[`${stream}Base64`]; assert.equal(typeof encoded, 'string');
        const bytes = Buffer.from(encoded, 'base64'); assert.equal(bytes.toString('base64'), encoded, 'canonical base64');
        assert.equal(bytes.length, item[`${stream}Bytes`]); assert.equal(sha(bytes), item[`${stream}Sha256`]);
        if (stream === 'stdout') {
          assert.equal(bytes.toString('utf8').split('\n').length - 1, item.stdoutLines);
          assert.equal((bytes.toString('utf8').match(/PASS/g) || []).length, item.passLines);
        }
      }
      const traces = round.trace.filter(t => t.command === item.command && JSON.stringify(t.args) === JSON.stringify(item.args));
      assert.equal(traces.length, 1); const trace = traces[0];
      assert.ok(Number.isSafeInteger(trace.pid) && trace.pid > 0);
      assert.equal(trace.code, 0); assert.equal(trace.signal, null);
      const spawn = trace.snapshots.find(s => s.phase === 'spawn');
      assert.equal(spawn.target.pid, trace.pid); assert.equal(spawn.target.pgrp, trace.pid);
      const group = groups.find(g => g.pid === trace.pid); assert.ok(group); assert.deepEqual(group.members, [], 'no remaining members, including zombies');
      const classified = round.classifications.find(c => c.label === item.label);
      assert.equal(classified.pid, trace.pid); assert.equal(classified.classification, 'clean');
      if (pass) {
        const observed = round.writeObservation; assert.equal(observed.ok, true); unique(observed.commands, 'label', 29);
        const command = observed.commands[i]; assert.equal(command.label, item.label); assert.equal(command.pid, trace.pid);
        assert.deepEqual(command.findings, []);
        assert.equal(path.basename(command.directory), String(i));
        assert.equal(path.basename(path.dirname(command.directory)), round.name);
        const directory = path.join(artifactRoot, `audit-node-${major}`, round.name, String(i));
        unique(command.processes, 'pid', command.processes.length); assert.ok(command.processes.some(p => p.pid === trace.pid));
        assert.deepEqual(fs.readdirSync(directory).sort(), command.processes.map(p => `${p.pid}.jsonl`).sort(), 'raw PID logs match report');
        for (const process of command.processes) {
          const raw = fs.readFileSync(path.join(directory, `${process.pid}.jsonl`), 'utf8'); assert.ok(raw.endsWith('\n'));
          assert.deepEqual(raw.slice(0, -1).split('\n').map(line => JSON.parse(line)), process.events);
          assert.equal(process.events.length, 1, 'only initialized is a clean API observation');
          const e = process.events[0]; assert.equal(e.pid, process.pid); assert.equal(e.operation, 'initialized');
          assert.equal(e.target, 'node-api-audit-v1'); assert.ok(path.isAbsolute(e.cwd));
        }
      }
    }
    if (reference) assert.deepEqual(round.outputs, reference, 'byte-exact within-Node parity');
    else reference = round.outputs;
    return { name: round.name, concurrency: r.concurrency, wallMs: r.wallMs, peakMiB: r.peakSystemMemInUseMb };
  });
  return { node: report.node, rounds, reference };
}
function auditPair(reports, expected, roots) {
  assert.equal(reports.length, 2); assert.equal(roots.length, 2);
  const audited = reports.map((r, i) => auditOne(r, expected, roots[i]));
  assert.deepEqual(audited.map(r => Number(/^v(\d+)/.exec(r.node)[1])).sort(), [22, 24], 'both Node versions required');
  const differences = [];
  for (let i = 0; i < 29; i++) for (const stream of ['stdout', 'stderr']) {
    const captures = audited.map(r => Buffer.from(r.reference[i][`${stream}Base64`], 'base64'));
    if (!captures[0].equals(captures[1])) differences.push({ label: audited[0].reference[i].label, stream,
      nodes: audited.map((r, n) => ({ node: r.node, sha256: sha(captures[n]), bytes: captures[n].length })) });
  }
  return { status: differences.length ? 'cross-node-output-review-required' : 'evidence-verified',
    nodes: audited.map(({ node, rounds }) => ({ node, rounds })), differences, productionAuthorized: false };
}
function expectedFrom(root, pinnedSha = PIN) {
  assert.match(pinnedSha, /^[a-f0-9]{40}$/, 'explicit full source SHA required');
  assert.equal(cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), pinnedSha);
  assert.equal(cp.execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim(), '', 'source tracked files must be clean');
  const commands = runner.enumerateShard('K', { root });
  const contract = cp.execFileSync(process.execPath, ['tests/run-all-shard.js'], { cwd: root, encoding: 'utf8', env: { ...process.env, TEST_SHARD: 'K', TEST_SHARD_CONTRACT: '1' } });
  const seen = /contractOnly=true executed=0 seen=(\d+)/.exec(contract); assert.ok(seen);
  return { sha: pinnedSha, commands, digest: runner.digestOf(commands), seen: Number(seen[1]),
    runnerSha256: sha(fs.readFileSync(path.join(root, 'scripts/parallel-shard-runner.js'))) };
}
module.exports = { auditOne, auditPair, expectedFrom };
if (require.main === module) {
  try {
    const [source, root22, report22, root24, report24, pinnedSha] = process.argv.slice(2);
    assert.ok([7, 8].includes(process.argv.length), 'usage: audit.cjs SOURCE_ROOT ARTIFACT22 REPORT22 ARTIFACT24 REPORT24 [PINNED_SOURCE_SHA]');
    const result = auditPair([report22, report24].map(p => JSON.parse(fs.readFileSync(p))), expectedFrom(path.resolve(source), pinnedSha), [root22, root24]);
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.differences.length ? 2 : 0;
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
