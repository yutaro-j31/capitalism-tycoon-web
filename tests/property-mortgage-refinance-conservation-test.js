'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const snap = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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

async function scenario(owner = 'personal', old = 216_000_000) {
  const durable = new Map(), control = { attempts: [] };
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control) });
  await s.modules.saveStorageIDB.hydrate();
  const state = s.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 10, companyCash: 100_000_000, personalCash: 100_000_000, companyDebt: 0, personalDebt: 0 });
  state.properties = [{ ...state.properties[0], id: 'mortgage-regression', name: 'Mortgage regression', owner,
    marketValue: 300_000_000, purchasePrice: 300_000_000, value: 300_000_000,
    mortgageBalance: old, mortgageProductID: old ? 'variable' : '', mortgageRemainingWeeks: old ? 416 : 0 }];
  state.finance = s.modules.finance.defaultFinanceState(state);
  const e = new s.engineModule.TycoonEngine(state);
  assert.equal(e.save(), true); await s.modules.saveStorageIDB.flush();
  return { ...s, e, durable, control, key: s.engineModule.SAVE_KEY };
}
function observe(s) {
  return { state: snap(s.e.g), mirror: s.ctx.__localStorageData.get(s.key),
    cache: s.modules.saveStorageIDB.readSync(s.key), durable: s.durable.get(s.key) };
}
async function unchanged(s, before) {
  assert.deepEqual(snap(s.e.g), before.state, 'whole live state unchanged');
  assert.equal(s.ctx.__localStorageData.get(s.key), before.mirror, 'mirror unchanged');
  assert.equal(s.modules.saveStorageIDB.readSync(s.key), before.cache, 'cache unchanged');
  await s.modules.saveStorageIDB.flush();
  assert.equal(s.durable.get(s.key), before.durable, 'durable bytes unchanged after flush');
  // Remove localStorage entirely: this must hydrate from durable IDB only.
  const fresh = loadGame({ headless: true, indexedDB: indexedDBFor(s.durable, { attempts: [] }) });
  await fresh.modules.saveStorageIDB.hydrate();
  const loaded = fresh.engineModule.TycoonEngine.load();
  assert.ok(loaded, 'durable-only load exists');
  const normalized = new fresh.engineModule.TycoonEngine(snap(before.state));
  for (const key of ['companyCash', 'personalCash', 'companyDebt', 'personalDebt', 'properties', 'propertyMortgageHistory', 'finance', 'simulationRng'])
    assert.deepEqual(snap(loaded.g[key]), snap(normalized.g[key]), `durable-only ${key}`);
  assert.equal(loaded.g.saveVersion, 9);
}
async function main() {
  for (const owner of ['company', 'personal']) {
    const s = await scenario(owner);
    // Repeated low/high LTV attempts cannot erase principal and redraw it.
    const startCash = s.e.g[owner === 'company' ? 'companyCash' : 'personalCash'];
    for (let i = 0; i < 2; i++) {
      const before = observe(s);
      assert.equal(s.e.refinancePropertyMortgage('mortgage-regression', 'conservative'), false, 'lower target needs principal repayment; reject before mutation');
      await unchanged(s, before);
      s.e.g.week++;
      // Same balance refinancing cannot silently book a fee without paying it.
      const highBefore = observe(s);
      assert.equal(s.e.refinancePropertyMortgage('mortgage-regression', 'variable'), false, 'insufficient new proceeds to fund fee');
      // Week is a fixture advance, intentionally not a committed gameplay week.
      assert.deepEqual(snap(s.e.g), highBefore.state);
      s.e.g.week++;
      assert.equal(s.e.save(), true); await s.modules.saveStorageIDB.flush();
    }
    assert.equal(s.e.g[owner === 'company' ? 'companyCash' : 'personalCash'], startCash);
    assert.equal(s.e.g.properties[0].mortgageBalance, 216_000_000);
  }
  // Re-run the exploit through actual production week progression, without stubbing debt service.
  const weekly = await scenario();
  for (let cycle = 0; cycle < 2; cycle++) {
    assert.notEqual(weekly.e.advanceWeek(false), false);
    const beforeLow = snap(weekly.e.g);
    assert.equal(weekly.e.refinancePropertyMortgage('mortgage-regression', 'conservative'), false);
    assert.deepEqual(snap(weekly.e.g), beforeLow);
    assert.notEqual(weekly.e.advanceWeek(false), false);
    const beforeHigh = snap(weekly.e.g);
    assert.equal(weekly.e.refinancePropertyMortgage('mortgage-regression', 'variable'), false);
    assert.deepEqual(snap(weekly.e.g), beforeHigh, 'no recurring draw after unpaid low-LTV reset');
  }
  // A legitimate cash-funded reduction uses the existing explicit prepayment command first.
  const paid = await scenario(), cashBeforePaydown = paid.e.g.personalCash;
  assert.equal(paid.e.prepayPropertyMortgage('mortgage-regression', 70_000_000), 70_000_000);
  paid.e.g.week++;
  const low = paid.e.refinancePropertyMortgage('mortgage-regression', 'conservative');
  assert.equal(low.oldBalance, 146_000_000); assert.equal(low.newBalance, 150_000_000);
  assert.equal(low.fee, 1_200_000); assert.equal(paid.e.g.personalCash - cashBeforePaydown, -67_200_000);
  // A positive draw that cannot pay its quoted fee is also unsupported, with no state mutation.
  const shortfall = await scenario('personal', 215_000_000), shortBefore = observe(shortfall);
  assert.equal(shortfall.e.refinancePropertyMortgage('mortgage-regression', 'variable'), false);
  await unchanged(shortfall, shortBefore);
  // Normal personal origination preserves the existing terms and cash-owner boundary.
  const normal = await scenario('personal', 0), before = observe(normal);
  const result = normal.e.refinancePropertyMortgage('mortgage-regression', 'fixed');
  assert.equal(result.newBalance, 195_000_000); assert.equal(result.fee, 2_340_000);
  assert.equal(normal.e.g.personalCash - before.state.personalCash, 192_660_000);
  assert.equal(normal.e.g.companyCash, before.state.companyCash);
  assert.equal(normal.e.g.companyDebt, before.state.companyDebt);
  assert.deepEqual(snap(normal.e.g.simulationRng), before.state.simulationRng, 'no RNG consumption');
  await normal.modules.saveStorageIDB.flush();
  await unchanged(normal, observe(normal));
  // Production transaction boundary must undo accepted drawdowns on all save failures.
  for (const entry of ['direct', 'nested']) for (const fault of ['save-false', 'save-throw', 'post-save-throw']) {
    const s = await scenario('personal', 0), baseline = observe(s), save = s.e.save;
    let reached = false;
    s.e.save = function (...args) {
      reached = true;
      if (fault === 'save-false') return false;
      if (fault === 'save-throw') throw new Error('injected save throw');
      save.apply(this, args); throw new Error('injected post-save throw');
    };
    const invoke = () => entry === 'nested' ? s.e.runTransaction(() => s.e.refinancePropertyMortgage('mortgage-regression', 'fixed')) : s.e.refinancePropertyMortgage('mortgage-regression', 'fixed');
    if (fault === 'save-false') assert.equal(invoke(), false);
    else assert.throws(invoke, /injected/);
    s.e.save = save; assert.equal(reached, true);
    await unchanged(s, baseline);
  }
  // Old properties lacking optional mortgage fields remain originatable; no migration/new schema.
  const legacy = await scenario('personal', 0);
  for (const key of ['mortgageBalance', 'mortgageProductID', 'mortgageRemainingWeeks']) delete legacy.e.g.properties[0][key];
  assert.ok(legacy.e.refinancePropertyMortgage('mortgage-regression', 'fixed'));
  console.log('property mortgage refinance conservation and durable rollback PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
