'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const workflowRoot = path.join(ROOT, '.github', 'workflows');
const iphoneWorkflow = fs.readFileSync(path.join(workflowRoot, 'test.yml'), 'utf8');
const runAllSource = fs.readFileSync(path.join(ROOT, 'tests', 'run-all.js'), 'utf8');
const webkitTestSource = fs.readFileSync(path.join(ROOT, 'tests', 'founding-tutorial-webkit-test.js'), 'utf8');

assert.equal(fs.existsSync(path.join(workflowRoot, 'founding-tutorial.yml')), false, 'dedicated Founding Tutorial workflow must remain consolidated');
assert.equal(fs.existsSync(path.join(workflowRoot, 'ceo-dashboard.yml')), false, 'dedicated CEO Dashboard workflow must remain consolidated');

for (const command of [
  'node tests/ceo-dashboard-webkit-test.js',
  'node tests/founding-tutorial-webkit-test.js',
  'playwright@1.61.0',
  'npx playwright install --with-deps webkit',
  'artifacts/ceo-dashboard-webkit',
  'artifacts/founding-tutorial-webkit',
]) {
  assert.match(iphoneWorkflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `iPhone WebKit Smoke must retain ${command}`);
}
for (const command of ['test:ceo-dashboard', 'test:weekly-impact', 'test:founding-tutorial']) {
  assert.match(runAllSource, new RegExp(`['\"]${command}['\"]`), `canonical run-all must retain ${command}`);
}
assert.doesNotMatch(webkitTestSource, /__ct_engine/, 'browser regression must not depend on a non-production engine global');
assert.match(webkitTestSource, /SAVE_KEY = 'capitalism_tycoon_web_v1'/, 'browser regression must retain the published save key');
assert.match(webkitTestSource, /SAVE_VERSION = 9/, 'browser regression must retain save version 9');

console.log('founding and CEO consolidated executor contract passed');
