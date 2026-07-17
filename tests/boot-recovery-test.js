'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, createBrowserContext } = require('./harness');

const file = path.join(ROOT, 'js', 'boot-recovery.js');
const source = fs.readFileSync(file, 'utf8');
assert.doesNotMatch(source, /localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/,
  'boot recovery must never mutate save storage');
assert.doesNotMatch(source.slice(source.indexOf('function onError('), source.indexOf('function onRejection(')), /preventDefault/,
  'boot error listener must not suppress browser errors');

const raw = JSON.stringify({ week: 12, companyName: 'Private Boot Co', companyCash: 7654321 });
const ctx = createBrowserContext({ localStorageInitial: { capitalism_tycoon_web_v1: raw } });
ctx.location.href = 'https://yutaro-j31.github.io/capitalism-tycoon-web/index.html?old=1#stale';
vm.runInContext(source, ctx, { filename: 'boot-recovery.js' });
const boot = vm.runInContext("globalThis[Symbol.for('capitalismTycoon.bootRecovery')]", ctx);
assert.ok(boot?.__installed, 'boot recovery symbol API missing');
assert.equal(boot.SAVE_KEY, 'capitalism_tycoon_web_v1');
for (const name of ['record','readSave','launchUrl','render','show','dismiss','capture','download','handoff','bridge','install']) {
  assert.equal(typeof boot[name], 'function', `${name} export missing`);
}

const record = boot.record(new Error(' <early failure>\nblocked '), {
  kind: 'resource',
  source: 'https://yutaro-j31.github.io/capitalism-tycoon-web/js/runtime.js?cache=old',
  line: 4
}, ctx);
assert.equal(record.message, '<early failure> blocked');
assert.equal(record.source, '/capitalism-tycoon-web/js/runtime.js');
assert.equal(record.line, 4);
assert.equal(Object.isFrozen(record), true);

const save = boot.readSave(ctx);
assert.equal(save.raw, raw);
assert.equal(save.week, 12);
assert.equal(ctx.__localStorageHistory.setItem.length, 0);
assert.equal(ctx.__localStorageHistory.removeItem.length, 0);

const restart = new URL(boot.launchUrl(ctx));
assert.equal(restart.origin, 'https://yutaro-j31.github.io');
assert.equal(restart.pathname, '/capitalism-tycoon-web/play.html');
assert.equal(restart.searchParams.has('reload'), true);
assert.equal(restart.hash, '');
assert.equal(restart.searchParams.has('old'), false);

const panel = boot.render(record, ctx);
assert.match(panel, /起動エラーから復旧/);
assert.match(panel, /最新版で再起動/);
assert.match(panel, /JSONバックアップ/);
assert.doesNotMatch(panel, /<early failure>/);
assert.match(panel, /&lt;early failure&gt;/);
assert.match(panel, /safe-area-inset-top/);
assert.match(panel, /min-height:44px/);

let clicked = false;
let blob = null;
let link = null;
class BlobStub { constructor(parts, options) { this.parts = parts; this.type = options?.type; blob = this; } }
const downloadEnv = {
  localStorage: { getItem(key) { assert.equal(key, boot.SAVE_KEY); return raw; } },
  Blob: BlobStub,
  URL: { createObjectURL() { return 'blob:boot'; }, revokeObjectURL() {} },
  document: { createElement(tag) { assert.equal(tag, 'a'); link = { click() { clicked = true; } }; return link; } }
};
assert.equal(boot.download(downloadEnv), true);
assert.equal(clicked, true);
assert.equal(link.download, 'capitalism-tycoon-boot-recovery-week-12.json');
assert.equal(blob.parts.length, 1);
assert.equal(String(blob.parts[0]), raw);
assert.equal(blob.type, 'application/json');

const root = ctx.document.getElementById(boot.ROOT_ID);
assert.equal(boot.show(record, ctx), true);
assert.match(root.innerHTML, /起動エラーから復旧/);
assert.equal(root.hidden, false);
assert.equal(boot.dismiss(ctx), true);
assert.equal(root.hidden, true);

let handed = null;
ctx.__capitalismTycoonModules = {
  runtimeRecoveryUI: {
    __installed: true,
    capture(error, meta, env) { handed = { error, meta, env }; return true; }
  }
};
assert.equal(boot.capture(new Error('handoff probe'), { kind: 'error', source: '/js/data.js', line: 8 }, ctx), true);
assert.equal(boot.bridge(ctx), true);
assert.equal(handed.error.message, 'handoff probe');
assert.equal(handed.meta.source, '/js/data.js');
assert.equal(handed.meta.line, 8);
assert.equal(handed.env, ctx);
assert.equal(root.hidden, true);
assert.equal(boot.capture(new Error('after handoff'), {}, ctx), false);

console.log('boot recovery contract passed');
