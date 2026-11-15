'use strict';
const assert = require('node:assert/strict');
const { analyze } = require('./parallel-shard-cancelled-test.cjs');
const time = n => new Date(Date.UTC(2026, 10, 9) + n * 1000).toISOString();
const step = (name, start, end, conclusion) => ({
  name, started_at: time(start), completed_at: time(end), status: 'completed', conclusion
});
const job = (id, name, runner_id, steps, conclusion = 'cancelled') => ({
  id, name, runner_id, steps, run_id: 1, run_attempt: 1, status: 'completed', conclusion,
  created_at: time(1), started_at: time(2), completed_at: time(20)
});
const jobs = [
  job(1, 'test-shard-${{ matrix.shard }}', 0, []),
  job(2, 'test-shard-A', 2, [step('Run canonical test shard A', 5, 15, 'cancelled')]),
  job(3, 'test-shard-B', 3, [step('Run canonical test shard B', 5, 5, 'cancelled')]),
  job(4, 'test-shard-C', 4, [step('Run canonical test shard C', 5, 21, 'success')]),
  job(5, 'test', 5, [step('Enforce all canonical shards', 6, 6, 'failure')], 'failure')
];
const input = { asOf: time(30), snapshots: [{
  run: { id: 1, name: 'Test', head_sha: 'a'.repeat(40), run_attempt: 1, event: 'pull_request',
    head_branch: 'test', status: 'completed', conclusion: 'cancelled', created_at: time(0) },
  jobs: { total_count: jobs.length, jobs }
}] };
const original = structuredClone(input);
const [out] = analyze(input);
assert.deepEqual(input, original);
assert.equal(out.jobsWithExecutionEvidence, 2);
assert.equal(out.observedJobWallSeconds, 36);
assert.equal(out.canonicalStepsWithExecutionEvidence, 1);
assert.equal(out.observedCanonicalStepSeconds, 10);
assert.equal(out.aggregate.state, 'failed');
assert.equal(out.state, 'cancelled');
assert.equal(out.headSha, input.snapshots[0].run.head_sha);
assert.equal(out.asOf, input.asOf);
const modify = change => {
  const copy = structuredClone(input);
  change(copy.snapshots[0]);
  return analyze(copy)[0];
};
assert.equal(modify(x => { x.jobs = { total_count: 0, jobs: [] }; }).observedJobWallSeconds, null);
assert.equal(modify(x => { delete x.jobs.jobs[1].runner_id; }).observedCanonicalStepSeconds, null);
assert.equal(modify(x => { delete x.jobs.jobs[1].steps; }).observedCanonicalStepSeconds, null);
assert.equal(modify(x => { x.jobs.jobs[1].steps.push(x.jobs.jobs[1].steps[0]); }).observedCanonicalStepSeconds, null);
assert.throws(() => modify(x => x.jobs.jobs.pop()), /all jobs pages/);
assert.throws(() => modify(x => { x.jobs.jobs[0].run_attempt++; }), /run attempt/);
assert.throws(() => modify(x => { x.run.conclusion = 'success'; }), /completed cancelled/);
assert.throws(() => analyze({ ...input, asOf: undefined }), /observation time/);
assert.throws(() => analyze({ ...input, snapshots: [...input.snapshots, ...input.snapshots] }), /duplicate run/);
console.log('Cancelled Test evidence: PASS');
