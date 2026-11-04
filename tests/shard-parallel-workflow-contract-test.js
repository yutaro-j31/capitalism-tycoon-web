'use strict';

// Stage 2A/3 contract: test.yml may hand a parallelism value to shards J, C and E only, and must stay serial (1) when the
// repository variables TEST_SHARD_PARALLELISM_J / _C / _E are unset. Required gates (needs, timeouts, matrix) are unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'test.yml'), 'utf8');
const start = text.indexOf('\n  test-shards:');
const end = text.indexOf('\n  test:\n', start);
assert.ok(start > 0 && end > start, 'test-shards job found');
const job = text.slice(start, end);

// The pilot value: shards J, C and E each read only their own variable, everything else (and an unset variable) resolves to '1'.
const expr = "TEST_SHARD_PARALLELISM: ${{ matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || matrix.shard == 'C' && (vars.TEST_SHARD_PARALLELISM_C || '1') || matrix.shard == 'E' && (vars.TEST_SHARD_PARALLELISM_E || '1') || matrix.shard == 'L' && (vars.TEST_SHARD_PARALLELISM_L || '1') || matrix.shard == 'A' && (vars.TEST_SHARD_PARALLELISM_A || '1') || matrix.shard == 'K' && (vars.TEST_SHARD_PARALLELISM_K || '1') || '1' }}";
assert.equal(job.split(expr).length - 1, 1, 'exactly one J/C/E-only parallelism expression');
assert.equal((job.match(/TEST_SHARD_PARALLELISM:/g) || []).length, 1, 'no other parallelism assignment');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_J/g) || []).length, 2, 'the J variable is referenced only by the env value and the upload condition');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_C/g) || []).length, 2, 'the C variable is referenced only by the env value and the upload condition');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_E/g) || []).length, 2, 'the E variable is referenced only by the env value and the upload condition');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_L/g) || []).length, 2, 'the L variable is referenced only by the env value and the upload condition');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_A/g) || []).length, 2, 'the A variable is referenced only by the env value and the upload condition');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_K/g) || []).length, 2, 'the K variable is referenced only by the env value and the upload condition');

