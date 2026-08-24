'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (text, token) => text.split(token).length - 1;
const workflow = read('.github/workflows/test.yml');
const pagesWorkflow = read('.github/workflows/pages-deployment-smoke.yml');
const tagWorkflow = read('.github/workflows/release-candidate-tag.yml');
const smoke = read('tests/iphone-webkit-smoke-test.js');
const retryPolicy = read('tests/published-webkit-transient-retry.js');
const deliveryGate = read('scripts/release-delivery-gate.js');
const index = read('index.html');
const mobileCss = read('css/mobile-release.css');
const releaseCandidate = JSON.parse(read('release-candidate.json'));
const deploymentUrlPattern = new RegExp(escapeRegExp(releaseCandidate.deployment.url));

assert.equal(fs.existsSync(path.join(ROOT, '.github/workflows/iphone-webkit-smoke.yml')), false,
  'dedicated iPhone WebKit workflow must remain consolidated into Test');
assert.match(workflow, /^name: Test$/m);
assert.match(workflow, /^  push:$/m, 'Test must run after main updates');
assert.match(workflow, /^    branches: \[ main \]$/m, 'Test push trigger must target main');
assert.match(workflow, /^  pull_request:$/m, 'Test must retain pull-request coverage');
assert.match(workflow, /^  schedule:$/m, 'Test must inherit nightly WebKit coverage');
assert.match(workflow, /^    - cron: '35 2 \* \* \*'$/m, 'Test must retain the exact WebKit cron');
assert.match(workflow, /^  workflow_dispatch:$/m, 'Test must remain manually runnable');
assert.match(workflow, /^          - release-readiness$/m);
assert.match(workflow, /^          - iphone-webkit$/m);
const lines = workflow.split(/\r?\n/);
const jobStart = lines.findIndex(line => line === '  iphone-webkit-smoke:');
assert(jobStart >= 0, 'Test must contain the iPhone WebKit job');
const jobEndOffset = lines.slice(jobStart + 1).findIndex(line => /^  [A-Za-z0-9_-]+:$/.test(line));
const jobEnd = jobEndOffset < 0 ? lines.length : jobStart + 1 + jobEndOffset;
const iphoneJob = lines.slice(jobStart, jobEnd).join('\n');
assert.match(iphoneJob, /^    name: iPhone WebKit Smoke$/m);
assert.match(iphoneJob, /github\.event_name == 'push'/);
assert.match(iphoneJob, /github\.event_name == 'schedule'/);
assert.match(iphoneJob, /inputs\.mode == 'iphone-webkit'/);
assert.doesNotMatch(iphoneJob, /github\.event_name == 'pull_request'/, 'WebKit job must not consume pull-request runners');
assert.doesNotMatch(iphoneJob, /inputs\.mode == 'release-readiness'/, 'release-readiness manual mode must not run WebKit');
assert.match(iphoneJob, /^      contents: read$/m, 'WebKit job must use read-only contents permission');
assert.match(iphoneJob, /group: iphone-webkit-smoke-\$\{\{ github\.ref \}\}/);
assert.match(iphoneJob, /cancel-in-progress: true/);
assert.match(iphoneJob, /timeout-minutes: 15/);
assert.match(iphoneJob, /node-version: '22'/);
assert.match(iphoneJob, /npm install --no-save --no-package-lock playwright@1\.61\.0/);
assert.match(iphoneJob, /npx playwright install --with-deps webkit/);
for (const command of [
  'node --check js/play-runtime-compat.js', 'node --check js/iphone-playtest-fixes.js',
  'node --check js/physical-iphone-playtest.js', 'node --check tests/iphone-playtest-webkit-test.js',
  'node tests/iphone-playtest-remediation-test.js', 'node tests/iphone-playtest-webkit-test.js',
  'node tests/physical-iphone-playtest-test.js', 'node tests/iphone-webkit-smoke-test.js',
  'node tests/ceo-dashboard-webkit-test.js', 'node tests/founding-tutorial-webkit-test.js',
  'node tests/d-ui-webkit-test.js', 'node tests/capital-allocation-recovery-webkit-test.js',
  'node tests/capital-allocation-recovery-outcome-webkit-test.js', 'node tests/game-over-settings-webkit-test.js',
  'node tests/two-store-iphone-webkit-test.js', 'node tests/release-diagnostics-webkit-test.js',
  'node tests/playtest-report-webkit-test.js', 'node tests/boot-recovery-webkit-test.js',
  'node tests/runtime-recovery-webkit-test.js'
]) assert(iphoneJob.includes(command), `iPhone job must retain ${command}`);
for (const artifactPath of [
  'artifacts/iphone-webkit-smoke', 'artifacts/game-over-settings-webkit', 'artifacts/d-ui-webkit',
  'artifacts/ceo-dashboard-webkit', 'artifacts/founding-tutorial-webkit',
  'artifacts/iphone-playtest-remediation', 'artifacts/physical-iphone-playtest'
]) assert(iphoneJob.includes(artifactPath), `iPhone job must retain ${artifactPath}`);
assert.match(iphoneJob, /actions\/upload-artifact@v4/);
assert.match(iphoneJob, /name: iphone-webkit-smoke-\$\{\{ github\.sha \}\}/);
assert.match(iphoneJob, /if: always\(\)/);
assert.match(iphoneJob, /if-no-files-found: error/);
assert.match(iphoneJob, /retention-days: 30/);

