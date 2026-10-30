'use strict';
// Read-only timing analysis of one GitHub run/complete jobs response. Not a release gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const timestamp = value => {
  if (value === null || value === undefined) return null;
  const ms = Date.parse(value); assert.ok(Number.isFinite(ms), `invalid timestamp: ${value}`); return ms;
};
const difference = (end, start) => end === null || start === null ? null : (end - start) / 1000;
function state(item) {
  if (item.status !== 'completed') return 'pending';
  if (['success', 'cancelled', 'skipped', 'neutral'].includes(item.conclusion)) return item.conclusion;
  return ['failure', 'timed_out', 'action_required', 'startup_failure', 'stale'].includes(item.conclusion) ? 'failed' : 'unknown';
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
function summarize(run, response, asOf = new Date().toISOString()) {
  assert.ok(Number.isSafeInteger(run.id) && run.id > 0);
  assert.match(run.head_sha, /^[a-f0-9]{40}$/);
  assert.ok(Array.isArray(response.jobs));
  assert.equal(response.total_count, response.jobs.length, 'fetch all jobs pages before analysis');
  assert.equal(new Set(response.jobs.map(j => j.id)).size, response.jobs.length, 'unique job IDs required');
  const now = timestamp(asOf), origin = timestamp(run.created_at);
  assert.ok(now !== null && origin !== null && now >= origin);
  const rows = response.jobs.map(job => {
    assert.equal(job.run_id, run.id, 'job must belong to this run');
    assert.ok(Number.isSafeInteger(job.id) && job.id > 0);
    assert.ok(typeof job.name === 'string' && job.name.length > 0);
    const status = state(job), created = timestamp(job.created_at);
    // Queued/skipped jobs can expose placeholder starts; they do not establish execution.
    const hasStart = job.status === 'in_progress' || (job.status === 'completed' && status !== 'skipped');
    const started = hasStart ? timestamp(job.started_at) : null;
    const completed = job.status === 'completed' ? timestamp(job.completed_at) : null;
    for (const ms of [created, started, completed]) if (ms !== null) assert.ok(ms >= origin && ms <= now, 'timestamps must lie within observed run');
    if (created !== null && started !== null) assert.ok(started >= created, 'start precedes creation');
    if (started !== null && completed !== null) assert.ok(completed >= started, 'completion precedes start');
    return { id: job.id, name: job.name, state: status, status: job.status, conclusion: job.conclusion ?? null, apiStartedAt: job.started_at ?? null, created, started, completed,
      runCreationToJobCreationSeconds: difference(created, origin),
      jobCreationToStartSeconds: difference(started, created), elapsedSeconds: difference(completed, started),
      runCreationToStartSeconds: difference(started, origin),
      pendingAgeSeconds: status === 'pending' && started === null ? difference(now, created) : null };
  });
  // GitHub may defer creating any job while a workflow concurrency group is held.
  // These are observed API creation times, not proof of scheduler/runner causation.
  const creations = rows.map(r => r.created).filter(ms => ms !== null);
  const firstCreation = creations.length ? Math.min(...creations) : null;
  const canonical = rows.filter(r => /^test-shard-[A-L]$/.test(r.name));
  const complete = [...'ABCDEFGHIJKL'].every(s => canonical.filter(r => r.name === `test-shard-${s}` && r.state === 'success').length === 1 && canonical.filter(r => r.name === `test-shard-${s}`).length === 1);
  const success = canonical.filter(r => r.state === 'success');
  const metric = key => { const values = success.map(r => r[key]).filter(n => n !== null); return { samples: values.length, medianSeconds: median(values) }; };
  const aggregates = rows.filter(r => r.name === 'test');
  const aggregate = aggregates.length === 1 ? aggregates[0] : null;
  const allEndKnown = complete && canonical.every(r => r.completed !== null);
  const lastEnd = allEndKnown ? Math.max(...canonical.map(r => r.completed)) : null;
  const last = lastEnd === null ? [] : canonical.filter(r => r.completed === lastEnd).map(r => r.name);
  const events = [];
  for (const row of rows) if (row.state !== 'skipped' && row.started !== null) {
    const end = row.completed ?? (row.state === 'pending' ? now : null);
    if (end !== null && end > row.started) { events.push([row.started, 1]); events.push([end, -1]); }
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0, maximum = 0;
  for (const [, change] of events) { active += change; maximum = Math.max(maximum, active); }
  const interval = aggregate?.state === 'success' ? difference(aggregate.completed, lastEnd) : null;
  if (interval !== null) assert.ok(interval >= 0, 'aggregate completed before a required shard');
  return { runId: run.id, headSha: run.head_sha, event: run.event, asOf, workflowState: state(run), workflowStatus: run.status, workflowConclusion: run.conclusion ?? null,
    jobStates: Object.fromEntries(['success', 'failed', 'cancelled', 'skipped', 'neutral', 'pending', 'unknown'].map(s => [s, rows.filter(r => r.state === s).length])),
    observedJobCreationCount: creations.length, returnedJobCreationCoverageComplete: rows.length > 0 && creations.length === rows.length,
    firstObservedJobCreatedAt: firstCreation === null ? null : new Date(firstCreation).toISOString(),
    runCreationToFirstObservedJobCreationSeconds: difference(firstCreation, origin),
    canonicalSuccessCount: success.length, canonicalCoverageComplete: complete,
    successfulShardCreationToStart: metric('jobCreationToStartSeconds'), successfulShardElapsed: metric('elapsedSeconds'),
    successfulShardRunCreationToStart: metric('runCreationToStartSeconds'),
    lastCanonicalSuccessJobs: last, lastCanonicalSuccessEnd: lastEnd === null ? null : new Date(lastEnd).toISOString(),
    aggregateState: aggregate?.state ?? 'missing-or-ambiguous', aggregateCreationToStartSeconds: aggregate?.jobCreationToStartSeconds ?? null,
    runCreationToAggregateCompletionSeconds: aggregate?.state === 'success' ? difference(aggregate.completed, origin) : null,
    postShardAggregateIntervalSeconds: interval, maximumObservedJobOverlap: maximum,
    pendingObservation: rows.some(r => r.state === 'pending'), completedRunHasPendingJobs: run.status === 'completed' && rows.some(r => r.state === 'pending'), rows };
}
module.exports = { summarize };
if (require.main === module) {
  try {
    assert.ok(process.argv.length === 4 || process.argv.length === 5, 'usage: timing.cjs RUN.json JOBS.json [AS_OF_ISO]');
    const [run, jobs] = process.argv.slice(2, 4).map(p => JSON.parse(fs.readFileSync(p)));
    console.log(JSON.stringify(summarize(run, jobs, process.argv[4]), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
