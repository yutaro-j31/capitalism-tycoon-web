'use strict';
// Negative isolation contract for the PE ramen market bridge.
// Two identical self-company ramen simulations run in lockstep. Only Experiment owns a PE ramen
// deal. If the detached bridge leaks into real g/state, the self market/supply/cash fingerprints
// diverge from Control.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

function rng(seed){
  let state=seed>>>0,calls=0;
  return {
    next(){calls+=1;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000;},
    calls(){return calls;}
  };
}
function plain(value){return JSON.parse(JSON.stringify(value));}
function selfFingerprint(engine,storeID){
  return plain({
    week:engine.g.week,
    companyCash:engine.g.companyCash,
    personalCash:engine.g.personalCash,
    marketByStore:engine.g.marketResultsByStoreID?.[storeID],
    marketByBusiness:engine.g.marketResultsByBusinessID?.ramen,
    store:engine.g.stores.find(row=>row.id===storeID),
    inventory:engine.g.inventoryByStoreID?.[storeID],
    purchaseOrders:(engine.g.purchaseOrders||[]).filter(row=>row.storeID===storeID),
    supplySetting:engine.g.supplySettingsByStoreID?.[storeID],
    supplyResult:engine.g.supplyResultsByStoreID?.[storeID],
    supplyBusiness:engine.g.supplyResultsByBusinessID?.ramen,
    supplyAccountsPayableBalance:engine.g.supplyAccountsPayableBalance,
    finance:engine.g.finance
  });
}
function setup(seed){
  const random=rng(seed);
  const {engineModule,modules}=loadGame({random:()=>random.next(),isolatedLegacyIndex:true});
  const engine=new engineModule.TycoonEngine();
  engine.configure({playerName:'Isolation Test',companyName:'Same Self Ramen Co',difficulty:'normal'});
  engine.g.companyCash=1_000_000_000;
  engine.g.personalCash=5_000_000_000;
  const tenant=engine.g.tenants.filter(row=>!row.occupiedBy).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)))[0];
  assert(tenant,'available tenant exists');
  assert(engine.openStore({tenantID:tenant.id,businessID:'ramen',operatingHours:3}),'self ramen store opens');
  const store=engine.g.stores.find(row=>row.businessID==='ramen');
  assert(store,'self ramen store exists');

  // One identical warm-up week establishes real market + supply state before any PE deal exists.
  engine.advanceWeek(false);
  const pf=modules.peFund;
  pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
  const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
  assert(fund,'PE fund created');
  return {engine,modules,random,storeID:store.id,fund};
}

const control=setup(0x31415926);
const experiment=setup(0x31415926);
assert.deepEqual(selfFingerprint(experiment.engine,experiment.storeID),selfFingerprint(control.engine,control.storeID),'self-company ramen state is identical before adding the PE deal');
assert.equal(experiment.random.calls(),control.random.calls(),'identical setup consumes identical simulation RNG');

const ops=experiment.modules.pePortfolioOperations;
const deal=ops.acquirePillarCompany(experiment.engine.g,experiment.fund.id,{
  businessID:'ramen',enterpriseValue:2_000_000_000,useCoinvest:false,week:experiment.engine.g.week
});
assert(deal?.portfolioCompany,'experiment acquires a PE ramen company');
deal.portfolioCompany.priceMultiplier=1.25;
deal.portfolioCompany.storeCount=3;

assert.deepEqual(selfFingerprint(experiment.engine,experiment.storeID),selfFingerprint(control.engine,control.storeID),'acquiring the PE ramen deal does not mutate self-company ramen demand/cash/inventory state');
assert.equal(experiment.random.calls(),control.random.calls(),'PE ramen acquisition consumes no simulation RNG');

for(let i=0;i<3;i++){
  const fundCashBefore=experiment.fund.cash;
  const personalBefore=experiment.engine.g.personalCash;
  const portfolioCashBefore=deal.portfolioCompany.cash;

  control.engine.advanceWeek(false);
  experiment.engine.advanceWeek(false);

  assert.deepEqual(
    selfFingerprint(experiment.engine,experiment.storeID),
    selfFingerprint(control.engine,control.storeID),
    `week ${experiment.engine.g.week}: PE ramen simulation must not change self demand, company cash, inventory, purchase orders, supply state, or finance`
  );
  assert.equal(experiment.random.calls(),control.random.calls(),`week ${experiment.engine.g.week}: detached PE ramen simulation consumes no extra simulation RNG`);
  assert.equal(experiment.fund.cash,fundCashBefore,`week ${experiment.engine.g.week}: weekly PE ramen settlement never moves fund.cash`);
  assert.equal(experiment.engine.g.personalCash,personalBefore,`week ${experiment.engine.g.week}: weekly PE ramen settlement never moves personalCash`);
  assert.equal(
    deal.portfolioCompany.cash-portfolioCashBefore,
    deal.portfolioCompany.weeklyProfit,
    `week ${experiment.engine.g.week}: only portfolioCompany.cash moves by the settled PE ramen profit`
  );
  assert.equal(deal.portfolioCompany.lastProcessedWeek,experiment.engine.g.week,'PE ramen deal settles exactly in the production weekly loop');
}

assert((experiment.engine.g.purchaseOrders||[]).every(row=>!String(row.storeID).startsWith(`pe-ramen-${deal.id}`)),'PE ramen market bridge never creates real supply purchase orders');
assert(!Object.keys(experiment.engine.g.inventoryByStoreID||{}).some(id=>String(id).startsWith(`pe-ramen-${deal.id}`)),'PE ramen market bridge never creates real inventory buckets');

console.log('PE ramen bridge isolation negative test passed');
