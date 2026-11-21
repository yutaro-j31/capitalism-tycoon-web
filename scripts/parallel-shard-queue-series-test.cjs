'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs');
const os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const { compareSeries } = require('./parallel-shard-queue-series.cjs');
const sample = (id, admission, queue) => ({ runId: id, runAttempt: id, asOf: '2026-11-01T00:00:00.000Z', headSha: 'a'.repeat(40),
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
assert.deepEqual(result.runs.map(x => [x.runId, x.runAttempt, x.asOf]),
  [[1, 1, '2026-11-01T00:00:00.000Z'], [2, 2, '2026-11-01T00:00:00.000Z']]);
assert.equal(result.runnerQuota, null); assert.equal(result.hostComparabilityEstablished, false);
assert.equal(result.runs[0].lastObservedShardPhases, null);
assert.equal(result.runs[0].postLastShardToAggregateSeconds, null);
assert.deepEqual(compareSeries({ summaries: [...input.summaries].reverse() }), result);
const finishes = structuredClone(input);
const tied = finishes.summaries[0];
for (const [i, row] of tied.rows.entries()) row.completed = (200 + i) * 1000;
tied.rows[7].completed = tied.rows[11].completed;
tied.rows[11].jobCreationToStartSeconds = null;
tied.postShardAggregateIntervalSeconds = 5;
tied.rows.reverse();
const last = compareSeries(finishes).runs.find(r => r.runId === 2);
assert.deepEqual(last.lastObservedShardPhases, [
  { shard: 'H', runCreationToJobCreationSeconds: 27, jobCreationToStartSeconds: 4, executionSeconds: 107 },
  { shard: 'L', runCreationToJobCreationSeconds: 31, jobCreationToStartSeconds: null, executionSeconds: 111 }
]);
assert.equal(last.postLastShardToAggregateSeconds, 5);
tied.rows.find(row => row.name === 'test-shard-A').completed = null;
const unknownLast = compareSeries(finishes).runs.find(r => r.runId === 2);
assert.equal(unknownLast.lastObservedShardPhases, null);
assert.equal(unknownLast.postLastShardToAggregateSeconds, null);
tied.rows.find(row => row.name === 'test-shard-A').completed = -1;
assert.throws(() => compareSeries(finishes));
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
for (const value of [undefined, null, 0, -1, 1.5, Infinity, NaN, '1', Number.MAX_SAFE_INTEGER + 1]) {
  const bad = structuredClone(input); bad.summaries[0].runAttempt = value;
  assert.throws(() => compareSeries(bad), /positive runAttempt/);
}
for (const value of [undefined, null, '', 'not a timestamp', 0, {}]) {
  const bad = structuredClone(input); bad.summaries[0].asOf = value;
  assert.throws(() => compareSeries(bad), /observation timestamp/);
}
const duplicateAttempt = structuredClone(input);
duplicateAttempt.summaries[1].runId = duplicateAttempt.summaries[0].runId;
assert.throws(() => compareSeries(duplicateAttempt), 'different attempts of one run are not independent run samples');
// Replay existing raw API projections through the single-run attempt guard first.
const retained = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/ci-evidence/ci-overlap-2026-10-31.json')));
const { summarize } = require('./parallel-shard-ci-timing.cjs');
const summaries = retained.snapshots.map(s => summarize(s.run, s.jobs, retained.asOf));
const replay = compareSeries({ summaries });
assert.deepEqual(replay.runs.map(r => [r.runId, r.runAttempt, r.asOf]),
  summaries.map(s => [s.runId, s.runAttempt, s.asOf]).sort((a, b) => a[0] - b[0]));
assert.equal(replay.observedRuns, 3);
assert.equal(replay.metrics.runnerQueueMedianSeconds.median, 65);
assert.deepEqual(replay.runs.map(r => r.lastObservedShardPhases.map(row => 'test-shard-' + row.shard)),
  summaries.map(s => s.lastCanonicalSuccessJobs.slice().sort()));
assert.deepEqual(replay.runs.map(r => r.postLastShardToAggregateSeconds),
  summaries.map(s => s.postShardAggregateIntervalSeconds));
assert.equal(replay.runnerQuota, null); assert.equal(replay.counterfactualSpeedup, null);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-queue-series-'));
try { const file = path.join(dir, 'collection.json'); fs.writeFileSync(file, JSON.stringify(input));
  const stdout = cp.execFileSync(process.execPath,
    [path.join(__dirname, 'parallel-shard-queue-series.cjs'), file], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(stdout), result);
  const missingAttempt = structuredClone(input); delete missingAttempt.summaries[0].runAttempt;
  fs.writeFileSync(file, JSON.stringify(missingAttempt));
  const unproven = cp.spawnSync(process.execPath,
    [path.join(__dirname, 'parallel-shard-queue-series.cjs'), file], { encoding: 'utf8' });
  assert.notEqual(unproven.status, 0); assert.equal(unproven.stdout, '');
  assert.match(unproven.stderr, /positive runAttempt/);
  fs.writeFileSync(file, JSON.stringify({ summaries: [input.summaries[0]] }));
  const bad = cp.spawnSync(process.execPath,
    [path.join(__dirname, 'parallel-shard-queue-series.cjs'), file]);
  assert.notEqual(bad.status, 0);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('CI queue series controls: PASS (admission, runner queue, runtime, invalid, CLI)');
