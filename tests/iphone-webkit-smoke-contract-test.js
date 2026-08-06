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
const fullRegression = read('scripts/iphone-webkit-full-regression.js');
const deliveryGate = read('scripts/release-delivery-gate.js');
const index = read('index.html');
const mobileCss = read('css/mobile-release.css');
const releaseCandidate = JSON.parse(read('release-candidate.json'));
const deploymentUrlPattern = new RegExp(escapeRegExp(releaseCandidate.deployment.url));

assert.match(workflow, /^name: iPhone WebKit Smoke$/m);
assert.match(workflow, /^  pull_request:$/m, 'WebKit smoke must be a required pull-request gate');
assert.match(workflow, /^    branches: \[main\]$/m, 'WebKit smoke pull-request trigger must target main');
assert.match(workflow, /^  push:$/m, 'WebKit smoke must run after main updates');
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
assert.match(smoke, /waitUntil: 'domcontentloaded'/, 'boot smoke must not wait on networkidle');
assert.doesNotMatch(smoke, /waitUntil: 'networkidle'/, 'networkidle must not be the boot success criterion');
assert.match(smoke, /data-app-boot-state=\\?"ready/);
assert.match(smoke, /#setup-form/);
assert.match(smoke, /data-setup-recovery/);
assert.match(smoke, /advance-week/);
assert.match(smoke, /capitalism_tycoon_web_v1/);
assert.match(smoke, /saveVersion/);
assert.match(smoke, /__capitalismTycoonBootDiagnostics/);
assert.match(smoke, /pageErrors/);
assert.match(smoke, /consoleErrors/);
assert.match(smoke, /failedRequests/);
assert.match(smoke, /page\.html/);
assert.match(smoke, /iphone-webkit-smoke-failure\.png/);
assert.match(smoke, /published-pages/);
assert.match(smoke, /must use the release-candidate deployment origin/);
assert.match(smoke, /must use the release-candidate deployment path/);
assert.match(smoke, /must not include a query string/);
assert.match(smoke, /must not include a fragment/);
assert.doesNotMatch(smoke, /chromium|firefox/, 'release mobile smoke must exercise WebKit only');

assert.match(fullRegression, /waitForEvent\('download'\)/, 'the former full smoke must remain available for staged restoration');
assert.match(fullRegression, /setInputFiles/);
assert.match(fullRegression, /reset-game/);

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
assert.ok(installIndex >= 0 && localSmokeIndex > installIndex);
assert.ok(pagesIndex > localSmokeIndex);
assert.ok(publishedTargetIndex > pagesIndex);
assert.ok(publishedSmokeIndex > publishedTargetIndex);
assert.ok(tagIndex > publishedSmokeIndex);
assert.match(tagWorkflow, deploymentUrlPattern);

assert.match(deliveryGate, /tests\/iphone-webkit-smoke-contract-test\.js/,
  'canonical release delivery gate must protect the WebKit workflow contract');

console.log('iPhone WebKit smoke contract passed');
