'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const crypto = require('node:crypto'), runner = require('./parallel-shard-runner');
const { auditOne, auditPair, expectedFrom, withArchive } = require('./parallel-shard-k-evidence-audit.cjs');
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
  // Use a tiny private Git source to exercise SHA/dirty guards without any K workload.
  const cp = require('node:child_process');
  const source = path.join(directory, 'source'); fs.mkdirSync(source);
  const git = args => cp.execFileSync('git', args, { cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); fs.writeFileSync(path.join(source, 'tracked'), 'original'); git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']);
  const sourceSha = git(['rev-parse', 'HEAD']);
  for (const invalid of ['main', '1234567', 'A'.repeat(40), '0'.repeat(39)])
    assert.throws(() => expectedFrom(source, invalid), /explicit full source SHA/);
  assert.throws(() => expectedFrom(source, '0'.repeat(40)), /strictly equal/);
  assert.throws(() => expectedFrom(source), /strictly equal/, 'legacy default must still require the historical pin');
  fs.writeFileSync(path.join(source, 'tracked'), 'dirty');
  assert.throws(() => expectedFrom(source, sourceSha), /source tracked files must be clean/);
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
  // Replay the retained pack without any test workload or historical Git fetch.
  const zlib = require('node:zlib');
  const archived = fs.readFileSync(path.join(__dirname, '../docs/ci-evidence/k-refresh-hosted-2026-10-31.json.gz'));
  const archiveHash = 'cbd0dbbde22ab5907d2d605e00cdb37db273722eaefe1d8f0c2850a3080aab63';
  const archivePin = '9223004d0bd2e9b0ebb435edf599d01b72020fd0';
  let restoredRoots;
  assert.deepEqual(withArchive(archived, archiveHash, archivePin, (reports, roots) => {
    restoredRoots = roots;
    assert.equal(roots.reduce((sum, root) => sum + fs.readdirSync(root).length, 0), 6);
    return reports.map(r => r.node.split('.')[0]).sort();
  }), ['v22', 'v24']);
  assert.ok(restoredRoots.every(root => !fs.existsSync(root)), 'success removes temporary files');
  assert.throws(() => withArchive(archived, archiveHash, archivePin, (_, roots) => {
    restoredRoots = roots; throw Error('visitor failed');
  }), /visitor failed/);
  assert.ok(restoredRoots.every(root => !fs.existsSync(root)), 'failure removes temporary files');
  assert.throws(() => withArchive(archived, '0'.repeat(64), archivePin, () => {}), /archive SHA256/);
  assert.throws(() => withArchive(archived, archiveHash, '0'.repeat(40), () => {}));
  const pack = JSON.parse(zlib.gunzipSync(archived));
  const oversized = zlib.gzipSync(JSON.stringify({ ...pack, padding: 'x'.repeat(16 * 1024 * 1024) }));
  assert.throws(() => withArchive(oversized, hash(oversized), archivePin, () => {}), 'decompression bound');
  for (const mutate of [
    p => p.nodes[0].artifactId = '../escape',
    p => p.nodes[1].artifactId = p.nodes[0].artifactId,
    p => p.nodes[0].files[0].path = '../escape',
    p => p.nodes[0].files[0].path = '/tmp/escape',
    p => p.nodes[0].files[0].path = 'unexpected.json',
    p => p.nodes[0].files.push(p.nodes[0].files[0]),
    p => p.nodes[0].files[0].base64 += '!',
    p => p.nodes[0].files[0].sha256 = '0'.repeat(64),
    p => p.nodes[0].files.pop(),
    p => {
      const f = p.nodes[0].files.find(f => /^controls-node-/.test(f.path));
      const c = JSON.parse(Buffer.from(f.base64, 'base64')); c.ok = false;
      const bytes = Buffer.from(JSON.stringify(c)); f.base64 = bytes.toString('base64'); f.sha256 = hash(bytes);
    },
    p => p.nodes[0].files[0].path = p.nodes[0].files[0].path.replace('node-22', 'node-24'),
  ]) {
    const copy = structuredClone(pack); mutate(copy); const zipped = zlib.gzipSync(JSON.stringify(copy));
    assert.throws(() => withArchive(zipped, hash(zipped), archivePin, () => {}));
  }
  console.log('K evidence audit: PASS (synthetic controls + archive restoration; not fresh hosted safety evidence)');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
