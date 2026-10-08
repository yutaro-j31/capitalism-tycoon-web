'use strict';
const assert = require('node:assert/strict');
const { createScenario, snapshot } = require('./ma-acquisition-financing-fixture');

function randomFor(seed = 934002) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
// Transaction completion, not request success, is the durable-write boundary.
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
      }); return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}
async function scenario() {
  const durable = new Map(), control = { attempts: [] }, host = { draws: 0 }, random = randomFor();
  const s = createScenario({ method: 'shareSwap', loadOptions: { headless: true,
    random: () => { host.draws++; return random(); }, indexedDB: indexedDBFor(durable, control) } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate();
  assert.equal(s.game.approveMAClosing(s.deal.id), true);
  assert.equal(s.game.save(), true); await backend.flush();
  return { ...s, durable, control, backend, key, host };
}
function observe(s) {
  return { state: snapshot(s.game), mirror: s.ctx.__localStorageData.get(s.key),
    cache: s.backend.readSync(s.key), durable: s.durable.get(s.key), draws: s.host.draws };
}
function economic(state) {
  return { shares: state.sharesOut, founder: state.founderShares, treasury: state.treasuryBuybackShares,
    companyCash: state.companyCash, companyDebt: state.companyDebt, personalCash: state.personalCash,
    personalDebt: state.personalDebt, subsidiaries: state.maSubsidiaries, deals: state.maDealRooms,
    targets: state.acquisitionTargets, goodwill: state.goodwillRecords, finance: state.finance, rng: state.simulationRng };
}
async function freshBoot(s, expected) {
  const control = { attempts: [] };
  const fresh = createScenario({ method: 'shareSwap', loadOptions: { headless: true, random: randomFor(),
    indexedDB: indexedDBFor(s.durable, control), localStorageInitial: Object.fromEntries(s.ctx.__localStorageData) } });
  await fresh.modules.saveStorageIDB.hydrate(); await fresh.modules.saveStorageIDB.flush();
  const loaded = fresh.engineModule.TycoonEngine.load();
  const normalized = new fresh.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected)));
  assert.deepEqual(JSON.parse(JSON.stringify(economic(loaded.g))), JSON.parse(JSON.stringify(economic(normalized.g))));
}
async function assertRollback(s, before) {
  assert.deepEqual(snapshot(s.game), before.state, 'complete economic state, histories and RNG restored');
  assert.equal(s.host.draws, before.draws, 'no extra host RNG draws');
  assert.equal(s.ctx.__localStorageData.get(s.key), before.mirror, 'exact prior mirror bytes');
  assert.equal(s.backend.readSync(s.key), before.cache, 'exact prior cache bytes');
  await s.backend.flush();
  assert.equal(s.durable.get(s.key), before.cache, 'flush cannot resurrect a failed closing');
  await freshBoot(s, before.state);
}
function invoke(s, entry) {
  if (entry === 'outer') return s.game.runTransaction(() => s.game.closeMADeal(s.deal.id));
  if (entry === 'complete') return s.game.completeTargetAcquisition({ targetID: s.deal.targetID,
    method: 'shareSwap', approvedPrice: s.deal.acceptedTerms.finalPrice, dealID: s.deal.id });
  return s.game.closeMADeal(s.deal.id);
}
function fault(s, name) {
  const g = s.game;
  if (name === 'mirror') {
    const base = s.ctx.localStorage.setItem.bind(s.ctx.localStorage); let once = true;
    s.ctx.localStorage.setItem = (key, value) => {
      if (key === s.key && once) { once = false; throw Object.assign(new Error('mirror rejected'), { name: 'SecurityError' }); }
      base(key, value);
    }; return () => { s.ctx.localStorage.setItem = base; };
  }
  if (name === 'enqueue-false' || name === 'enqueue-throw') {
    const base = s.backend.writeSync;
    const writeSync = (key, value) => {
      base(key, value); // Exercise cancellation after cache/queue admission too.
      if (name === 'enqueue-throw') throw new Error('enqueue rejected');
      return false;
    };
    s.modules.saveStorageIDB = { ...s.backend, writeSync };
    return () => { s.modules.saveStorageIDB = s.backend; };
  }
  if (name === 'save-throw') {
    const base = g.save;
    g.save = function (...args) {
      const r = base.apply(this, args);
      if (!this.inTransaction()) throw new Error('save accepted then threw');
      return r;
    }; return () => { g.save = base; };
  }
  if (name === 'finance-throw') {
    const base = s.modules.finance.event;
    s.modules.finance.event = function (...args) { base.apply(this, args); throw new Error('journal posted then threw'); };
    return () => { s.modules.finance.event = base; };
  }
  const base = g.emit;
  g.emit = function (type, ...args) {
    if (name === 'saved-throw' ? type === 'saved' : type === undefined || type === 'change') throw new Error('event threw');
    return base.call(this, type, ...args);
  }; return () => { g.emit = base; };
}
async function successful(s) {
  const before = observe(s), counts = { saved: 0, change: 0 };
  s.game.addEventListener('saved', () => counts.saved++); s.game.addEventListener('change', () => counts.change++);
  assert.equal(s.game.closeMADeal(s.deal.id), true);
  const state = s.game.g;
  assert.equal(state.sharesOut, before.state.sharesOut + 100000);
  assert.equal(state.maSubsidiaries.length, before.state.maSubsidiaries.length + 1);
  assert.equal(state.maDealRooms[0].status, 'acquired');
  for (const key of ['companyCash', 'companyDebt', 'personalCash', 'personalDebt', 'founderShares', 'treasuryBuybackShares'])
    assert.equal(state[key], before.state[key], key);
  assert.equal(state.finance.transactions.filter(t => t.sourceType === 'acquireTargetShareSwap').length, 1);
  assert.equal(state.finance.transactions.filter(t => t.sourceType === 'shareSwapCapital').length, 1);
  // validate caches derived statements: check a clone without changing the saved/live comparison.
  assert.equal(s.modules.finance.validate(snapshot(s.game)).ok, true);
  assert.deepEqual(counts, { saved: 1, change: 1 }, 'one accepted save and change event');
  assert.equal(s.host.draws, before.draws);
  assert.deepEqual(JSON.parse(JSON.stringify(state.simulationRng)), before.state.simulationRng);
  await s.backend.flush(); await freshBoot(s, state);
  const completed = observe(s);
  assert.equal(s.game.closeMADeal(s.deal.id), false);
  assert.equal(invoke(s, 'complete'), false);
  assert.deepEqual(observe(s), completed, 'replayed completed operation changes no state/storage/RNG');
  return state;
}
(async () => {
  // Both app closing and direct final complete go through the actual wrapper chain.
  for (const entry of ['close', 'complete', 'outer']) for (const name of [
    'mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved-throw', 'change-throw', 'finance-throw'
  ]) {
    const s = await scenario(), before = observe(s), restore = fault(s, name);
    if (['mirror', 'enqueue-false', 'enqueue-throw'].includes(name)) assert.equal(invoke(s, entry), false, `${entry}/${name}`);
    else assert.throws(() => invoke(s, entry), /threw/, `${entry}/${name}`);
    restore(); await assertRollback(s, before);
    // A later save without retrying closing must not promote any failed economic changes.
    const sequence = JSON.parse(before.cache).saveSequence;
    assert.equal(s.game.save(), true); assert.equal(s.game.save(), true); await s.backend.flush();
    assert.ok(JSON.parse(s.backend.readSync(s.key)).saveSequence > sequence);
    await freshBoot(s, before.state);
    await successful(s); // The same accepted deal remains retryable once the fault clears.
  }
  // Preserve an earlier accepted, in-flight write; cancel only the failed closing's put.
  {
    const s = await scenario(); s.control.holdPut = true;
    s.game.g.personalCash += 123; assert.equal(s.game.save(), true);
    for (let i = 0; i < 100 && !s.control.release; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof s.control.release, 'function');
    const before = observe(s), attempted = s.control.attempts.length, restore = fault(s, 'change-throw');
    assert.throws(() => s.game.closeMADeal(s.deal.id), /event threw/); restore();
    assert.deepEqual(snapshot(s.game), before.state); assert.equal(s.backend.readSync(s.key), before.cache);
    s.control.release(); await assertRollback(s, before);
    assert.equal(s.control.attempts.length, attempted, 'rejected queued put never reaches durable transaction');
    assert.equal(s.game.save(), true); await s.backend.flush();
    assert.ok(JSON.parse(s.backend.readSync(s.key)).saveSequence > JSON.parse(before.cache).saveSequence + 1,
      'cancelled attempted sequence is not reused');
    await successful(s);
  }
  // Same saved seed and command/reload sequence produce the same full economic outcome.
  const a = await scenario(), b = await scenario();
  const before = observe(a), restore = fault(a, 'change-throw');
  assert.throws(() => a.game.closeMADeal(a.deal.id), /event threw/); restore(); await assertRollback(a, before);
  await successful(a); await successful(b);
  assert.deepEqual(economic(snapshot(a.game)), economic(snapshot(b.game)));
  assert.notEqual(a.game.advanceWeek(false), false); assert.notEqual(b.game.advanceWeek(false), false);
  await a.backend.flush(); await b.backend.flush();
  assert.deepEqual(economic(snapshot(a.game)), economic(snapshot(b.game)), 'rollback/retry then weekly deterministic replay');
  assert.equal(a.host.draws, b.host.draws, 'same host RNG consumption after replay');
  console.log('M&A share-swap save/rollback atomicity tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
