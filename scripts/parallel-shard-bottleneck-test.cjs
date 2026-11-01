'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { observe } = require('./parallel-shard-bottleneck.cjs');
const rows = [...'ABCDEFGHIJKL'].map((s, i) => ({ name: `test-shard-${s}`, state: 'success',
  runCreationToJobCreationSeconds: 10, jobCreationToStartSeconds: 10,
  elapsedSeconds: 10, runCreationToStartSeconds: 20,
  pendingAgeSeconds: null, completed: 30000 + i * 1000 }));
const patch = (s, values) => Object.assign(rows.find(r => r.name === `test-shard-${s}`), values);
patch('H', { jobCreationToStartSeconds: 100, elapsedSeconds: 10, runCreationToStartSeconds: 110, completed: 120000 });
patch('I', { jobCreationToStartSeconds: 5, elapsedSeconds: 110, runCreationToStartSeconds: 15, completed: 125000 });
patch('K', { jobCreationToStartSeconds: 2, elapsedSeconds: 120, runCreationToStartSeconds: 12, completed: 132000 });
const summary = { runId: 42, headSha: 'a'.repeat(40), workflowState: 'success',
  canonicalCoverageComplete: true, pendingObservation: false,
  aggregateState: 'success', completedRunHasPendingJobs: false,
  runCreationToFirstObservedJobCreationSeconds: 0,
  runCreationToAggregateCompletionSeconds: 2317, rows };
const copy = structuredClone(summary), full = observe(summary);
assert.deepEqual(summary, copy, 'read-only');
assert.equal(full.completeSuccessfulSnapshot, true);
assert.equal(full.canonicalSuccessObserved, 12);
assert.equal(full.runCreationToFirstObservedJobCreationSeconds, 0);
assert.deepEqual(full.canonicalShardCreationDelaySeconds, { samples: 12, min: 10, max: 10 });
assert.equal(full.runCreationToAggregateCompletionSeconds, 2317);
const creationSpread = structuredClone(summary);
creationSpread.rows[0].runCreationToJobCreationSeconds = 5;
creationSpread.rows[11].runCreationToJobCreationSeconds = 12;
assert.deepEqual(observe(creationSpread).canonicalShardCreationDelaySeconds,
  { samples: 12, min: 5, max: 12 }, 'shard admission differs from first observed job');
const noCreation = structuredClone(summary);
noCreation.runCreationToFirstObservedJobCreationSeconds = null;
noCreation.runCreationToAggregateCompletionSeconds = null;
for (const row of noCreation.rows) row.runCreationToJobCreationSeconds = null;
assert.deepEqual(observe(noCreation).canonicalShardCreationDelaySeconds,
  { samples: 0, min: null, max: null });
assert.equal(observe(noCreation).runCreationToFirstObservedJobCreationSeconds, null);
assert.equal(observe(noCreation).runCreationToAggregateCompletionSeconds, null);
assert.deepEqual(full.topObservedExecution.slice(0, 2), [{ shard: 'K', seconds: 120 }, { shard: 'I', seconds: 110 }]);
assert.deepEqual(full.topObservedJobCreationToStart.slice(0, 2), [{ shard: 'H', seconds: 100 }, { shard: 'A', seconds: 10 }]);
assert.deepEqual(full.lastObservedSuccessfulShards, ['K']);
assert.deepEqual(full.focusHIK.map(s => s.shard), ['H', 'I', 'K']);
assert.equal(full.runnerQuota, null); assert.equal(full.productionParallelismAuthorized, false);
// A successful workflow label cannot certify a failed/missing aggregate or
// contradictory pending-child metadata. Keep individual observations available.
for (const mutate of [
  x => x.aggregateState = 'failed',
  x => x.aggregateState = 'cancelled',
  x => x.aggregateState = 'missing-or-ambiguous',
  x => delete x.aggregateState,
  x => x.completedRunHasPendingJobs = true,
  x => delete x.completedRunHasPendingJobs
]) {
  const inconsistent = structuredClone(summary); mutate(inconsistent);
  const observation = observe(inconsistent);
  assert.equal(observation.completeSuccessfulSnapshot, false, 'incomplete child metadata cannot certify a full successful snapshot');
  assert.equal(observation.lastObservedSuccessfulShards, null);
  assert.deepEqual(observation.focusHIK, full.focusHIK, 'individual shard observations survive');
  assert.deepEqual(observation.topObservedExecution, full.topObservedExecution);
}
// Exercise the actual upstream API-snapshot -> summary -> observation boundary.
const { summarize } = require('./parallel-shard-ci-timing.cjs');
const time = seconds => new Date(Date.UTC(2026, 10, 1) + seconds * 1000).toISOString();
const apiRun = { id: 43, run_attempt: 1, head_sha: 'b'.repeat(40), event: 'pull_request',
  created_at: time(0), status: 'completed', conclusion: 'success' };
