'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'founding-tutorial.yml'), 'utf8');
const webkitTestSource = fs.readFileSync(path.join(ROOT, 'tests', 'founding-tutorial-webkit-test.js'), 'utf8');

function topLevelTriggerKeys(source) {
  const lines = source.split(/\r?\n/);
  const onIndex = lines.findIndex(line => /^on:\s*$/.test(line));
  assert.notEqual(onIndex, -1, 'Founding Tutorial workflow must declare an on block');
  const keys = [];
  for (let index = onIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(line)) break;
    const match = line.match(/^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

assert.doesNotMatch(webkitTestSource, /__ct_engine/, 'browser regression must not depend on a non-production engine global');
assert.match(workflow, /^name: Founding Tutorial$/m);
assert.deepEqual(topLevelTriggerKeys(workflow), ['workflow_dispatch'], 'Founding Tutorial must remain manual-only');
assert.doesNotMatch(workflow, /^  (?:pull_request|push|schedule):\s*$/m, 'Founding Tutorial must not have an automatic trigger');
assert.match(workflow, /node-version: '22'/);
assert.match(workflow, /playwright@1\.61\.0/);
assert.match(workflow, /npx playwright install --with-deps webkit/);
assert.match(workflow, /node tests\/founding-tutorial-webkit-test\.js/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(workflow, /SAVE_KEY: capitalism_tycoon_web_v1/);
assert.match(workflow, /SAVE_VERSION: '9'/);

for (const command of [
  'npm run test:founding-tutorial',
  'npm run test:ceo-dashboard',
  'npm run test:weekly-impact',
  'npm run test:syntax',
  'npm run test:javascript',
  'npm run test:modules',
  'npm run test:static',
  'npm run test:css',
]) {
  assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

console.log('founding tutorial workflow contract passed');
