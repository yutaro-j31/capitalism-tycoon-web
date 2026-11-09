'use strict';
const assert = require('node:assert/strict');
const { summarize } = require('./parallel-shard-ci-timing.cjs');
const time = n => new Date(Date.UTC(2026, 9, 30) + n * 1000).toISOString();
const run = { id: 1, run_attempt: 1, head_sha: 'a'.repeat(40), event: 'push', created_at: time(0), status: 'completed', conclusion: 'success' };
const make = (id, name, start, end, conclusion = 'success') => ({ id, run_id: 1, run_attempt: 1, name, created_at: time(10), started_at: time(start), completed_at: time(end), status: 'completed', conclusion });
const jobs = [...'ABCDEFGHIJKL'].map((s, i) => make(i + 1, `test-shard-${s}`, 20 + i, 100 + i));
jobs.push(make(13, 'test', 150, 151), make(14, 'cancelled-diagnostic', 20, 500, 'cancelled'), make(15, 'skipped-control', 20, 1000, 'skipped'));
const response = { total_count: jobs.length, jobs };
const original = structuredClone(response), result = summarize(run, response, time(1100));
const rerunResponse = structuredClone(response);
for (const job of rerunResponse.jobs) job.run_attempt = 2;
for (const change of [
  x => x.jobs[0].run_attempt = 2,
  x => delete x.jobs[0].run_attempt
]) {
  const wrongAttempt = structuredClone(response); change(wrongAttempt);
  assert.throws(() => summarize(run, wrongAttempt, time(1100)), /run attempt/);
}
assert.equal(result.runAttempt, 1, 'retain verified run attempt');
assert.equal(summarize({ ...run, run_attempt: 2 }, rerunResponse, time(1100)).runAttempt, 2);
for (const attempt of [undefined, null, 0, -1, 1.5, '1'])
  assert.throws(() => summarize({ ...run, run_attempt: attempt }, response, time(1100)), /run attempt/);
// Replay a retained projection from a complete attempt-specific GitHub API response.
const recorded = JSON.parse(require('node:fs').readFileSync(require('node:path').join(
  __dirname, '../docs/ci-evidence/ci-run-attempt-2026-11-01.json'), 'utf8'));
const replay = summarize(recorded.run, recorded.jobs, recorded.asOf);
assert.equal(replay.runAttempt, 1);
assert.equal(replay.workflowState, 'success');
assert.equal(replay.canonicalCoverageComplete, true);
const wrongRecorded = structuredClone(recorded.jobs);
wrongRecorded.jobs[0].run_attempt = 2;
assert.throws(() => summarize(recorded.run, wrongRecorded, recorded.asOf), /run attempt/);
assert.equal(result.workflowState, 'success'); assert.equal(result.canonicalCoverageComplete, true);
assert.deepEqual(result.successfulShardCreationToStart, { samples: 12, medianSeconds: 15.5 });
assert.deepEqual(result.successfulShardElapsed, { samples: 12, medianSeconds: 80 });
assert.equal(result.jobStates.cancelled, 1); assert.equal(result.jobStates.skipped, 1);
assert.equal(result.postShardAggregateIntervalSeconds, 40); assert.equal(result.aggregateCreationToStartSeconds, 140);
assert.deepEqual(result.lastCanonicalSuccessJobs, ['test-shard-L']); assert.equal(result.maximumObservedJobOverlap, 12);
// Pending final aggregate: separate age from completed duration and runner usage.
const pendingRun = { ...run, status: 'queued', conclusion: null };
const pendingGate = structuredClone(response);
Object.assign(pendingGate.jobs[12], { created_at: time(120), status: 'queued', conclusion: null, completed_at: null });
const gateWait = summarize(pendingRun, pendingGate, time(1100));
assert.equal(gateWait.aggregateCreationOffsetFromLastShardSeconds, 9);
assert.equal(gateWait.pendingAggregatePostShardObservationSeconds, 989);
assert.equal(gateWait.aggregatePendingWithoutStartAgeSeconds, 980);
assert.equal(gateWait.postShardAggregateIntervalSeconds, null);
assert.equal(gateWait.runCreationToAggregateCompletionSeconds, null);
assert.equal(gateWait.maximumObservedJobOverlap, 12, 'queued placeholder is not runner occupation');
assert.equal(gateWait.rows[12].started, null);
const runningGate = structuredClone(pendingGate); runningGate.jobs[12].status = 'in_progress';
const runningTail = summarize(pendingRun, runningGate, time(1100));
assert.equal(runningTail.pendingAggregatePostShardObservationSeconds, 989);
assert.equal(runningTail.aggregatePendingWithoutStartAgeSeconds, null);
const earlyCreation = structuredClone(pendingGate); earlyCreation.jobs[12].created_at = time(10);
assert.equal(summarize(pendingRun, earlyCreation, time(1100)).aggregateCreationOffsetFromLastShardSeconds, -101,
  'creation offset stays signed when aggregate metadata predates shard completion');
