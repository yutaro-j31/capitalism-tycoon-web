'use strict';

// GF3-016: JSON.stringify converts non-finite numbers to null. A runtime money corruption must
// therefore fail before metadata, compaction, serialization, or either durable copy is touched.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const SAVE_KEY = 'capitalism_tycoon_web_v1';
const FIELDS = ['companyCash', 'personalCash', 'companyDebt', 'personalDebt'];
const INVALID = [NaN, Infinity, -Infinity, null, undefined, '100'];

function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function setup(seed = 0x3f3016) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const game = new loaded.engineModule.TycoonEngine();
  game.g.configured = true;
  assert.equal(game.save(), true);
  return { loaded, game };
}

function rngSnapshot(state) {
  return JSON.stringify(state.simulationRng);
}

// Healthy, zero, and negative finite authoritative balances remain valid.
{
  const { game } = setup();
  for (const field of FIELDS) game.g[field] = 0;
  assert.equal(game.save(), true, 'zero is finite and saveable');
  for (const field of FIELDS) game.g[field] = -123.45;
  assert.equal(game.save(), true, 'negative finite values are not corruption');
}

// Every required field rejects every non-number/non-finite form without storage, metadata, or RNG
// mutation. This exercises the same production save path used by manual saves and autosaves.
for (const field of FIELDS) {
  for (const invalid of INVALID) {
    const { loaded, game } = setup();
    const healthyBytes = loaded.ctx.__localStorageData.get(SAVE_KEY);
    const lastSaveDate = game.g.lastSaveDate;
    const rng = rngSnapshot(game.g);
    const writes = loaded.ctx.__localStorageHistory.setItem.length;
    const reasons = [];
    game.addEventListener('save-error', event => reasons.push(event.detail.reason));
    game.g[field] = invalid;
    assert.equal(game.save(), false, `${field}=${String(invalid)} must be rejected`);
    assert.equal(loaded.ctx.__localStorageData.get(SAVE_KEY), healthyBytes, 'previous raw bytes must be identical');
    assert.equal(loaded.ctx.__localStorageHistory.setItem.length, writes, 'mirror must not be written');
    assert.equal(game.g.lastSaveDate, lastSaveDate, 'failed save must not change lastSaveDate');
    assert.equal('saveSequence' in game.g, false, 'failed save must not install live saveSequence');
    assert.equal(rngSnapshot(game.g), rng, 'failed save must not consume or mutate simulation RNG');
    assert.deepEqual(reasons, ['nonfinite-critical-money']);
    assert.equal(game._lastSaveStorageInfo.reason, 'nonfinite-critical-money');
  }
}

// Slot writes are guarded and preserve an existing slot byte-for-byte.
{
  const { loaded, game } = setup();
  assert.equal(game.save(2), true);
  const key = `${SAVE_KEY}_slot_2`;
  const bytes = loaded.ctx.__localStorageData.get(key);
  game.g.personalDebt = Infinity;
  assert.equal(game.save(2), false);
  assert.equal(loaded.ctx.__localStorageData.get(key), bytes);
}

// A save requested inside a transaction may be deferred, but its post-transaction write still
// passes through the guard and cannot replace the durable payload.
{
  const { loaded, game } = setup();
  const bytes = loaded.ctx.__localStorageData.get(SAVE_KEY);
  assert.equal(game.runTransaction(() => {
    game.g.companyCash = NaN;
    assert.equal(game.save(), true, 'the in-transaction request is deferred');
    return true;
  }), true);
  assert.equal(loaded.ctx.__localStorageData.get(SAVE_KEY), bytes);
  assert.equal(game._lastSaveStorageInfo.reason, 'nonfinite-critical-money');
}

// The shared adapter rejects before touching either the IndexedDB-style backend or its mirror.
{
  const { loaded, game } = setup();
  const calls = [];
  const backend = { status: () => ({ available: true }), nextSequence: () => { calls.push('sequence'); return 2; }, writeSync: () => { calls.push('backend'); return true; } };
  const mirror = { getItem: () => null, setItem: () => calls.push('mirror') };
  game.g.companyDebt = NaN;
  const result = loaded.modules.saveStorage.saveWithAdapter(game, { backend, mirrorStorage: mirror, savedAt: '2099-01-01T00:00:00.000Z' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'nonfinite-critical-money');
  assert.deepEqual(calls, [], 'no sequence allocation or durable/mirror write may start');
}

// Exports must fail closed rather than presenting JSON null as a valid backup.
{
  const { loaded, game } = setup();
  game.g.personalCash = NaN;
  assert.throws(() => game.exportSave(), error => error.reason === 'nonfinite-critical-money');
  assert.equal(loaded.modules.saveStorageUI.downloadBackup(game, loaded.ctx), false);
}

// Production-composition weekly commit validation uses the existing outer transaction rollback.
{
  const { loaded, game } = setup(0x3f3017);
  const healthyBytes = loaded.ctx.__localStorageData.get(SAVE_KEY);
  const before = JSON.stringify(game.g);
  const base = game.updatePersonalAssets;
  game.updatePersonalAssets = function (...args) {
    const result = base.apply(this, args);
    this.g.companyCash = NaN;
    return result;
  };
  assert.throws(() => game.advanceWeek(false), error => error.reason === 'nonfinite-critical-money');
  assert.equal(JSON.stringify(game.g), before, 'outer week transaction restores the pre-week state');
  assert.equal(loaded.ctx.__localStorageData.get(SAVE_KEY), healthyBytes, 'failed week cannot overwrite the healthy save');
}

// Existing GF2-009 load isolation remains distinct from the write-side reason.
{
  const { loaded } = setup();
  const corrupted = JSON.parse(loaded.ctx.__localStorageData.get(SAVE_KEY));
  corrupted.companyCash = null;
  loaded.ctx.__localStorageData.set(SAVE_KEY, JSON.stringify(corrupted));
  const fallback = loaded.engineModule.TycoonEngine.load();
  assert.equal(fallback._saveBlockedDueToLoadFailure, true);
  assert.match(fallback._loadFailureReason, /companyCash is null/);
}

{
  const { loaded } = setup();
  assert.equal(loaded.engineModule.SAVE_KEY, SAVE_KEY);
  assert.equal(loaded.engineModule.SAVE_VERSION, 9);
}

console.log('save write critical-money guard tests passed');
