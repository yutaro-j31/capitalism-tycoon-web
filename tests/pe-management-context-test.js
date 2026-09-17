'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let randomCalls=0,randomState=0x13579bdf;
const {engineModule,modules}=loadGame({random:()=>{randomCalls+=1;randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/0x100000000;},isolatedLegacyIndex:true});
const pf=modules.peFund,ops=modules.pePortfolioOperations,context=modules.managementContext;
const plain=value=>JSON.parse(JSON.stringify(value));
const equal=(actual,expected,message)=>assert.deepEqual(plain(actual),plain(expected),message);
function fixture(businessID='ramen'){
  const engine=new engineModule.TycoonEngine();
  engine.configure({playerName:'Context Test',companyName:'Self Company',difficulty:'normal'});
  engine.g.companyCash=7_000_000_000;engine.g.personalCash=20_000_000_000;
  pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
  const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
  const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID,enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
  return {engine,fund,deal};
}
equal(plain(context.supportedBusinessIDs),['ramen','conveni','gym','realEstateAgency','productVentures']);
equal(new engineModule.TycoonEngine().getManagementContext(),{kind:'self'},'default context is self');
{
  const {engine,fund,deal}=fixture(),before=structuredClone(engine.g),callsBefore=randomCalls;
  const capability=context.resolvePortfolioManagementCapability(deal);
  equal(capability,{supported:true,pillar:'ramen',businessID:'ramen',actionsEnabled:false,reason:null});
  equal(engine.canOpenPEPortfolioManagement(fund.id,deal.id),{ok:true,capability});
  const opened=engine.openPEPortfolioManagement(fund.id,deal.id);
  assert.equal(opened.ok,true);equal(engine.getManagementContext(),{kind:'pePortfolio',fundID:fund.id,dealID:deal.id,businessID:'ramen',pillar:'ramen'});
  assert.equal(engine.resolveManagementContext().capability.actionsEnabled,false,'existing self actions remain disabled in a PE context');
  equal(engine.g,before,'read/open only changes runtime context');
  assert.equal(randomCalls,callsBefore,'context lifecycle consumes no RNG');
  equal(engine.closeManagementContext(),{ok:true,context:{kind:'self'}});equal(engine.getManagementContext(),{kind:'self'});
  equal(engine.g,before,'open and close preserve all simulation cash, stores, ledger, and portfolio state');
  const payload=plain(engine.g);assert.equal(Object.hasOwn(payload,'managementContext'),false,'runtime context is absent from save payload');
}
for(const [label,mutate,reason] of [
  ['invalid fund',({fund})=>['missing',fund.deals[0].id],'fund-not-found'],
  ['invalid deal',({fund})=>[fund.id,'missing'],'deal-not-found'],
  ['exited deal',({fund,deal})=>{deal.status='exited';return[fund.id,deal.id];},'deal-not-active'],
  ['missing portfolio',({fund,deal})=>{delete deal.portfolioCompany;return[fund.id,deal.id];},'portfolio-company-not-found']
]){
  const data=fixture(),args=mutate(data),before=structuredClone(data.engine.g);
  equal(data.engine.openPEPortfolioManagement(...args),{ok:false,reason,context:{kind:'self'}},label);
  equal(data.engine.getManagementContext(),{kind:'self'});equal(data.engine.g,before);
}
{
  const {engine,fund,deal}=fixture();deal.businessID='unsupported-business';const before=structuredClone(engine.g);
  equal(context.resolvePortfolioManagementCapability(deal),{supported:false,pillar:null,businessID:'unsupported-business',actionsEnabled:false,reason:'unsupported-pillar'});
  assert.equal(engine.openPEPortfolioManagement(fund.id,deal.id).reason,'unsupported-pillar');equal(engine.g,before);
}
{
  const {engine}=fixture(),saved=plain(engine.g),loaded=new engineModule.TycoonEngine(saved);
  equal(loaded.getManagementContext(),{kind:'self'},'old/current save loads into self context');
  const beforeCash=loaded.g.companyCash,business=loaded.business('ramen');
  assert.equal(loaded.adjustPrice('ramen',business.price+10),true);assert.equal(loaded.g.companyCash,beforeCash,'self gameplay behavior remains unchanged');
}

