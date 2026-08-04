'use strict';

const assert = require('node:assert/strict');
const { loadGame, findStateIssues } = require('./harness');

const AUDIT_WEEKS = 520;
const MAX_SAVE_BYTES = 4 * 1024 * 1024;
const MAX_RELOAD_GROWTH_BYTES = 64 * 1024;
const RETAINED_REPORT_WEEKS = 104;
const CASH_BUFFER = 1_000_000_000;

function seededRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

const initial = loadGame({ random: seededRandom(0x6c400001) });
const engine = initial.ctx.__ct_engine;
const { SAVE_KEY, SAVE_VERSION } = initial.engineModule;

assert.equal(SAVE_KEY, 'capitalism_tycoon_web_v1', 'storage budget audit must use the canonical save key');
assert.equal(SAVE_VERSION, 9, 'storage budget audit must preserve save version 9');

engine.configure({
  playerName: '保存容量監査者',
  companyName: '十年保存監査株式会社',
  difficulty: 'normal',
  scenario: 'free'
});
engine.g.companyCash += CASH_BUFFER;
engine.g.personalCash += CASH_BUFFER;

for (let index = 0; index < AUDIT_WEEKS; index += 1) {
  const beforeWeek = engine.g.week;
  assert.notEqual(engine.advanceWeek(false), false, `week ${beforeWeek + 1} must advance during the storage audit`);
  assert.equal(engine.g.week, beforeWeek + 1, 'storage audit week must advance exactly once');
  if ((index + 1) % 52 === 0) {
    assert.deepEqual(findStateIssues(engine.g), [], `state must remain finite at audit year ${(index + 1) / 52}`);
  }
}

engine.save();
const payload = initial.ctx.__localStorageData.get(SAVE_KEY);
assert.equal(typeof payload, 'string', 'the canonical save must be written to localStorage');
const saveBytes = Buffer.byteLength(payload, 'utf8');
assert.ok(saveBytes <= MAX_SAVE_BYTES, `ten-year save exceeds ${MAX_SAVE_BYTES} bytes: ${saveBytes}`);

const parsed = JSON.parse(payload);
assert.equal(parsed.saveVersion, SAVE_VERSION, 'serialized save version changed');
assert.equal(parsed.week, engine.g.week, 'serialized week does not match runtime state');
assert.equal(parsed.companyName, engine.g.companyName, 'serialized company name does not match runtime state');
assert.deepEqual(findStateIssues(parsed), [], 'serialized ten-year save must remain finite and acyclic');

const expectedRetainedReports = engine.g.reports.slice(-RETAINED_REPORT_WEEKS);
const reloaded = loadGame({
  random: seededRandom(0x6c400002),
  localStorageInitial: { [SAVE_KEY]: payload }
});
const loadedEngine = reloaded.ctx.__ct_engine;
assert.equal(loadedEngine.g.week, engine.g.week, 'reload must preserve the audited week');
assert.equal(loadedEngine.g.companyName, engine.g.companyName, 'reload must preserve the company name');
assert.equal(loadedEngine.g.reports.length, RETAINED_REPORT_WEEKS, 'reload must enforce the bounded 104-week report history');
assert.deepEqual(
  JSON.parse(JSON.stringify(loadedEngine.g.reports)),
  JSON.parse(JSON.stringify(expectedRetainedReports)),
  'reload must preserve the newest bounded report-history tail'
);
assert.deepEqual(findStateIssues(loadedEngine.g), [], 'reloaded ten-year state must remain finite and valid');

loadedEngine.save();
const reSavedPayload = reloaded.ctx.__localStorageData.get(SAVE_KEY);
const reSavedBytes = Buffer.byteLength(reSavedPayload, 'utf8');
assert.ok(reSavedBytes <= MAX_SAVE_BYTES, `re-saved ten-year state exceeds ${MAX_SAVE_BYTES} bytes: ${reSavedBytes}`);
assert.ok(reSavedBytes <= saveBytes + MAX_RELOAD_GROWTH_BYTES, `reload/save cycle inflated storage by ${reSavedBytes - saveBytes} bytes`);

console.log(JSON.stringify({
  auditWeeks: AUDIT_WEEKS,
  saveBytes,
  reSavedBytes,
  maxSaveBytes: MAX_SAVE_BYTES,
  maxReloadGrowthBytes: MAX_RELOAD_GROWTH_BYTES,
  reports: loadedEngine.g.reports.length
}, null, 2));
console.log('save storage budget passed');
