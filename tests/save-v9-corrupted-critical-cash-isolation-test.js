'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function basePayload() {
  const loaded = loadGame();
  const state = JSON.parse(JSON.stringify(loaded.ctx.__ct_engine.g));
  state.saveVersion = loaded.engineModule.SAVE_VERSION;
  state.companyCash = 123_000_000;
  state.personalCash = 45_000_000;
  state.companyDebt = 6_000_000;
  return { state, key: loaded.engineModule.SAVE_KEY };
}

function corruptedRaw(field, value = null) {
  const { state } = basePayload();
  state[field] = value;
  return JSON.stringify(state);
}

for (const field of ['companyCash', 'personalCash', 'companyDebt']) {
  const { key } = basePayload();
  const raw = corruptedRaw(field);
  const loaded = loadGame({ localStorageInitial: { [key]: raw } });
  const engine = loaded.ctx.__ct_engine;
  assert.equal(engine._saveBlockedDueToLoadFailure, true, `${field} corruption must block primary saves`);
  assert.match(engine._loadFailureReason, new RegExp(`${field} is null`));
  assert.notEqual(engine.g[field], null, 'fallback state must not adopt the corrupted value');
  assert.equal(loaded.ctx.__localStorageData.get(key), raw, 'corrupted localStorage payload must remain byte-for-byte unchanged');
  assert.equal(engine.save(), false);
  engine.advanceWeek(false);
  assert.equal(loaded.ctx.__localStorageData.get(key), raw, 'autosave paths must not overwrite the corrupted payload');
}

{
  const { state, key } = basePayload();
  state.companyCash = 0;
  const raw = JSON.stringify(state);
  const loaded = loadGame({ localStorageInitial: { [key]: raw } });
  assert.equal(loaded.ctx.__ct_engine._saveBlockedDueToLoadFailure, undefined);
  assert.equal(loaded.ctx.__ct_engine.g.companyCash, 0);
}

{
  const { key } = basePayload();
  for (const value of ['', '1000000', 'NaN', 'Infinity']) {
    const raw = corruptedRaw('companyCash', value);
    const loaded = loadGame({ localStorageInitial: { [key]: raw } });
    assert.equal(loaded.ctx.__ct_engine._saveBlockedDueToLoadFailure, true);
    assert.match(loaded.ctx.__ct_engine._loadFailureReason, /companyCash is not a finite number/);
    assert.equal(loaded.ctx.__localStorageData.get(key), raw);
  }
}

{
  const loaded = loadGame();
  const engine = loaded.ctx.__ct_engine;
  const key = loaded.engineModule.SAVE_KEY;
  engine.g.companyCash = 222_000_000;
  assert.equal(engine.save(), true);
  const normalMain = loaded.ctx.__localStorageData.get(key);
  const currentState = JSON.stringify(engine.g);
  const slotKey = `${key}_slot_2`;
  const brokenSlot = corruptedRaw('companyCash');
  loaded.ctx.localStorage.setItem(slotKey, brokenSlot);
  loaded.ctx.__localStorageHistory.setItem.length = 0;
  assert.equal(engine.loadSlot(2), false);
  assert.equal(JSON.stringify(engine.g), currentState);
  assert.equal(engine.g.companyCash, 222_000_000);
  assert.equal(engine._saveBlockedDueToLoadFailure, undefined, 'a corrupt manual slot must not block the healthy current game');
  assert.equal(loaded.ctx.__localStorageData.get(slotKey), brokenSlot);
  assert.equal(loaded.ctx.__localStorageData.get(key), normalMain);
  assert.equal(loaded.ctx.__localStorageHistory.setItem.length, 0);
}

{
  const loaded = loadGame();
  const engine = loaded.ctx.__ct_engine;
  const key = loaded.engineModule.SAVE_KEY;
  engine.g.companyCash = 333_000_000;
  assert.equal(engine.save(), true);
  const normalMain = loaded.ctx.__localStorageData.get(key);
  const currentState = JSON.stringify(engine.g);
  assert.throws(() => engine.importSave(corruptedRaw('companyCash')), /companyCash is null/);
  assert.equal(JSON.stringify(engine.g), currentState);
  assert.equal(loaded.ctx.__localStorageData.get(key), normalMain);
}

{
  const loaded = loadGame();
  const key = loaded.engineModule.SAVE_KEY;
  const raw = corruptedRaw('companyCash');
  loaded.modules.saveStorageIDB.writeSync(key, raw);
  const engine = loaded.engineModule.TycoonEngine.load();
  assert.equal(engine._saveBlockedDueToLoadFailure, true);
  assert.match(engine._loadFailureReason, /companyCash is null/);
  assert.equal(loaded.modules.saveStorageIDB.readSync(key), raw, 'corrupted durable-cache payload must be preserved');
  assert.equal(engine.save(), false);
  assert.equal(loaded.modules.saveStorageIDB.readSync(key), raw);
}

{
  const { state, key } = basePayload();
  const raw = JSON.stringify(state);
  const loaded = loadGame({ localStorageInitial: { [key]: raw } });
  const engine = loaded.ctx.__ct_engine;
  assert.notEqual(engine._saveBlockedDueToLoadFailure, true);
  assert.equal(engine.g.companyCash, state.companyCash);
  engine.save(3);
  const slotState = JSON.stringify(engine.g);
  assert.equal(engine.loadSlot(3), true);
  assert.equal(engine.g.companyCash, state.companyCash);
  engine.importSave(slotState);
  assert.equal(engine.g.companyCash, state.companyCash);
}

{
  const loaded = loadGame();
  const validator = loaded.engineModule.validateRawCriticalMoneyFields;
  const validZero = validator({ companyCash: 0, personalCash: 0, companyDebt: 0 });
  assert.equal(validZero.ok, true);
  assert.equal(validZero.errors.length, 0);
  assert.equal(validator({ companyCash: null }).ok, false);
  assert.equal(validator({ personalCash: Number.NaN }).ok, false);
  assert.equal(validator({ companyDebt: Number.POSITIVE_INFINITY }).ok, false);
}

console.log('save v9 corrupted critical-cash isolation tests passed');
