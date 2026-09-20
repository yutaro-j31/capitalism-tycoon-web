'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame,ROOT}=require('./harness');

let randomCalls=0,seed=0x7e57a11;
const {ctx,engineModule,modules}=loadGame({random:()=>{randomCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;},isolatedLegacyIndex:true});
// product-lifecycle.js loads after management-context.js in production index order. The isolated
// harness stops before that late module, so load the real production module explicitly here.
if(!modules.productLifecycle)vm.runInContext(fs.readFileSync(path.join(ROOT,'js/product-lifecycle.js'),'utf8'),ctx,{filename:'js/product-lifecycle.js'});

const pf=modules.peFund,ops=modules.pePortfolioOperations,context=modules.managementContext;
const plain=value=>JSON.parse(JSON.stringify(value));
const engine=new engineModule.TycoonEngine();
engine.configure({playerName:'PE Product Bridge',companyName:'Self Digital Holdings',difficulty:'normal'});
engine.g.companyCash=9_000_000_000;
engine.g.personalCash=12_000_000_000;

// A deliberately unrelated self-company product/funnel exists at the same time. The PE adapter
// must never alias or mutate these records.
engine.g.productVentures=[{
  id:'self-product',blueprintID:'app',name:'Self Product',category:'SaaS',status:'released',origin:'office',economicsVersion:1,
  quality:92,brand:88,users:70_000,paidUsers:8_000,price:9_999,serverCost:50_000,serverCapacity:400_000,
  market:90_000,risk:.05,valuation:900_000_000,revenue:12_000_000,cost:2_000_000,profit:10_000_000,releaseWeek:1,
  maintenancePolicy:'standard',technicalDebt:7,lifecycleAgeWeeks:120,lifecycleIncidents:0,lifecycleStage:'active',
  lastInnovationWeek:0,lastMaintenanceWeek:1,sunsetStartWeek:0,sunsetWeeks:0,retiredWeek:0,retirementReason:''
}];
engine.g.productFunnels={'self-product':{
  productID:'self-product',awareness:.9,registeredUsers:70_000,monthlyActiveUsers:60_000,paidUsers:8_000,
  conversionRate:.14,conversionModifier:.02,churnRate:.01,churnModifier:-.01,arpu:9_999,
  serverLoad:.2,supportBurden:.02,b2bContracts:12,lastUpdatedWeek:1
}};

pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'productVentures',enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
assert(deal?.portfolioCompany,'productVentures PE deal acquired');
assert.equal(context.resolvePortfolioManagementCapability(deal).actionsEnabled,true,'productVentures player-facing actions are enabled once the detached production bridge is connected');

// ---- Detached production input / pure preview --------------------------------------------------
deal.portfolioCompany.priceMultiplier=1.35;
{
  const before=plain(engine.g),callsBefore=randomCalls;
  const input=engine.getPEPortfolioProductVenturesOperatingInput(fund.id,deal.id);
  assert.equal(input.ok,true);
  assert.equal(input.source,'pe-product-ventures-detached-production-input');
  assert.equal(input.product.blueprintID,'app','v1 PE digital archetype reuses the canonical formal SaaS blueprint');
  assert.equal(input.product.id,`pe-product-${deal.id}`,'PE product has a detached synthetic identity');
  assert.notEqual(input.product.id,'self-product');
  const blueprint=modules.data.PRODUCT_BLUEPRINTS.find(row=>row.id==='app'),economics=modules.data.DIGITAL_PRODUCT_ECONOMICS.app;
  assert.equal(input.product.price,blueprint.price*1.35,'PE price lever maps to detached production product price');
  assert.equal(input.funnel.arpu,economics.monthlyArpu*1.35,'PE price lever maps to detached production ARPU');
  assert.notEqual(input.product.price,engine.g.productVentures[0].price,'self-company price cannot leak into PE input');
  assert.equal(input.product.quality,55,'PE operating quality comes from detached mature baseline, not the self-company product');
  assert.deepEqual(plain(engine.g),before,'building productVentures input is read-only');
  assert.equal(randomCalls,callsBefore,'building productVentures input consumes no RNG');

  const preview=engine.previewPEPortfolioProductVenturesWeek(fund.id,deal.id);
  const control=context.previewPEPortfolioProductVenturesWeekForState(engine.g,fund.id,deal.id,{priceMultiplierOverride:1});
  assert.equal(preview.ok&&control.ok,true);
  assert.equal(preview.source,'pe-product-ventures-detached-preview');
  assert(preview.sales>0&&preview.variable>=0&&control.sales>0,'production kernels produce finite operating values');
  assert(preview.sales>control.sales,'higher SaaS ARPU raises production-kernel sales');
  assert(preview.profitBeforeFixed>control.profitBeforeFixed,'higher SaaS ARPU raises production-kernel contribution');
  assert(preview.kpi.registeredUsers>0&&preview.kpi.registeredUsers<=input.product.market,'detached funnel users stay bounded by its own market');
  assert.equal(preview.nextOperatingState.product.price,blueprint.price,'persisted PE state restores neutral base price to prevent multiplier compounding');
  assert.equal(preview.nextOperatingState.funnel.arpu,economics.monthlyArpu,'persisted PE state restores neutral ARPU to prevent multiplier compounding');
  assert.deepEqual(plain(engine.g),before,'productVentures preview cannot mutate self company, PE cash, or ledger');
  assert.equal(randomCalls,callsBefore,'productVentures preview consumes no RNG');

  // Direct parity with the extracted production pure kernels.
  const directFunnel=modules.expansion.calculateFormalProductFunnelWeek({
    product:plain(input.product),funnel:plain(input.funnel),economics:plain(input.economics),week:input.week,
    departmentEffects:{product:0,marketing:0,dx:0},founderSkillTech:0
  });
  const directLifecycle=modules.productLifecycle.calculateProductLifecycleBaseWeek({
    product:plain(directFunnel.nextProduct),funnel:plain(directFunnel.nextFunnel),
    policy:modules.productLifecycle.POLICIES.standard,availableCash:Number.MAX_SAFE_INTEGER,week:input.week
  });
  assert.equal(preview.sales,directFunnel.revenue,'preview sales delegate directly to production formal-product kernel');
  assert.equal(preview.variable,directFunnel.cost+directLifecycle.payable,'preview variable cost is product cost plus production lifecycle maintenance exactly once');
}

