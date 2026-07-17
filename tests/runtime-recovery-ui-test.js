'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadGame } = require('./harness');

const source = fs.readFileSync(path.join(ROOT, 'js', 'runtime-recovery-ui.js'), 'utf8');
assert.doesNotMatch(source, /localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/,
  'runtime recovery must never mutate save storage');
for (const listener of ['onError', 'onRejection']) {
  const match = source.match(new RegExp(`function ${listener}\\([^)]*\\)\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `${listener} listener missing`);
  assert.doesNotMatch(match[1], /preventDefault\?\.\(\)|preventDefault\(\)/,
    `${listener} must not suppress the original error`);
}

const { modules } = loadGame();
const recovery = modules.runtimeRecoveryUI;
assert.ok(recovery?.__installed, 'runtime recovery module must install');
for (const name of [
  'buildRecord','readSave','supportPayload','backupFilename','downloadBackup',
  'renderPanel','show','close','capture','handleClick','install'
]) assert.equal(typeof recovery[name], 'function', `${name} export missing`);
assert.equal(recovery.SAVE_KEY, 'capitalism_tycoon_web_v1');

const record = recovery.buildRecord(new Error('  <broken>\nrender failed  '), {
  kind: 'error', source: 'https://yutaro-j31.github.io/capitalism-tycoon-web/js/app.js?old=1', line: 42, column: 7
});
assert.equal(record.message, '<broken> render failed');
assert.equal(record.source, '/capitalism-tycoon-web/js/app.js');
assert.equal(record.line, 42);
assert.equal(record.column, 7);
assert.equal(Object.isFrozen(record), true);

const raw = JSON.stringify({ week: 27, companyName: 'Private Co', companyCash: 123456789, stores: [{ name: 'Secret' }] });
let reads = 0;
const env = {
  location: { href: 'https://yutaro-j31.github.io/capitalism-tycoon-web/play.html', pathname: '/capitalism-tycoon-web/play.html' },
  navigator: { userAgent: 'iPhone test', onLine: true },
  localStorage: { getItem(key) { reads++; assert.equal(key, recovery.SAVE_KEY); return raw; } }
};
const save = recovery.readSave(env);
assert.equal(reads, 1);
assert.equal(save.raw, raw);
assert.equal(save.state.week, 27);
assert.equal(save.error, null);

const payload = recovery.supportPayload(record, env);
assert.equal(payload.week, 27);
assert.equal(payload.runtimeError.message, '<broken> render failed');
assert.equal(payload.runtimeError.source, '/capitalism-tycoon-web/js/app.js');
const payloadText = JSON.stringify(payload);
for (const forbidden of ['Private Co', '123456789', 'Secret', 'companyCash', 'stores']) {
  assert.equal(payloadText.includes(forbidden), false, `support payload leaked ${forbidden}`);
}

const panel = recovery.renderPanel(record, env);
assert.match(panel, /エラーから復旧/);
assert.match(panel, /JSONバックアップ/);
assert.ok(!panel.includes('<broken>'), 'runtime message must be HTML escaped');
assert.match(panel, /&lt;broken&gt;/);

let clicked = false;
let revoked = '';
let createdBlob = null;
let link = null;
class BlobStub { constructor(parts, options) { this.parts = parts; this.type = options?.type; createdBlob = this; } }
const downloadEnv = {
  localStorage: env.localStorage,
  Blob: BlobStub,
  URL: { createObjectURL() { return 'blob:recovery'; }, revokeObjectURL(value) { revoked = value; } },
  document: { createElement(tag) { assert.equal(tag, 'a'); link = { click() { clicked = true; } }; return link; } }
};
assert.equal(recovery.downloadBackup(downloadEnv), true);
assert.equal(clicked, true);
assert.equal(link.download, 'capitalism-tycoon-recovery-week-27.json');
assert.deepEqual(createdBlob.parts, [raw]);
assert.equal(createdBlob.type, 'application/json');

const corrupt = recovery.readSave({ localStorage: { getItem() { return '{bad'; } } });
assert.equal(corrupt.raw, '{bad');
assert.equal(corrupt.state, null);
assert.equal(typeof corrupt.error, 'string');
assert.equal(recovery.backupFilename(corrupt), 'capitalism-tycoon-recovery-week-unknown.json');

const root = { innerHTML: '', hidden: true, __runtimeRecoveryRecord: null };
const captureEnv = {
  ...env,
  document: { getElementById(id) { assert.equal(id, recovery.ROOT_ID); return root; } }
};
assert.equal(recovery.capture(new Error('unique recovery error'), { source: '/js/app.js', line: 10 }, captureEnv), true);
assert.match(root.innerHTML, /unique recovery error/);
assert.equal(root.hidden, false);
assert.equal(recovery.capture(new Error('unique recovery error'), { source: '/js/app.js', line: 10 }, captureEnv), false,
  'duplicate errors inside the debounce window must not rebuild the panel');
assert.equal(recovery.close(captureEnv), true);
assert.equal(root.innerHTML, '');
assert.equal(root.hidden, true);

setTimeout(() => {
  assert.equal(revoked, 'blob:recovery');
  console.log('runtime recovery UI tests passed');
}, 1100);
