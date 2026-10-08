'use strict';

// Diagnostic only: isolated harness memory, no real browser/player storage.
// --assert-fixed is intentionally RED on main 21d01108; this is not an acceptance gate.
const assert = require('node:assert/strict');
const { createScenario, snapshot } = require('../../../tests/ma-acquisition-financing-fixture');

function indexedDBFor(durable) {
  const db = {
    objectStoreNames: { contains: name => name === 'saves' },
    createObjectStore() {},
    transaction() {
      const tx = {};
      const finish = (request, result, mutate) => queueMicrotask(() => {
        mutate?.(); request.result = result; request.onsuccess?.();
        queueMicrotask(() => tx.oncomplete?.());
      });
      tx.objectStore = () => ({
        getAll() { const r = {}; finish(r, [...durable.values()]); return r; },
        getAllKeys() { const r = {}; finish(r, [...durable.keys()]); return r; },
        put(payload, key) { const r = {}; finish(r, key, () => durable.set(String(key), String(payload))); return r; },
        delete(key) { const r = {}; finish(r, undefined, () => durable.delete(String(key))); return r; }
      });
      return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}
function randomFor(seed = 934002) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function economic(state) {
  return { shares: state.sharesOut, subsidiaries: state.maSubsidiaries.length,
    dealStatus: state.maDealRooms[0].status, cash: state.companyCash, debt: state.companyDebt,
    acquisitionReceipts: state.finance.transactions.filter(t => t.sourceType === 'acquireTargetShareSwap').length,
    equityReceipts: state.finance.transactions.filter(t => t.sourceType === 'shareSwapCapital').length };
}
async function run(fault) {
  const durable = new Map();
  const s = createScenario({ method: 'shareSwap', loadOptions: {
    headless: true, random: randomFor(), indexedDB: indexedDBFor(durable) } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate();
  assert.equal(s.game.approveMAClosing(s.deal.id), true, 'actual final installed board approval');
  assert.equal(s.game.save(), true);
  await backend.flush();
  const beforeState = snapshot(s.game), before = economic(beforeState), prior = durable.get(key);
  assert.equal(s.ctx.__localStorageData.get(key), prior);
  let injected = false;
  const setItem = s.ctx.localStorage.setItem.bind(s.ctx.localStorage), emit = s.game.emit;
  if (fault === 'mirror-security-error') s.ctx.localStorage.setItem = (k, value) => {
    if (k === key && !injected) { injected = true; throw Object.assign(new Error('P3-4-002 mirror failure'), { name: 'SecurityError' }); }
    setItem(k, value);
  };
  else s.game.emit = function (type, ...args) {
    if (type === undefined || type === 'change') { injected = true; throw new Error('P3-4-002 post-save change notification failure'); }
    return emit.call(this, type, ...args);
  };
  let returned = null, error = null;
  try { returned = s.game.closeMADeal(s.deal.id); } catch (e) { error = e.message; }
  assert.equal(injected, true, 'the injected boundary was reached');
  const afterState = snapshot(s.game), after = economic(afterState);
  await backend.flush();
  const durableAfterFailure = economic(JSON.parse(durable.get(key)));
  const mirrorUnchanged = s.ctx.__localStorageData.get(key) === prior;
  s.ctx.localStorage.setItem = setItem; s.game.emit = emit;
  assert.equal(s.game.save(), true, 'ordinary later save without retrying closing');
  await backend.flush();
  const fresh = createScenario({ method: 'shareSwap', loadOptions: {
    headless: true, random: randomFor(), indexedDB: indexedDBFor(durable),
    localStorageInitial: Object.fromEntries(s.ctx.__localStorageData) } });
  await fresh.modules.saveStorageIDB.hydrate();
  const hydrated = fresh.engineModule.TycoonEngine.load();
  const evidence = { fault, returned, error, before, after, mirrorUnchanged,
    durableAfterFailure, freshHydrationAfterLaterSave: economic(hydrated.g),
    completeLiveStateRestored: JSON.stringify(afterState) === JSON.stringify(beforeState) };
  console.log(JSON.stringify(evidence, null, 2));
  return { evidence, beforeState, afterState };
}
(async () => {
  const results = [];
  for (const fault of ['mirror-security-error', 'post-save-emit-throw']) results.push(await run(fault));
  if (process.argv.includes('--assert-fixed')) for (const r of results) {
    assert.deepEqual(r.afterState, r.beforeState, 'failed share-swap must restore the complete live economic state');
    assert.deepEqual(r.evidence.durableAfterFailure, r.evidence.before, 'failed closing cannot enter durable storage');
    assert.deepEqual(r.evidence.freshHydrationAfterLaterSave, r.evidence.before, 'later save cannot resurrect the failed closing');
    if (r.evidence.fault === 'mirror-security-error') assert.equal(r.evidence.returned, false);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
