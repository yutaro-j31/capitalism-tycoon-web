'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readIndex, extractScripts } = require('./harness');

const html = readIndex();
const scripts = extractScripts(html);
const bridge = scripts.find(script => !script.src && script.attrs.includes('data-game-over-settings-bridge'));
assert.ok(bridge, 'game-over settings bridge must be present in index.html');
assert.ok(bridge.code.trim().length <= 700, 'game-over settings bridge must remain a small inline script');
assert.match(bridge.code, /\.game-over/, 'bridge must target the bankruptcy overlay');
assert.match(bridge.code, /button\[data-action="save-now"\]/, 'bridge must only unlock the settings screen');
assert.match(bridge.code, /registerUIEnhancer\(\{id:'game-over-settings-bridge'/, 'bridge must survive settings rerenders through the central enhancer pipeline');
assert.doesNotMatch(bridge.code, /MutationObserver/, 'bridge must not create an observer-driven rerender loop');
assert.match(bridge.code, /o&&s\)o\.remove\(\)/, 'bridge must remove the blocking overlay only when settings are visible');
assert.doesNotMatch(bridge.code, /localStorage|SAVE_KEY|saveVersion|gameOver\s*=/,
  'bridge must not rewrite save data, schema, or bankruptcy state');

const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'iphone-webkit-smoke.yml'), 'utf8');
const browserTest = fs.readFileSync(path.join(ROOT, 'tests', 'game-over-settings-webkit-test.js'), 'utf8');
assert.match(workflow, /node tests\/game-over-settings-webkit-test\.js/,
  'iPhone WebKit workflow must execute the bankruptcy settings regression');
assert.match(workflow, /artifacts\/game-over-settings-webkit/,
  'iPhone WebKit workflow must retain bankruptcy settings evidence');
assert.match(browserTest, /state\.gameOver = true/);
assert.match(browserTest, /state\.selectedTab = 'home'/);
assert.match(browserTest, /gameOver\.waitFor\(\{ state: 'detached'/,
  'browser regression must prove that the overlay disappears');
assert.match(browserTest, /button\[data-action="save-now"\]/,
  'browser regression must prove that settings controls are reachable');
assert.match(browserTest, /saved\.selectedTab, 'settings'/,
  'browser regression must prove that the tab change is persisted');
assert.match(browserTest, /saved\.gameOver, true/,
  'browser regression must preserve the bankruptcy state');

console.log('game-over settings UI checks passed');
