'use strict';
// Offline controls only: no C workload, process signalling, or repository settings.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { auditOne, auditPair, expectedFrom, withArchive } = require('./parallel-shard-c-evidence-audit.cjs');
const runner = require('./parallel-shard-runner');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pin = 'd10a971eb99fb4111fd3a169ba9c34ccb7a81971';
const hash = 'f33b04eaa4f82191c804c5b328855baa7e0589b5fb46e13c1db987f269b592ce';
const archived = fs.readFileSync(path.join(__dirname, '../docs/ci-evidence/c-process-hosted-2026-10-31.json.gz'));
const commands = runner.enumerateShard('C');
// Current canonical metadata is an independent expectation; it does not launch tests.
const contract = cp.execFileSync(process.execPath, ['tests/run-all-shard.js'], {
  cwd: path.resolve(__dirname, '..'), encoding: 'utf8',
  env: { ...process.env, TEST_SHARD: 'C', TEST_SHARD_CONTRACT: '1' }
});
const expected = { sha: pin, commands, digest: runner.digestOf(commands),
  seen: Number(/contractOnly=true executed=0 seen=(\d+)/.exec(contract)[1]),
  runnerSha256: sha(fs.readFileSync(path.join(__dirname, 'parallel-shard-runner.js'))) };
let reports, restored;
assert.equal(withArchive(archived, hash, pin, (value, roots) => {
  reports = value; restored = roots;
  assert.deepEqual(roots.map(root => fs.readdirSync(root).length), [2, 2]);
  return auditPair(value, expected).status;
}), 'evidence-verified');
assert.ok(restored.every(root => !fs.existsSync(root)), 'success removes private extraction');
assert.throws(() => withArchive(archived, hash, pin, (_, roots) => {
  restored = roots; throw Error('visitor failed');
}), /visitor failed/);
assert.ok(restored.every(root => !fs.existsSync(root)), 'failure removes private extraction');
assert.throws(() => withArchive(archived, '0'.repeat(64), pin, () => {}), /archive SHA256/);
assert.throws(() => withArchive(archived, hash, '0'.repeat(40), () => {}));
const reportMutations = [
  r => r.runs.pop(), r => r.platform = 'darwin', r => r.ok = false,
  r => r.identity.consistent = false, r => r.identity.numbered.pid++,
  r => r.identity.numbered.startTicks = '1', r => r.identity.numberedPidNamespace = 'pid:[2]',
  r => r.targetSourceSha = 'wrong', r => r.runnerSha256 = 'wrong',
  r => r.trackedSourceCleanAfter = false, r => r.rescueCleanup = [{ pid: 1 }],
  r => r.contractSummary = r.contractSummary.replace('628', '627'),
  r => r.commands.reverse(), r => r.runs[0].result.enumerationDigest = 'wrong',
  r => r.runs[1].result.concurrency = 4, r => r.runs[0].result.counts.passed--,
  r => r.runs[0].result.abortedReason = 'run-timeout',
  r => r.runs[0].result.peakSystemMemInUseMb = r.physicalMemoryBytes / 1048576,
  r => r.runs[0].result.results[0].state = 'failed',
  r => r.runs[0].result.results[0].exitCode = 1,
  r => r.runs[0].result.results[0].signal = 'SIGKILL',
  r => r.runs[0].result.results[0].reason = 'ENOBUFS',
  r => r.runs[0].result.results[0].reason = 'ETIMEDOUT',
  r => r.runs[0].result.results[0].leftoverProcesses = true,
  r => r.runs[0].trace.pop(), r => r.runs[0].trace[0].snapshots[0].target.pgrp++,
  r => r.runs[0].classifications[0].classification = 'observed-and-cleaned',
  r => r.runs[0].after[0].groups[0].members.push({ pid: 9, state: 'S' }),
  r => r.runs[0].after[2].groups[0].members.push({ pid: 9, state: 'Z' }),
  r => r.runs[0].after[1].groups[0].pid++, r => r.runs[0].after.pop(),
  r => r.runs[0].outputs[0].stdoutBase64 += '!',
  r => r.runs[0].result.results[0].stdoutBytes++,
  r => r.runs[0].result.results[0].stdoutSha256 = 'wrong',
  r => r.runs[0].result.results[0].passLines++
];
for (const mutate of reportMutations) {
  const copy = structuredClone(reports[0]); mutate(copy);
  assert.throws(() => auditOne(copy, expected), 'corrupted report must not PASS');
}
// Internally valid byte changes still require parity/review, never normalization.
const changeBytes = (report, rounds) => {
  const bytes = Buffer.from([255, 0, 195, 40, 10]);
  for (const i of rounds) {
    report.runs[i].outputs[0].stderrBase64 = bytes.toString('base64');
    Object.assign(report.runs[i].result.results[0], { stderrBytes: bytes.length, stderrSha256: sha(bytes) });
  }
};
const within = structuredClone(reports[0]); changeBytes(within, [1]);
assert.throws(() => auditOne(within, expected), /within-Node parity/);
const across = structuredClone(reports[1]); changeBytes(across, [0, 1]);
const review = auditPair([reports[0], across], expected);
assert.equal(review.status, 'cross-node-output-review-required');
assert.equal(review.differences.length, 1); assert.equal(review.productionAuthorized, false);
assert.throws(() => auditPair([reports[0], reports[0]], expected), /both Node versions/);

