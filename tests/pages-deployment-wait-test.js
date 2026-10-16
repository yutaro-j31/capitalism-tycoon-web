'use strict';

// Contract for waiting on the GitHub Pages deployment of exactly github.sha before any
// published-bytes or published-WebKit verification (see scripts/wait-for-pages-deployment.js
// for the 2026-10-15 incidents this covers).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ENVIRONMENT,
  DeploymentWaitError,
  createGitHubClient,
  checkDeployment,
  waitForDeployment
} = require('../scripts/wait-for-pages-deployment');

const ROOT = path.resolve(__dirname, '..');
const SHA = 'c45b2c9e2dff93a791d9394cee3ec462623fd926';
const NEWER = '642fcd22aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OLDER = '743d08d1867f453fe09c61e1fd5312c846cfc1eb';

// Fake GitHub API driven by a list of per-poll snapshots (the last snapshot repeats).
function fakeApi(snapshots) {
  let poll = -1;
  const calls = [];
  const current = () => snapshots[Math.min(poll, snapshots.length - 1)];
  const get = async route => {
    calls.push(route);
    if (route === '/commits/main') {
      poll += 1;
      return { sha: current().main };
    }
    const snap = current();
    let match = route.match(/^\/deployments\?sha=([0-9a-f]+)&environment=github-pages&per_page=10$/);
    if (match) return (snap.deployments || []).filter(row => row.sha === match[1]);
    match = route.match(/^\/deployments\/(\d+)\/statuses\?per_page=1$/);
    if (match) {
      const state = (snap.statuses || {})[match[1]];
      return state ? [{ state, created_at: '2026-10-15T12:23:32Z', environment_url: 'https://yutaro-j31.github.io/capitalism-tycoon-web/', log_url: 'https://example.invalid/log' }] : [];
    }
    if (route === '/deployments?environment=github-pages&per_page=1') {
      return [...(snap.deployments || [])].sort((a, b) => b.id - a.id).slice(0, 1);
    }
    throw new Error(`unexpected route ${route}`);
  };
  return { get, calls, polls: () => poll + 1 };
}

const previousDeployment = { id: 7086483103, sha: OLDER };
const ownDeployment = { id: 7092138674, sha: SHA };

async function rejectsKind(promise, kind, pattern) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof DeploymentWaitError, `expected DeploymentWaitError, got ${error}`);
    assert.equal(error.kind, kind);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

