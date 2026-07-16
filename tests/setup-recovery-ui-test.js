'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadGame } = require('./harness');

const recoverySource = fs.readFileSync(path.join(ROOT, 'js', 'setup-recovery.js'), 'utf8');
const count = (text, token) => text.split(token).length - 1;

function appHtml(ctx) {
  return ctx.document.getElementById('app').innerHTML;
}

{
  const { ctx } = loadGame();
  const html = appHtml(ctx);
  assert.match(html, /id="setup-form"/, 'fresh boot must show the founder setup form');
  assert.match(html, /data-setup-recovery/, 'fresh boot must expose setup recovery');
  assert.match(html, /data-action="import-save"/, 'setup recovery must use the canonical import action');
  assert.match(html, /id="import-file"[^>]*accept="application\/json,\.json"/, 'setup recovery must provide a JSON file input');
  assert.equal(count(html, 'id="import-file"'), 1, 'fresh setup must expose exactly one import input');
  assert.match(html, /新しく創業せずにここから復旧できます/, 'recovery purpose must be explicit');
}

{
  const broken = '{ broken save';
  const { ctx, engineModule } = loadGame({
    localStorageInitial: { capitalism_tycoon_web_v1: broken }
  });
  const html = appHtml(ctx);
  assert.match(html, /data-setup-recovery/, 'corrupt startup fallback must keep JSON recovery reachable');
  assert.equal(ctx.__localStorageData.get(engineModule.SAVE_KEY), broken, 'recovery UI must not overwrite corrupt save bytes');
  assert.equal(ctx.__localStorageHistory.setItem.length, 0, 'recovery UI must not write localStorage during render');
}

{
  const builder = loadGame();
  const { TycoonEngine, SAVE_KEY } = builder.engineModule;
  const configuredEngine = new TycoonEngine();
  configuredEngine.configure({
    playerName: 'Recovery Tester',
    companyName: 'Recovery Holdings',
    difficulty: 'normal',
    scenario: 'free'
  });
  configuredEngine.g.selectedTab = 'settings';
  const payload = JSON.stringify(configuredEngine.g);
  const { ctx } = loadGame({ localStorageInitial: { [SAVE_KEY]: payload } });
  const html = appHtml(ctx);
  assert.doesNotMatch(html, /data-setup-recovery/, 'configured settings screen must not receive setup recovery markup');
  assert.doesNotMatch(html, /id="setup-form"/, 'configured save must bypass founder setup');
  assert.equal(count(html, 'id="import-file"'), 1, 'settings screen must retain exactly one canonical import input');
  for (const action of ['save-now', 'export-save', 'import-save', 'reset-game']) {
    assert.match(html, new RegExp(`data-action="${action}"`), `settings screen must retain ${action}`);
  }
}

assert.match(recoverySource, /typeof MutationObserver===['"]function['"]/, 'browser observer must restore recovery after reset');
assert.match(recoverySource, /app\.innerHTML\.includes\(marker\)/, 'recovery injection must be idempotent');
assert.doesNotMatch(recoverySource, /localStorage|SAVE_KEY|saveVersion/, 'recovery renderer must not mutate save storage or schema');

console.log('setup recovery UI checks passed');
