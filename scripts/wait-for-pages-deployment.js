'use strict';

/*
 * Waits until the GitHub Pages deployment of exactly EXPECTED_SHA has completed,
 * before any published-bytes or published-WebKit check runs.
 *
 * Why: the published-file verifiers used to start polling the public site as soon
 * as main was pushed. GitHub's dynamic "pages build and deployment" run is queued
 * independently and on 2026-10-15 finished 2-46 minutes after the push
 * (d0802d88 05:59:31, 743d08d1 07:27:41, c45b2c9e 12:23:32), so the fixed retry
 * budgets expired first. Worse, for c45b2c9e the 7-file publication attestation
 * passed at 11:59:57 against the *previous* deployment, 24 minutes before this
 * SHA was deployed, because those files happened to be unchanged.
 *
 * Signal: the `github-pages` environment deployment created for the SHA
 * (GET /repos/{repo}/deployments?sha=X&environment=github-pages). Its newest
 * status turns `success` at the same second the Pages deploy job finishes
 * (c45b2c9e: deployment 7092138674 success 12:23:32 == run 38728696557 end).
 *
 * Superseded: an older deployment keeps its `success` status after a newer one
 * goes live, so supersession is detected explicitly -- main no longer points at
 * EXPECTED_SHA, the SHA's deployment is `inactive`, or the newest github-pages
 * deployment is for another SHA. A superseded run never passes; it fails with an
 * explicit SUPERSEDED message (Actions has no neutral conclusion, and a success
 * would feed Release Attestation Sync for a commit that is no longer live).
 *
 * Modes: `wait` (default) polls; `confirm` performs one check (used after the
 * published WebKit suite to prove the site was not replaced while it ran).
 */

const fs = require('node:fs');

const ENVIRONMENT = 'github-pages';
const FAILED_STATES = new Set(['failure', 'error']);

class DeploymentWaitError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createGitHubClient({
  apiUrl = 'https://api.github.com',
  repository,
  token,
  fetchImpl = globalThis.fetch
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(repository || ''))) throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is unavailable. Node.js 18 or later is required.');
  const base = String(apiUrl).replace(/\/+$/, '');
  return async function get(pathAndQuery) {
    const response = await fetchImpl(`${base}/repos/${repository}${pathAndQuery}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) throw new Error(`GitHub API ${pathAndQuery}: HTTP ${response.status}`);
    return response.json();
  };
}

/*
 * One observation. Returns { state: 'deployed' | 'pending', ... } or throws a
 * DeploymentWaitError of kind 'superseded' or 'failed'.
 */
async function checkDeployment({ get, expectedSha, branch = 'main' }) {
  const sha = String(expectedSha || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`EXPECTED_SHA must be a full commit SHA: ${expectedSha}`);

  const head = await get(`/commits/${encodeURIComponent(branch)}`);
  const headSha = String(head?.sha || '').toLowerCase();
  if (headSha !== sha) {
    throw new DeploymentWaitError('superseded', `SUPERSEDED: ${branch} now points at ${headSha || 'unknown'}, not ${sha}. This run cannot attest ${sha}; the run for the newer commit owns publication verification.`);
  }

  const deployments = await get(`/deployments?sha=${sha}&environment=${ENVIRONMENT}&per_page=10`);
  const own = Array.isArray(deployments) ? deployments.filter(row => String(row?.sha).toLowerCase() === sha) : [];
  if (!own.length) return { state: 'pending', detail: `no ${ENVIRONMENT} deployment exists for ${sha} yet` };
  const deployment = own.reduce((newest, row) => (Number(row.id) > Number(newest.id) ? row : newest));

  const statuses = await get(`/deployments/${deployment.id}/statuses?per_page=1`);
  const latest = Array.isArray(statuses) ? statuses[0] : null;
  const state = String(latest?.state || 'none');
  if (FAILED_STATES.has(state)) {
    throw new DeploymentWaitError('failed', `GitHub Pages deployment ${deployment.id} for ${sha} ended in state "${state}" (${latest?.log_url || 'no log url'}).`);
  }
  if (state === 'inactive') {
    throw new DeploymentWaitError('superseded', `SUPERSEDED: GitHub Pages deployment ${deployment.id} for ${sha} is inactive; a newer deployment replaced it.`);
  }
  if (state !== 'success') return { state: 'pending', detail: `deployment ${deployment.id} for ${sha} is "${state}"`, deploymentId: deployment.id };

  const newestList = await get(`/deployments?environment=${ENVIRONMENT}&per_page=1`);
  const newest = Array.isArray(newestList) ? newestList[0] : null;
  const newestSha = String(newest?.sha || '').toLowerCase();
  if (newestSha !== sha) {
    throw new DeploymentWaitError('superseded', `SUPERSEDED: the newest ${ENVIRONMENT} deployment is ${newest?.id ?? 'unknown'} for ${newestSha || 'unknown'}, not ${sha}.`);
  }
  return {
    state: 'deployed',
    deploymentId: deployment.id,
    completedAt: latest.created_at || null,
    environmentUrl: latest.environment_url || null
  };
}

async function waitForDeployment({
  get,
  expectedSha,
  branch = 'main',
  mode = 'wait',
  attempts = 120,
  delayMs = 30_000,
  sleepImpl = sleep,
  log = message => console.log(message)
}) {
  const maxAttempts = mode === 'confirm' ? 1 : positiveInteger(attempts, 120);
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await checkDeployment({ get, expectedSha, branch });
    if (last.state === 'deployed') return { ...last, attempts: attempt };
    log(`[pages-deployment] attempt ${attempt}/${maxAttempts}: ${last.detail}`);
    if (attempt < maxAttempts) await sleepImpl(Math.max(0, Number(delayMs) || 0));
  }
  throw new DeploymentWaitError(
    mode === 'confirm' ? 'failed' : 'timeout',
    mode === 'confirm'
      ? `GitHub Pages deployment for ${expectedSha} is not the completed live deployment: ${last?.detail}`
      : `GitHub Pages deployment for ${expectedSha} did not complete after ${maxAttempts} attempts: ${last?.detail}`
  );
}

async function main() {
  const expectedSha = process.env.EXPECTED_SHA || process.env.GITHUB_SHA;
  const mode = process.env.PAGES_DEPLOYMENT_MODE === 'confirm' ? 'confirm' : 'wait';
  const get = createGitHubClient({
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  });
  try {
    const result = await waitForDeployment({
      get,
      expectedSha,
      branch: process.env.PAGES_DEPLOYMENT_BRANCH || 'main',
      mode,
      attempts: process.env.PAGES_DEPLOYMENT_WAIT_ATTEMPTS,
      delayMs: process.env.PAGES_DEPLOYMENT_WAIT_DELAY_MS
    });
    console.log(JSON.stringify({ ok: true, mode, expectedSha, ...result }, null, 2));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `deployment_id=${result.deploymentId}\n`);
  } catch (error) {
    const kind = error instanceof DeploymentWaitError ? error.kind : 'error';
    console.log(`::error title=Pages deployment ${kind}::${error.message}`);
    console.error(JSON.stringify({ ok: false, mode, expectedSha, kind, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  ENVIRONMENT,
  DeploymentWaitError,
  createGitHubClient,
  checkDeployment,
  waitForDeployment
};
