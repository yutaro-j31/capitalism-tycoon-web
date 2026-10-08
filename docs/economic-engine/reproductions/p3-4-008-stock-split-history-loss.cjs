'use strict';
// Evidence only: production load order, isolated storage, no runtime correction/player data.
const assert = require('node:assert/strict');
const { loadGame } = require('../../../tests/harness');
const plain = x => JSON.parse(JSON.stringify(x));
function randomFor(seed = 934008) {
  return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
}
function indexedDBFor(durable) {
  const db = { objectStoreNames:{contains:n=>n==='saves'},createObjectStore(){},transaction(){
    const tx={};
    const finish=(r,result,mutate)=>queueMicrotask(()=>{
      mutate?.();r.result=result;r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());
    });
    tx.objectStore=()=>({
      getAll(){const r={};finish(r,[...durable.values()]);return r;},
      getAllKeys(){const r={};finish(r,[...durable.keys()]);return r;},
      put(v,k){const r={};finish(r,k,()=>durable.set(String(k),String(v)));return r;},
      delete(k){const r={};finish(r,undefined,()=>durable.delete(String(k)));return r;}
    });return tx;
  }};
  return {open(){const r={};queueMicrotask(()=>{r.result=db;r.onsuccess?.();});return r;}};
}
async function run(family){
  const durable=new Map();
  const s=loadGame({headless:true,random:randomFor(),indexedDB:indexedDBFor(durable)});
  const backend=s.modules.saveStorageIDB,key=s.engineModule.SAVE_KEY;
  await backend.hydrate();
  const state=s.engineModule.createInitialState({configured:true});
  Object.assign(state,{week:12,publicCompany:true,sharesOut:1000000,founderShares:600000,
    treasuryBuybackShares:0,stockPrice:100,ticker:'CPTY',companyCash:100000000,companyDebt:0});
  const id=family==='own'?'CPTY':'EXT';
  state.market=state.market.filter(x=>x.id!==id);
  state.market.push({id,name:'History fixture',sector:'コングロマリット',price:100,previous:96,
    issuedShares:1000000,marketCap:100000000,dividendYield:0,volatility:0,trend:0,per:20,pbr:2,
    dividendPerShare:0,shareholders:{},description:'fixture',listingMarket:'東証グロース',
    priceHistory:[{week:9,price:90},{week:10,price:96},{week:12,price:100}]});
  state.personalStocks[id]={qty:20000,avg:100};state.companyStocks[id]={qty:3000,avg:120};
  state.finance=s.modules.finance.defaultFinanceState(state);
  const e=new s.engineModule.TycoonEngine(state);
  assert.equal(s.modules.finance.validate(plain(e.g)).ok,true);
  assert.equal(e.save(),true);await backend.flush();
  const before=plain(e.stock(id).priceHistory),beforeRng=plain(e.g.simulationRng);
  const rootBefore={issued:e.g.sharesOut,founder:e.g.founderShares,price:e.g.stockPrice};
  assert.deepEqual(before,[{week:9,price:90},{week:10,price:96},{week:12,price:100}]);
  // No injected save or notification failure: actual installed normal split.
  let saveReturned=null;const save=e.save;
  e.save=function(...args){saveReturned=save.apply(this,args);return saveReturned;};
  const returned=e.stockSplit(id,2);e.save=save;
  const liveNaNs=Array.from(e.stock(id).priceHistory,x=>Number.isNaN(x));
  const after=plain(e.stock(id).priceHistory);
  await backend.flush();
  const read=bytes=>JSON.parse(bytes).market.find(x=>x.id===id).priceHistory;
  const mirror=read(s.ctx.__localStorageData.get(key)),cache=read(backend.readSync(key)),stored=read(durable.get(key));
  const fresh=loadGame({headless:true,random:randomFor(),indexedDB:indexedDBFor(durable),
    localStorageInitial:Object.fromEntries(s.ctx.__localStorageData)});
  await fresh.modules.saveStorageIDB.hydrate();await fresh.modules.saveStorageIDB.flush();
  const loaded=fresh.engineModule.TycoonEngine.load();
  const hydrated=plain(loaded.stock(id).priceHistory);
  const expected=before.map(row=>({...row,price:row.price/2}));
  const result={family,id,returned,saveReturned,before,expected,liveNaNs,after,mirror,cache,
    durable:stored,freshHydration:hydrated,rootBefore,
    rootAfter:{issued:e.g.sharesOut,founder:e.g.founderShares,price:e.g.stockPrice}};
  console.log(JSON.stringify(result,null,2));
  assert.equal(returned,true);assert.equal(saveReturned,true);
  assert.deepEqual(plain(e.g.simulationRng),beforeRng);
  assert.equal(e.g.personalStocks[id].qty,40000);assert.equal(e.g.companyStocks[id].qty,6000);
  if(family==='external')assert.deepEqual(result.rootAfter,rootBefore);
  if(process.argv.includes('--assert-defect')){
    assert.deepEqual(liveNaNs,[true,true,true]);
    for(const history of [after,mirror,cache,stored])assert.deepEqual(history,[null,null,null]);
    assert.deepEqual(hydrated,[{week:11,price:48},{week:12,price:50}]);
    assert.notDeepEqual(hydrated,expected,'normal hydration cannot recover deleted original observations');
  }
  return result;
}
(async()=>{
  const results=[];
  for(const family of ['own','external'])results.push(await run(family));
  if(process.argv.includes('--assert-fixed'))for(const r of results){
    assert.deepEqual(r.after,r.expected,'valid split must preserve historical weeks and divide each price');
    for(const history of [r.mirror,r.cache,r.durable,r.freshHydration])assert.deepEqual(history,r.expected);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