// Evaluate the expression the way Actions does for each shard with the variable unset / set.
function parallelism(shard, vars) {
  return shard === 'J' && (vars.J || '1') || shard === 'C' && (vars.C || '1') || shard === 'E' && (vars.E || '1') || shard === 'L' && (vars.L || '1') || shard === 'A' && (vars.A || '1') || shard === 'K' && (vars.K || '1') || '1';
}
for (const shard of 'ABCDEFGHIJKL') {
  assert.equal(parallelism(shard, {}), '1', `${shard} is serial when the variables are unset`);
  assert.equal(parallelism(shard, { J: '2' }), shard === 'J' ? '2' : '1', `${shard} with J=2`);
  assert.equal(parallelism(shard, { C: '2' }), shard === 'C' ? '2' : '1', `${shard} with C=2`);
  assert.equal(parallelism(shard, { E: '2' }), shard === 'E' ? '2' : '1', `${shard} with E=2`);
  assert.equal(parallelism(shard, { L: '2' }), shard === 'L' ? '2' : '1', `${shard} with L=2`);
  assert.equal(parallelism(shard, { A: '2' }), shard === 'A' ? '2' : '1', `${shard} with A=2`);
  assert.equal(parallelism(shard, { K: '2' }), shard === 'K' ? '2' : '1', `${shard} with K=2`);
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

// Every added step is J/C/E-only, and the report upload only happens when the pilot variable is set.
assert.match(job, /name: Record runner resources \(parallel pilot shards\)\n\s+if: matrix\.shard == 'J' \|\| matrix\.shard == 'C' \|\| matrix\.shard == 'E' \|\| matrix\.shard == 'L' \|\| matrix\.shard == 'A' \|\| matrix\.shard == 'K'/);
assert.ok(job.includes("if: always() && ((matrix.shard == 'J' && vars.TEST_SHARD_PARALLELISM_J != '') || (matrix.shard == 'C' && vars.TEST_SHARD_PARALLELISM_C != '') || (matrix.shard == 'E' && vars.TEST_SHARD_PARALLELISM_E != '') || (matrix.shard == 'L' && vars.TEST_SHARD_PARALLELISM_L != '') || (matrix.shard == 'A' && vars.TEST_SHARD_PARALLELISM_A != '') || (matrix.shard == 'K' && vars.TEST_SHARD_PARALLELISM_K != ''))"), 'report upload only when a pilot variable is set');
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
const processGate = "    if: github.event_name == 'pull_request' && (github.head_ref == 'ci/parallel-shard-process-diagnostic' || github.head_ref == 'ci/i-serial-resource-evidence')";
assert.equal(diagnostic.split('\n').find(line => line.trim().startsWith('if:')), processGate);
for (const token of ["node: ['22', '24']", 'timeout-minutes: 90', 'contents: read', 'fail-fast: false',
  'node scripts/parallel-shard-runner-process-diagnostic.js --report',
  'node tests/parallel-shard-runner-test.js', '--full-e', '--root diagnostic-e-source',
  '--source-sha 20dcfe71a3fc5e8ad662c8f8497fac1120162ae1', 'persist-credentials: false', 'if: always()', 'if-no-files-found: error'])
  assert.ok(diagnostic.includes(token), `process diagnostic must retain ${token}`);
assert.doesNotMatch(diagnostic, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);
function verifyISerialWorkflow(block) {
  assert.equal(block.split('\n').find(line => line.trim().startsWith('if:')), processGate);
  function step(name) {
    const marker = `      - name: ${name}\n`, at = block.indexOf(marker);
    assert.ok(at >= 0, `${name} step retained`);
    const next = block.indexOf('\n      - ', at + marker.length);
    return block.slice(at, next < 0 ? undefined : next);
  }
  for (const name of ['Checkout exact E HEAD for full reproduction', 'Compare all 33 E commands serial and parallel two'])
    assert.ok(step(name).includes("if: github.head_ref == 'ci/parallel-shard-process-diagnostic'"), 'E experiment does not run on I branch');
  const checkout = step('Checkout fixed I source for serial resource evidence');
  for (const token of ['ref: 555ca4042f183ba01aebb4c1df06be094fdf09bb', 'path: diagnostic-i-source', 'persist-credentials: false'])
    assert.ok(checkout.includes(token));
  for (const name of ['Checkout fixed I source for serial resource evidence', 'Validate all 8 I invocation metadata', 'Profile all 8 I commands serial only with retained bytes'])
    assert.ok(step(name).includes("if: github.head_ref == 'ci/i-serial-resource-evidence'"), 'I is opt-in only');
  const plan = step('Validate all 8 I invocation metadata'), profile = step('Profile all 8 I commands serial only with retained bytes');
  for (const run of [plan, profile]) {
    assert.ok(run.includes('--full-shard I'));
    assert.ok(run.includes('--root diagnostic-i-source --source-sha 555ca4042f183ba01aebb4c1df06be094fdf09bb'));
  }
  assert.ok(plan.includes('--plan-only')); assert.ok(profile.includes('--retain-output'));
  assert.doesNotMatch(profile, /--plan-only|--write-audit-root|--full-e/);
  for (const token of ["node: ['22', '24']", 'timeout-minutes: 90', 'contents: read', 'fail-fast: false',
    'node tests/parallel-shard-runner-test.js', 'if: always()', 'if-no-files-found: error', 'retention-days: 14']) assert.ok(block.includes(token));
  assert.doesNotMatch(block, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);
}
verifyISerialWorkflow(diagnostic);
for (const mutate of [
  b => b.replace(processGate, "    if: github.event_name == 'pull_request'"),
  b => b.replace("if: github.head_ref == 'ci/parallel-shard-process-diagnostic'", "if: always()"),
  b => b.replace("if: github.head_ref == 'ci/i-serial-resource-evidence'", "if: always()"),
  b => b.replace('ref: 555ca4042f183ba01aebb4c1df06be094fdf09bb', 'ref: main'),
  b => b.replaceAll('--source-sha 555ca4042f183ba01aebb4c1df06be094fdf09bb', '--source-sha 94aaee741c6dd8af5ca15193931c4723667518f1'),
  b => b.replace('--retain-output', ''),
  b => b.replace('--full-shard I --retain-output', '--full-shard I --plan-only --retain-output'),
  b => b.replace('contents: read', 'contents: write'),
  b => b.replaceAll('persist-credentials: false', 'persist-credentials: true'),
  b => b.replace('if: always()', 'if: success()'),
  b => b.replace('if-no-files-found: error', 'if-no-files-found: warn'),
  b => b + '\n    continue-on-error: true',
  b => b + '\n    TEST_SHARD_PARALLELISM_I: 2'
]) assert.throws(() => verifyISerialWorkflow(mutate(diagnostic)), 'unsafe I evidence mutation rejected');


const kDiagnostic = jobBlock('parallel-k-diagnostic');
assert.ok(kDiagnostic.includes("if: github.event_name == 'pull_request' && github.head_ref == 'ci/shard-k-parallel-diagnostic'"));
for (const token of ["node: ['22', '24']", 'timeout-minutes: 90', 'contents: read', 'fail-fast: false',
  '--full-shard K', '--root diagnostic-k-source', '--source-sha 165d924423f1e4bde8be8c801c28b15bbac76e72',
  'node tests/parallel-shard-runner-test.js', 'persist-credentials: false', 'if: always()', 'if-no-files-found: error'])
  assert.ok(kDiagnostic.includes(token), `K diagnostic must retain ${token}`);
assert.doesNotMatch(kDiagnostic, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);
assert.ok(!diagnostic.includes('--full-shard K'), 'E and K contracts examine separate job blocks');
const writeDiagnostic = jobBlock('parallel-k-write-observation');
function verifyKWriteDiagnostic(block) {
  assert.equal(block.split("\n").find(line => line.trim().startsWith("if:")),
    "    if: github.event_name == 'pull_request' && github.head_ref == 'ci/k-current-source-refresh'");
  for (const token of ["node: ['22', '24']", 'timeout-minutes: 120', 'contents: read', 'fail-fast: false',
    '--full-shard K', '--root diagnostic-k-source', '--source-sha daa5236d2483a9dbd1b208bb6b84e44d88a39762',
    '--retain-output --write-audit-root', 'node scripts/parallel-shard-write-observation.cjs',
    'node tests/parallel-shard-runner-test.js', 'persist-credentials: false', 'if: always()', 'if-no-files-found: error'])
    assert.ok(block.includes(token), `K write observation must retain ${token}`);
  assert.ok(block.includes('ref: daa5236d2483a9dbd1b208bb6b84e44d88a39762'), 'checkout and claimed source SHA stay pinned together');
  assert.doesNotMatch(block, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);
}
verifyKWriteDiagnostic(writeDiagnostic);
// Keep this source refresh confined to its opt-in branch, complete evidence
// and immutable checkout/claimed-source pair. No production setting can enter.
for (const mutate of [
  b => b.replace("github.event_name == 'pull_request' && github.head_ref == 'ci/k-current-source-refresh'", "github.event_name == 'pull_request'"),
  b => b.replace('ref: daa5236d2483a9dbd1b208bb6b84e44d88a39762', 'ref: main'),
  b => b.replace('--source-sha daa5236d2483a9dbd1b208bb6b84e44d88a39762', '--source-sha 9223004d0bd2e9b0ebb435edf599d01b72020fd0'),
  b => b.replace('contents: read', 'contents: write'),
  b => b.replace('fail-fast: false', 'fail-fast: true'),
  b => b.replace('--retain-output', ''),
  b => b.replace('--write-audit-root', ''),
  b => b.replace('persist-credentials: false', 'persist-credentials: true'),
  b => b.replace('if: always()', 'if: success()'),
  b => b.replace('if-no-files-found: error', 'if-no-files-found: warn'),
  b => b + '\n    continue-on-error: true',
  b => b + '\n    TEST_SHARD_PARALLELISM: 2'
]) assert.throws(() => verifyKWriteDiagnostic(mutate(writeDiagnostic)), 'unsafe K refresh workflow mutation rejected');
const cDiagnostic = jobBlock('parallel-c-process-evidence');
assert.equal(cDiagnostic.split('\n').find(line => line.trim().startsWith('if:')),
  "    if: github.event_name == 'pull_request' && github.head_ref == 'ci/shard-c-process-evidence'");
for (const token of ["node: ['22', '24']", 'timeout-minutes: 90', 'contents: read', 'fail-fast: false',
  'node tests/parallel-shard-runner-test.js', '--full-shard C', '--retain-output',
  'ref: d10a971eb99fb4111fd3a169ba9c34ccb7a81971', '--source-sha d10a971eb99fb4111fd3a169ba9c34ccb7a81971',
  'persist-credentials: false', 'if: always()', 'if-no-files-found: error'])
  assert.ok(cDiagnostic.includes(token), `C diagnostic must retain ${token}`);
assert.doesNotMatch(cDiagnostic, /continue-on-error|TEST_SHARD_PARALLELISM|vars\./);
console.log('shard-parallel-workflow-contract-test: ok');
