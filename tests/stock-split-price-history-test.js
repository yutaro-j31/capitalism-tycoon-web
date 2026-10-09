'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const snapshot = game => JSON.parse(JSON.stringify(game.g));

function randomFor(seed = 934008) {
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
async function scenario(family, legacy = false) {
  const durable = new Map(), control = { attempts: [] }, host = { draws: 0 }, random = randomFor();
  const s = loadGame({ headless: true, random: () => { host.draws++; return random(); }, indexedDB: indexedDBFor(durable,control) });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate();
  const state = s.engineModule.createInitialState({configured:true});
  Object.assign(state,{week:12,publicCompany:true,sharesOut:1000000,founderShares:600000,
    treasuryBuybackShares:10000,stockPrice:100,ticker:'CPTY',companyCash:100000000,companyDebt:0});
  state.departments.investment = true;
  for(const id of ['CPTY','EXT']) {
    state.market = state.market.filter(stock=>stock.id!==id);
    state.market.push({id,name:id,sector:'コングロマリット',price:100,previous:96,issuedShares:1000000,
      marketCap:100000000,dividendYield:0,volatility:0,trend:0,per:20,pbr:2,dividendPerShare:0,
      shareholders:{},description:'fixture',listingMarket:'東証グロース',
      priceHistory:legacy?[90,96,100]:[{week:9,price:90,tag:'first'},{week:10,price:96},{week:12,price:100}]});
    state.personalStocks[id]={qty:20000,avg:100};state.companyStocks[id]={qty:3000,avg:120};
  }
  state.finance=s.modules.finance.defaultFinanceState(state);
  const game=new s.engineModule.TycoonEngine(state);
  assert.equal(s.modules.finance.validate(snapshot(game)).ok,true);
  assert.equal(game.save(),true);await backend.flush();
  return {...s,game,backend,key,durable,host,stockID:family==='own'?'CPTY':'EXT'};
}
function economic(state) {
  const copy=JSON.parse(JSON.stringify(state));delete copy.lastSaveDate;delete copy.saveSequence;
  return copy;
}
async function persistence(s) {
  await s.backend.flush();
  const bytes=s.ctx.__localStorageData.get(s.key);
  assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.durable.get(s.key),bytes);
  const encoded=JSON.parse(bytes),id=s.stockID,history=JSON.parse(JSON.stringify(s.game.stock(id).priceHistory));
  assert.deepEqual(encoded.market.find(x=>x.id===id).priceHistory,history);
  assert.ok(s.game.stock(id).priceHistory.every(x=>Number.isFinite(typeof x==='number'?x:x.price)&&(typeof x==='number'?x:x.price)>0));
  const normalized=new s.engineModule.TycoonEngine(snapshot(s.game));
  const reloaded=s.engineModule.TycoonEngine.load();
  assert.deepEqual(economic(reloaded.g),economic(normalized.g),'production reload parity');
  const fresh=loadGame({headless:true,random:randomFor(),indexedDB:indexedDBFor(s.durable,{attempts:[]}),
    localStorageInitial:Object.fromEntries(s.ctx.__localStorageData)});
  await fresh.modules.saveStorageIDB.hydrate();await fresh.modules.saveStorageIDB.flush();
  assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),economic(normalized.g),'fresh IDB hydrate parity');
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.stock(id).priceHistory)),JSON.parse(JSON.stringify(normalized.stock(id).priceHistory)));
  assert.equal(reloaded.g.saveVersion,9);assert.equal(s.key,'capitalism_tycoon_web_v1');
}
async function split(s,ratio) {
  const before=snapshot(s.game),prior=before.market.find(x=>x.id===s.stockID),draws=s.host.draws;
  const counts={saved:0,change:0},onSaved=()=>counts.saved++,onChange=()=>counts.change++;
  s.game.addEventListener('saved',onSaved);s.game.addEventListener('change',onChange);
  assert.equal(s.game.stockSplit(s.stockID,ratio),true);
  s.game.removeEventListener('saved',onSaved);s.game.removeEventListener('change',onChange);
  const after=snapshot(s.game),stock=after.market.find(x=>x.id===s.stockID);
  assert.deepEqual(stock.priceHistory,prior.priceHistory.map(row=>({...row,price:row.price/ratio})));
  assert.equal(stock.price,prior.price/ratio);assert.equal(stock.previous,prior.previous/ratio);
  assert.equal(stock.issuedShares,prior.issuedShares*ratio);assert.equal(stock.marketCap,prior.marketCap);
  for(const key of ['personalStocks','companyStocks']) {
    assert.equal(after[key][s.stockID].qty,before[key][s.stockID].qty*ratio);
    assert.equal(after[key][s.stockID].avg,before[key][s.stockID].avg/ratio);
  }
  for(const key of ['sharesOut','founderShares','treasuryBuybackShares'])
    assert.equal(after[key],before[key]*(s.stockID==='CPTY'?ratio:1));
  assert.equal(after.stockPrice,before.stockPrice/(s.stockID==='CPTY'?ratio:1));
  for(const key of ['companyCash','personalCash','companyDebt','personalDebt','finance','simulationRng',
    'realizedPersonalStockPL','realizedCompanyStockPL'])assert.deepEqual(after[key],before[key],key);
  assert.deepEqual(after.stockSplitHistory,[{week:before.week,stockID:s.stockID,ratio},...before.stockSplitHistory]);
  const other=s.stockID==='CPTY'?'EXT':'CPTY';
  assert.deepEqual(after.market.find(x=>x.id===other),before.market.find(x=>x.id===other));
  assert.deepEqual(after.personalStocks[other],before.personalStocks[other]);
  assert.deepEqual(after.companyStocks[other],before.companyStocks[other]);
  assert.deepEqual(counts,{saved:1,change:1});assert.equal(s.host.draws,draws);
  assert.equal(s.modules.finance.validate(after).ok,true);await persistence(s);
}
(async()=>{
  const families=process.env.SPLIT_EXTERNAL_FIRST==='1'?['external','own']:['own','external'];
  for(const family of families)for(const legacy of [false,true]) {
    const s=await scenario(family,legacy);
    await split(s,2);await split(s,2);await split(s,3); // repeated valid commands remain distinct splits
    const before=snapshot(s.game),bytes=s.backend.readSync(s.key),draws=s.host.draws;
    assert.equal(s.game.stockSplit(s.stockID,1),false);assert.equal(s.game.stockSplit('MISSING',2),false);
    assert.deepEqual(snapshot(s.game),before);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.host.draws,draws);
    for(const account of ['personal','company']) {
      assert.equal(s.game.buyStock(s.stockID,1000,account),true);
      assert.equal(s.game.sellStock(s.stockID,1000,account),true);
    }
    await persistence(s);await split(s,2);
  }
  // Numeric legacy rows also remain supported on a direct compatibility state, without migration.
  const legacy=await scenario('external');legacy.game.stock('EXT').priceHistory=[90,96,100];
  assert.equal(legacy.game.stockSplit('EXT',2),true);
  assert.deepEqual(Array.from(legacy.game.stock('EXT').priceHistory),[45,48,50]);
  await persistence(legacy);
  for(const family of ['own','external']) {
    const a=await scenario(family),b=await scenario(family);
    for(const s of [a,b]) {
      await split(s,2);assert.equal(s.game.buyStock(s.stockID,1000,'company'),true);
      assert.equal(s.game.sellStock(s.stockID,500,'personal'),true);await split(s,3);
      assert.notEqual(s.game.advanceWeek(false),false);await s.backend.flush();
    }
    assert.deepEqual(economic(a.game.g),economic(b.game.g),'same seeded split/trade/week replay');
    assert.equal(a.host.draws,b.host.draws);await persistence(a);await persistence(b);
  }
  console.log('Stock-split price-history preservation, persistence and replay tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