assert.match(smoke, /const \{ webkit, devices \} = require\('playwright'\)/);
assert.match(smoke, /require\('\.\.\/release-candidate\.json'\)/);
assert.match(smoke, /DEVICE_NAME = 'iPhone 13'/);
assert.match(smoke, /TARGET_ENV = 'IPHONE_WEBKIT_TARGET_URL'/);
assert.match(smoke, /await webkit\.launch\(\)/);
assert.match(smoke, /serviceWorkers: 'block'/);
assert.match(smoke, /#setup-form/);
assert.match(smoke, /data-setup-recovery/);
assert.match(smoke, /advance-week/);
assert.match(smoke, /advance-4/);
assert.match(smoke, /waitForEvent\('download'\)/);
assert.match(smoke, /reset-game/);
assert.match(smoke, /confirm-reset/);
assert.match(smoke, /setInputFiles/);
assert.match(smoke, /documentScrollWidth/);
assert.match(smoke, /overflowX/);
assert.match(smoke, /pageErrors/);
assert.match(smoke, /consoleErrors/);
assert.match(smoke, /requiredAssetServerErrors/);
assert.match(retryPolicy, /status < 500 \|\| status > 599/,
  'published retry must be limited to HTTP 5xx');
assert.match(retryPolicy, /new Set\(\['document', 'script', 'stylesheet'\]\)/,
  'published retry must be limited to required asset types');
assert.match(retryPolicy, /new URL\(responseUrl\)\.origin === new URL\(targetUrl\)\.origin/,
  'published retry must be limited to the deployment origin');
assert.match(retryPolicy, /const MAX_ATTEMPTS = 2/,
  'published retry must allow at most one retry');
assert.match(retryPolicy, /published === true && attempt === 1 && diagnostics\.requiredAssetServerErrors\.length > 0/,
  'only a first-attempt published required-asset 5xx may retry');
assert.match(smoke, /runWithPublishedRetry/, 'generic WebKit smoke must use the shared retry policy');
assert.match(smoke, /published-pages/);
assert.match(smoke, /must use the release-candidate deployment origin/);
assert.match(smoke, /must use the release-candidate deployment path/);
assert.match(smoke, /must not include a query string/);
assert.match(smoke, /must not include a fragment/);
assert.doesNotMatch(smoke, /chromium|firefox/, 'release mobile smoke must exercise WebKit only');

const appCssIndex = index.indexOf('./css/app.css');
const mobileCssIndex = index.indexOf('./css/mobile-release.css');
assert.ok(appCssIndex >= 0, 'base application stylesheet must remain linked');
assert.ok(mobileCssIndex > appCssIndex, 'mobile release overrides must load after app.css');
assert.match(mobileCss, /@media\(max-width:720px\)/);
assert.match(mobileCss, /\.week-controls \.secondary\s*\{[^}]*display:inline-flex/,
  'four-week control must remain visible at iPhone widths');
assert.doesNotMatch(mobileCss, /\.week-controls \.secondary\s*\{[^}]*display:none/,
  'mobile release override must never hide the four-week control');

assert.match(pagesWorkflow, /^name: Pages Deployment Smoke$/m);
assert.match(pagesWorkflow, /^  push:$/m);
assert.match(pagesWorkflow, /branches: \[ main \]/);
assert.match(pagesWorkflow, /^  contents: read$/m, 'published smoke must keep read-only repository permissions');
assert.match(pagesWorkflow, deploymentUrlPattern, 'published workflow must target the release-candidate deployment URL');
assert.match(pagesWorkflow, /IPHONE_WEBKIT_TARGET_URL/);
assert.match(pagesWorkflow, /artifacts\/published-iphone-webkit-smoke/);
assert.match(pagesWorkflow, /published-iphone-webkit-smoke-\$\{\{ github\.sha \}\}/);
assert.match(pagesWorkflow, /npm install --no-save --no-package-lock playwright@1\.61\.0/);
assert.match(pagesWorkflow, /npx playwright install --with-deps webkit/);
const pagesBytesIndex = pagesWorkflow.indexOf('node scripts/pages-deployment-smoke.js');
const pagesInstallIndex = pagesWorkflow.indexOf('npm install --no-save --no-package-lock playwright@1.61.0');
const pagesWebKitIndex = pagesWorkflow.indexOf('node tests/iphone-webkit-smoke-test.js');
assert.ok(pagesBytesIndex >= 0, 'published assets must be attested');
assert.ok(pagesInstallIndex > pagesBytesIndex, 'browser install must occur only after published bytes match main');
assert.ok(pagesWebKitIndex > pagesInstallIndex, 'published WebKit smoke must follow browser installation');

const installIndex = tagWorkflow.indexOf('npm install --no-save --no-package-lock playwright@1.61.0');
const localSmokeIndex = tagWorkflow.indexOf('node tests/iphone-webkit-smoke-test.js');
const pagesIndex = tagWorkflow.indexOf('node scripts/pages-deployment-smoke.js');
const publishedTargetIndex = tagWorkflow.indexOf('IPHONE_WEBKIT_TARGET_URL');
const publishedSmokeIndex = tagWorkflow.lastIndexOf('node tests/iphone-webkit-smoke-test.js');
const tagIndex = tagWorkflow.indexOf('git tag -a');
assert.equal(count(tagWorkflow, 'node tests/iphone-webkit-smoke-test.js'), 2,
  'tag workflow must run both local and published WebKit smoke');
assert.ok(installIndex >= 0, 'tag workflow must install pinned Playwright');
assert.ok(localSmokeIndex > installIndex, 'local WebKit smoke must run after installing Playwright');
assert.ok(pagesIndex > localSmokeIndex, 'published Pages verification must follow local WebKit smoke');
assert.ok(publishedTargetIndex > pagesIndex, 'published WebKit target must be configured after byte attestation');
assert.ok(publishedSmokeIndex > publishedTargetIndex, 'published WebKit smoke must use the configured deployment target');
assert.ok(tagIndex > publishedSmokeIndex, 'tag creation must remain after both WebKit paths');
assert.match(tagWorkflow, deploymentUrlPattern, 'tag workflow must test the manifest deployment URL');
assert.match(tagWorkflow, /release-candidate-published-webkit-\$\{\{ github\.sha \}\}/);

assert.match(deliveryGate, /tests\/iphone-webkit-smoke-contract-test\.js/,
  'canonical release delivery gate must protect the WebKit workflow contract');

console.log('iPhone WebKit smoke contract passed');
