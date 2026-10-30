'use strict';
const assert = require('node:assert/strict');
const { summarize } = require('./parallel-shard-ci-timing.cjs');
const time = n => new Date(Date.UTC(2026, 9, 30) + n * 1000).toISOString();
const run = { id: 1, head_sha: 'a'.repeat(40), event: 'push', created_at: time(0), status: 'completed', conclusion: 'success' };
const make = (id, name, start, end, conclusion = 'success') => ({ id, run_id: 1, name, created_at: time(10), started_at: time(start), completed_at: time(end), status: 'completed', conclusion });
const jobs = [...'ABCDEFGHIJKL'].map((s, i) => make(i + 1, `test-shard-${s}`, 20 + i, 100 + i));
jobs.push(make(13, 'test', 150, 151), make(14, 'cancelled-diagnostic', 20, 500, 'cancelled'), make(15, 'skipped-control', 20, 1000, 'skipped'));
const response = { total_count: jobs.length, jobs };
const original = structuredClone(response), result = summarize(run, response, time(1100));
assert.equal(result.workflowState, 'success'); assert.equal(result.canonicalCoverageComplete, true);
assert.deepEqual(result.successfulShardCreationToStart, { samples: 12, medianSeconds: 15.5 });
assert.deepEqual(result.successfulShardElapsed, { samples: 12, medianSeconds: 80 });
assert.equal(result.jobStates.cancelled, 1); assert.equal(result.jobStates.skipped, 1);
assert.equal(result.postShardAggregateIntervalSeconds, 40); assert.equal(result.aggregateCreationToStartSeconds, 140);
assert.deepEqual(result.lastCanonicalSuccessJobs, ['test-shard-L']); assert.equal(result.maximumObservedJobOverlap, 13);
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
