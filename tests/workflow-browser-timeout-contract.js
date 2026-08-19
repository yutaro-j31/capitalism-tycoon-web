'use strict';

// A job that downloads a browser can hang in the download itself, and GitHub's default job
// timeout is six hours. On 2026-08-19 that happened four times in one morning -- twice in
// M&A Integration, once in M&A Deal Room, and once more while the first was still stuck --
// every time inside `npx playwright install --with-deps webkit`, which normally takes about
// 1m20s. Those two workflows were the only browser-installing jobs in the repo with no
// job-level timeout-minutes, so each hang sat on a runner indefinitely and the canonical
// gate could not tell "still installing" from "wedged".
//
// Re-running the same job unchanged succeeded every time, so the fix is not to make the
// download more reliable but to bound it: with a job-level timeout the run fails in minutes
// and can simply be re-run.
//
// This contract keeps that property. It deliberately covers only jobs that install a
// browser, not every job in the repo -- browser downloads are the failure mode actually
// observed, and requiring a timeout everywhere would force unrelated numbers onto pure-node
// jobs that have never hung. (12 such jobs still have no timeout-minutes; that is a separate
// question from this one.)

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '..', '.github', 'workflows');
const files = fs.readdirSync(dir).filter(name => name.endsWith('.yml') || name.endsWith('.yaml')).sort();
assert.ok(files.length > 0, '.github/workflows にワークフローが存在する');

// Walk the file line by line rather than parsing YAML: the repo has no YAML dependency, and
// these files all use the same conventional two-space indentation under `jobs:`.
function jobsOf(source) {
  const lines = source.split('\n');
  const jobs = [];
  let inJobs = false;
  let current = null;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (/^[A-Za-z]/.test(line)) { inJobs = false; continue; }        // back to a top-level key
    const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (header) { current = { name: header[1], timeout: false, body: [] }; jobs.push(current); continue; }
    if (!current) continue;
    if (/^ {4}timeout-minutes:\s*\d+\s*$/.test(line)) current.timeout = true;
    current.body.push(line);
  }
  return jobs;
}

const installsBrowser = job => job.body.some(line => /playwright\s+install/.test(line));

let checked = 0;
const offenders = [];
for (const file of files) {
  for (const job of jobsOf(fs.readFileSync(path.join(dir, file), 'utf8'))) {
    if (!installsBrowser(job)) continue;
    checked++;
    if (!job.timeout) offenders.push(`${file}:${job.name}`);
  }
}

assert.ok(checked > 0, 'ブラウザを導入するジョブが検出できている（パーサが壊れていない）');
assert.deepEqual(
  offenders,
  [],
  `ブラウザを導入するジョブには job-level timeout-minutes が必要（無いとハング時に既定の6時間ランナーを占有する）: ${offenders.join(', ')}`
);

console.log(`workflow browser timeout contract ok: ${checked} browser-installing jobs, all bounded`);
