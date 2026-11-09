'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { summarize } = require('./parallel-shard-ci-timing.cjs');

function timestamp(value) { return typeof value === 'string' ? Date.parse(value) : NaN; }
function observedSteps(job, row) {
  if (!Number.isSafeInteger(job.runner_id) || job.runner_id <= 0 || row.started === null || row.completed === null)
    return [];
  return (job.steps ?? []).filter(step => {
    const start = timestamp(step.started_at), end = timestamp(step.completed_at);
    return step.status === 'completed' &&
      (['success', 'failure'].includes(step.conclusion) ||
        (step.conclusion === 'cancelled' && end > start)) &&
      start >= row.started && end >= start && end <= row.completed;
  });
}
function analyze(data) {
  assert.ok(typeof data.asOf === 'string' && Number.isFinite(Date.parse(data.asOf)), 'retained observation time required');
  assert.ok(Array.isArray(data.snapshots) && data.snapshots.length > 0, 'provide run/jobs snapshots');
  const seen = new Set();
  return data.snapshots.map(({ run, jobs }) => {
    assert.equal(run.name, 'Test', 'only the Test workflow is in scope');
    assert.ok(!seen.has(run.id), 'duplicate run ID');
    seen.add(run.id);
    const summary = summarize(run, jobs, data.asOf);
    assert.equal(summary.workflowState, 'cancelled', 'only completed cancelled runs are in scope');
    const rows = new Map(summary.rows.map(r => [r.id, r]));
    const evidence = jobs.jobs.flatMap(job => {
      const row = rows.get(job.id), steps = observedSteps(job, row);
      if (steps.length === 0) return [];
      const canonicalSteps = /^test-shard-[A-L]$/.test(job.name)
        ? steps.filter(step => step.name === 'Run canonical test shard ' + job.name.at(-1)) : [];
      const canonical = canonicalSteps.length === 1 ? canonicalSteps[0] : undefined;
      return [{ jobId: job.id, name: job.name, state: row.state,
        jobWallSeconds: (row.completed - row.started) / 1000,
        canonicalStepSeconds: canonical === undefined ? null
          : (timestamp(canonical.completed_at) - timestamp(canonical.started_at)) / 1000 }];
    });
    const canonical = evidence.filter(j => j.canonicalStepSeconds !== null);
    const aggregates = evidence.filter(job => job.name === 'test');
    return { runId: run.id, headSha: run.head_sha, attempt: run.run_attempt, asOf: data.asOf,
      event: run.event, ref: run.head_branch,
      state: summary.workflowState, returnedJobs: jobs.total_count, jobsWithExecutionEvidence: evidence.length,
      canonicalStepsWithExecutionEvidence: canonical.length,
      observedCanonicalStepSeconds: canonical.length === 0 ? null : canonical.reduce((sum,j) => sum + j.canonicalStepSeconds, 0),
      observedJobWallSeconds: evidence.length === 0 ? null : evidence.reduce((sum,j) => sum + j.jobWallSeconds, 0),
      aggregate: aggregates.length === 1 ? aggregates[0] : null,
      canonicalSteps: canonical };
  });
}
module.exports = { analyze };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 3, 'usage: node parallel-shard-cancelled-test.cjs SNAPSHOTS.json');
    const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify(analyze(data), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
