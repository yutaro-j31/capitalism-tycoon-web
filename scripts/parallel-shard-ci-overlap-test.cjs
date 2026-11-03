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
const originalInput = structuredClone(input);
const result = summarizeCollection(input, time(100));
assert.deepEqual(input, originalInput, 'collection remains read-only');
assert.equal(result.maximumObservedEligibleJobOverlap, 3);
assert.equal(result.maximumObservedEligibleRunOverlap, 2);
assert.deepEqual(result.peakWitness, { at: time(20), jobIds: [10, 11, 20], runIds: [1, 2] });
assert.equal(result.observedEligibleJobSeconds, 70);
assert.deepEqual(result.preStart, { startedJobs: 4, observedDelaySeconds: 76, unstartedJobs: 0, censoredAgeSeconds: 0, omittedJobs: 0 });
assert.deepEqual(result.runs[0].preStart, { startedJobs: 2, observedDelaySeconds: 28, unstartedJobs: 0, censoredAgeSeconds: 0, omittedJobs: 0 });
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
assert.deepEqual(pending.preStart, { startedJobs: 1, observedDelaySeconds: 9, unstartedJobs: 1, censoredAgeSeconds: 99, omittedJobs: 5 });
const later = summarizeCollection(waiting, time(110));
assert.equal(later.preStart.censoredAgeSeconds, 109);
assert.equal(later.preStart.observedDelaySeconds, 9);
const missingStart = structuredClone(waiting); missingStart.snapshots[0].jobs.jobs[0].started_at = null;
assert.equal(summarizeCollection(missingStart, time(100)).preStart.unstartedJobs, 1, 'running with missing timestamp is not invented pre-start time');
assert.equal(summarizeCollection(missingStart, time(100)).preStart.omittedJobs, 6);
assert.equal(pending.pendingObservation, true);
assert.deepEqual(pending.runs[0].jobStates, { success: 1, failed: 1, cancelled: 1, skipped: 1, neutral: 1, pending: 2, unknown: 0 });
assert.equal(pending.runs[0].workflowState, 'pending');
assert.equal(pending.runs[0].omittedIntervals, 6);
const inconsistent = structuredClone(waiting);
inconsistent.snapshots[0].run = run(1);
const inconsistentResult = summarizeCollection(inconsistent, time(100));
assert.equal(inconsistentResult.pendingObservation, true, 'completed workflow does not hide pending jobs');
assert.equal(inconsistentResult.runs[0].completedRunHasPendingJobs, true);
const zeroDelay = summarizeCollection({ snapshots: [snap(run(1), [job(10, 1, 1, 2)])] }, time(100));
assert.equal(zeroDelay.preStart.startedJobs, 1); assert.equal(zeroDelay.preStart.observedDelaySeconds, 0);
for (const status of ['queued', 'waiting', 'pending', 'requested']) {
  const response = { snapshots: [snap(run(1, 'in_progress', null), [job(10, 1, 1, null, status, null)])] };
  assert.deepEqual(summarizeCollection(response, time(100)).preStart,
    { startedJobs: 0, observedDelaySeconds: 0, unstartedJobs: 1, censoredAgeSeconds: 99, omittedJobs: 0 });
  response.snapshots[0].jobs.jobs[0].created_at = null;
  assert.equal(summarizeCollection(response, time(100)).preStart.omittedJobs, 1);
}
const zeroAgeJob = job(10, 1, 1, null, 'queued', null); zeroAgeJob.created_at = time(100);
assert.deepEqual(summarizeCollection({ snapshots: [snap(run(1, 'in_progress', null), [zeroAgeJob])] }, time(100)).preStart,
  { startedJobs: 0, observedDelaySeconds: 0, unstartedJobs: 1, censoredAgeSeconds: 0, omittedJobs: 0 });
const unknownStatus = job(10, 1, 1, null, 'future_status', null);
assert.equal(summarizeCollection({ snapshots: [snap(run(1, 'in_progress', null), [unknownStatus])] }, time(100)).preStart.omittedJobs, 1);
const retained = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,
  '../docs/ci-evidence/ci-prestart-snapshots-41303594585-41315187678.json'), 'utf8'));
