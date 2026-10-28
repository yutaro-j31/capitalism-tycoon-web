'use strict';

// Stage 2A contract: test.yml may hand a parallelism value to shard J only, and must stay serial (1) when the
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
const expr = "TEST_SHARD_PARALLELISM: ${{ matrix.shard == 'J' && (vars.TEST_SHARD_PARALLELISM_J || '1') || '1' }}";
assert.equal(job.split(expr).length - 1, 1, 'exactly one J-only parallelism expression');
assert.equal((job.match(/TEST_SHARD_PARALLELISM:/g) || []).length, 1, 'no other parallelism assignment');
assert.equal((job.match(/vars\.TEST_SHARD_PARALLELISM_J/g) || []).length, 2, 'the variable is referenced only by the env value and the upload condition');

// Evaluate the expression the way Actions does for each shard with the variable unset / set.
function parallelism(shard, variable) {
  return shard === 'J' && (variable || '1') || '1';
}
for (const shard of 'ABCDEFGHIJKL') {
  assert.equal(parallelism(shard, ''), '1', `${shard} is serial when the variable is unset`);
  assert.equal(parallelism(shard, '2'), shard === 'J' ? '2' : '1', `${shard} with the variable set to 2`);
}

// Required gates are unchanged.
assert.match(job, /needs: test-shard-contract/);
// 40 since #1184: measured shard test time on slow runners reached 1787 s against a 30-minute job budget.
assert.match(job, /timeout-minutes: 40/);
assert.match(job, /shard: \[A, B, C, D, E, F, G, H, I, J, K, L\]/);
assert.match(job, /fail-fast: false/);
assert.match(job, /run: node tests\/run-all-shard\.js/);
assert.doesNotMatch(job, /continue-on-error/);

// Every added step is J-only, and the report upload only happens when the pilot variable is set.
assert.match(job, /name: Record runner resources \(shard J parallel pilot\)\n\s+if: matrix\.shard == 'J'/);
assert.match(job, /if: always\(\) && matrix\.shard == 'J' && vars\.TEST_SHARD_PARALLELISM_J != ''/);
for (const needle of ['nproc', 'free -m', '/proc/cpuinfo', 'cpu.max', 'memory.max']) assert.ok(job.includes(needle), `resource log has ${needle}`);

// The aggregate job still requires every shard.
assert.match(text, /test "\$\{\{ needs\.test-shards\.result \}\}" = "success"/);

console.log('shard-parallel-workflow-contract-test: ok');
