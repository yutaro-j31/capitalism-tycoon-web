'use strict';
// Offline analysis of an explicitly supplied subset, never a capacity or release gate.
const assert = require('node:assert/strict');
const { summarize } = require('./parallel-shard-ci-timing.cjs');
const emptyPreStart = () => ({ startedJobs: 0, observedDelaySeconds: 0, unstartedJobs: 0, censoredAgeSeconds: 0, omittedJobs: 0 });
const unstartedStates = new Set(['queued', 'waiting', 'pending', 'requested']);
const waitKinds = ['completedWait', 'censoredAge'];
const emptyOverlap = () => Object.fromEntries(waitKinds.map(kind => [kind, {
  waitMilliseconds: 0, coveredMilliseconds: 0
}]));
const waitReport = totals => Object.fromEntries(Object.entries(totals).map(([kind, {
  waitMilliseconds, coveredMilliseconds
}]) => [kind, {
  waitJobSeconds: waitMilliseconds / 1000,
  withOtherRunExecutionJobSeconds: coveredMilliseconds / 1000,
  withoutObservedOtherRunExecutionJobSeconds: (waitMilliseconds - coveredMilliseconds) / 1000
}]));
function summarizeCollection(input, asOf = input.asOf ?? new Date().toISOString()) {
  assert.ok(Array.isArray(input.snapshots) && input.snapshots.length > 0, 'provide run/jobs snapshots');
  const runs = new Set(), jobs = new Set(), intervals = [], summaries = [];
  const waitsByRun = new Map(), observedAt = Date.parse(asOf);
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
    const preStart = emptyPreStart();
    const waits = [];
    waitsByRun.set(run.id, waits);
    for (const row of summary.rows) {
      // Cancellation can expose placeholder start timestamps. A conservative
      // overlap excludes all terminal non-success jobs, even with valid times.
      const eligibleState = row.state === 'success' || row.status === 'in_progress';
      if (eligibleState && row.created !== null && row.started !== null) {
        preStart.startedJobs++; preStart.observedDelaySeconds += row.jobCreationToStartSeconds;
        waits.push({ kind: 'completedWait', start: row.created, end: row.started });
      } else if (unstartedStates.has(row.status) && row.pendingAgeSeconds !== null) {
        // Queue/approval/dependency waiting are not proof of runner scarcity.
        preStart.unstartedJobs++; preStart.censoredAgeSeconds += row.pendingAgeSeconds;
        waits.push({ kind: 'censoredAge', start: row.created, end: observedAt });
      } else preStart.omittedJobs++;

      const end = row.status === 'in_progress' ? observedAt : row.completed;
      if (eligibleState && row.started !== null && end !== null && end > row.started) {
        intervals.push({ id: row.id, runId: run.id, start: row.started, end }); eligible++;
      } else omitted++;
    }
    summaries.push({ runId: run.id, headSha: run.head_sha, attempt: run.run_attempt,
      event: run.event, workflowState: summary.workflowState, workflowStatus: run.status,
      workflowConclusion: run.conclusion ?? null, jobStates: summary.jobStates,
      pendingObservation: summary.pendingObservation,
      completedRunHasPendingJobs: summary.completedRunHasPendingJobs,
      eligibleIntervals: eligible, omittedIntervals: omitted, preStart,
      successfulShardElapsed: summary.successfulShardElapsed,
      successfulShardCreationToStart: summary.successfulShardCreationToStart,
      runCreationToFirstObservedJobCreationSeconds: summary.runCreationToFirstObservedJobCreationSeconds,
      runCreationToAggregateCompletionSeconds: summary.runCreationToAggregateCompletionSeconds });
  }
  const events = intervals.flatMap(i => [[i.start, 1, i], [i.end, -1, i]]);
  // Half-open intervals: finish before start at a tie, never invent overlap.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].id - b[2].id);
  const jobDurations = new Map(), runDurations = new Map(), activitySegments = [];
  let previous = null;
  const active = new Map(); let maximum = 0, maximumRuns = 0, witness = null;
  for (let at = 0; at < events.length;) {
    const time = events[at][0];
    // Integrate the preceding half-open segment before applying this time's
    // events. Zero-job segments describe only gaps inside the observed subset.
    if (previous !== null && time > previous) {
      const elapsed = time - previous, activeRuns = new Set(active.values()), runCount = activeRuns.size;
      jobDurations.set(active.size, (jobDurations.get(active.size) ?? 0) + elapsed);
      runDurations.set(runCount, (runDurations.get(runCount) ?? 0) + elapsed);
      if (runCount) activitySegments.push({
        start: previous, end: time, soleRunId: runCount === 1 ? activeRuns.values().next().value : null
      });
    }
    previous = time;
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
  const first = events[0]?.[0] ?? null, last = events.at(-1)?.[0] ?? null;
  const bins = (durations, key) => [...durations].sort((a, b) => a[0] - b[0])
    .map(([count, milliseconds]) => ({ [key]: count, seconds: milliseconds / 1000 }));
  const observedActivity = {
    firstObservedStart: first === null ? null : new Date(first).toISOString(),
    lastObservedEnd: last === null ? null : new Date(last).toISOString(),
    spanSeconds: first === null ? null : (last - first) / 1000,
    activeSeconds: [...jobDurations].reduce((sum, [count, ms]) => sum + (count > 0 ? ms : 0), 0) / 1000,
    uncoveredSeconds: first === null ? null : (jobDurations.get(0) ?? 0) / 1000,
    crossRunSeconds: [...runDurations].reduce((sum, [count, ms]) => sum + (count > 1 ? ms : 0), 0) / 1000,
    byJobCount: bins(jobDurations, 'jobs'), byRunCount: bins(runDurations, 'runs')
  };
  // Each sweep segment is counted at most once per waiting job, even when
  // several other runs execute together. Seconds sum across jobs, not wall time.
  const preStartOtherRunExecution = emptyOverlap();
  for (const run of summaries) {
    const runOverlap = emptyOverlap();
    for (const { kind, start, end } of waitsByRun.get(run.runId)) {
      let covered = 0;
      for (const segment of activitySegments) {
        if (segment.start >= end) break;
        if (segment.end > start && segment.soleRunId !== run.runId) {
          covered += Math.min(end, segment.end) - Math.max(start, segment.start);
        }
      }
      for (const metrics of [runOverlap[kind], preStartOtherRunExecution[kind]]) {
        metrics.waitMilliseconds += end - start;
        metrics.coveredMilliseconds += covered;
      }
    }
    run.preStartOtherRunExecution = waitReport(runOverlap);
  }
  return { repository, asOf, observedRuns: runs.size, observedJobs: jobs.size,
    completeRepositoryCoverage: false, capacityQuota: null,
    preStart: summaries.reduce((total, run) => {
      for (const key of Object.keys(total)) total[key] += run.preStart[key];
      return total;
    }, emptyPreStart()),
    eligibleIntervals: intervals.length, maximumObservedEligibleJobOverlap: maximum,
    maximumObservedEligibleRunOverlap: maximumRuns, peakWitness: witness,
    observedActivity, preStartOtherRunExecution: waitReport(preStartOtherRunExecution),
    observedEligibleJobSeconds: intervals.reduce((sum, i) => sum + (i.end - i.start) / 1000, 0),
    pendingObservation: summaries.some(s => s.workflowState === 'pending' || s.pendingObservation), runs: summaries };
}
module.exports = { summarizeCollection };
if (require.main === module) {
  try {
    assert.ok([3, 4].includes(process.argv.length), 'usage: overlap.cjs COLLECTION.json [AS_OF_ISO]');
    const input = JSON.parse(require('node:fs').readFileSync(process.argv[2]));
    console.log(JSON.stringify(summarizeCollection(input, process.argv[3]), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
