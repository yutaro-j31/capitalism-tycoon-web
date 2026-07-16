'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const workflow = read('.github/workflows/iphone-webkit-smoke.yml');
const tagWorkflow = read('.github/workflows/release-candidate-tag.yml');
const smoke = read('tests/iphone-webkit-smoke-test.js');
const deliveryGate = read('scripts/release-delivery-gate.js');

assert.match(workflow, /^name: iPhone WebKit Smoke$/m);
assert.match(workflow, /^  pull_request:$/m, 'WebKit smoke must run for pull requests');
assert.match(workflow, /^  workflow_dispatch:$/m, 'WebKit smoke must remain manually runnable');
assert.match(workflow, /^  contents: read$/m, 'WebKit smoke must use read-only contents permission');
assert.match(workflow, /npm install --no-save --no-package-lock playwright@1\.61\.0/);
assert.match(workflow, /npx playwright install --with-deps webkit/);
assert.match(workflow, /node tests\/iphone-webkit-smoke-test\.js/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(workflow, /artifacts\/iphone-webkit-smoke/);

assert.match(smoke, /const \{ webkit, devices \} = require\('playwright'\)/);
assert.match(smoke, /DEVICE_NAME = 'iPhone 13'/);
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
assert.doesNotMatch(smoke, /chromium|firefox/, 'release mobile smoke must exercise WebKit only');

const installIndex = tagWorkflow.indexOf('npm install --no-save --no-package-lock playwright@1.61.0');
const smokeIndex = tagWorkflow.indexOf('node tests/iphone-webkit-smoke-test.js');
const pagesIndex = tagWorkflow.indexOf('node scripts/pages-deployment-smoke.js');
const tagIndex = tagWorkflow.indexOf('git tag -a');
assert.ok(installIndex >= 0, 'tag workflow must install pinned Playwright');
assert.ok(smokeIndex > installIndex, 'tag workflow must run WebKit smoke after installing Playwright');
assert.ok(pagesIndex > smokeIndex, 'published Pages verification must follow local WebKit smoke');
assert.ok(tagIndex > pagesIndex, 'tag creation must remain the final release step');

assert.match(deliveryGate, /tests\/iphone-webkit-smoke-contract-test\.js/,
  'canonical release delivery gate must protect the WebKit workflow contract');

console.log('iPhone WebKit smoke contract passed');