// Detached PE-gym production input: use the PE production site and shared market environment,
// but never point the gym model at the player's self-company state or settle any PE cash here.
{
  const initial=context.defaultPEPortfolioGymOperatingState();
  assert.equal(initial.schemaVersion,context.GYM_OPERATING_STATE_SCHEMA_VERSION);
  assert.equal(initial.condition,modules.storeEquipment.FULL_CONDITION);
  assert.equal(initial.level,1);
  assert.equal(initial.operatingHours,modules.storeEquipment.DEFAULT_OPERATING_HOURS);
  assert.equal(initial.gymMembership.schemaVersion,modules.gymMembershipModel.SCHEMA_VERSION);
  assert.equal(initial.gymMembership.members,0);
}
{
  const {engine,fund,deal}=fixture('gym');
  // Deliberately distort the self-company gym record. The PE input must still start from the
  // static production master so self price/quality/brand/DX choices cannot leak across owners.
  const selfGym=engine.business('gym');selfGym.price*=3;selfGym.quality=99;selfGym.brand=91;selfGym.dx=77;
  deal.portfolioCompany.priceMultiplier=1.25;
  const before=plain(engine.g),callsBefore=randomCalls;
  const input=engine.getPEPortfolioGymOperatingInput(fund.id,deal.id);
  assert.equal(input.ok,true);assert.equal(input.source,'pe-gym-detached-production-input');
  const site=ops.getPortfolioProductionSite(engine.g,fund.id,deal.id);equal(input.productionSite,site,'adapter uses persisted PE production site');
  const pref=engine.g.prefs.find(row=>row.id===site.prefID),area=engine.g.areas.find(row=>row.id===site.areaID);
  assert(pref&&area&&pref.areaID===area.id);
  const expectedPressure=modules.storeMarketEnvironment.competitorPressure(engine.g.competitors,area.id,'gym');
  assert.equal(input.competitorPressure,expectedPressure);
  assert.equal(input.localCompetition,modules.storeMarketEnvironment.localCompetition(area,expectedPressure));
  assert(Number.isFinite(input.demand)&&input.demand>0,'shared production demand is finite and positive');
  const gymMaster=modules.data.MASTER.businesses.find(row=>row.id==='gym');
  assert(gymMaster,'static gym business master exists');
  assert.equal(input.business.price,gymMaster.price*1.25,'PE price lever maps onto the detached gym fee');
  assert.equal(input.business.quality,gymMaster.quality,'self-company quality must not leak into detached PE input');
  assert.equal(input.business.brand,gymMaster.brand,'self-company brand must not leak into detached PE input');
  assert.equal(input.business.dx,gymMaster.dx,'self-company DX must not leak into detached PE input');
  assert.notEqual(input.business.price,selfGym.price,'detached business does not alias self-company pricing');
  assert.equal(input.portfolioLevers.qualityInvestment,deal.portfolioCompany.qualityInvestment,'unmapped PE levers remain explicit for the future calibrated calculator');
  equal(engine.g,before,'building detached gym input is read-only');
  assert.equal(randomCalls,callsBefore,'building detached gym input consumes no RNG');

  const directStore=plain(input.store),directBusiness=plain(input.business);
  const directResult=modules.gymMembershipModel.processStore({week:input.week},directStore,directBusiness,input.demand,input.inflation,input.localCompetition);
  const preview=engine.previewPEPortfolioGymWeek(fund.id,deal.id);
  assert.equal(preview.ok,true);assert.equal(preview.source,'pe-gym-detached-preview');
  assert.equal(preview.sales,directResult.sales);assert.equal(preview.variable,directResult.variable);
  equal(preview.nextOperatingState.gymMembership,directStore.gymMembership,'preview delegates to the production gym membership model');
  assert(preview.membershipWeek&&preview.membershipWeek.members>0,'preview advances detached membership state');
  equal(engine.g,before,'gym preview cannot mutate self company, PE cash, ledger, or saved portfolio state');
  assert.equal(randomCalls,callsBefore,'gym preview consumes no RNG');

  const next=engine.previewPEPortfolioGymWeek(fund.id,deal.id,{week:input.week+1,operatingState:preview.nextOperatingState});
  assert.equal(next.ok,true);assert.equal(next.membershipWeek.week,input.week+1);
  assert(next.nextOperatingState.gymMembership.members>=0);
  equal(engine.g,before,'chained detached previews still do not persist or settle state');
  assert.equal(randomCalls,callsBefore,'chained detached preview consumes no RNG');

  assert.strictEqual(ops.resolvePortfolioOperatingCalculator(deal),ops.calculateGenericPortfolioOperatingWeek,'weekly PE dispatch remains generic in this prerequisite');
  // gym is the first (so far only) pillar business whose detached production bridge above is
  // wired all the way to a player-facing management action -- see tests/pe-gym-management-actions-test.js.
  assert.equal(engine.canOpenPEPortfolioManagement(fund.id,deal.id).capability.actionsEnabled,true,'gym management actions are enabled once the detached bridge exists');
}
{
  const {engine,fund,deal}=fixture('productVentures');
  assert.equal(engine.canOpenPEPortfolioManagement(fund.id,deal.id).capability.actionsEnabled,false,'other supported pillars stay disabled until they have their own detached bridge');
}
// Detached PE-conveni production input: same detachment discipline as gym above (see
// tests/pe-conveni-portfolio-bridge-test.js for the full state-isolation/cluster-proxy coverage).
// This block only confirms the input/preview plumbing mirrors gym's own read-only contract.
{
  const {engine,fund,deal}=fixture('conveni');
  assert.equal(engine.canOpenPEPortfolioManagement(fund.id,deal.id).capability.actionsEnabled,true,'conveni management actions are enabled once its detached bridge exists');
  // Deliberately distort the self-company conveni record. The PE input must still start from the
  // static production master so self price/quality/brand/DX choices cannot leak across owners.
  const selfConveni=engine.business('conveni');selfConveni.price*=3;selfConveni.quality=99;selfConveni.brand=91;selfConveni.dx=77;
  deal.portfolioCompany.priceMultiplier=1.25;
  const before=plain(engine.g),callsBefore=randomCalls;
  const input=engine.getPEPortfolioConveniOperatingInput(fund.id,deal.id);
  assert.equal(input.ok,true);assert.equal(input.source,'pe-conveni-detached-production-input');
  const site=ops.getPortfolioProductionSite(engine.g,fund.id,deal.id);equal(input.productionSite,site,'adapter uses persisted PE production site');
  const conveniMaster=modules.data.MASTER.businesses.find(row=>row.id==='conveni');
  assert(conveniMaster,'static conveni business master exists');
  assert.equal(input.business.price,conveniMaster.price*1.25,'PE price lever maps onto the detached conveni price');
  assert.equal(input.business.quality,conveniMaster.quality,'self-company quality must not leak into detached PE input');
  assert.notEqual(input.business.price,selfConveni.price,'detached business does not alias self-company pricing');
  equal(engine.g,before,'building detached conveni input is read-only');
  assert.equal(randomCalls,callsBefore,'building detached conveni input consumes no RNG');

  const preview=engine.previewPEPortfolioConveniWeek(fund.id,deal.id);
  assert.equal(preview.ok,true);assert.equal(preview.source,'pe-conveni-detached-preview');
  assert(Number.isFinite(preview.sales)&&preview.sales>0,'detached conveni preview produces positive sales');
  equal(engine.g,before,'conveni preview cannot mutate self company, PE cash, ledger, or saved portfolio state');
  assert.equal(randomCalls,callsBefore,'conveni preview consumes no RNG');
}
{
  const {engine,fund,deal}=fixture('gym'),before=plain(engine.g),callsBefore=randomCalls;
  equal(engine.getPEPortfolioConveniOperatingInput(fund.id,deal.id),{ok:false,reason:'not-conveni',fundID:fund.id,dealID:deal.id});
  equal(engine.g,before);assert.equal(randomCalls,callsBefore);
}
{
  const {engine,fund,deal}=fixture('ramen'),before=plain(engine.g),callsBefore=randomCalls;
  equal(engine.getPEPortfolioGymOperatingInput(fund.id,deal.id),{ok:false,reason:'not-gym',fundID:fund.id,dealID:deal.id});
  equal(engine.g,before);assert.equal(randomCalls,callsBefore);
}
{
  const {engine,fund,deal}=fixture('gym');delete deal.portfolioCompany.productionSite;
  const before=plain(engine.g),callsBefore=randomCalls;
  equal(engine.getPEPortfolioGymOperatingInput(fund.id,deal.id),{ok:false,reason:'production-site-missing',fundID:fund.id,dealID:deal.id});
  equal(engine.g,before,'adapter does not lazily mutate a missing site');assert.equal(randomCalls,callsBefore);
}
console.log('PE management context foundation tests passed');