const replay = summarizeCollection(retained);
assert.equal(replay.observedRuns, 2);
assert.equal(replay.preStart.startedJobs + replay.preStart.unstartedJobs + replay.preStart.omittedJobs, replay.observedJobs);
assert.equal(replay.capacityQuota, null);
assert.equal(replay.observedActivity.activeSeconds, 2987.341);
assert.equal(replay.observedActivity.uncoveredSeconds, 8249);
assert.equal(replay.observedActivity.crossRunSeconds, 0);
const none = summarizeCollection({ snapshots: [snap(run(1), [])] }, time(100));
assert.deepEqual(none.preStart, { startedJobs: 0, observedDelaySeconds: 0, unstartedJobs: 0, censoredAgeSeconds: 0, omittedJobs: 0 });
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
// Duration distributions use the same eligible intervals as the existing peaks.
const activity = (snapshots, asOf = time(100)) => summarizeCollection({ snapshots }, asOf).observedActivity;
assert.deepEqual(result.observedActivity, {
  firstObservedStart: time(10), lastObservedEnd: time(50), spanSeconds: 40,
  activeSeconds: 40, uncoveredSeconds: 0, crossRunSeconds: 20,
  byJobCount: [{ jobs: 1, seconds: 20 }, { jobs: 2, seconds: 10 }, { jobs: 3, seconds: 10 }],
  byRunCount: [{ runs: 1, seconds: 20 }, { runs: 2, seconds: 20 }]
});
assert.deepEqual(summarizeCollection(reversed, time(100)).observedActivity, result.observedActivity);
assert.deepEqual(activity(tied.snapshots), {
  firstObservedStart: time(10), lastObservedEnd: time(30), spanSeconds: 20,
  activeSeconds: 20, uncoveredSeconds: 0, crossRunSeconds: 0,
  byJobCount: [{ jobs: 1, seconds: 20 }], byRunCount: [{ runs: 1, seconds: 20 }]
});
const gap = [snap(run(1), [job(10, 1, 10, 20)]), snap(run(2), [job(20, 2, 30, 40)])];
assert.deepEqual(activity(gap), {
  firstObservedStart: time(10), lastObservedEnd: time(40), spanSeconds: 30,
  activeSeconds: 20, uncoveredSeconds: 10, crossRunSeconds: 0,
  byJobCount: [{ jobs: 0, seconds: 10 }, { jobs: 1, seconds: 20 }],
  byRunCount: [{ runs: 0, seconds: 10 }, { runs: 1, seconds: 20 }]
});
const sameRun = [snap(run(1), [job(10, 1, 10, 30), job(11, 1, 10, 30)])];
assert.equal(activity(sameRun).crossRunSeconds, 0);
assert.deepEqual(activity(sameRun).byJobCount, [{ jobs: 2, seconds: 20 }]);
assert.deepEqual(activity(sameRun).byRunCount, [{ runs: 1, seconds: 20 }]);
assert.deepEqual(pending.observedActivity, {
  firstObservedStart: time(10), lastObservedEnd: time(100), spanSeconds: 90,
  activeSeconds: 90, uncoveredSeconds: 0, crossRunSeconds: 0,
  byJobCount: [{ jobs: 1, seconds: 90 }], byRunCount: [{ runs: 1, seconds: 90 }]
});
assert.equal(later.observedActivity.activeSeconds, 100, 'running interval is censored at the supplied observation');
const emptyActivity = { firstObservedStart: null, lastObservedEnd: null, spanSeconds: null,
  activeSeconds: 0, uncoveredSeconds: null, crossRunSeconds: 0, byJobCount: [], byRunCount: [] };
for (const list of [[], [job(10, 1, 10, 10)], [job(10, 1, 1, null, 'queued', null)],
  [job(10, 1, 10, 20, 'completed', 'cancelled'), job(11, 1, null, 20)]]) {
  assert.deepEqual(activity([snap(run(1), list)]), emptyActivity, 'no eligible interval does not invent idle time');
}
const fractional = summarizeCollection({ snapshots: [snap(run(1), [job(10, 1, 10, 10.5)]),
  snap(run(2), [job(20, 2, 10.25, 10.75)])] }, time(100));
assert.equal(fractional.observedActivity.crossRunSeconds, 0.25);
assert.equal(fractional.observedActivity.spanSeconds, 0.75);
for (const summary of [result, pending, later, none, replay, fractional,
  summarizeCollection({ snapshots: gap }, time(100)), summarizeCollection({ snapshots: sameRun }, time(100))]) {
  const a = summary.observedActivity;
  const sum = (bins, weight) => bins.reduce((total, bin) => total + bin.seconds * weight(bin), 0);
  assert.ok(Math.abs(sum(a.byJobCount, b => b.jobs) - summary.observedEligibleJobSeconds) < 1e-8,
    'weighted duration conserves job-seconds within floating-point summation precision');
  assert.equal(sum(a.byJobCount, () => 1), a.spanSeconds ?? 0);
  assert.equal(sum(a.byRunCount, () => 1), a.spanSeconds ?? 0);
  assert.equal(sum(a.byJobCount, b => b.jobs > 0 ? 1 : 0), a.activeSeconds);
  assert.equal(summary.capacityQuota, null); assert.equal(summary.completeRepositoryCoverage, false);
}
console.log('CI cross-run overlap: PASS (conservative intervals, attempts, missing/queued/cancelled, ties, coverage)');
require('./parallel-shard-bottleneck-test.cjs');
