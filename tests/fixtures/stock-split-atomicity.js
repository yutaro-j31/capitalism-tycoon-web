'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('../harness');
const {indexedDBFor}=require('./pe-fund-acquisition-faults');
const snapshot=game=>JSON.parse(JSON.stringify(game.g));
function randomFor(seed = 934008) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
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
  return {...s,game,backend,key,durable,control,host,stockID:family==='own'?'CPTY':'EXT'};
}
function economic(state) {
  const copy=JSON.parse(JSON.stringify(state));delete copy.lastSaveDate;delete copy.saveSequence;
  return copy;
}
function assertSplit(before,after,stockID,ratio){
 const equal=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('split oracle: '+(label||'')+' '+JSON.stringify({a,b}));};
  const prior=before.market.find(x=>x.id===stockID);
  const stock=after.market.find(x=>x.id===stockID);
  equal(stock.priceHistory,prior.priceHistory.map(row=>({...row,price:row.price/ratio})));
  equal(stock.price,prior.price/ratio);equal(stock.previous,prior.previous/ratio);
  equal(stock.issuedShares,prior.issuedShares*ratio);equal(stock.marketCap,prior.marketCap);
  for(const key of ['personalStocks','companyStocks']) {
    equal(after[key][stockID].qty,before[key][stockID].qty*ratio);
    equal(after[key][stockID].avg,before[key][stockID].avg/ratio);
  }
  for(const key of ['sharesOut','founderShares','treasuryBuybackShares'])
    equal(after[key],before[key]*(stockID==='CPTY'?ratio:1));
  equal(after.stockPrice,before.stockPrice/(stockID==='CPTY'?ratio:1));
  for(const key of ['companyCash','personalCash','companyDebt','personalDebt','finance','simulationRng',
    'realizedPersonalStockPL','realizedCompanyStockPL'])equal(after[key],before[key],key);
  equal(after.stockSplitHistory,[{week:before.week,stockID:stockID,ratio},...before.stockSplitHistory]);
  const other=stockID==='CPTY'?'EXT':'CPTY';
  equal(after.market.find(x=>x.id===other),before.market.find(x=>x.id===other));
  equal(after.personalStocks[other],before.personalStocks[other]);
  equal(after.companyStocks[other],before.companyStocks[other]);
}

module.exports={random:randomFor,scenario,economic,snapshot,assertSplit};
