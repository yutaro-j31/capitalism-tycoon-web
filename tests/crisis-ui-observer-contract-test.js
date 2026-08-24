'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const crisisUI = read('js/player-crisis-ui.js');
const creditorUI = read('js/player-crisis-creditor-ui.js');
const turnaroundUI = read('js/player-turnaround-plan-ui.js');
const workflow = read('.github/workflows/test.yml');
const regression = read('tests/two-store-iphone-webkit-test.js');

assert.match(crisisUI, /function renderKey\(html\)/, 'canonical crisis UI must derive a stable render key');
assert.match(crisisUI, /data-player-crisis-render-key/, 'canonical crisis panel must retain its render key in the DOM');
assert.match(crisisUI, /if\(currentKey===key\)/, 'canonical crisis observer must stop when state-derived markup is unchanged');
assert.doesNotMatch(crisisUI, /if\(next===screen\.innerHTML\)/,
  'canonical crisis observer must not rely on browser-normalized innerHTML equality');

for (const [label, source, marker, keyMarker] of [
  ['creditor', creditorUI, 'data-player-crisis-creditor-standalone', 'data-player-crisis-creditor-render-key'],
  ['turnaround', turnaroundUI, 'data-player-turnaround-standalone', 'data-player-turnaround-render-key']
]) {
  assert.match(source, /function renderKey\(html\)/, `${label} UI must derive a stable render key`);
  assert.match(source, /function existingRenderKey\(node\)/, `${label} UI must read the persisted render key`);
  assert.match(source, /if\(existingRenderKey\(existing\)===key\)return false/,
    `${label} observer must stop before mutating identical content`);
  assert.ok(source.includes(marker), `${label} UI must use a standalone marker`);
  assert.ok(source.includes(keyMarker), `${label} UI must persist a render key`);
  assert.match(source, /panel\.insertAdjacentHTML\(['"]afterend['"],desired\)/,
    `${label} UI must compose outside the canonical crisis panel`);
  assert.doesNotMatch(source, /querySelector\(['"]#player-crisis-panel \.card-body['"]\)/,
    `${label} UI must not rewrite the canonical crisis panel body`);
  assert.doesNotMatch(source, /outerHTML===html/,
    `${label} UI must not compare browser-normalized outerHTML with source markup`);
}

assert.match(workflow, /Verify two-store first-week advance/);
assert.match(workflow, /node tests\/two-store-iphone-webkit-test\.js/);
assert.match(regression, /new URL\(['"]play\.html['"], baseUrl\)/, 'regression must use the cache-safe launcher');
assert.match(regression, /selectOption\(['"]hard['"]\)/, 'regression must use the reported hard setup');
assert.equal((regression.match(/openTenant\(page,[^\n]+['"]ramen['"]/g) || []).length, 2,
  'regression must open two ramen stores');
assert.match(regression, /button\[data-action=\\?['"]advance-week/);
assert.match(regression, /週間経営レポート/);
assert.match(regression, /after\.week, 2/);

console.log('crisis UI stable render-key contract passed');