const original = JSON.parse(zlib.gunzipSync(archived));
const archiveMutations = [
  p => p.schema = 'k-full-artifact-evidence-v1', p => p.productionSettingsChanged = true,
  p => p.nodes[1].artifactId = p.nodes[0].artifactId, p => p.nodes[0].artifactId = -1,
  p => p.nodes[0].files.pop(), p => p.nodes[0].files.push(p.nodes[0].files[0]),
  p => p.nodes[0].files[0].path = '../escape.json',
  p => p.nodes[0].files[0].path = '/tmp/escape.json',
  p => p.nodes[0].files[0].path = 'controls-node-24.json',
  p => p.nodes[0].files[0].base64 += '!',
  p => p.nodes[0].files[0].sha256 = '0'.repeat(64),
  p => {
    const file = p.nodes[0].files[0], controls = JSON.parse(Buffer.from(file.base64, 'base64'));
    controls.identity.numbered.pid++;
    const bytes = Buffer.from(JSON.stringify(controls)); file.base64 = bytes.toString('base64'); file.sha256 = sha(bytes);
  }
];
for (const mutate of archiveMutations) {
  const pack = structuredClone(original); mutate(pack);
  const bytes = zlib.gzipSync(JSON.stringify(pack));
  assert.throws(() => withArchive(bytes, sha(bytes), pin, () => {}), 'malformed pack must fail even with matching outer hash');
}
const oversized = zlib.gzipSync(Buffer.alloc(16 * 1024 * 1024 + 1, 32));
assert.throws(() => withArchive(oversized, sha(oversized), pin, () => {}));
// Source SHA/dirty guards execute before any contract loader or workload.
const source = fs.mkdtempSync(path.join(os.tmpdir(), 'c-evidence-source-'));
try {
  const git = args => cp.execFileSync('git', args, { cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); fs.writeFileSync(path.join(source, 'tracked'), 'original'); git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']);
  for (const invalid of [undefined, 'main', '1234567', 'A'.repeat(40)])
    assert.throws(() => expectedFrom(source, invalid));
  assert.throws(() => expectedFrom(source, '0'.repeat(40)));
  fs.writeFileSync(path.join(source, 'tracked'), 'dirty');
  assert.throws(() => expectedFrom(source, git(['rev-parse', 'HEAD'])), /tracked files must be clean/);
} finally { fs.rmSync(source, { recursive: true, force: true }); }
console.log('C evidence audit controls: PASS');