(async () => {
  assert.equal(ENVIRONMENT, 'github-pages');

  // 1. Waits through "no deployment yet" -> queued -> in_progress -> success, then passes.
  {
    const api = fakeApi([
      { main: SHA, deployments: [previousDeployment], statuses: { [previousDeployment.id]: 'success' } },
      { main: SHA, deployments: [previousDeployment, ownDeployment], statuses: { [previousDeployment.id]: 'success', [ownDeployment.id]: 'queued' } },
      { main: SHA, deployments: [previousDeployment, ownDeployment], statuses: { [previousDeployment.id]: 'success', [ownDeployment.id]: 'in_progress' } },
      { main: SHA, deployments: [previousDeployment, ownDeployment], statuses: { [previousDeployment.id]: 'success', [ownDeployment.id]: 'success' } }
    ]);
    const sleeps = [];
    const result = await waitForDeployment({ get: api.get, expectedSha: SHA, attempts: 10, delayMs: 7, sleepImpl: async ms => sleeps.push(ms), log: () => {} });
    assert.equal(result.state, 'deployed');
    assert.equal(result.deploymentId, ownDeployment.id);
    assert.equal(result.attempts, 4, 'must keep polling until the deployment of this SHA succeeds');
    assert.deepEqual(sleeps, [7, 7, 7]);
  }

  // 2. The previous SHA's live deployment must never satisfy the wait (the c45b2c9e false pass).
  {
    const api = fakeApi([{ main: SHA, deployments: [previousDeployment], statuses: { [previousDeployment.id]: 'success' } }]);
    await rejectsKind(
      waitForDeployment({ get: api.get, expectedSha: SHA, attempts: 3, delayMs: 0, sleepImpl: async () => {}, log: () => {} }),
      'timeout', /did not complete after 3 attempts/
    );
    assert.equal(api.polls(), 3);
  }

  // 3. main advanced while waiting -> SUPERSEDED immediately, never a pass for the old SHA.
  {
    const api = fakeApi([
      { main: SHA, deployments: [previousDeployment, ownDeployment], statuses: { [ownDeployment.id]: 'in_progress' } },
      { main: NEWER, deployments: [previousDeployment, ownDeployment], statuses: { [ownDeployment.id]: 'success' } }
    ]);
    await rejectsKind(
      waitForDeployment({ get: api.get, expectedSha: SHA, attempts: 50, delayMs: 0, sleepImpl: async () => {}, log: () => {} }),
      'superseded', /^SUPERSEDED: main now points at 642fcd22/
    );
    assert.equal(api.polls(), 2, 'supersession must stop polling at once');
  }

  // 4. Own deployment succeeded but a newer deployment is live (old statuses stay "success").
  {
    const newerDeployment = { id: 7095908574, sha: NEWER };
    const api = fakeApi([{ main: SHA, deployments: [ownDeployment, newerDeployment], statuses: { [ownDeployment.id]: 'success', [newerDeployment.id]: 'success' } }]);
    await rejectsKind(checkDeployment({ get: api.get, expectedSha: SHA }), 'superseded', /newest github-pages deployment is 7095908574/);
  }

  // 5. inactive -> superseded; failure / error -> failed (no waiting out the budget).
  for (const [state, kind] of [['inactive', 'superseded'], ['failure', 'failed'], ['error', 'failed']]) {
    const api = fakeApi([{ main: SHA, deployments: [ownDeployment], statuses: { [ownDeployment.id]: state } }]);
    await rejectsKind(
      waitForDeployment({ get: api.get, expectedSha: SHA, attempts: 20, delayMs: 0, sleepImpl: async () => {}, log: () => {} }),
      kind
    );
    assert.equal(api.polls(), 1, `${state} must end the wait immediately`);
  }

  // 6. A redeploy of the same SHA: the newest deployment of that SHA decides.
  {
    const redeploy = { id: 7092999999, sha: SHA };
    const api = fakeApi([{ main: SHA, deployments: [ownDeployment, redeploy], statuses: { [ownDeployment.id]: 'failure', [redeploy.id]: 'success' } }]);
    const result = await checkDeployment({ get: api.get, expectedSha: SHA });
    assert.equal(result.state, 'deployed');
    assert.equal(result.deploymentId, redeploy.id);
  }

  // 7. confirm mode checks exactly once and fails rather than waits.
  {
    const api = fakeApi([{ main: SHA, deployments: [ownDeployment], statuses: { [ownDeployment.id]: 'in_progress' } }]);
    let slept = false;
    await rejectsKind(
      waitForDeployment({ get: api.get, expectedSha: SHA, mode: 'confirm', attempts: 99, sleepImpl: async () => { slept = true; }, log: () => {} }),
      'failed', /not the completed live deployment/
    );
    assert.equal(api.polls(), 1);
    assert.equal(slept, false);
    const ok = fakeApi([{ main: SHA, deployments: [ownDeployment], statuses: { [ownDeployment.id]: 'success' } }]);
    assert.equal((await waitForDeployment({ get: ok.get, expectedSha: SHA, mode: 'confirm', log: () => {} })).state, 'deployed');
  }

  // 8. Only full commit SHAs are accepted.
  await assert.rejects(checkDeployment({ get: async () => ({}), expectedSha: 'main' }), /full commit SHA/);
  await assert.rejects(checkDeployment({ get: async () => ({}), expectedSha: '' }), /full commit SHA/);

  // 9. HTTP client: authenticated GET against the repository API, non-2xx is an error.
  {
    const seen = [];
    const get = createGitHubClient({
      apiUrl: 'https://api.example.invalid/',
      repository: 'yutaro-j31/capitalism-tycoon-web',
      token: 'tok',
      fetchImpl: async (url, init) => {
        seen.push({ url, init });
        return url.endsWith('/missing') ? { ok: false, status: 404 } : { ok: true, status: 200, json: async () => ({ sha: SHA }) };
      }
    });
    assert.deepEqual(await get('/commits/main'), { sha: SHA });
    assert.equal(seen[0].url, 'https://api.example.invalid/repos/yutaro-j31/capitalism-tycoon-web/commits/main');
    assert.equal(seen[0].init.headers.authorization, 'Bearer tok');
    assert.equal(seen[0].init.method, undefined, 'the client must only issue GET requests');
    await assert.rejects(get('/missing'), /HTTP 404/);
    assert.throws(() => createGitHubClient({ repository: 'bad repo', fetchImpl: async () => {} }), /Invalid GITHUB_REPOSITORY/);
  }

  // 10. Workflow wiring.
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages-deployment-smoke.yml'), 'utf8');
  const jobBlock = name => {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    assert.ok(start !== -1, `workflow must define job ${name}`);
    const rest = workflow.slice(start + 1);
    const next = rest.slice(1).search(/\n {2}[A-Za-z0-9_-]+:\n/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  };
  assert.match(workflow, /^permissions:\n  contents: read\n  deployments: read\n\n/m,
    'deployment status reads need exactly deployments: read beside contents: read');
  assert.doesNotMatch(workflow, /: write\b/, 'Pages smoke must stay read-only');
  assert.match(workflow, /^  push:\s*\n\s*branches:\s*\[ main \]/m, 'push trigger stays: Release Attestation Sync requires event == push');
  assert.doesNotMatch(workflow, /workflow_run:/, 'Pages smoke must not depend on workflow_run of the dynamic Pages workflow');
  assert.match(workflow, /^concurrency:\n  group: pages-deployment-smoke\n  cancel-in-progress: true$/m,
    'a newer main push must cancel the older run (including its deployment wait)');

  const waitJob = jobBlock('wait-for-pages-deployment');
  assert.match(waitJob, /^    timeout-minutes: \d+$/m, 'the deployment wait must be bounded by a job-level timeout');
  const waitTimeout = Number(waitJob.match(/^    timeout-minutes: (\d+)$/m)[1]);
  const attempts = Number(waitJob.match(/PAGES_DEPLOYMENT_WAIT_ATTEMPTS: '(\d+)'/)[1]);
  const delayMs = Number(waitJob.match(/PAGES_DEPLOYMENT_WAIT_DELAY_MS: '(\d+)'/)[1]);
  assert.ok(attempts * delayMs >= 46 * 60_000, 'wait budget must cover the observed 46 min Pages deployment (c45b2c9e)');
  assert.ok(waitTimeout * 60_000 > attempts * delayMs, 'job timeout must exceed the polling budget so the script reports the timeout');
  assert.match(waitJob, /EXPECTED_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(waitJob, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(waitJob, /node scripts\/wait-for-pages-deployment\.js/);
  assert.doesNotMatch(waitJob, /playwright/, 'the wait job must not install a browser');
  assert.doesNotMatch(waitJob, /PAGES_DEPLOYMENT_MODE/, 'the wait job polls (default wait mode)');

  const attestJob = jobBlock('verify-publication-attestation');
  assert.match(attestJob, /^    needs: wait-for-pages-deployment$/m, 'publication attestation must start only after the deployment of this SHA completed');
  assert.match(attestJob, /ref: \$\{\{ github\.sha \}\}/, 'attestation must hash the checkout of the attested SHA, not a moving main');
  assert.doesNotMatch(attestJob, /ref: main$/m);
  assert.match(attestJob, /node scripts\/verify-published-pages\.js/);

  const assetsJob = jobBlock('verify-published-assets');
  assert.match(assetsJob, /^    needs: \[ wait-for-pages-deployment, verify-publication-attestation \]$/m,
    'published WebKit verification must run only after the publication check succeeded');
  assert.match(assetsJob, /^    if: github\.event_name != 'schedule'$/m,
    'job-level condition must not use always()/failure() to bypass failed prerequisites');
  const byteIndex = assetsJob.indexOf('node scripts/pages-deployment-smoke.js');
  const lastWebKitIndex = assetsJob.indexOf('node tests/published-save-quota-webkit-test.js');
  const confirmIndex = assetsJob.indexOf('PAGES_DEPLOYMENT_MODE: confirm');
  const uploadIndex = assetsJob.indexOf('Retain published WebKit evidence');
  assert.ok(byteIndex !== -1 && lastWebKitIndex > byteIndex);
  assert.ok(confirmIndex > lastWebKitIndex, 'must re-confirm the live deployment after the published WebKit suite');
  assert.ok(uploadIndex > confirmIndex, 'evidence upload stays last');
  assert.ok(assetsJob.slice(confirmIndex - 400, confirmIndex + 200).includes('node scripts/wait-for-pages-deployment.js'));

  // The script itself issues read-only GitHub API calls.
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'wait-for-pages-deployment.js'), 'utf8');
  assert.doesNotMatch(script, /method:\s*['"](POST|PATCH|PUT|DELETE)/i);
  assert.doesNotMatch(script, /Math\.random/);

  console.log('Pages deployment wait contract passed.');
})().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
