'use strict';
// Isolated diagnostic: no real browser/player storage and no production changes.
const assert = require('node:assert/strict');
const { loadGame } = require('../../../tests/harness');
function randomFor(seed = 934003) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function indexedDBFor(durable) {
  const db = { objectStoreNames: { contains: name => name === 'saves' }, createObjectStore() {},
    transaction() {
      const tx = {};
      const finish = (r, result, mutate) => queueMicrotask(() => {
        mutate?.(); r.result = result; r.onsuccess?.(); queueMicrotask(() => tx.oncomplete?.());
      });
      tx.objectStore = () => ({
        getAll() { const r = {}; finish(r, [...durable.values()]); return r; },
        getAllKeys() { const r = {}; finish(r, [...durable.keys()]); return r; },
        put(payload, key) { const r = {}; finish(r, key, () => durable.set(String(key), String(payload))); return r; },
        delete(key) { const r = {}; finish(r, undefined, () => durable.delete(String(key))); return r; }
      }); return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}
function economic(g, id) {
  return { shares: g.sharesOut, founder: g.founderShares, companyCash: g.companyCash,
    personalCash: g.personalCash, debt: g.companyDebt,
    status: g.investorOffers.find(o => o.id === id)?.status,
    receipts: g.finance.transactions.filter(t => t.sourceType === 'investorOffer' && t.sourceID === id).length,
    capitalSurplus: g.finance.balances.capitalSurplus };
}
async function run(fault) {
  const durable = new Map();
  const s = loadGame({ headless: true, random: randomFor(), indexedDB: indexedDBFor(durable) });
  const g = new s.engineModule.TycoonEngine(), backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate(); g.g.configured = true;
  const office = g.g.rentalOffices.reduce((a,b) => a.deposit < b.deposit ? a : b);
  assert.equal(g.contractOffice(office.id), true);
  assert.equal(g.refreshInvestorOffers(), true);
  const offer = g.g.investorOffers[0]; assert.ok(offer?.amount > 0);
  assert.equal(g.save(), true); await backend.flush();
  const beforeState = JSON.stringify(g.g), prior = durable.get(key), before = economic(g.g, offer.id);
  assert.equal(s.ctx.__localStorageData.get(key), prior);
  let injected = false;
  const setItem = s.ctx.localStorage.setItem.bind(s.ctx.localStorage), emit = g.emit;
  if (fault === 'mirror-security-error') s.ctx.localStorage.setItem = (k,v) => {
    if (k === key && !injected) { injected = true; throw Object.assign(new Error('P3-4-003 rejected mirror'), {name:'SecurityError'}); }
    setItem(k,v);
  };
  else g.emit = function(type,...args) {
    if (type === undefined || type === 'change') { injected = true; throw new Error('P3-4-003 post-save change exception'); }
    return emit.call(this,type,...args);
  };
  let returned = null, error = null;
  try { returned = g.acceptInvestorOffer(offer.id); } catch (e) { error = e.message; }
  assert.equal(injected, true);
  const after = economic(g.g,offer.id), liveRestored = JSON.stringify(g.g) === beforeState;
  await backend.flush();
  const mirrorUnchanged = s.ctx.__localStorageData.get(key) === prior;
  const cacheAfterFailure = economic(JSON.parse(backend.readSync(key)),offer.id);
  const durableAfterFailure = economic(JSON.parse(durable.get(key)),offer.id);
  async function boot() {
    const fresh = loadGame({headless:true,random:randomFor(),indexedDB:indexedDBFor(durable),
      localStorageInitial:Object.fromEntries(s.ctx.__localStorageData)});
    await fresh.modules.saveStorageIDB.hydrate(); await fresh.modules.saveStorageIDB.flush();
    return economic(fresh.engineModule.TycoonEngine.load().g,offer.id);
  }
  const freshHydrationImmediatelyAfterFailure = await boot();
  s.ctx.localStorage.setItem = setItem; g.emit = emit;
  assert.equal(g.save(), true); await backend.flush();
  const freshHydrationAfterLaterSave = await boot();
  const result = {fault,returned,error,offer:{amount:offer.amount,preMoneyValuation:offer.preMoneyValuation},
    before,after,liveRestored,mirrorUnchanged,cacheAfterFailure,durableAfterFailure,
    freshHydrationImmediatelyAfterFailure,freshHydrationAfterLaterSave};
  console.log(JSON.stringify(result,null,2)); return result;
}
(async()=>{
  const results=[];
  for(const f of ['mirror-security-error','post-save-change-throw'])results.push(await run(f));
  if(process.argv.includes('--assert-fixed'))for(const r of results){
    assert.equal(r.liveRestored,true,'failed acceptance must restore complete live state');
    assert.deepEqual(r.durableAfterFailure,r.before);
    assert.deepEqual(r.freshHydrationAfterLaterSave,r.before);
    if(r.fault==='mirror-security-error')assert.equal(r.returned,false);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
