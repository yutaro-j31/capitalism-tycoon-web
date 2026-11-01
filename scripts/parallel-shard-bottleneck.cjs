'use strict';
// Offline interpretation of a validated parallel-shard-ci-timing.cjs JSON summary.
// Observations are not causal critical paths, runner quotas, or release gates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const SHARDS = [...'ABCDEFGHIJKL'];
const canonical = name => /^test-shard-[A-L]$/.test(name);
const numberOrNull = (value, label) => {
  assert.ok(value === null || (Number.isFinite(value) && value >= 0), `${label}: nonnegative number or null required`);
  return value;
};
function observe(summary) {
  assert.ok(summary && typeof summary === 'object' && !Array.isArray(summary), 'timing summary object required');
  assert.ok(Number.isSafeInteger(summary.runId) && summary.runId > 0, 'run ID required');
  assert.match(summary.headSha, /^[a-f0-9]{40}$/, 'full commit SHA required');
  assert.ok(typeof summary.workflowState === 'string', 'workflow state required');
  assert.equal(typeof summary.canonicalCoverageComplete, 'boolean');
  assert.equal(typeof summary.pendingObservation, 'boolean');
  assert.ok(Array.isArray(summary.rows), 'timing rows required');
  const found = new Map();
  for (const row of summary.rows) {
    assert.ok(row && typeof row.name === 'string');
    if (!canonical(row.name)) continue;
    assert.ok(!found.has(row.name), `duplicate canonical shard: ${row.name}`);
    found.set(row.name, row);
  }
  const shards = SHARDS.map(shard => {
    const name = `test-shard-${shard}`, row = found.get(name);
    if (!row) return { shard, state: 'missing', runCreationToJobCreationSeconds: null,
      jobCreationToStartSeconds: null, elapsedSeconds: null, runCreationToStartSeconds: null,
      completedAt: null, pendingAgeSeconds: null };
    const metrics = {};
    for (const key of ['runCreationToJobCreationSeconds', 'jobCreationToStartSeconds',
      'elapsedSeconds', 'runCreationToStartSeconds', 'pendingAgeSeconds']) {
      metrics[key] = numberOrNull(row[key], `${name}.${key}`);
    }
    const completed = numberOrNull(row.completed, `${name}.completed`);
    assert.ok(typeof row.state === 'string');
    return { shard, state: row.state, ...metrics,
      completedAt: completed === null ? null : new Date(completed).toISOString() };
  });
  // Keep workflow admission and canonical shard creation distinct from runner queueing.
  const firstObservedJobCreation = numberOrNull(
    summary.runCreationToFirstObservedJobCreationSeconds ?? null,
    'runCreationToFirstObservedJobCreationSeconds');
  const aggregateCompletion = numberOrNull(
    summary.runCreationToAggregateCompletionSeconds ?? null,
    'runCreationToAggregateCompletionSeconds');
  const canonicalCreation = shards.map(s => s.runCreationToJobCreationSeconds)
    .filter(seconds => seconds !== null);
  const canonicalShardCreationDelaySeconds = { samples: canonicalCreation.length,
    min: canonicalCreation.length ? Math.min(...canonicalCreation) : null,
    max: canonicalCreation.length ? Math.max(...canonicalCreation) : null };
  const successes = shards.filter(s => s.state === 'success');
  const rank = key => successes.filter(s => s[key] !== null)
    .sort((a, b) => b[key] - a[key] || a.shard.localeCompare(b.shard))
    .slice(0, 3).map(s => ({ shard: s.shard, seconds: s[key] }));
  const completeSuccessfulSnapshot = summary.workflowState === 'success' &&
    summary.canonicalCoverageComplete && !summary.pendingObservation &&
    summary.aggregateState === 'success' && summary.completedRunHasPendingJobs === false &&
    successes.length === 12 && successes.every(s => s.completedAt !== null);
  const latest = completeSuccessfulSnapshot ? Math.max(...successes.map(s => Date.parse(s.completedAt))) : null;
  // Arithmetic bound for ONE shard only. Other starts/finishes stay fixed;
  // this never predicts queue redistribution, runner capacity or workflow speedup.
  const fixedTimingCompletionModel = latest === null ? null : {
    scope: 'canonical-shard-end-only', measuredSpeedup: false,
    assumptions: 'one runtime may shrink to zero; every other shard start/finish stays fixed; no queue or aggregate rescheduling',
    lastCanonicalEndAt: new Date(latest).toISOString(),
    shards: successes.map(s => {
      const end = Date.parse(s.completedAt);
      const otherEnd = Math.max(...successes.filter(other => other.shard !== s.shard)
        .map(other => Date.parse(other.completedAt)));
      const finishMargin = Math.max(0, (end - otherEnd) / 1000);
      return { shard: s.shard, completionSlackSeconds: (latest - end) / 1000,
        maximumEndReductionSeconds: finishMargin === 0 ? 0 : s.elapsedSeconds === null
          ? null : Math.min(s.elapsedSeconds, finishMargin) };
    })
  };
  return { runId: summary.runId, headSha: summary.headSha, workflowState: summary.workflowState,
    pendingObservation: summary.pendingObservation, canonicalSuccessObserved: successes.length,
    completeSuccessfulSnapshot, productionParallelismAuthorized: false, runnerQuota: null,
    runCreationToFirstObservedJobCreationSeconds: firstObservedJobCreation,
    canonicalShardCreationDelaySeconds,
    runCreationToAggregateCompletionSeconds: aggregateCompletion,
    topObservedExecution: rank('elapsedSeconds'),
    topObservedJobCreationToStart: rank('jobCreationToStartSeconds'),
    lastObservedSuccessfulShards: latest === null ? null : successes
      .filter(s => Date.parse(s.completedAt) === latest).map(s => s.shard).sort(),
    fixedTimingCompletionModel,
    focusHIK: shards.filter(s => ['H', 'I', 'K'].includes(s.shard)),
    allShards: shards };
}
module.exports = { observe };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 3, 'usage: bottleneck.cjs TIMING_SUMMARY.json');
    console.log(JSON.stringify(observe(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
