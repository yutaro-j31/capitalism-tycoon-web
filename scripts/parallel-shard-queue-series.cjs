'use strict';
// Offline, non-authoritative comparison of complete per-run timing summaries.
const assert = require('node:assert/strict'), fs = require('node:fs');
const letters = [...'ABCDEFGHIJKL'], focus = ['H', 'I', 'K'];
const valid = n => { assert.ok(n === null || (typeof n === 'number' && Number.isFinite(n) && n >= 0)); return n; };
const stat = values => {
  const a = values.filter(n => n !== null).sort((x, y) => x - y), i = Math.floor(a.length / 2);
  return { samples: a.length, min: a[0] ?? null,
    median: a.length ? (a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2) : null,
    max: a.at(-1) ?? null };
};
function compareSeries(collection) {
  assert.ok(Array.isArray(collection?.summaries) && collection.summaries.length >= 2);
  const seen = new Set();
  const runs = collection.summaries.map(s => {
    assert.ok(Number.isSafeInteger(s.runId) && s.runId > 0 && !seen.has(s.runId)); seen.add(s.runId);
    assert.match(s.headSha, /^[a-f0-9]{40}$/);
    assert.equal(s.workflowState, 'success'); assert.equal(s.canonicalCoverageComplete, true);
    assert.equal(s.pendingObservation, false);
    // A successful workflow label must not mask incomplete child jobs or an
    // unsuccessful/missing aggregate. Fail closed on inconsistent summaries.
    assert.equal(s.completedRunHasPendingJobs, false);
    assert.equal(s.aggregateState, 'success');
    assert.ok(Array.isArray(s.rows));
    const rows = s.rows.filter(r => /^test-shard-[A-L]$/.test(r?.name || ''));
    assert.equal(rows.length, 12); assert.equal(new Set(rows.map(r => r.name)).size, 12);
    assert.deepEqual(rows.map(r => r.name).sort(), letters.map(x => `test-shard-${x}`));
    assert.ok(rows.every(r => r.state === 'success'));
    const by = Object.fromEntries(rows.map(r => [r.name.slice(-1), r]));
    const metric = (r, key) => valid(r[key] ?? null);
    const creation = letters.map(x => metric(by[x], 'runCreationToJobCreationSeconds'));
    const queue = letters.map(x => metric(by[x], 'jobCreationToStartSeconds'));
    const execution = letters.map(x => metric(by[x], 'elapsedSeconds'));
    // A partial A-L sample cannot establish the last creation or full-shard median.
    const complete = values => values.every(n => n !== null);
    return { runId: s.runId, headSha: s.headSha,
      firstJobCreationSeconds: valid(s.runCreationToFirstObservedJobCreationSeconds ?? null),
      lastShardCreationSeconds: complete(creation) ? stat(creation).max : null,
      runnerQueueMedianSeconds: complete(queue) ? stat(queue).median : null,
      shardExecutionMedianSeconds: complete(execution) ? stat(execution).median : null,
      aggregateCompletionSeconds: valid(s.runCreationToAggregateCompletionSeconds ?? null),
      focusHIK: Object.fromEntries(focus.map(x => [x, {
        runnerQueueSeconds: metric(by[x], 'jobCreationToStartSeconds'),
        executionSeconds: metric(by[x], 'elapsedSeconds') }])) };
  }).sort((a, b) => a.runId - b.runId);
  const keys = ['firstJobCreationSeconds', 'lastShardCreationSeconds', 'runnerQueueMedianSeconds',
    'shardExecutionMedianSeconds', 'aggregateCompletionSeconds'];
  return { observedRuns: runs.length, completeRepositoryCoverage: false,
    hostComparabilityEstablished: false, runnerQuota: null, counterfactualSpeedup: null,
    metrics: Object.fromEntries(keys.map(k => [k, stat(runs.map(r => r[k]))])),
    focusHIK: Object.fromEntries(focus.map(x => [x, {
      runnerQueueSeconds: stat(runs.map(r => r.focusHIK[x].runnerQueueSeconds)),
      executionSeconds: stat(runs.map(r => r.focusHIK[x].executionSeconds)) }])), runs };
}
module.exports = { compareSeries };
if (require.main === module) {
  try { assert.equal(process.argv.length, 3);
    console.log(JSON.stringify(compareSeries(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (e) { console.error(e.stack); process.exitCode = 1; }
}
