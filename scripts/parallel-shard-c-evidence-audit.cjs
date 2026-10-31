'use strict';
// Offline evidence verification; never launches a test workload or enables a shard.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const identities = list => list.map(({ label, command, args }) => ({ label, command, args }));
function unique(list, key, count) {
  assert.equal(list.length, count, `${key}: complete coverage`);
  assert.equal(new Set(list.map(item => item[key])).size, count, `${key}: unique coverage`);
}
// Historical enumerateShard inherits the caller's parallelism. Its spawnSync
// interception does not intercept the parallel async executor: force serial
// enumeration and restore the caller exactly, including an absent variable.
function enumerateOffline(runner, root) {
  const previous = process.env.TEST_SHARD_PARALLELISM;
  try {
    process.env.TEST_SHARD_PARALLELISM = '1';
    return runner.enumerateShard('C', { root });
  } finally {
    if (previous === undefined) delete process.env.TEST_SHARD_PARALLELISM;
    else process.env.TEST_SHARD_PARALLELISM = previous;
  }
}
function auditIdentity(identity) {
  assert.equal(identity.consistent, true);
  for (const field of ['self', 'numbered']) assert.equal(identity[field].pid, identity.nodePid);
  assert.match(identity.self.startTicks, /^\d+$/);
  assert.ok(Number.isSafeInteger(identity.self.pgrp) && identity.self.pgrp > 0);
  assert.equal(identity.self.startTicks, identity.numbered.startTicks);
  assert.equal(identity.self.pgrp, identity.numbered.pgrp);
  assert.match(identity.selfPidNamespace, /^pid:\[\d+\]$/);
  assert.equal(identity.selfPidNamespace, identity.numberedPidNamespace);
  assert.ok(Number.isSafeInteger(identity.nodePid) && identity.nodePid > 0);
}
function auditOne(report, expected) {
  assert.equal(report.ok, true); assert.equal(report.outputParity, true); assert.ok(!report.error);
  assert.equal(report.platform, 'linux'); assert.equal(report.targetSourceSha, expected.sha);
  assert.equal(report.runnerSha256, expected.runnerSha256); assert.deepEqual(report.rescueCleanup || [], []);
  const major = /^v(22|24)\./.exec(report.node)?.[1]; assert.ok(major, 'Node22/24 evidence required');
  auditIdentity(report.identity);
  assert.ok(Number.isFinite(report.physicalMemoryBytes) && report.physicalMemoryBytes > 0);
  assert.ok(Number.isInteger(report.logicalCpus) && report.logicalCpus > 0);
  assert.ok(typeof report.cpuModel === 'string' && report.cpuModel.length > 0);
  assert.equal(expected.commands.length, 25); unique(report.commands, 'label', 25);
  assert.deepEqual(identities(report.commands), identities(expected.commands));
  const seen = /^canonical-test-shard-summary: shard=C contractOnly=true executed=0 seen=(\d+) total=[\d.]+s$/.exec(report.contractSummary);
  assert.ok(seen, 'same-source contract summary required'); assert.equal(Number(seen[1]), expected.seen);
  assert.equal(report.trackedSourceCleanAfter, true);
  assert.equal(report.processEvidencePolicy, 'empty-final-groups-including-zombies');
  const names = ['full-c-serial', 'full-c-parallel-2'];
  assert.deepEqual(report.runs.map(r => r.name), names, 'both passes must finish');
  let reference;
  const rounds = report.runs.map((round, pass) => {
    const r = round.result; assert.equal(r.ok, true); assert.equal(r.abortedReason, null);
    assert.equal(r.firstFailure, null); assert.equal(r.firstFailureResult, null);
    assert.equal(r.order, pass === 0 ? 'recorded' : 'longest-first');
    assert.equal(r.concurrency, [1, 2][pass]); assert.equal(r.enumerationDigest, expected.digest);
    assert.deepEqual(r.counts, { enumerated: 25, passed: 25, failed: 0, aborted: 0, notStarted: 0 });
    assert.ok(Number.isFinite(r.wallMs) && r.wallMs > 0);
    assert.ok(Number.isFinite(r.peakSystemMemInUseMb) && r.peakSystemMemInUseMb > 0);
    assert.ok(r.peakSystemMemInUseMb * 1048576 <= report.physicalMemoryBytes / 2, 'memory <=50%');
    assert.ok(Number.isFinite(r.systemCpuUtilization) && r.systemCpuUtilization >= 0 && r.systemCpuUtilization <= 1);
    assert.ok(Number.isFinite(r.runnerCpuSeconds) && r.runnerCpuSeconds >= 0);
    assert.ok(Number.isFinite(r.cpuSecondsSampled) && r.cpuSecondsSampled >= 0);
    unique(r.results, 'label', 25); unique(round.outputs, 'index', 25); unique(round.trace, 'pid', 25);
    unique(round.classifications, 'label', 25);
    assert.deepEqual(identities(r.results), identities(expected.commands));
    assert.deepEqual(round.after.map(a => a.waitedMs), [0, 100, 2000]);
    const groups = round.after.at(-1).groups; unique(groups, 'pid', 25);
    for (const observation of round.after) {
      unique(observation.groups, 'pid', 25);
      assert.deepEqual(observation.groups.map(g => g.pid).sort((a,b) => a-b),
        round.trace.map(t => t.pid).sort((a,b) => a-b), 'every observation covers each traced group');
      for (const group of observation.groups) assert.deepEqual(group.members, [], 'all final observations empty including zombies');
    }
    for (let i = 0; i < 25; i++) {
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
      assert.equal(trace.snapshots.filter(s => s.phase === 'spawn').length, 1);
      const spawn = trace.snapshots.find(s => s.phase === 'spawn');
      assert.match(spawn.target.startTicks, /^\d+$/);
      assert.equal(spawn.target.pid, trace.pid); assert.equal(spawn.target.pgrp, trace.pid);
      const group = groups.find(g => g.pid === trace.pid); assert.ok(group); assert.deepEqual(group.members, [], 'no remaining members, including zombies');
      const classified = round.classifications.find(c => c.label === item.label);
      assert.equal(classified.pid, trace.pid); assert.equal(classified.classification, 'clean');
    }
    if (reference) assert.deepEqual(round.outputs, reference, 'byte-exact within-Node parity');
    else reference = round.outputs;
    return { name: round.name, concurrency: r.concurrency, wallMs: r.wallMs, peakMiB: r.peakSystemMemInUseMb };
  });
  return { node: report.node, rounds, reference };
}
function auditPair(reports, expected) {
  assert.equal(reports.length, 2);
  const audited = reports.map(r => auditOne(r, expected));
  assert.deepEqual(audited.map(r => Number(/^v(\d+)/.exec(r.node)[1])).sort(), [22, 24], 'both Node versions required');
  const differences = [];
  for (let i = 0; i < 25; i++) for (const stream of ['stdout', 'stderr']) {
    const captures = audited.map(r => Buffer.from(r.reference[i][`${stream}Base64`], 'base64'));
    if (!captures[0].equals(captures[1])) differences.push({ label: audited[0].reference[i].label, stream,
      nodes: audited.map((r, n) => ({ node: r.node, sha256: sha(captures[n]), bytes: captures[n].length })) });
  }
  return { status: differences.length ? 'cross-node-output-review-required' : 'evidence-verified',
    nodes: audited.map(({ node, rounds }) => ({ node, rounds })), differences, productionAuthorized: false };
}
function expectedFrom(root, pinnedSha) {
  assert.match(pinnedSha, /^[a-f0-9]{40}$/, 'explicit full source SHA required');
  assert.equal(cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), pinnedSha);
  assert.equal(cp.execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim(), '', 'source tracked files must be clean');
  const runner = require(path.join(root, 'scripts/parallel-shard-runner.js'));
  const commands = enumerateOffline(runner, root);
  const contract = cp.execFileSync(process.execPath, ['tests/run-all-shard.js'], { cwd: root, encoding: 'utf8', env: { ...process.env, TEST_SHARD: 'C', TEST_SHARD_CONTRACT: '1' } });
  const seen = /contractOnly=true executed=0 seen=(\d+)/.exec(contract); assert.ok(seen);
  return { sha: pinnedSha, commands, digest: runner.digestOf(commands), seen: Number(seen[1]),
    runnerSha256: sha(fs.readFileSync(path.join(root, 'scripts/parallel-shard-runner.js'))) };
}
// Restore only an independently hash-pinned complete artifact pack into a private
// temporary directory. Existing auditPair still decides evidence status/exit2.
function withArchive(bytes, expectedHash, pinnedSha, visit) {
  assert.match(expectedHash, /^[a-f0-9]{64}$/); assert.match(pinnedSha, /^[a-f0-9]{40}$/);
  assert.equal(sha(bytes), expectedHash, 'archive SHA256 mismatch');
  const pack = JSON.parse(require('node:zlib').gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 }));
  assert.equal(pack.schema, 'c-full-process-evidence-v1'); assert.equal(pack.sourceSha, pinnedSha);
  assert.equal(pack.productionSettingsChanged, false); unique(pack.nodes, 'artifactId', 2);
  const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'c-archive-audit-'));
  try {
    const reports = [], roots = [], majors = [];
    for (const node of pack.nodes) {
      assert.ok(Number.isSafeInteger(node.artifactId) && node.artifactId > 0);
      unique(node.files, 'path', 2); // exactly one full report and controls per Node
      const dir = path.join(root, String(node.artifactId)); fs.mkdirSync(dir); roots.push(dir);
      let major;
      for (const file of node.files) {
        assert.equal(typeof file.path, 'string');
        const match = /^(?:full-c|controls)-node-(22|24)\.json$/.exec(file.path);
        assert.ok(match, 'unexpected artifact path');
        const version = Number(match[1]); major ??= version;
        assert.equal(version, major, 'mixed Node versions in artifact');
        assert.equal(typeof file.base64, 'string'); const data = Buffer.from(file.base64, 'base64');
        assert.equal(data.toString('base64'), file.base64, 'canonical archive base64');
        assert.equal(sha(data), file.sha256, 'artifact file SHA256 mismatch');
        const target = path.join(dir, file.path); fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data, { flag: 'wx' });
      }
      majors.push(major);
      const controls = JSON.parse(fs.readFileSync(path.join(dir, `controls-node-${major}.json`)));
      assert.equal(controls.ok, true); auditIdentity(controls.identity);
      assert.equal(controls.platform, 'linux'); assert.match(controls.node, new RegExp(`^v${major}\\.`));
      const report = JSON.parse(fs.readFileSync(path.join(dir, `full-c-node-${major}.json`)));
      assert.match(report.node, new RegExp(`^v${major}\\.`)); reports.push(report);
    }
    assert.deepEqual(majors.slice().sort(), [22, 24], 'both Node artifact versions required');
    return visit(reports, roots);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
module.exports = { auditOne, auditPair, expectedFrom, withArchive, enumerateOffline };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 7, 'usage: audit.cjs --archive SOURCE_ROOT ARCHIVE_GZ EXPECTED_GZIP_SHA256 PINNED_SOURCE_SHA');
    assert.equal(process.argv[2], '--archive');
    const [, source, archive, hash, pinnedSha] = process.argv.slice(2);
    const expected = expectedFrom(path.resolve(source), pinnedSha);
    const result = withArchive(fs.readFileSync(archive), hash, pinnedSha,
      reports => auditPair(reports, expected));
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.differences.length ? 2 : 0;
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
