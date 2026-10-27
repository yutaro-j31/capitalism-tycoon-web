'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const m = require('../scripts/ci-metrics');

const MIN = 60000;
const iso = minutes => new Date(Date.UTC(2026, 9, 1) + minutes * MIN).toISOString();
const job = (name, created, started, completed, conclusion = 'success') => ({
  name, conclusion, created_at: created === null ? null : iso(created), started_at: started === null ? null : iso(started), completed_at: completed === null ? null : iso(completed)
});

// stats: linear-interpolated percentiles, empty input is unknown rather than zero.
assert.deepEqual(m.stats([]), { n: 0, mean: null, median: null, p90: null, min: null, max: null });
assert.deepEqual(m.stats([null, undefined, NaN]).n, 0);
const s = m.stats([10, 20, 30, 40, 50]);
assert.equal(s.median, 30); assert.equal(s.p90, 46); assert.equal(s.min, 10); assert.equal(s.max, 50); assert.equal(s.mean, 30);

// span: missing, unparsable or negative spans are unknown.
assert.equal(m.span(iso(0), iso(5)), 5 * MIN);
assert.equal(m.span(null, iso(5)), null);
assert.equal(m.span(iso(5), iso(0)), null);
assert.equal(m.span('not a date', iso(0)), null);

// Queue wait and execution are separate, and skipped jobs are never timed.
const timed = m.analyzeJob(job('test-shard-A', 0, 7, 22));
assert.equal(timed.queueMs, 7 * MIN); assert.equal(timed.runMs, 15 * MIN);
const skipped = m.analyzeJob(job('iPhone WebKit Smoke', 0, 0, -5, 'skipped'));
assert.equal(skipped.skipped, true); assert.equal(skipped.queueMs, null); assert.equal(skipped.runMs, null);
const cancelled = m.analyzeJob(job('test-shard-B', 0, null, null, 'cancelled'));
assert.equal(cancelled.queueMs, null); assert.equal(cancelled.runMs, null);

// PR attribution: API link first, merge/squash commit subject second (flagged as inferred), otherwise unknown.
assert.deepEqual(m.prOf({ pull_requests: [{ number: 12 }] }), { number: 12, source: 'api' });
assert.deepEqual(m.prOf({ pull_requests: [], head_commit: { message: 'Merge pull request #34 from a/b' } }), { number: 34, source: 'commit-message' });
assert.deepEqual(m.prOf({ head_commit: { message: 'feat: thing (#56)' } }), { number: 56, source: 'commit-message' });
assert.deepEqual(m.prOf({ head_commit: { message: 'chore: nightly' } }), { number: null, source: null });

const run = (id, event, createdAt, extra = {}) => ({ id, run_number: id, run_attempt: 1, event, conclusion: 'success', head_sha: `sha${id}`, created_at: iso(createdAt), pull_requests: [], ...extra });
const entries = [
  { run: run(1, 'pull_request', 0, { pull_requests: [{ number: 100 }] }), jobs: [
    job('test-shard-contract', 0, 1, 2), job('test-shard-A', 2, 4, 19), job('test-shard-B', 2, 12, 36), job('test', 36, 36, 37),
    job('iPhone WebKit Smoke', 0, 0, -1, 'skipped') ] },
  { run: run(2, 'pull_request', 100, { pull_requests: [{ number: 100 }], head_sha: 'sha-other', run_attempt: 2 }), jobs: [job('test-shard-A', 100, 101, 115), job('test-shard-B', 100, 105, null, 'cancelled')], },
  { run: run(3, 'push', 200, { head_commit: { message: 'Merge pull request #100 from a/b' } }), jobs: [job('test-shard-A', 200, 201, 216), job('test-shard-B', 200, 202, 230)] }
];
entries[1].run.conclusion = 'cancelled';
const summary = m.summarize(entries);

