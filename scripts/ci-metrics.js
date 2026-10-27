#!/usr/bin/env node
'use strict';
// CI timing report: separates runner queue wait (job created -> started) from execution (started -> completed).
// Read-only. Never infers a value the API did not return: a missing or inconsistent timestamp is "unknown".
//
//   node scripts/ci-metrics.js [--repo owner/name] [--workflow test.yml] [--max-runs 100]
//        [--json out.json] [--md out.md] [--save-raw raw.json] [--input raw.json]
//
// Authentication is whatever the GitHub CLI already has (`gh auth login` or GH_TOKEN); nothing is stored here.
// --input replays a file written by --save-raw, so a report can be reproduced without network access.
const fs = require('node:fs');
const childProcess = require('node:child_process');

const SHARD_JOB = /^test-shard-([A-Z])$/;

function stats(values) {
  const xs = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return { n: 0, mean: null, median: null, p90: null, min: null, max: null };
  const at = p => {
    const k = (xs.length - 1) * p, f = Math.floor(k), c = Math.min(f + 1, xs.length - 1);
    return xs[f] + (xs[c] - xs[f]) * (k - f);
  };
  return { n: xs.length, mean: xs.reduce((a, b) => a + b, 0) / xs.length, median: at(0.5), p90: at(0.9), min: xs[0], max: xs[xs.length - 1] };
}

// Milliseconds between two ISO timestamps, or null when either is absent, unparsable or the span is negative.
function span(from, to) {
  if (!from || !to) return null;
  const a = Date.parse(from), b = Date.parse(to);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
}

function groupName(name) { return SHARD_JOB.test(name) ? 'test-shard-*' : name; }

// Skipped jobs carry placeholder timestamps from GitHub, so they are counted but never timed.
function analyzeJob(job) {
  const skipped = job.conclusion === 'skipped';
  return {
    name: job.name, conclusion: job.conclusion || 'unknown', skipped,
    queueMs: skipped ? null : span(job.created_at, job.started_at),
    runMs: skipped ? null : span(job.started_at, job.completed_at),
    completedAt: skipped ? null : job.completed_at || null
  };
}

// PR number from the API link when present, otherwise from a merge/squash commit subject (marked inferred).
function prOf(run) {
  if (run.pull_requests && run.pull_requests[0]) return { number: run.pull_requests[0].number, source: 'api' };
  const message = (run.head_commit && run.head_commit.message) || run.display_title || '';
  const m = /^Merge pull request #(\d+)/.exec(message) || /\(#(\d+)\)\s*$/m.exec(message.split('\n')[0]);
  return m ? { number: Number(m[1]), source: 'commit-message' } : { number: null, source: null };
}

function analyzeRun({ run, jobs }) {
  const analyzed = jobs.map(analyzeJob);
  const timed = analyzed.filter(j => j.completedAt);
  const last = timed.reduce((best, j) => (!best || Date.parse(j.completedAt) > Date.parse(best.completedAt) ? j : best), null);
  const lastRaw = last && jobs.find(j => j.name === last.name && j.completed_at === last.completedAt);
  const pr = prOf(run);
  return {
    runId: run.id, runNumber: run.run_number, attempt: run.run_attempt || 1, event: run.event, conclusion: run.conclusion || 'unknown',
    headSha: run.head_sha, pr: pr.number, prSource: pr.source,
    // Wall time = run creation -> last finishing job; only known when at least one job has a complete timestamp pair.
    wallMs: last ? span(run.created_at, last.completedAt) : null,
    firstJobStartDelayMs: Math.min(...jobs.map(j => span(run.created_at, j.started_at)).filter(Number.isFinite), Infinity),
    lastFinishingJob: last ? { name: last.name, queueMs: last.queueMs, runMs: last.runMs } : null,
    lastFinishingJobCreatedToRunMs: lastRaw ? span(run.created_at, lastRaw.started_at) : null,
    jobs: analyzed
  };
}

