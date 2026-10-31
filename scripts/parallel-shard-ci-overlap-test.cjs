'use strict';
const assert = require('node:assert/strict');
const { summarizeCollection } = require('./parallel-shard-ci-overlap.cjs');
const time = s => new Date(Date.UTC(2026, 9, 31) + s * 1000).toISOString();
const run = (id, status = 'completed', conclusion = 'success') => ({ id, run_attempt: 1,
  repository: { full_name: 'fixture/repository' }, head_sha: 'a'.repeat(40),
  event: id === 1 ? 'push' : 'pull_request', created_at: time(0), status, conclusion });
const job = (id, run_id, start, end, status = 'completed', conclusion = 'success') => ({
  id, run_id, run_attempt: 1, name: `job-${id}`, created_at: time(1),
  started_at: start === null ? null : time(start), completed_at: end === null ? null : time(end), status, conclusion });
const snap = (r, list) => ({ run: r, jobs: { total_count: list.length, jobs: list } });
const input = { snapshots: [snap(run(1), [job(10, 1, 10, 30), job(11, 1, 20, 40)]),
  snap(run(2), [job(20, 2, 20, 30), job(21, 2, 30, 50)])] };
const result = summarizeCollection(input, time(100));
assert.equal(result.maximumObservedEligibleJobOverlap, 3);
assert.equal(result.maximumObservedEligibleRunOverlap, 2);
assert.deepEqual(result.peakWitness, { at: time(20), jobIds: [10, 11, 20], runIds: [1, 2] });
assert.equal(result.observedEligibleJobSeconds, 70);
assert.equal(result.capacityQuota, null); assert.equal(result.completeRepositoryCoverage, false);
assert.deepEqual(summarizeCollection({ ...input, asOf: time(100) }), result, 'retained observation time replays deterministically');
const reversed = structuredClone(input); reversed.snapshots.reverse();
assert.deepEqual(summarizeCollection(reversed, time(100)).peakWitness, result.peakWitness);
const tied = { snapshots: [snap(run(1), [job(10, 1, 10, 20)]), snap(run(2), [job(20, 2, 20, 30)])] };
assert.equal(summarizeCollection(tied, time(100)).maximumObservedEligibleJobOverlap, 1);
const waiting = { snapshots: [snap(run(1, 'in_progress', null), [
  job(10, 1, 10, null, 'in_progress', null),
  job(11, 1, 1, null, 'queued', null), // API placeholder must not count
  job(12, 1, 1, 2, 'completed', 'cancelled'),
  job(13, 1, 10, 20, 'completed', 'failure'),
  job(14, 1, 10, 20, 'completed', 'neutral'),
  job(15, 1, 10, 2, 'completed', 'skipped'),
  job(16, 1, null, 20) // missing start must not be invented
])] };
const pending = summarizeCollection(waiting, time(100));
assert.equal(pending.maximumObservedEligibleJobOverlap, 1);
assert.equal(pending.observedEligibleJobSeconds, 90);
assert.equal(pending.pendingObservation, true);
assert.deepEqual(pending.runs[0].jobStates, { success: 1, failed: 1, cancelled: 1, skipped: 1, neutral: 1, pending: 2, unknown: 0 });
assert.equal(pending.runs[0].workflowState, 'pending');
assert.equal(pending.runs[0].omittedIntervals, 6);
const none = summarizeCollection({ snapshots: [snap(run(1), [])] }, time(100));
assert.equal(none.maximumObservedEligibleJobOverlap, 0); assert.equal(none.peakWitness, null);
for (const mutate of [
  p => p.snapshots.push(structuredClone(p.snapshots[0])),
  p => p.snapshots[1].jobs.jobs[0].id = 10,
  p => p.snapshots[1].run.repository.full_name = 'other/repository',
  p => p.snapshots[0].run.run_attempt = 2,
  p => delete p.snapshots[0].jobs.jobs[0].run_attempt,
  p => p.snapshots[0].jobs.total_count++,
  p => p.snapshots[0].jobs.jobs[0].run_id = 99,
  p => p.snapshots[0].jobs.jobs[0].started_at = time(200),
  p => p.snapshots[0].jobs.jobs[0].completed_at = time(9),
  p => p.snapshots = []
]) { const copy = structuredClone(input); mutate(copy); assert.throws(() => summarizeCollection(copy, time(100))); }
console.log('CI cross-run overlap: PASS (conservative intervals, attempts, missing/queued/cancelled, ties, coverage)');
