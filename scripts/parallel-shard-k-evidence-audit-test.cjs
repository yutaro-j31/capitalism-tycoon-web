'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const crypto = require('node:crypto'), runner = require('./parallel-shard-runner');
const { auditOne, auditPair } = require('./parallel-shard-k-evidence-audit.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k-evidence-controls-'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const commands = runner.enumerateShard('K');
const expected = { sha: 'fixture-source', runnerSha256: 'fixture-runner', commands, digest: runner.digestOf(commands), seen: 628 };
function fixture(major) {
  const output = Buffer.from([255, 0, 80, 65, 83, 83, 10]), stderr = Buffer.from('expected\n');
  const root = path.join(directory, String(major));
  const report = { ok: true, outputParity: true, platform: 'linux', targetSourceSha: expected.sha, runnerSha256: expected.runnerSha256,
    node: `v${major}.0.0`, physicalMemoryBytes: 16 * 1024 ** 3, logicalCpus: 4, cpuModel: 'synthetic fixture', sharedStateAudit: {},
    commands, contractSummary: 'canonical-test-shard-summary: shard=K contractOnly=true executed=0 seen=628 total=0.000s',
    identity: { consistent: true, nodePid: 10, self: { pid: 10, startTicks: '100', pgrp: 10 }, numbered: { pid: 10, startTicks: '100', pgrp: 10 }, selfPidNamespace: 'pid:[1]', numberedPidNamespace: 'pid:[1]' }, runs: [] };
  for (const [pass, name] of ['full-k-serial', 'full-k-audited-serial', 'full-k-parallel-2', 'full-k-parallel-4'].entries()) {
    const trace = commands.map((c, i) => ({ command: c.command, args: c.args, pid: 1000 + pass * 100 + i,
      code: 0, signal: null, snapshots: [{ phase: 'spawn', target: { pid: 1000 + pass * 100 + i, pgrp: 1000 + pass * 100 + i } }] }));
    const round = { name, trace, outputs: commands.map((c, i) => ({ index: i, label: c.label, state: 'passed', stdoutBase64: output.toString('base64'), stderrBase64: stderr.toString('base64') })),
      result: { ok: true, abortedReason: null, firstFailure: null, firstFailureResult: null, concurrency: [1, 1, 2, 4][pass], enumerationDigest: expected.digest,
        order: pass < 2 ? 'recorded' : 'longest-first', cpuSecondsSampled: 0, counts: { enumerated: 29, passed: 29, failed: 0, aborted: 0, notStarted: 0 }, wallMs: 1000, peakSystemMemInUseMb: 1000, systemCpuUtilization: 0.5, runnerCpuSeconds: 1,
        results: commands.map((c, i) => ({ ...c, index: i, wallMs: 1, cpuMs: 0, peakRssMb: 0, state: 'passed', exitCode: 0, signal: null, reason: null, leftoverProcesses: false,
          stdoutBytes: output.length, stdoutSha256: hash(output), stderrBytes: stderr.length, stderrSha256: hash(stderr), stdoutLines: 1, passLines: 1 })) },
      classifications: commands.map((c, i) => ({ label: c.label, pid: trace[i].pid, classification: 'clean' })),
      after: [0, 100, 2000].map(waitedMs => ({ waitedMs, groups: trace.map(t => ({ pid: t.pid, members: [] })) })) };
    if (pass) round.writeObservation = { ok: true, commands: commands.map((c, i) => {
      const dir = path.join(root, `audit-node-${major}`, name, String(i)), pid = trace[i].pid;
      fs.mkdirSync(dir, { recursive: true });
      const events = [{ pid, operation: 'initialized', target: 'node-api-audit-v1', cwd: '/fixture/source' }];
      fs.writeFileSync(path.join(dir, `${pid}.jsonl`), JSON.stringify(events[0]) + '\n');
      return { label: c.label, pid, directory: `/host/${name}/${i}`, findings: [], processes: [{ pid, events }] };
    }) };
    report.runs.push(round);
  }
  return { report, root };
}
try {
  const a = fixture(22), b = fixture(24);
  assert.equal(auditPair([a.report, b.report], expected, [a.root, b.root]).status, 'evidence-verified');
  const cases = [r => r.runs.pop(), r => r.identity.consistent = false, r => r.identity.numbered.pid++,
    r => delete r.identity.self.startTicks, r => r.targetSourceSha = 'wrong', r => r.runnerSha256 = 'wrong', r => r.rescueCleanup = [{ pid: 1 }],
    r => r.contractSummary = r.contractSummary.replace('628', '627'), r => r.runs[0].result.counts.passed--,
    r => r.runs[0].result.peakSystemMemInUseMb = 9000, r => r.runs[0].result.results[0].signal = 'SIGKILL',
    r => r.runs[0].result.results[0].reason = 'ETIMEDOUT', r => r.runs[0].result.results[0].leftoverProcesses = true,
    r => r.runs[0].after[2].groups[0].members.push({ pid: 9, state: 'Z' }),
    r => r.runs[0].trace[0].snapshots[0].target.pgrp++, r => r.runs[0].outputs[0].stdoutBase64 += '!',
    r => r.runs[1].outputs[0].stderrBase64 = 'YQ==', r => r.runs[1].writeObservation.commands.pop(),
    r => r.runs[1].writeObservation.commands[0].processes[0].events.push({ operation: 'fs.writeFileSync' })];
  for (const mutate of cases) { const copy = structuredClone(a.report); mutate(copy); assert.throws(() => auditOne(copy, expected, a.root)); }
  const file = path.join(a.root, 'audit-node-22/full-k-audited-serial/0/1100.jsonl');
  const original = fs.readFileSync(file);
  fs.appendFileSync(file, '{}\n'); assert.throws(() => auditOne(a.report, expected, a.root), /deep-equal/);
  fs.writeFileSync(file, original); fs.renameSync(file, `${file}.missing`); assert.throws(() => auditOne(a.report, expected, a.root)); fs.renameSync(`${file}.missing`, file);
  const changed = structuredClone(b.report), bytes = Buffer.from('different stderr\n');
  for (const r of changed.runs) { r.outputs[0].stderrBase64 = bytes.toString('base64'); r.result.results[0].stderrBytes = bytes.length; r.result.results[0].stderrSha256 = hash(bytes); }
  const review = auditPair([a.report, changed], expected, [a.root, b.root]);
  assert.equal(review.status, 'cross-node-output-review-required'); assert.equal(review.differences.length, 1);
  assert.equal(review.productionAuthorized, false);
  assert.throws(() => auditPair([a.report, a.report], expected, [a.root, a.root]), /both Node versions/);
  console.log('K evidence audit: PASS (synthetic controls only; not hosted safety evidence)');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