function summarize(entries) {
  const runs = entries.map(analyzeRun);
  runs.forEach(r => { if (!Number.isFinite(r.firstJobStartDelayMs)) r.firstJobStartDelayMs = null; });
  const jobs = runs.flatMap(r => r.jobs.map(j => ({ ...j, event: r.event })));
  const byName = {};
  for (const j of jobs) {
    const g = (byName[groupName(j.name)] ||= { queue: [], run: [], total: 0, skipped: 0, untimed: 0 });
    g.total++;
    if (j.skipped) g.skipped++;
    else if (j.queueMs === null || j.runMs === null) g.untimed++;
    g.queue.push(j.queueMs); g.run.push(j.runMs);
  }
  const jobGroups = Object.entries(byName).map(([name, g]) => ({
    name, jobs: g.total, skipped: g.skipped, untimed: g.untimed, queueMs: stats(g.queue), runMs: stats(g.run)
  })).sort((a, b) => (b.runMs.median ?? -1) - (a.runMs.median ?? -1));
  const shards = {};
  for (const j of jobs) {
    const m = SHARD_JOB.exec(j.name);
    if (m) (shards[m[1]] ||= { queue: [], run: [] }).run.push(j.runMs), shards[m[1]].queue.push(j.queueMs);
  }
  const shardTable = Object.keys(shards).sort().map(s => ({ shard: s, queueMs: stats(shards[s].queue), runMs: stats(shards[s].run) }));
  const wallByEvent = {};
  for (const r of runs) (wallByEvent[r.event] ||= []).push(r.wallMs);
  const wall = Object.fromEntries(Object.entries(wallByEvent).map(([e, v]) => [e, stats(v)]));
  const prs = {};
  for (const r of runs.filter(x => x.event === 'pull_request' && x.pr !== null)) {
    const p = (prs[r.pr] ||= { shas: new Set(), runs: 0, cancelled: 0, reattempts: 0 });
    p.shas.add(r.headSha); p.runs++;
    if (r.conclusion === 'cancelled') p.cancelled++;
    if (r.attempt > 1) p.reattempts++;
  }
  const prList = Object.entries(prs).map(([n, p]) => ({ pr: Number(n), runs: p.runs, distinctHeadShas: p.shas.size, cancelled: p.cancelled, reattempts: p.reattempts }));
  const pushWall = runs.filter(r => r.event === 'push' && r.pr !== null).map(r => ({ pr: r.pr, wallMs: r.wallMs, prSource: r.prSource }));
  const outcomes = {};
  for (const r of runs) outcomes[r.conclusion] = (outcomes[r.conclusion] || 0) + 1;
  const last = {};
  for (const r of runs) if (r.lastFinishingJob) {
    const g = (last[groupName(r.lastFinishingJob.name)] ||= 0); last[groupName(r.lastFinishingJob.name)] = g + 1;
  }
  return {
    runs: runs.length, outcomes, wallMsByEvent: wall, jobGroups, shards: shardTable,
    firstJobStartDelayMs: stats(runs.map(r => r.firstJobStartDelayMs)),
    lastFinishingJobCounts: last,
    prCi: { prs: prList.length, runsPerPr: stats(prList.map(p => p.runs)), headShasPerPr: stats(prList.map(p => p.distinctHeadShas)),
      cancelledRuns: prList.reduce((a, p) => a + p.cancelled, 0), reattemptedRuns: prList.reduce((a, p) => a + p.reattempts, 0) },
    mainPushRevalidation: { mapped: pushWall.length, mappedByCommitMessage: pushWall.filter(p => p.prSource === 'commit-message').length,
      wallMs: stats(pushWall.map(p => p.wallMs)) },
    perRun: runs.map(({ jobs: _jobs, ...rest }) => rest)
  };
}

const min = ms => (ms === null || ms === undefined ? 'n/a' : (ms / 60000).toFixed(1));
const statCells = s => [s.n, min(s.mean), min(s.median), min(s.p90), min(s.min), min(s.max)].join(' | ');
const HEAD = '| n | mean | median | p90 | min | max |\n|---:|---:|---:|---:|---:|---:|';

