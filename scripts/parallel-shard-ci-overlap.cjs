'use strict';
// Offline analysis of an explicitly supplied subset, never a capacity or release gate.
const assert = require('node:assert/strict');
const { summarize } = require('./parallel-shard-ci-timing.cjs');
function summarizeCollection(input, asOf = input.asOf ?? new Date().toISOString()) {
  assert.ok(Array.isArray(input.snapshots) && input.snapshots.length > 0, 'provide run/jobs snapshots');
  const runs = new Set(), jobs = new Set(), intervals = [], summaries = [];
  let repository;
  for (const snapshot of input.snapshots) {
    const { run, jobs: response } = snapshot;
    assert.ok(typeof run.repository?.full_name === 'string' && run.repository.full_name.length > 0);
    repository ??= run.repository.full_name;
    assert.equal(run.repository.full_name, repository, 'one repository per collection');
    assert.ok(!runs.has(run.id), 'one snapshot/attempt per unique run'); runs.add(run.id);
    assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0);
    for (const job of response.jobs) {
      assert.equal(job.run_attempt, run.run_attempt, 'jobs must match the recorded run attempt');
      assert.ok(!jobs.has(job.id), 'job IDs must be unique across runs'); jobs.add(job.id);
    }
    const summary = summarize(run, response, asOf);
    let eligible = 0, omitted = 0;
    for (const row of summary.rows) {
      // Cancellation can expose placeholder start timestamps. A conservative
      // overlap excludes all terminal non-success jobs, even with valid times.
      const eligibleState = row.state === 'success' || row.status === 'in_progress';
      const end = row.status === 'in_progress' ? Date.parse(asOf) : row.completed;
      if (eligibleState && row.started !== null && end !== null && end > row.started) {
        intervals.push({ id: row.id, runId: run.id, start: row.started, end }); eligible++;
      } else omitted++;
    }
    summaries.push({ runId: run.id, headSha: run.head_sha, attempt: run.run_attempt,
      event: run.event, workflowState: summary.workflowState, workflowStatus: run.status,
      workflowConclusion: run.conclusion ?? null, jobStates: summary.jobStates,
      eligibleIntervals: eligible, omittedIntervals: omitted,
      successfulShardElapsed: summary.successfulShardElapsed,
      successfulShardCreationToStart: summary.successfulShardCreationToStart,
      runCreationToFirstObservedJobCreationSeconds: summary.runCreationToFirstObservedJobCreationSeconds,
      runCreationToAggregateCompletionSeconds: summary.runCreationToAggregateCompletionSeconds });
  }
  const events = intervals.flatMap(i => [[i.start, 1, i], [i.end, -1, i]]);
  // Half-open intervals: finish before start at a tie, never invent overlap.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].id - b[2].id);
  const active = new Map(); let maximum = 0, maximumRuns = 0, witness = null;
  for (let at = 0; at < events.length;) {
    const time = events[at][0];
    while (at < events.length && events[at][0] === time) {
      const [, direction, item] = events[at++];
      if (direction < 0) active.delete(item.id); else active.set(item.id, item.runId);
    }
    maximumRuns = Math.max(maximumRuns, new Set(active.values()).size);
    if (active.size > maximum) {
      maximum = active.size;
      witness = { at: new Date(time).toISOString(), jobIds: [...active.keys()].sort((a,b) => a-b),
        runIds: [...new Set(active.values())].sort((a,b) => a-b) };
    }
  }
  return { repository, asOf, observedRuns: runs.size, observedJobs: jobs.size,
    completeRepositoryCoverage: false, capacityQuota: null,
    eligibleIntervals: intervals.length, maximumObservedEligibleJobOverlap: maximum,
    maximumObservedEligibleRunOverlap: maximumRuns, peakWitness: witness,
    observedEligibleJobSeconds: intervals.reduce((sum, i) => sum + (i.end - i.start) / 1000, 0),
    pendingObservation: summaries.some(s => s.workflowState === 'pending'), runs: summaries };
}
module.exports = { summarizeCollection };
if (require.main === module) {
  try {
    assert.ok([3, 4].includes(process.argv.length), 'usage: overlap.cjs COLLECTION.json [AS_OF_ISO]');
    const input = JSON.parse(require('node:fs').readFileSync(process.argv[2]));
    console.log(JSON.stringify(summarizeCollection(input, process.argv[3]), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
