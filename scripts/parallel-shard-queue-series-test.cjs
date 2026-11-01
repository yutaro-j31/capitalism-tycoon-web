'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs');
const os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const { compareSeries } = require('./parallel-shard-queue-series.cjs');
const sample = (id, admission, queue) => ({ runId: id, headSha: 'a'.repeat(40),
  workflowState: 'success', canonicalCoverageComplete: true, pendingObservation: false,
  completedRunHasPendingJobs: false, aggregateState: 'success',
  runCreationToFirstObservedJobCreationSeconds: admission,
  runCreationToAggregateCompletionSeconds: admission + 100,
  rows: [...'ABCDEFGHIJKL'].map((x, i) => ({ name: `test-shard-${x}`, state: 'success',
    runCreationToJobCreationSeconds: admission + i, jobCreationToStartSeconds: queue,
    elapsedSeconds: 100 + i })) });
const input = { summaries: [sample(2, 20, 4), sample(1, 1800, 2)] };
const original = structuredClone(input), result = compareSeries(input);
assert.deepEqual(input, original); assert.deepEqual(result.runs.map(x => x.runId), [1, 2]);
assert.deepEqual(result.metrics.firstJobCreationSeconds, { samples: 2, min: 20, median: 910, max: 1800 });
assert.deepEqual(result.metrics.runnerQueueMedianSeconds, { samples: 2, min: 2, median: 3, max: 4 });
assert.deepEqual(result.focusHIK.K.executionSeconds, { samples: 2, min: 110, median: 110, max: 110 });
assert.equal(result.runnerQuota, null); assert.equal(result.hostComparabilityEstablished, false);
assert.deepEqual(compareSeries({ summaries: [...input.summaries].reverse() }), result);
const missing = structuredClone(input);
missing.summaries[0].runCreationToFirstObservedJobCreationSeconds = null;
assert.equal(compareSeries(missing).metrics.firstJobCreationSeconds.samples, 1);
// Missing one canonical timestamp must not masquerade as a complete A-L
// maximum/median. The H/I/K per-shard observations remain available.
for (const [key, aggregate] of [
  ['runCreationToJobCreationSeconds', 'lastShardCreationSeconds'],
  ['jobCreationToStartSeconds', 'runnerQueueMedianSeconds'],
  ['elapsedSeconds', 'shardExecutionMedianSeconds']
]) {
  const partial = structuredClone(input);
  partial.summaries[0].rows[0][key] = null;
  const observed = compareSeries(partial);
  assert.equal(observed.runs.find(r => r.runId === 2)[aggregate], null);
  assert.equal(observed.metrics[aggregate].samples, 1);
  assert.deepEqual(observed.focusHIK.K, result.focusHIK.K);
}
for (const mutate of [x => x.summaries.pop(), x => x.summaries.push(x.summaries[0]),
  x => x.summaries[0].workflowState = 'pending', x => x.summaries[0].pendingObservation = true,
  x => x.summaries[0].canonicalCoverageComplete = false,
  x => x.summaries[0].completedRunHasPendingJobs = true,
  x => delete x.summaries[0].completedRunHasPendingJobs,
  x => x.summaries[0].aggregateState = 'failed',
  x => delete x.summaries[0].aggregateState,
  x => x.summaries[0].aggregateState = 'missing-or-ambiguous',
  x => x.summaries[0].rows.pop(),
  x => x.summaries[0].rows[1].name = 'test-shard-A',
  x => x.summaries[0].rows[0].state = 'cancelled',
  x => x.summaries[0].rows[0].elapsedSeconds = Infinity,
  x => x.summaries[0].rows[0].jobCreationToStartSeconds = -1,
  x => x.summaries[0].headSha = 'short']) {
  const bad = structuredClone(input); mutate(bad); assert.throws(() => compareSeries(bad));
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-queue-series-'));
try { const file = path.join(dir, 'collection.json'); fs.writeFileSync(file, JSON.stringify(input));
  const stdout = cp.execFileSync(process.execPath,
    [path.join(__dirname, 'parallel-shard-queue-series.cjs'), file], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(stdout), result);
  fs.writeFileSync(file, JSON.stringify({ summaries: [input.summaries[0]] }));
  const bad = cp.spawnSync(process.execPath,
    [path.join(__dirname, 'parallel-shard-queue-series.cjs'), file]);
  assert.notEqual(bad.status, 0);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('CI queue series controls: PASS (admission, runner queue, runtime, invalid, CLI)');