const apiJobs = [...'ABCDEFGHIJKL'].map((shard, index) => ({ id: 100 + index,
  run_id: 43, run_attempt: 1, name: `test-shard-${shard}`, created_at: time(1), started_at: time(2),
  completed_at: time(10 + index), status: 'completed', conclusion: 'success' }));
const aggregate = { id: 200, run_id: 43, run_attempt: 1, name: 'test', created_at: time(22),
  started_at: time(23), completed_at: time(24), status: 'completed', conclusion: 'success' };
const fromApi = jobs => observe(summarize(apiRun, { total_count: jobs.length, jobs }, time(30)));
assert.equal(fromApi([...apiJobs, aggregate]).completeSuccessfulSnapshot, true);
for (const jobs of [apiJobs, [...apiJobs, { ...aggregate, conclusion: 'failure' }],
  [...apiJobs, { ...aggregate, status: 'in_progress', conclusion: null, completed_at: null }]]) {
  const observation = fromApi(jobs);
  assert.equal(observation.completeSuccessfulSnapshot, false);
  assert.equal(observation.lastObservedSuccessfulShards, null);
  assert.equal(observation.canonicalSuccessObserved, 12);
}
const partial = structuredClone(summary);
partial.workflowState = 'pending'; partial.canonicalCoverageComplete = false; partial.pendingObservation = true;
const h = partial.rows.find(r => r.name === 'test-shard-H');
Object.assign(h, { state: 'pending', jobCreationToStartSeconds: null, elapsedSeconds: null,
  runCreationToStartSeconds: null, completed: null, pendingAgeSeconds: 50 });
const i = partial.rows.find(r => r.name === 'test-shard-I');
Object.assign(i, { state: 'pending', elapsedSeconds: null, completed: null, pendingAgeSeconds: null });
const k = partial.rows.find(r => r.name === 'test-shard-K');
Object.assign(k, { state: 'failed', elapsedSeconds: 120 });
const incomplete = observe(partial);
assert.equal(incomplete.completeSuccessfulSnapshot, false);
assert.equal(incomplete.canonicalSuccessObserved, 9);
assert.equal(incomplete.lastObservedSuccessfulShards, null);
assert.equal(incomplete.focusHIK[0].jobCreationToStartSeconds, null);
assert.equal(incomplete.focusHIK[0].pendingAgeSeconds, 50);
assert.ok(!incomplete.topObservedExecution.some(x => ['H', 'I', 'K'].includes(x.shard)));
const missing = structuredClone(partial); missing.rows = missing.rows.filter(r => r.name !== 'test-shard-H');
assert.equal(observe(missing).focusHIK[0].state, 'missing');
const tied = structuredClone(summary); tied.rows.find(r => r.name === 'test-shard-J').completed = 132000;
assert.deepEqual(observe(tied).lastObservedSuccessfulShards, ['J', 'K']);
for (const mutate of [
  x => x.rows.push(structuredClone(x.rows[0])),
  x => x.rows[0].elapsedSeconds = -1,
  x => x.rows[0].completed = NaN,
  x => x.runCreationToFirstObservedJobCreationSeconds = -1,
  x => x.runCreationToAggregateCompletionSeconds = Infinity,
  x => x.rows[0].runCreationToJobCreationSeconds = -1,
  x => x.headSha = 'short',
  x => x.rows = null
]) { const bad = structuredClone(summary); mutate(bad); assert.throws(() => observe(bad)); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shard-bottleneck-'));
try {
  const input = path.join(dir, 'summary.json'); fs.writeFileSync(input, JSON.stringify(summary));
  const result = JSON.parse(cp.execFileSync(process.execPath,
    [path.join(__dirname, 'parallel-shard-bottleneck.cjs'), input], { encoding: 'utf8' }));
  assert.deepEqual(result, full, 'CLI matches pure function');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('CI shard bottleneck observation: PASS (H/I/K queue vs elapsed, partial, ties, missing, CLI, no causal claims)');
