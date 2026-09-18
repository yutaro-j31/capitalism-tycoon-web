'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

let randomCalls=0,seed=0x5a17c9e3;
const {engineModule,modules}=loadGame({random:()=>{randomCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;},isolatedLegacyIndex:true});
const pf=modules.peFund,ops=modules.pePortfolioOperations,market=modules.market;
const plain=value=>JSON.parse(JSON.stringify(value));

const engine=new engineModule.TycoonEngine();
engine.configure({playerName:'PE Ramen Bridge',companyName:'Detached Ramen Holdings',difficulty:'normal'});
engine.g.companyCash=9_000_000_000;
engine.g.personalCash=12_000_000_000;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'ramen',enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
assert(deal?.portfolioCompany?.productionSite,'ramen deal has a deterministic production site');
assert.equal(engine.canOpenPEPortfolioManagement(fund.id,deal.id).capability.actionsEnabled,true,'ramen management becomes player-facing only after the detached market bridge exists');

// Distort the self-company ramen business aggressively. The PE bridge must use the static master,
// never the mutable self-company business record.
const selfRamen=engine.business('ramen');
selfRamen.price*=3;selfRamen.quality=99;selfRamen.brand=97;selfRamen.dx=88;
deal.portfolioCompany.priceMultiplier=1.25;
deal.portfolioCompany.storeCount=3;

{
  const before=plain(engine.g),callsBefore=randomCalls;
  const input=engine.getPEPortfolioRamenOperatingInput(fund.id,deal.id);
  assert.equal(input.ok,true);
  assert.equal(input.source,'pe-ramen-detached-market-input');
  assert.equal(input.playerOffers.length,3,'portfolio storeCount becomes a same-prefecture synthetic offer batch');
  assert(input.playerOffers.every(row=>row.id.startsWith(`pe-ramen-${deal.id}-`)),'all player offers are detached PE identities');
  assert(!input.playerOffers.some(row=>engine.g.stores.some(store=>store.id===row.id)),'no PE synthetic store aliases a self-company store');

  const master=modules.data.MASTER.businesses.find(row=>row.id==='ramen');
  assert(master,'static ramen master exists');
  assert(input.playerOffers.every(row=>row.price===master.price*1.25),'PE price lever is applied to the static ramen master price');
  assert.notEqual(input.playerOffers[0].price,selfRamen.price,'self-company ramen price cannot leak into PE offers');
  assert.equal(input.playerOffers[0].quality,master.quality,'self-company quality cannot leak into PE offers');
  assert(Number.isFinite(input.marketPotential)&&input.marketPotential>0,'detached ramen market has positive finite market potential');
  assert(Array.isArray(input.competitorOffers),'world competitor offers are copied into the detached input');
  assert.deepEqual(plain(engine.g),before,'building PE ramen market input is read-only');
  assert.equal(randomCalls,callsBefore,'building PE ramen market input consumes no simulation RNG');

  const preview=engine.previewPEPortfolioRamenWeek(fund.id,deal.id);
  assert.equal(preview.ok,true);
  assert.equal(preview.source,'pe-ramen-detached-market-preview');
  assert(preview.sales>0&&preview.variable>=0,'production market kernel produces finite ramen sales/cost');
  assert(preview.ownMarketShare>0&&preview.ownMarketShare<=1,'detached PE ramen receives a bounded market share');
  assert.deepEqual(plain(engine.g),before,'ramen market preview cannot mutate self company, PE cash, supply, competitor state, or ledger');
  assert.equal(randomCalls,callsBefore,'ramen market preview consumes no simulation RNG');

  // Direct kernel parity: preview is only an adapter around the production pure market kernel.
  const direct=market.calculateMarketFromOffers({
    businessID:'ramen',prefID:input.pref.id,areaID:input.area.id,marketPotential:input.marketPotential,
    inflation:input.inflation,economy:input.economy,playerOffers:plain(input.playerOffers),
    competitorOffers:plain(input.competitorOffers),campaignBoosts:{}
  });
  const directRows=Object.values(direct.stores);
  assert.equal(preview.sales,directRows.reduce((a,row)=>a+row.revenue,0));
  assert.equal(preview.variable,directRows.reduce((a,row)=>a+row.variableCost,0));
  assert.equal(preview.ownMarketShare,direct.ownMarketShare);
}

// Neutral price preserves the calibrated generic PE baseline exactly.
deal.portfolioCompany.priceMultiplier=1;
{
  const before=plain(engine.g),callsBefore=randomCalls;
  const generic=ops.calculateGenericPortfolioOperatingWeek(fund,deal,2);
  const neutral=ops.calculatePortfolioOperatingWeek(fund,deal,2,engine.g);
  assert.strictEqual(ops.resolvePortfolioOperatingCalculator(deal,engine.g),ops.calculateRamenPortfolioOperatingWeek,'production state dispatches the ramen market calculator');
  assert.equal(neutral.source,'ramen');
  assert.equal(neutral.revenue,generic.revenue,'neutral ramen production price preserves generic calibrated revenue');
  assert.equal(neutral.profit,generic.profit,'neutral ramen production price preserves generic calibrated profit');
  assert.deepEqual(plain(engine.g),before,'neutral ramen operating calculation stays pure');
  assert.equal(randomCalls,callsBefore,'neutral ramen operating calculation consumes no simulation RNG');
}

// Non-neutral price replaces only the old generic inverse-price response. Other PE levers stay on
// the existing generic path; supply/inventory is deliberately not introduced in this PR.
deal.portfolioCompany.priceMultiplier=1.35;
{
  const before=plain(engine.g),callsBefore=randomCalls;
  const priced=ops.calculatePortfolioOperatingWeek(fund,deal,3,engine.g);
  const pricedGeneric=ops.calculateGenericPortfolioOperatingWeek(fund,deal,3);
  assert.equal(priced.source,'ramen');
  assert(Math.abs(priced.components.ramenSalesFactor-1)>1e-9,'production ramen price elasticity changes sales versus neutral control');
  assert.equal(priced.components.replacedGenericPriceFactor,ops.leverFactors(deal.portfolioCompany,3).priceFactor,'ramen calculator explicitly replaces the generic price factor');
  assert.notEqual(priced.revenue,pricedGeneric.revenue,'production ramen market pricing diverges from the old generic inverse-price formula');
  assert.deepEqual(plain(engine.g),before,'priced ramen operating calculation stays pure');
  assert.equal(randomCalls,callsBefore,'priced ramen operating calculation consumes no simulation RNG');
}

console.log('PE ramen portfolio bridge tests passed');
