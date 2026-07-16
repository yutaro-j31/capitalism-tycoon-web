'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const bridge = read('js/player-engine-bridge.js');
const creditorUI = read('js/player-crisis-creditor-ui.js');
const turnaroundUI = read('js/player-turnaround-plan-ui.js');
const workflow = read('.github/workflows/iphone-webkit-smoke.yml');
const regression = read('tests/two-store-iphone-webkit-test.js');

assert.match(bridge, /AppleWebKit/i, 'yield must be limited to WebKit browsers');
assert.match(bridge, /type!==['"]week['"]/, 'non-week engine events must remain synchronous');
assert.match(bridge, /setTimeout\(\(\)=>\{/, 'week event delivery must yield beyond the active tap task');
assert.match(bridge, /if\(timer\)return true/, 'rapid week events must be coalesced');
assert.match(bridge, /baseEmit\(['"]week['"],nextDetail\|\|\{\}\)/, 'deferred delivery must use the canonical engine event method');
assert.match(bridge, /__webkitWeekYieldInstalled/, 'installation must be idempotent');
assert.match(bridge, /installWebKitWeekYield/, 'the bridge must expose focused installation for tests and diagnostics');
assert.doesNotMatch(bridge, /localStorage|SAVE_KEY|saveVersion|companyCash/, 'the bridge must not read or mutate save state');

for (const [label, source, marker] of [
  ['creditor', creditorUI, 'data-player-crisis-creditor-standalone'],
  ['turnaround', turnaroundUI, 'data-player-turnaround-standalone']
]) {
  assert.match(source, /function sameMarkup\(node,html\)/, `${label} UI must compare existing markup before mutation`);
  assert.match(source, /if\(sameMarkup\(existing,desired\)\)return false/, `${label} UI observer must be idempotent`);
  assert.ok(source.includes(marker), `${label} UI must use a standalone marker`);
  assert.match(source, /panel\.insertAdjacentHTML\(['"]afterend['"],desired\)/,
    `${label} UI must compose outside the canonical crisis panel`);
  assert.doesNotMatch(source, /querySelector\(['"]#player-crisis-panel \.card-body['"]\)/,
    `${label} UI must not rewrite the crisis panel body`);
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

console.log('WebKit week event and crisis observer contracts passed');