assert.equal(summarize(run, pendingGate, time(1100)).pendingAggregatePostShardObservationSeconds, null,
  'completed run with inconsistent pending jobs is flagged separately, not an ongoing wait');
for (const change of [
  r => r.jobs.splice(12, 1),
  r => r.jobs.push({ ...r.jobs[12], id: 16 }),
  r => r.jobs[0].conclusion = 'failure',
  r => r.jobs[0].completed_at = null,
  r => { r.jobs[12].status = 'completed'; r.jobs[12].conclusion = 'cancelled'; }
]) {
  const badGate = structuredClone(pendingGate); change(badGate); badGate.total_count = badGate.jobs.length;
  assert.equal(summarize(pendingRun, badGate, time(1100)).pendingAggregatePostShardObservationSeconds, null);
}
assert.equal(result.pendingAggregatePostShardObservationSeconds, null);
assert.equal(result.aggregatePendingWithoutStartAgeSeconds, null);
const retainedWait = require('../docs/ci-evidence/aggregate-wait-2026-11-02.json');
for (const [i, snapshot] of retainedWait.snapshots.entries()) {
  const observedWait = summarize(snapshot.run, snapshot.jobs, snapshot.asOf);
  assert.equal(observedWait.canonicalSuccessCount, 12);
  assert.equal(observedWait.aggregateState, 'pending');
  assert.equal(observedWait.pendingAggregatePostShardObservationSeconds, [590.066, 267.256][i]);
  assert.equal(observedWait.aggregatePendingWithoutStartAgeSeconds, [589.066, 267.256][i]);
  assert.equal(observedWait.aggregateCreationOffsetFromLastShardSeconds, [1, 0][i]);
  assert.equal(observedWait.postShardAggregateIntervalSeconds, null);
  assert.equal(observedWait.workflowState, 'pending');
}
// Non-success terminal timestamps are not evidence of occupied runner intervals.
// Preserve their diagnostic row timings, and include observed running intervals.
const mixedOverlapJobs = [
  make(101, 'success-control', 20, 100),
  make(102, 'cancelled-control', 20, 100, 'cancelled'),
  make(103, 'failed-control', 20, 100, 'failure'),
  make(104, 'neutral-control', 20, 100, 'neutral'),
  make(105, 'unknown-control', 20, 100, null),
  { ...make(106, 'running-control', 20, 100), status: 'in_progress', conclusion: null, completed_at: null }
];
const mixedOverlap = summarize(run, { total_count: mixedOverlapJobs.length, jobs: mixedOverlapJobs }, time(1100));
assert.equal(mixedOverlap.maximumObservedJobOverlap, 2);
assert.equal(mixedOverlap.rows[1].elapsedSeconds, 80, 'terminal diagnostic timing remains available');
assert.equal(mixedOverlap.pendingObservation, true);
assert.equal(summarize(run, { total_count: 5, jobs: mixedOverlapJobs.slice(0, -1) }, time(1100)).maximumObservedJobOverlap, 1);
assert.deepEqual(response, original);
assert.equal(result.observedJobCreationCount, jobs.length); assert.equal(result.returnedJobCreationCoverageComplete, true);
assert.equal(result.firstObservedJobCreatedAt, time(10)); assert.equal(result.runCreationToFirstObservedJobCreationSeconds, 10);
assert.deepEqual(result.successfulShardRunCreationToStart, { samples: 12, medianSeconds: 25.5 });
assert.equal(result.rows[0].runCreationToJobCreationSeconds, 10);
assert.equal(result.rows[0].runCreationToStartSeconds,
  result.rows[0].runCreationToJobCreationSeconds + result.rows[0].jobCreationToStartSeconds);
// A large pre-job creation delay must remain visible even with short job queues.
const delayed = structuredClone(response);
for (const j of delayed.jobs) for (const key of ['created_at', 'started_at', 'completed_at'])
  j[key] = new Date(Date.parse(j[key]) + 1101 * 1000).toISOString();
