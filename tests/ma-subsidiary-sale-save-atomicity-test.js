'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { prepareSale, economic } = require('./fixtures/ma-subsidiary-sale-atomicity');
const clone = value => JSON.parse(JSON.stringify(value));
function indexedDBFor(durable, control) {
  const db = {
    objectStoreNames: { contains: name => name === 'saves' }, createObjectStore() {},
    transaction() {
      const tx = {};
      const finish = (request, result, mutate, put = false) => {
        const complete = () => queueMicrotask(() => {
          mutate?.(); request.result = result; request.onsuccess?.();
          queueMicrotask(() => tx.oncomplete?.());
        });
        if (put && control.holdPut) { control.holdPut = false; control.release = complete; }
        else complete();
      };
      tx.objectStore = () => ({
        getAll() { const r = {}; finish(r, [...durable.values()]); return r; },
        getAllKeys() { const r = {}; finish(r, [...durable.keys()]); return r; },
        put(payload, key) {
          control.attempts.push(String(payload)); const r = {};
          finish(r, key, () => durable.set(String(key), String(payload)), true); return r;
        },
        delete(key) { const r = {}; finish(r, undefined, () => durable.delete(String(key))); return r; }
      });
      return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}

async function setup(count = 1) {
  const durable = new Map(), control = { attempts: [] };
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control) });
  const game = prepareSale(s.modules, count), backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  assert.equal(game.__quotaSafeSaveInstalled, true, 'installed common production save');
  await backend.hydrate(); assert.equal(game.save(), true); await backend.flush();
  return { ...s, game, backend, key, durable, control };
}
async function assertLoaded(s, expected) {
  const normalized = new s.engineModule.TycoonEngine(clone(expected));
  const loaded = s.engineModule.TycoonEngine.load();
  assert.equal(s.modules.finance.validate(normalized.g).ok, true);
  assert.equal(s.modules.finance.validate(loaded.g).ok, true);
  assert.deepEqual(economic(loaded.g), economic(normalized.g), 'production reload');
  const fresh = loadGame({ headless: true, indexedDB: indexedDBFor(s.durable, { attempts: [] }) });
  await fresh.modules.saveStorageIDB.hydrate();
  const hydrated = fresh.engineModule.TycoonEngine.load();
  assert.equal(fresh.modules.finance.validate(hydrated.g).ok, true);
  assert.deepEqual(economic(hydrated.g), economic(normalized.g), 'fresh durable-only hydration');
  await fresh.modules.saveStorageIDB.flush();
}
function inject(s, name) {
  const g = s.game, save = g.save, emit = g.emit, setItem = s.ctx.localStorage.setItem;
  let hits = 0;
  if (name === 'save-false') g.save = () => { hits++; return false; };
  if (name === 'mirror') s.ctx.localStorage.setItem = function (k, value) {
    if (k === s.key) { hits++; throw Object.assign(new Error('MA sale mirror rejected'), { name: 'SecurityError' }); }
    return setItem.call(this, k, value);
  };
  if (name === 'enqueue-false' || name === 'enqueue-throw') s.modules.saveStorageIDB = {
    ...s.backend, writeSync(k, value) {
      s.backend.writeSync(k, value); hits++;
      if (name === 'enqueue-throw') throw new Error('MA sale enqueue threw after admission');
      return false;
    }
  };
  if (name === 'save-throw') g.save = function (...args) {
    const r = save.apply(this, args);
    if (!this.inTransaction()) { hits++; throw new Error('MA sale save accepted then threw'); }
    return r;
  };
  if (['saved', 'change', 'notify'].includes(name)) g.emit = function (type = 'change', ...args) {
    if (type === name && (name === 'notify' || !this.inTransaction())) { hits++; throw new Error(`MA sale ${name} threw`); }
    return emit.call(this, type, ...args);
  };
  return { hits: () => hits, restore() {
    g.save = save; g.emit = emit; s.ctx.localStorage.setItem = setItem; s.modules.saveStorageIDB = s.backend;
  } };
}
async function rejected(name, pending = false, outer = false) {
  const s = await setup();
  if (pending) {
    s.control.holdPut = true; assert.equal(s.game.save(), true);
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(typeof s.control.release, 'function');
  }
  const before = clone(s.game.g), bytes = s.backend.readSync(s.key), durable = s.durable.get(s.key);
  const puts = s.control.attempts.length, fault = inject(s, name), id = before.maSubsidiaries[0].id;
  let result, error;
  try { result = outer ? s.game.runTransaction(() => s.game.sellMASubsidiary(id)) : s.game.sellMASubsidiary(id); }
  catch (e) { error = e; } finally { fault.restore(); }
  assert.ok(fault.hits() > 0, `${name}: injection reached installed sale`);
  if (['save-false', 'mirror', 'enqueue-false', 'enqueue-throw'].includes(name)) {
    assert.equal(result, false, 'failed save must not report completed subsidiary disposal'); assert.equal(error, undefined);
  } else assert.match(error?.message || '', /MA sale .*threw/);
  assert.deepEqual(clone(s.game.g), before, `${name}: full live snapshot restored, including cash, subsidiary, goodwill, journal and RNG`);
  assert.equal(s.ctx.__localStorageData.get(s.key), bytes, `${name}: exact mirror`);
  assert.equal(s.backend.readSync(s.key), bytes, `${name}: exact cache and stored sequence`);
  assert.equal(s.durable.get(s.key), durable, `${name}: no synchronous durable mutation`);
  s.control.release?.(); await s.backend.flush();
  assert.equal(s.durable.get(s.key), bytes, `${name}: flush preserves prior accepted candidate`);
  assert.equal(s.control.attempts.length, puts, `${name}: rejected sale put never starts`);
  await assertLoaded(s, before);
  const seq = JSON.parse(bytes).saveSequence;
  assert.equal(s.game.save(), true); await s.backend.flush();
  assert.ok(JSON.parse(s.durable.get(s.key)).saveSequence > seq, 'later accepted save never reuses a sequence');
  await assertLoaded(s, s.game.g); assert.equal(s.game.g.maSubsidiaries.length, 1, 'later save cannot revive failed sale');
  if (name === 'save-false' && !pending && !outer) {
    const untouched = await setup();
    assert.equal(s.game.sellMASubsidiary(id), true); assert.equal(untouched.game.sellMASubsidiary(id), true);
    assert.deepEqual(economic(s.game.g), economic(untouched.game.g), 'retry preserves original price, accounting and RNG');
    await s.backend.flush(); await assertLoaded(s, s.game.g);
  }
  console.log(`MA subsidiary sale ${name}${pending ? ' / prior pending put' : ''}${outer ? ' / nested' : ''} PASS`);
}
async function normal() {
  const a = await setup(2), b = await setup(2);
  for (const id of a.game.g.maSubsidiaries.map(s => s.id)) {
    const before = clone(a.game.g), subsidiary = before.maSubsidiaries.find(s => s.id === id);
    const expected = clone(before), price = subsidiary.valuation * a.engineModule.rand(expected, .85, 1.3);
    const book = (subsidiary.commercializationCarryingValue || 0) + subsidiary.identifiableNetAssetsBookValue + subsidiary.goodwillBookValue;
    const events = [], listeners = [];
    for (const type of ['notify', 'saved', 'change']) {
      const listener = () => events.push(type); a.game.addEventListener(type, listener); listeners.push([type, listener]);
    }
    let saves = 0; const save = a.game.save;
    a.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    try { assert.equal(a.game.sellMASubsidiary(id), true); } finally { a.game.save = save; }
    for (const [type, listener] of listeners) a.game.removeEventListener(type, listener);
    assert.equal(b.game.sellMASubsidiary(id), true);
    assert.deepEqual(events, ['notify', 'saved', 'change'], 'existing notification/commit order');
    assert.equal(saves, 1, 'exactly one accepted sale save');
    const g = a.game.g;
    assert.equal(g.companyCash, before.companyCash + price); assert.equal(g.personalCash, before.personalCash);
    assert.equal(g.totalMAGain, before.totalMAGain + (price - book));
    const journal = g.finance.transactions.at(-1), round = n => Math.round(n * 100) / 100;
    assert.equal(journal.sourceType, 'sellMASubsidiary'); assert.equal(journal.sourceID, id);
    assert.equal(journal.cashEffect, round(price)); assert.equal(journal.assetEffect, -book); assert.equal(journal.profitEffect, round(price - book));
    const goodwill = g.goodwillRecords.find(row => row.id === subsidiary.goodwillRecordID);
    assert.equal(goodwill.status, 'disposed'); assert.equal(goodwill.carryingValue, 0); assert.equal(goodwill.goodwillBookValue, 0);
    assert.deepEqual(clone(g.simulationRng), expected.simulationRng, 'exactly original price draw, no extra RNG');
    assert.equal(a.modules.finance.validate(g).ok, true);
    assert.equal(b.modules.finance.validate(b.game.g).ok, true);
    assert.deepEqual(economic(g), economic(b.game.g), 'deterministic replay');
    assert.equal(a.key, 'capitalism_tycoon_web_v1'); assert.equal(g.saveVersion, 9);
    await a.backend.flush(); assert.equal(a.durable.get(a.key), a.backend.readSync(a.key));
    assert.equal(a.durable.get(a.key), a.ctx.__localStorageData.get(a.key)); await assertLoaded(a, g);
    const completed = clone(g), bytes = a.backend.readSync(a.key);
    assert.equal(a.game.sellMASubsidiary(id), false, 'duplicate sale rejected');
    assert.deepEqual(clone(g), completed, 'duplicate sale changes no state/RNG/journal'); assert.equal(a.backend.readSync(a.key), bytes);
  }
  console.log('MA subsidiary sale normal / consecutive / duplicate / persistence / deterministic replay PASS');
}
(async () => {
  await rejected('save-false'); // PR #925 RED contract first, without changing its assertions.
  for (const name of ['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change', 'notify']) await rejected(name);
  await rejected('save-false', true); await rejected('change', true); await rejected('change', false, true);
  await normal();
  console.log('MA subsidiary sale save atomicity PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