// ---- Neutral calibration / priced production response -------------------------------------------
deal.portfolioCompany.priceMultiplier=1;
{
  const before=plain(engine.g),callsBefore=randomCalls;
  const generic=ops.calculateGenericPortfolioOperatingWeek(fund,deal,2);
  const neutral=ops.calculatePortfolioOperatingWeek(fund,deal,2,engine.g);
  assert.strictEqual(ops.resolvePortfolioOperatingCalculator(deal,engine.g),ops.calculateProductVenturesPortfolioOperatingWeek,'production state dispatches the productVentures calculator');
  assert.equal(neutral.source,'productVentures');
  assert.equal(neutral.revenue,generic.revenue,'neutral production bridge preserves calibrated generic revenue exactly');
  assert.equal(neutral.profit,generic.profit,'neutral production bridge preserves calibrated generic profit exactly');
  assert.equal(neutral.components.productVenturesSalesFactor,1);
  assert.equal(neutral.components.productVenturesContributionFactor,1);
  assert.deepEqual(plain(engine.g),before,'neutral productVentures calculation stays pure');
  assert.equal(randomCalls,callsBefore,'neutral productVentures calculation consumes no RNG');
}

deal.portfolioCompany.priceMultiplier=1.35;
{
  const selfBefore=plain({products:engine.g.productVentures,funnels:engine.g.productFunnels});
  const companyCashBefore=engine.g.companyCash,pcCashBefore=deal.portfolioCompany.cash,callsBefore=randomCalls;
  const priced=ops.calculatePortfolioOperatingWeek(fund,deal,3,engine.g);
  const pricedGeneric=ops.calculateGenericPortfolioOperatingWeek(fund,deal,3);
  assert.equal(priced.source,'productVentures');
  assert(priced.components.productVenturesSalesFactor>1,'production SaaS price response replaces generic inverse-price response');
  assert(priced.components.productVenturesContributionFactor>1,'production SaaS contribution responds to price');
  assert.equal(priced.components.replacedGenericPriceFactor,ops.leverFactors(deal.portfolioCompany,3).priceFactor);
  assert.notEqual(priced.revenue,pricedGeneric.revenue,'non-neutral production pricing diverges from the old generic formula');
  assert.equal(ops.settlePortfolioOperatingWeek(deal,priced),true);
  assert.equal(engine.g.companyCash,companyCashBefore,'PE settlement never moves self-company companyCash');
  assert.equal(deal.portfolioCompany.cash,pcCashBefore+priced.profit,'PE operating result settles only into portfolioCompany.cash');
  assert(deal.portfolioCompany.productVenturesOperatingState,'settlement persists only the detached PE product state');
  assert.deepEqual(plain({products:engine.g.productVentures,funnels:engine.g.productFunnels}),selfBefore,'PE settlement cannot mutate self-company product/funnel state');
  assert.equal(randomCalls,callsBefore,'priced calculation and settlement consume no RNG');
}

// ---- 208-week deterministic isolation regression ------------------------------------------------
{
  const selfBefore=plain({products:engine.g.productVentures,funnels:engine.g.productFunnels});
  const companyCashBefore=engine.g.companyCash,callsBefore=randomCalls;
  for(let week=4;week<212;week++){
    const result=ops.calculatePortfolioOperatingWeek(fund,deal,week,engine.g);
    assert.equal(result.source,'productVentures');
    assert(Number.isFinite(result.revenue)&&Number.isFinite(result.profit),`week ${week}: PE result remains finite`);
    assert.equal(ops.settlePortfolioOperatingWeek(deal,result),true,`week ${week}: settles exactly once`);
  }
  const state=deal.portfolioCompany.productVenturesOperatingState;
  assert.equal(state.schemaVersion,context.PRODUCT_VENTURES_OPERATING_STATE_SCHEMA_VERSION);
  assert(Number.isFinite(state.product.valuation)&&state.product.valuation>0,'detached product valuation remains finite');
  assert(Number.isFinite(state.product.technicalDebt),'detached lifecycle debt remains finite');
  assert(state.funnel.registeredUsers>=0&&state.funnel.registeredUsers<=state.product.market,'long-run detached users remain market-bounded');
  assert(Number.isFinite(deal.portfolioCompany.cash),'portfolio company cash remains finite through 208 weeks');
  assert.equal(engine.g.companyCash,companyCashBefore,'208 weeks of PE simulation never touch self-company companyCash');
  assert.deepEqual(plain({products:engine.g.productVentures,funnels:engine.g.productFunnels}),selfBefore,'208 weeks of PE simulation never touch self-company digital products');
  assert.equal(randomCalls,callsBefore,'208-week PE product bridge is deterministic and consumes no simulation RNG');
}

console.log('PE productVentures portfolio bridge tests passed');