const delay = summarize(run, delayed, time(2201));
assert.equal(delay.runCreationToFirstObservedJobCreationSeconds, 1111);
assert.deepEqual(delay.successfulShardCreationToStart, result.successfulShardCreationToStart);
assert.deepEqual(delay.successfulShardElapsed, result.successfulShardElapsed);
assert.deepEqual(delay.successfulShardRunCreationToStart, { samples: 12, medianSeconds: 1126.5 });
const absentCreation = structuredClone(response); absentCreation.jobs[0].created_at = null;
const absent = summarize(run, absentCreation, time(1100));
assert.equal(absent.observedJobCreationCount, jobs.length - 1); assert.equal(absent.returnedJobCreationCoverageComplete, false);
assert.equal(absent.rows[0].runCreationToJobCreationSeconds, null);
assert.equal(absent.rows[0].jobCreationToStartSeconds, null);
assert.equal(absent.firstObservedJobCreatedAt, time(10)); // earliest known observation, not a completeness claim
const allMissing = structuredClone(response); for (const j of allMissing.jobs) j.created_at = null;
const unknownCreation = summarize(run, allMissing, time(1100));
assert.equal(unknownCreation.observedJobCreationCount, 0); assert.equal(unknownCreation.firstObservedJobCreatedAt, null);
assert.equal(unknownCreation.runCreationToFirstObservedJobCreationSeconds, null);
assert.equal(unknownCreation.returnedJobCreationCoverageComplete, false);
const empty = summarize({ ...run, status: 'queued', conclusion: null }, { total_count: 0, jobs: [] }, time(1100));
assert.equal(empty.firstObservedJobCreatedAt, null); assert.equal(empty.runCreationToFirstObservedJobCreationSeconds, null);
assert.equal(empty.observedJobCreationCount, 0); assert.equal(empty.returnedJobCreationCoverageComplete, false);
assert.deepEqual(empty.successfulShardRunCreationToStart, { samples: 0, medianSeconds: null });

const cancelled = structuredClone(response); cancelled.jobs[0].conclusion = 'cancelled';
const partial = summarize({ ...run, conclusion: 'cancelled' }, cancelled, time(1100));
assert.equal(partial.workflowState, 'cancelled'); assert.equal(partial.canonicalCoverageComplete, false);
assert.equal(partial.successfulShardElapsed.samples, 11); assert.equal(partial.postShardAggregateIntervalSeconds, null);
const waiting = { total_count: 1, jobs: [{ ...make(1, 'test-shard-A', 20, 30), status: 'queued', conclusion: null, completed_at: null }] };
const queued = summarize({ ...run, status: 'queued', conclusion: 'success' }, waiting, time(1100));
assert.equal(queued.workflowState, 'pending'); assert.equal(queued.canonicalSuccessCount, 0);
assert.equal(queued.rows[0].jobCreationToStartSeconds, null); assert.equal(queued.rows[0].pendingAgeSeconds, 1090);
assert.equal(queued.runCreationToFirstObservedJobCreationSeconds, 10); // created does not mean started
assert.deepEqual(queued.successfulShardRunCreationToStart, { samples: 0, medianSeconds: null });
assert.equal(queued.successfulShardElapsed.medianSeconds, null); assert.equal(queued.maximumObservedJobOverlap, 0);
const missing = structuredClone(response); missing.jobs[0].started_at = null;
assert.equal(summarize(run, missing, time(1100)).successfulShardElapsed.samples, 11);
const mixed = summarize({ ...run, status: 'in_progress', conclusion: null }, response, time(1100));
assert.equal(mixed.aggregateState, 'success'); assert.equal(mixed.workflowState, 'pending');
const duplicate = structuredClone(response); duplicate.jobs[1].name = 'test-shard-A';
assert.equal(summarize(run, duplicate, time(1100)).canonicalCoverageComplete, false);
for (const mutate of [r => r.total_count++, r => r.jobs[0].run_id++, r => r.jobs[0].created_at = 'bad',
  r => r.jobs[0].started_at = time(9), r => r.jobs[0].completed_at = time(15), r => r.jobs[0].id = r.jobs[1].id]) {
  const copy = structuredClone(response); mutate(copy); assert.throws(() => summarize(run, copy, time(1100)));
}
for (const [conclusion, expected] of [['failure', 'failed'], ['timed_out', 'failed'], ['neutral', 'neutral'], [null, 'unknown']]) {
  const sample = { total_count: 1, jobs: [make(1, 'one', 20, 30, conclusion)] };
  assert.equal(summarize(run, sample, time(1100)).rows[0].state, expected);
}
assert.equal(summarize(run, waiting, time(1100)).completedRunHasPendingJobs, true);
const skippedPlaceholder = { total_count: 1, jobs: [{ ...make(1, 'skipped', 20, 9, 'skipped') }] };
assert.equal(summarize(run, skippedPlaceholder, time(1100)).rows[0].elapsedSeconds, null);
assert.equal(summarize(run, skippedPlaceholder, time(1100)).maximumObservedJobOverlap, 0);
const tied = { total_count: 2, jobs: [make(1, 'one', 20, 30), make(2, 'two', 30, 40)] };
assert.equal(summarize(run, tied, time(1100)).maximumObservedJobOverlap, 1);
console.log('CI timing audit: PASS (queue/cancel/pending/pre-job-creation/missing/pagination/chronology/ties; synthetic controls)');
require('./parallel-shard-ci-overlap-test.cjs');
require('./parallel-shard-cancelled-test-test.cjs');