function toMarkdown(summary, meta) {
  const L = [`# CI timing report`, '', `- repo: ${meta.repo}, workflow: ${meta.workflow}`, `- completed runs analysed: ${summary.runs}${meta.window ? ` (${meta.window})` : ''}`,
    `- all durations in minutes; \`n/a\` = timestamp missing or inconsistent in the API response (never estimated)`,
    `- outcomes: ${Object.entries(summary.outcomes).map(([k, v]) => `${k}=${v}`).join(', ')}`, '',
    '## Workflow wall time (run created -> last finishing job)', '', `| event | ${HEAD.split('\n')[0].slice(2)}`, `|---|${HEAD.split('\n')[1]}`];
  for (const [e, s] of Object.entries(summary.wallMsByEvent)) L.push(`| ${e} | ${statCells(s)} |`);
  L.push('', '## Delay before the first job starts', '', HEAD, `| ${statCells(summary.firstJobStartDelayMs)} |`);
  L.push('', '## Jobs: queue wait (created -> started) vs execution (started -> completed)', '',
    `| job | jobs | skipped | untimed | queue n | queue median | queue p90 | queue max | run n | run median | run p90 | run max |`, `|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
  for (const g of summary.jobGroups) L.push(`| ${g.name} | ${g.jobs} | ${g.skipped} | ${g.untimed} | ${g.queueMs.n} | ${min(g.queueMs.median)} | ${min(g.queueMs.p90)} | ${min(g.queueMs.max)} | ${g.runMs.n} | ${min(g.runMs.median)} | ${min(g.runMs.p90)} | ${min(g.runMs.max)} |`);
  L.push('', '## Shards', '', `| shard | queue median | queue max | run n | run median | run p90 | run min | run max |`, `|---|---:|---:|---:|---:|---:|---:|---:|`);
  for (const s of summary.shards) L.push(`| ${s.shard} | ${min(s.queueMs.median)} | ${min(s.queueMs.max)} | ${s.runMs.n} | ${min(s.runMs.median)} | ${min(s.runMs.p90)} | ${min(s.runMs.min)} | ${min(s.runMs.max)} |`);
  L.push('', '## Last finishing job per run (the run\'s critical-path end; dependencies are not in the API)', '',
    Object.entries(summary.lastFinishingJobCounts).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '- none');
  L.push('', '## Pull-request CI', '', `- PRs with pull_request runs: ${summary.prCi.prs}`, `- runs per PR: median ${summary.prCi.runsPerPr.median ?? 'n/a'}, max ${summary.prCi.runsPerPr.max ?? 'n/a'}`,
    `- distinct head SHAs per PR: median ${summary.prCi.headShasPerPr.median ?? 'n/a'}, max ${summary.prCi.headShasPerPr.max ?? 'n/a'}`,
    `- cancelled runs: ${summary.prCi.cancelledRuns}, re-attempted runs: ${summary.prCi.reattemptedRuns}`);
  L.push('', '## main push re-validation after merge', '', `- push runs mapped to a PR: ${summary.mainPushRevalidation.mapped} (${summary.mainPushRevalidation.mappedByCommitMessage} via commit message, inferred)`, '', HEAD, `| ${statCells(summary.mainPushRevalidation.wallMs)} |`);
  return L.join('\n') + '\n';
}

// ---- GitHub access (GitHub CLI; injectable for tests) ----
function ghExec(argv) {
  return childProcess.execFileSync('gh', argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}
function fetchRuns({ repo, workflow, maxRuns, exec = ghExec }) {
  const runs = [];
  for (let page = 1; runs.length < maxRuns; page++) {
    const body = JSON.parse(exec(['api', `repos/${repo}/actions/workflows/${workflow}/runs?status=completed&per_page=100&page=${page}`]));
    runs.push(...body.workflow_runs);
    if (body.workflow_runs.length < 100) break;
  }
  return runs.slice(0, maxRuns).map(run => {
    const jobs = JSON.parse(exec(['api', `repos/${repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`])).jobs;
    return { run: slimRun(run), jobs: jobs.map(slimJob) };
  });
}
const slimRun = r => ({ id: r.id, run_number: r.run_number, run_attempt: r.run_attempt, event: r.event, conclusion: r.conclusion, head_sha: r.head_sha,
  created_at: r.created_at, updated_at: r.updated_at, display_title: r.display_title, pull_requests: (r.pull_requests || []).map(p => ({ number: p.number })),
  head_commit: r.head_commit ? { message: String(r.head_commit.message || '').split('\n')[0] } : null });
const slimJob = j => ({ name: j.name, conclusion: j.conclusion, created_at: j.created_at, started_at: j.started_at, completed_at: j.completed_at });

function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const repo = opt('--repo', process.env.GITHUB_REPOSITORY || 'yutaro-j31/capitalism-tycoon-web');
  const workflow = opt('--workflow', 'test.yml');
  const maxRuns = Math.max(1, Number(opt('--max-runs', '100')) || 100);
  const entries = opt('--input') ? JSON.parse(fs.readFileSync(opt('--input'), 'utf8')) : fetchRuns({ repo, workflow, maxRuns });
  if (opt('--save-raw')) fs.writeFileSync(opt('--save-raw'), JSON.stringify(entries));
  const times = entries.map(e => e.run.created_at).filter(Boolean).sort();
  const summary = summarize(entries);
  const meta = { repo, workflow, window: times.length ? `${times[0]} .. ${times[times.length - 1]}` : null };
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify({ meta, summary }, null, 2));
  const md = toMarkdown(summary, meta);
  if (opt('--md')) fs.writeFileSync(opt('--md'), md); else process.stdout.write(md);
}

module.exports = { stats, span, analyzeJob, analyzeRun, prOf, summarize, toMarkdown, fetchRuns };
if (require.main === module) main(process.argv.slice(2));
