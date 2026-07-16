'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  ROOT,
  extractAssetPaths,
  deploymentTargets,
  normalizeAssetPath,
  verifyDeployment
} = require('../scripts/pages-deployment-smoke');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

(async () => {
  assert.equal(normalizeAssetPath('./js/runtime.js?x=1'), 'js/runtime.js');
  assert.equal(normalizeAssetPath('https://example.com/app.js'), null);
  assert.throws(() => normalizeAssetPath('../secret.txt'), /escapes repository root/);

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const assets = extractAssetPaths(html);
  assert.ok(assets.includes('css/app.css'), 'CSS must be included in deployment attestation');
  assert.ok(assets.includes('js/runtime.js'), 'runtime must be included in deployment attestation');
  assert.ok(assets.includes('js/app.js'), 'application module must be included in deployment attestation');
  assert.ok(deploymentTargets(ROOT).length > 30, 'deployment attestation must cover the complete static runtime');

  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages-deployment-smoke.yml'), 'utf8');
  assert.match(workflow, /^name: Pages Deployment Smoke$/m);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[ main \]/m, 'deployment smoke must run after main changes');
  assert.match(workflow, /workflow_dispatch:/, 'deployment smoke must support manual reruns');
  assert.doesNotMatch(workflow, /pull_request:/, 'pull requests must not compare unpublished branch bytes with Pages');
  assert.match(workflow, /node scripts\/pages-deployment-smoke\.js/, 'workflow must execute the production verifier');
  assert.match(workflow, /cancel-in-progress: true/, 'stale deployment checks must be cancelled');
  assert.ok(fs.existsSync(path.join(ROOT, '.nojekyll')), 'exact static delivery requires .nojekyll');

  const state = { staleResponsesRemaining: 1, alwaysStale: false };
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html';
    if (relativePath === 'release-candidate.json' && (state.alwaysStale || state.staleResponsesRemaining > 0)) {
      state.staleResponsesRemaining = Math.max(0, state.staleResponsesRemaining - 1);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"version":"stale"}\n');
      return;
    }

    const resolved = path.resolve(ROOT, relativePath);
    if (!resolved.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'cache-control': 'no-store' });
    response.end(fs.readFileSync(resolved));
  });

  try {
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}/`;
    const recovered = await verifyDeployment({
      root: ROOT,
      baseUrl,
      attempts: 2,
      delayMs: 1,
      requestTimeoutMs: 5_000
    });
    assert.equal(recovered.attempts, 2, 'verifier must retry a stale Pages deployment');
    assert.ok(recovered.assetCount > 30);

    state.alwaysStale = true;
    await assert.rejects(
      verifyDeployment({
        root: ROOT,
        baseUrl,
        attempts: 1,
        delayMs: 0,
        requestTimeoutMs: 5_000
      }),
      /Published GitHub Pages assets did not match this checkout/
    );
  } finally {
    await close(server);
  }

  console.log('Pages deployment smoke checks passed.');
})().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
