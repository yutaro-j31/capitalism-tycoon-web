'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadGame } = require('./harness');

const source = fs.readFileSync(path.join(ROOT, 'js', 'playtest-report-ui.js'), 'utf8');
assert.doesNotMatch(source, /localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/,
  'playtest reporting must never mutate save storage');
assert.doesNotMatch(source, /companyName|playerName|companyCash|personalCash|stores/,
  'playtest report source must not read private game fields');

const privateSave = JSON.stringify({
  version: 9,
  week: 18,
  companyName: '秘密商事',
  playerName: '秘密の創業者',
  companyCash: 987654321,
  personalCash: 123456789,
  stores: [{ name: '秘密店舗' }]
});
const { modules } = loadGame({ localStorageInitial: { capitalism_tycoon_web_v1: privateSave } });
const reportUI = modules.playtestReportUI;
assert.ok(reportUI?.__installed, 'playtest report module must install');
for (const name of [
  'safeToken','utf8Bytes','checksum','record','activeTab','saveFingerprint','viewport',
  'buildReport','filename','download','enhance','handleClick','handleChange','handleSubmit','install'
]) assert.equal(typeof reportUI[name], 'function', `${name} export missing`);
assert.equal(reportUI.SCHEMA_VERSION, 1);
assert.equal(reportUI.KIND, 'capitalism-tycoon-playtest-report');
assert.equal(reportUI.MAX_ACTIONS, 30);

assert.equal(reportUI.safeToken('Advance-Week'), 'advance-week');
assert.equal(reportUI.safeToken('秘密会社'), '');
assert.equal(reportUI.safeToken('contains space'), '');
assert.equal(reportUI.utf8Bytes('Aあ😀'), 8);
assert.match(reportUI.checksum(privateSave), /^fnv1a32-[0-9a-f]{8}$/);
assert.equal(reportUI.checksum(privateSave), reportUI.checksum(privateSave));

for (let i = 0; i < 35; i++) reportUI.record(`test-action-${i}`, { source: 'click', tab: i % 2 ? 'map' : 'home' }, i + 1);
reportUI.record('setting-change', { source: 'change', binding: 'reducedmotion' }, 100);

const env = {
  location: {
    href: 'https://yutaro-j31.github.io/capitalism-tycoon-web/play.html',
    pathname: '/capitalism-tycoon-web/play.html'
  },
  navigator: { userAgent: 'iPhone playtest', onLine: true },
  localStorage: { getItem(key) { assert.equal(key, 'capitalism_tycoon_web_v1'); return privateSave; } },
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  screen: { orientation: { type: 'portrait-primary' } },
  document: {
    visibilityState: 'visible',
    querySelector(selector) {
      if (selector === '.tabs button.active') return { dataset: { tab: 'settings' } };
      return null;
    }
  }
};
const report = reportUI.buildReport(env);
assert.equal(report.schemaVersion, 1);
assert.equal(report.kind, reportUI.KIND);
assert.equal(report.diagnostics.week, 18);
assert.equal(report.activeTab, 'settings');
assert.deepEqual({ ...report.viewport }, { width: 390, height: 844, devicePixelRatio: 3, orientation: 'portrait-primary' });
assert.equal(report.save.present, true);
assert.equal(report.save.readable, true);
assert.equal(report.save.bytes, reportUI.utf8Bytes(privateSave));
assert.match(report.save.checksum, /^fnv1a32-/);
assert.equal(report.recentActions.length, reportUI.MAX_ACTIONS);
assert.equal(report.recentActions.at(-1).binding, 'reducedmotion');

const text = JSON.stringify(report);
for (const forbidden of ['秘密商事', '秘密の創業者', '秘密店舗', '987654321', '123456789', 'companyCash', 'personalCash', 'stores']) {
  assert.equal(text.includes(forbidden), false, `playtest report leaked ${forbidden}`);
}

let clicked = false;
let revoked = '';
let link = null;
let blob = null;
class BlobStub { constructor(parts, options) { this.parts = parts; this.type = options?.type; blob = this; } }
const downloadEnv = {
  ...env,
  Blob: BlobStub,
  URL: {
    createObjectURL() { return 'blob:playtest-report'; },
    revokeObjectURL(value) { revoked = value; }
  },
  document: {
    ...env.document,
    createElement(tag) {
      assert.equal(tag, 'a');
      link = { click() { clicked = true; } };
      return link;
    }
  }
};
assert.equal(reportUI.download(downloadEnv), true);
assert.equal(clicked, true);
assert.match(link.download, /^capitalism-tycoon-playtest-week-18-/);
assert.equal(blob.type, 'application/json');
const downloaded = JSON.parse(String(blob.parts[0]));
assert.equal(downloaded.kind, reportUI.KIND);
assert.equal(JSON.stringify(downloaded).includes('秘密商事'), false);

const appended = [];
const grid = { appendChild(node) { appended.push(node); } };
const card = {
  querySelector(selector) {
    if (selector === '[data-playtest-report-button]') return null;
    if (selector === '.button-grid') return grid;
    return null;
  }
};
const enhanceEnv = {
  document: {
    querySelector(selector) { return selector === '[data-release-diagnostics-card]' ? card : null; },
    createElement() { return { setAttribute(k, v) { this[k] = v; }, dataset: {} }; }
  }
};
assert.equal(reportUI.enhance(enhanceEnv), true);
assert.equal(appended.length, 1);
assert.equal(appended[0]['data-playtest-report-action'], 'download');
assert.equal(appended[0].textContent, '不具合報告ファイルを保存');

const clickTarget = {
  dataset: { action: 'tab', tab: 'rivals' },
  closest(selector) { return selector.includes('data-action') ? this : null; }
};
assert.equal(reportUI.handleClick({ target: clickTarget }, env), true);
const afterClick = reportUI.buildReport(env);
assert.equal(afterClick.recentActions.at(-1).action, 'tab');
assert.equal(afterClick.recentActions.at(-1).tab, 'rivals');

const changeTarget = { dataset: { bind: 'strategyTab', value: 'private-input-must-not-leak' }, closest() { return this; } };
assert.equal(reportUI.handleChange({ target: changeTarget }), true);
const afterChange = JSON.stringify(reportUI.buildReport(env));
assert.equal(afterChange.includes('private-input-must-not-leak'), false);
assert.equal(reportUI.handleSubmit({ target: { id: 'setup-form' } }), true);

setTimeout(() => {
  assert.equal(revoked, 'blob:playtest-report');
  console.log('playtest report UI tests passed');
}, 1100);
