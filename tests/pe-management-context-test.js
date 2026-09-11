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
console.log('PE management context foundation tests passed');
