'use strict';

// Stage 2A/3 contract: test.yml may hand a parallelism value to shards J and C only, and must stay serial (1) when the
// repository variable TEST_SHARD_PARALLELISM_J is unset. Required gates (needs, timeouts, matrix) are unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'test.yml'), 'utf8');
const start = text.indexOf('\n  test-shards:');
const end = text.indexOf('\n  test:\n', start);
assert.ok(start > 0 && end > start, 'test-shards job found');
const job = text.slice(start, end);

// The pilot value: only shard J reads the variable, everything else (and an unset variable) resolves to '1'.
const expr = "TEST_SHARD_PARALLELISM: ${{ matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || matrix.shard == 'C' && (vars.TEST_SHARD_PARALLELISM_C || '1') || '1' }}";
assert.equal(job.split(expr).length - 1, 1, 'exactly one J/C-only parallelism expression');
assert.equal((job.match(/TEST_SHARD_PARALLELISM:/g) || []).length, 1, 'no other parallelism assignment');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_J/g) || []).length, 2, 'the J variable is referenced only by the env value and the upload condition');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_C/g) || []).length, 2, 'the C variable is referenced only by the env value and the upload condition');

// Evaluate the expression the way Actions does for each shard with the variable unset / set.
function parallelism(shard, vars) {
  return shard === 'J' && (vars.J || '1') || shard === 'C' && (vars.C || '1') || '1';
}
for (const shard of 'ABCDEFGHIJKL') {
  assert.equal(parallelism(shard, {}), '1', `${shard} is serial when the variables are unset`);
  assert.equal(parallelism(shard, { J: '2' }), shard === 'J' ? '2' : '1', `${shard} with J=2`);
  assert.equal(parallelism(shard, { C: '2' }), shard === 'C' ? '2' : '1', `${shard} with C=2`);
  assert.equal(parallelism(shard, { J: '2', C: '' }), shard === 'J' ? '2' : '1', `${shard} with J=2, C empty`);
}

// Required gates are unchanged.
assert.match(job, /needs: test-shard-contract/);
// 40 since #1184: measured shard test time on slow runners reached 1787 s against a 30-minute job budget.
assert.match(job, /timeout-minutes: 40/);
assert.match(job, /shard: \[A, B, C, D, E, F, G, H, I, J, K, L\]/);
assert.match(job, /fail-fast: false/);
assert.match(job, /run: node tests\/run-all-shard\.js/);
assert.doesNotMatch(job, /continue-on-error/);

// Every added step is J/C-only, and the report upload only happens when the pilot variable is set.
assert.match(job, /name: Record runner resources \(parallel pilot shards\)\n\s+if: matrix\.shard == 'J' \|\| matrix\.shard == 'C'/);
assert.ok(job.includes("if: always() && ((matrix.shard == 'J' && vars.TEST_SHARD_PARALLELISM_J != '') || (matrix.shard == 'C' && vars.TEST_SHARD_PARALLELISM_C != ''))"), 'report upload only when a pilot variable is set');
for (const needle of ['nproc', 'free -m', '/proc/cpuinfo', 'cpu.max', 'memory.max']) assert.ok(job.includes(needle), `resource log has ${needle}`);

// The aggregate job still requires every shard.
assert.match(text, /test "\$\{\{ needs\.test-shards\.result \}\}" = "success"/);

// Owner-authorized residue diagnosis is restricted to its own PR branch. It never
// changes canonical J/C parallelism or starts on main, schedule, dispatch or other PRs.
function jobBlock(id) {
  const start = text.indexOf(`\n  ${id}:`);
  assert.ok(start >= 0, `${id} job exists`);
  const tail = text.slice(start + 1);
  const next = tail.slice(1).search(/^  [A-Za-z0-9_-]+:\s*$/m);
  return next < 0 ? tail : tail.slice(0, next + 1);
}
const diagnostic = jobBlock('parallel-process-diagnostic');
assert.ok(text.includes('\n  parallel-process-diagnostic:'), 'dedicated process diagnostic job exists');
assert.ok(diagnostic.includes("if: github.event_name == 'pull_request' && github.head_ref == 'ci/parallel-shard-process-diagnostic'"));
for (const token of ["node: ['22', '24']", 'timeout-minutes: 90', 'contents: read', 'fail-fast: false',
  'node scripts/parallel-shard-runner-process-diagnostic.js --report',
  'node tests/parallel-shard-runner-test.js', '--full-e', '--root diagnostic-e-source',
  '--source-sha 20dcfe71a3fc5e8ad662c8f8497fac1120162ae1', 'persist-credentials: false', 'if: always()', 'if-no-files-found: error'])
  assert.ok(diagnostic.includes(token), `process diagnostic must retain ${token}`);
assert.doesNotMatch(diagnostic, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);

const kDiagnostic = jobBlock('parallel-k-diagnostic');
assert.ok(kDiagnostic.includes("if: github.event_name == 'pull_request' && github.head_ref == 'ci/shard-k-parallel-diagnostic'"));
for (const token of ["node: ['22', '24']", 'timeout-minutes: 90', 'contents: read', 'fail-fast: false',
  '--full-shard K', '--root diagnostic-k-source', '--source-sha 165d924423f1e4bde8be8c801c28b15bbac76e72',
  'node tests/parallel-shard-runner-test.js', 'persist-credentials: false', 'if: always()', 'if-no-files-found: error'])
  assert.ok(kDiagnostic.includes(token), `K diagnostic must retain ${token}`);
assert.doesNotMatch(kDiagnostic, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);
assert.ok(!diagnostic.includes('--full-shard K'), 'E and K contracts examine separate job blocks');
const writeDiagnostic = jobBlock('parallel-k-write-observation');
assert.equal(writeDiagnostic.split("\n").find(line => line.trim().startsWith("if:")),
  "    if: github.event_name == 'pull_request' && github.head_ref == 'ci/shard-k-write-observation'");
for (const token of ["node: ['22', '24']", 'timeout-minutes: 120', 'contents: read', 'fail-fast: false',
  '--full-shard K', '--root diagnostic-k-source', '--source-sha 165d924423f1e4bde8be8c801c28b15bbac76e72',
  '--retain-output --write-audit-root', 'node scripts/parallel-shard-write-observation.cjs',
  'node tests/parallel-shard-runner-test.js', 'persist-credentials: false', 'if: always()', 'if-no-files-found: error'])
  assert.ok(writeDiagnostic.includes(token), `K write observation must retain ${token}`);
assert.doesNotMatch(writeDiagnostic, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);
console.log('shard-parallel-workflow-contract-test: ok');