assert.equal(summary.runs, 3);
assert.deepEqual(summary.outcomes, { success: 2, cancelled: 1 });
const a = summary.shards.find(x => x.shard === 'A'), b = summary.shards.find(x => x.shard === 'B');
assert.equal(a.runMs.n, 3); assert.equal(a.queueMs.max, 2 * MIN);
assert.equal(b.runMs.n, 2, 'the cancelled shard has no completed timestamp and must not be counted as 0');
assert.equal(b.queueMs.n, 3, 'the cancelled shard still has a valid created->started pair, but only when started_at exists');
const group = summary.jobGroups.find(x => x.name === 'test-shard-*');
assert.equal(group.jobs, 6); assert.equal(group.untimed, 1);
assert.equal(summary.jobGroups.find(x => x.name === 'iPhone WebKit Smoke').skipped, 1);
// Wall time is run creation -> last finishing job; the PR run ends when the final `test` job completes at minute 37.
assert.equal(summary.perRun[0].wallMs, 37 * MIN);
assert.equal(summary.perRun[0].lastFinishingJob.name, 'test');
assert.equal(summary.perRun[0].firstJobStartDelayMs, 0);
// PR CI count and main-push attribution.
assert.equal(summary.prCi.prs, 1); assert.equal(summary.prCi.runsPerPr.max, 2); assert.equal(summary.prCi.headShasPerPr.max, 2);
assert.equal(summary.prCi.cancelledRuns, 1); assert.equal(summary.prCi.reattemptedRuns, 1);
assert.equal(summary.mainPushRevalidation.mapped, 1); assert.equal(summary.mainPushRevalidation.mappedByCommitMessage, 1);
assert.equal(summary.mainPushRevalidation.wallMs.median, 30 * MIN);

const md = m.toMarkdown(summary, { repo: 'o/r', workflow: 'test.yml', window: null });
for (const heading of ['# CI timing report', '## Workflow wall time', '## Jobs: queue wait', '## Shards', '## Pull-request CI', '## main push re-validation']) assert.ok(md.includes(heading), heading);
assert.ok(md.includes('n/a'), 'unknown values render as n/a');

// GitHub access: only `gh api` read calls are made, pagination stops on a short page, the entry is trimmed to timing fields.
const calls = [];
const fakeExec = argv => {
  calls.push(argv);
  assert.equal(argv[0], 'api'); assert.ok(!argv.includes('-X') && !argv.includes('--method'), 'read-only');
  if (argv[1].includes('/runs?')) return JSON.stringify({ workflow_runs: [{ ...run(9, 'push', 0), head_commit: { message: 'x\nsecret body' }, actor: { login: 'someone' } }] });
  return JSON.stringify({ jobs: [{ ...job('test', 0, 1, 2), steps: [{ name: 'noise' }], runner_name: 'r' }] });
};
const fetched = m.fetchRuns({ repo: 'o/r', workflow: 'test.yml', maxRuns: 5, exec: fakeExec });
assert.equal(calls.length, 2);
assert.ok(calls[0][1].startsWith('repos/o/r/actions/workflows/test.yml/runs?status=completed'));
assert.deepEqual(Object.keys(fetched[0].jobs[0]).sort(), ['completed_at', 'conclusion', 'created_at', 'name', 'started_at']);
assert.equal(fetched[0].run.head_commit.message, 'x');
assert.equal(fetched[0].run.actor, undefined);

// The script source carries no credential handling of its own.
const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'ci-metrics.js'), 'utf8');
assert.ok(!/ghp_|github_pat_|Authorization|process\.env\.(GH|GITHUB)_TOKEN/.test(source));

// CLI replays a saved file offline and writes both formats.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-metrics-'));
fs.writeFileSync(path.join(dir, 'raw.json'), JSON.stringify(entries));
childProcess.execFileSync('node', [path.join(__dirname, '..', 'scripts', 'ci-metrics.js'), '--input', path.join(dir, 'raw.json'),
  '--json', path.join(dir, 'out.json'), '--md', path.join(dir, 'out.md')], { encoding: 'utf8' });
assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'out.json'), 'utf8')).summary.runs, 3);
assert.ok(fs.readFileSync(path.join(dir, 'out.md'), 'utf8').startsWith('# CI timing report'));
fs.rmSync(dir, { recursive: true, force: true });

console.log('ci-metrics-test: ok');
