'use strict';
// Isolated diagnostic: no real browser/player storage and no production changes.
const assert = require('node:assert/strict');
const { loadGame } = require('../../../tests/harness');
function randomFor(seed = 934007) {
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
function economic(g) {
  const lot = g.personalStocks.CPTY, stock = g.market.find(x=>x.id==='CPTY');
  return { issued:g.sharesOut, founder:g.founderShares, treasury:g.treasuryBuybackShares,
    companyCash:g.companyCash, personalCash:g.personalCash, companyDebt:g.companyDebt,
    personalDebt:g.personalDebt, personalLot:lot,companyLot:g.companyStocks.CPTY, marketPrice:stock.price, marketCap:stock.marketCap,
    rootStockPrice:g.stockPrice, splitHistory:g.stockSplitHistory, companyReceipts:g.finance.transactions.length,
    realizedPersonalPL:g.realizedPersonalStockPL, rng:g.simulationRng };
}
async function run(fault) {
  const durable = new Map();
  const s = loadGame({ headless: true, random: randomFor(), indexedDB: indexedDBFor(durable) });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate();
  // Same valid public-company shape as the existing shareholder-returns fixture, using full production load order.
  const state = s.engineModule.createInitialState({configured:true});
  Object.assign(state,{week:12,companyCash:100000000,companyDebt:0,publicCompany:true,
    sharesOut:1000000,founderShares:600000,treasuryBuybackShares:0,stockPrice:100,ticker:'CPTY'});
  state.market=state.market.filter(x=>x.id!=='CPTY');
  state.market.push({id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,
    dividendYield:0,volatility:0,trend:0,marketCap:100000000,per:20,pbr:2,issuedShares:1000000,
    dividendPerShare:0,shareholders:{},description:'fixture',listingMarket:'東証グロース',priceHistory:[100]});
  state.personalStocks.CPTY={qty:20000,avg:100};
  state.companyStocks.CPTY={qty:3000,avg:100};
  state.finance=s.modules.finance.defaultFinanceState(state);
  const g=new s.engineModule.TycoonEngine(state);
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(g.g))).ok,true);
  assert.equal(g.save(), true); await backend.flush();
  const beforeState = JSON.stringify(g.g), prior = durable.get(key), before = JSON.parse(JSON.stringify(economic(g.g)));
  assert.equal(s.ctx.__localStorageData.get(key), prior);
  let injected = false;
  const setItem = s.ctx.localStorage.setItem.bind(s.ctx.localStorage), emit = g.emit;
  if (fault === 'mirror-security-error') s.ctx.localStorage.setItem = (k,v) => {
    if (k === key && !injected) { injected = true; throw Object.assign(new Error('P3-4-007 rejected mirror'), {name:'SecurityError'}); }
    setItem(k,v);
  };
  else g.emit = function(type,...args) {
    if (type === undefined || type === 'change') { injected = true; throw new Error('P3-4-007 post-save change exception'); }
    return emit.call(this,type,...args);
  };
  const save = g.save; let saveReturned = null;
  g.save = function(...args) { saveReturned = save.apply(this,args); return saveReturned; };
  let returned = null, error = null;
  try { returned = g.stockSplit('CPTY',2); } catch (e) { error = e.message; }
  assert.equal(injected, true);
  const after = JSON.parse(JSON.stringify(economic(g.g))), liveRestored = JSON.stringify(g.g) === beforeState;
  await backend.flush();
  const mirrorUnchanged = s.ctx.__localStorageData.get(key) === prior;
  const cacheAfterFailure = economic(JSON.parse(backend.readSync(key)));
  const durableAfterFailure = economic(JSON.parse(durable.get(key)));
  async function boot() {
    const fresh = loadGame({headless:true,random:randomFor(),indexedDB:indexedDBFor(durable),
      localStorageInitial:Object.fromEntries(s.ctx.__localStorageData)});
    await fresh.modules.saveStorageIDB.hydrate(); await fresh.modules.saveStorageIDB.flush();
    return JSON.parse(JSON.stringify(economic(fresh.engineModule.TycoonEngine.load().g)));
  }
  const freshHydrationImmediatelyAfterFailure = await boot();
  s.ctx.localStorage.setItem = setItem; g.emit = emit; g.save = save;
  assert.equal(g.save(), true); await backend.flush();
  const freshHydrationAfterLaterSave = await boot();
  const result = {fault,saveReturned,returned,error,command:{method:'stockSplit',stockID:'CPTY',ratio:2},
    before,after,liveRestored,mirrorUnchanged,cacheAfterFailure,durableAfterFailure,
    freshHydrationImmediatelyAfterFailure,freshHydrationAfterLaterSave};
  console.log(JSON.stringify(result,null,2)); return result;
}
(async()=>{
  const results=[];
  for(const f of ['mirror-security-error','post-save-change-throw'])results.push(await run(f));
  if(process.argv.includes('--assert-defect'))for(const r of results){
    assert.equal(r.liveRestored,false);
    assert.equal(r.after.issued,r.before.issued*2);
    assert.equal(r.after.personalLot.qty,r.before.personalLot.qty*2);
    assert.equal(r.after.companyLot.qty,r.before.companyLot.qty*2);
    assert.equal(r.after.companyCash,r.before.companyCash);
    assert.equal(r.after.personalCash,r.before.personalCash);
    assert.deepEqual(r.freshHydrationAfterLaterSave,r.after);
    if(r.fault==='mirror-security-error'){
      assert.equal(r.saveReturned,false);assert.equal(r.returned,true);
      assert.equal(r.mirrorUnchanged,true);assert.deepEqual(r.durableAfterFailure,r.before);
      assert.deepEqual(r.freshHydrationImmediatelyAfterFailure,r.before);
    }else{
      assert.equal(r.saveReturned,true);assert.match(r.error,/post-save change exception/);
      assert.equal(r.mirrorUnchanged,false);assert.deepEqual(r.cacheAfterFailure,r.after);
      assert.deepEqual(r.durableAfterFailure,r.after);
      assert.deepEqual(r.freshHydrationImmediatelyAfterFailure,r.after);
    }
  }
  if(process.argv.includes('--assert-fixed'))for(const r of results){
    assert.equal(r.liveRestored,true,'failed stock split must restore complete live state');
    assert.equal(r.mirrorUnchanged,true);
    assert.deepEqual(r.cacheAfterFailure,r.before);
    assert.deepEqual(r.durableAfterFailure,r.before);
    assert.deepEqual(r.freshHydrationImmediatelyAfterFailure,r.before);
    assert.deepEqual(r.freshHydrationAfterLaterSave,r.before);
    if(r.fault==='mirror-security-error')assert.equal(r.returned,false);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
