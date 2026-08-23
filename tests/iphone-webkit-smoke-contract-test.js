'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (text, token) => text.split(token).length - 1;
const workflow = read('.github/workflows/iphone-webkit-smoke.yml');
const pagesWorkflow = read('.github/workflows/pages-deployment-smoke.yml');
const tagWorkflow = read('.github/workflows/release-candidate-tag.yml');
const smoke = read('tests/iphone-webkit-smoke-test.js');
const deliveryGate = read('scripts/release-delivery-gate.js');
const index = read('index.html');
const mobileCss = read('css/mobile-release.css');
const releaseCandidate = JSON.parse(read('release-candidate.json'));
const deploymentUrlPattern = new RegExp(escapeRegExp(releaseCandidate.deployment.url));

assert.match(workflow, /^name: iPhone WebKit Smoke$/m);
assert.doesNotMatch(workflow, /^  pull_request:$/m, 'WebKit smoke must not consume pull-request runners');
assert.match(workflow, /^  push:$/m, 'WebKit smoke must run after main updates');
assert.match(workflow, /^    branches: \[main\]$/m, 'WebKit smoke push trigger must target main');
assert.match(workflow, /^  schedule:$/m, 'WebKit smoke must retain nightly coverage');
assert.match(workflow, /^    - cron: '[^']+'$/m, 'WebKit smoke must define a nightly cron');
assert.match(workflow, /^  workflow_dispatch:$/m, 'WebKit smoke must remain manually runnable');
assert.match(workflow, /^  contents: read$/m, 'WebKit smoke must use read-only contents permission');
assert.match(workflow, /npm install --no-save --no-package-lock playwright@1\.61\.0/);
assert.match(workflow, /npx playwright install --with-deps webkit/);
assert.match(workflow, /node tests\/iphone-webkit-smoke-test\.js/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(workflow, /artifacts\/iphone-webkit-smoke/);

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
assert.match(smoke, /response\.status\(\) < 500 \|\| response\.status\(\) > 599/,
  'published retry must be limited to HTTP 5xx');
assert.match(smoke, /\['document', 'script', 'stylesheet'\]\.includes\(resourceType\)/,
  'published retry must be limited to required asset types');
assert.match(smoke, /new URL\(response\.url\(\)\)\.origin !== new URL\(publishedUrl\)\.origin/,
  'published retry must be limited to the deployment origin');
assert.match(smoke, /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/,
  'published retry must allow at most one retry');
assert.match(smoke, /attempt === 1 && error\?\.retryablePublishedAsset5xx === true/,
  'only a first-attempt published required-asset 5xx may retry');
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
