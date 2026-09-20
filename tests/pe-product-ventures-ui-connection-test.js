'use strict';
// PE productVentures UI connection regression.
// Proves the detached production bridge can now be reached from the real PE D UI without
// enabling the still-pending realEstateAgency management surface or leaking cash outside the
// acquired portfolio company.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

let randomCalls=0,randomState=0x5a17c9e3;
const random=()=>{randomCalls+=1;randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/0x100000000;};
const {ctx,modules}=loadGame({random});
const engine=ctx.__ct_engine;
engine.configure({playerName:'Product Ventures UI Test',companyName:'Product Ventures UI Co',difficulty:'normal'});
engine.g.companyCash=9_000_000_000;
engine.g.personalCash=20_000_000_000;

const pf=modules.peFund,ops=modules.pePortfolioOperations,context=modules.managementContext;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
const productDeal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'productVentures',enterpriseValue:2_000_000_000,useCoinvest:false,week:engine.g.week});
const agencyDeal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'realEstateAgency',enterpriseValue:2_000_000_000,useCoinvest:false,week:engine.g.week});
assert(productDeal?.portfolioCompany,'productVentures portfolio deal created');
assert(agencyDeal?.portfolioCompany,'realEstateAgency control deal created');
ops.ensure(engine.g);
productDeal.portfolioCompany.cash=2_000_000_000;

assert.equal(context.resolvePortfolioManagementCapability(productDeal).actionsEnabled,true,'productVentures player-facing management is enabled after the production bridge');
assert.equal(context.resolvePortfolioManagementCapability(agencyDeal).actionsEnabled,false,'realEstateAgency remains UI-disabled in this PR');

let model=modules.peUIAdapter.getPEUIData({portfolioDealId:productDeal.id});
let holding=model.portfolio.holdings.find(row=>row.dealID===productDeal.id);
assert(holding,'productVentures holding is present in the real PE adapter model');
assert.equal(holding.management.actionsEnabled,true,'adapter exposes productVentures management actions');
assert.deepEqual(Object.keys(holding.management.gym),['priceMultiplier'],'productVentures receives only the business-agnostic price field, never gym membership controls');

let saveCalls=0;
engine.save=()=>{saveCalls+=1;return true;};
const outsideBefore={companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash};
const rngBefore=randomCalls;

assert.equal(modules.peUIAdapter.performPortfolio('setGymPriceMultiplier',{fundID:fund.id,dealID:productDeal.id,value:1.35}),true,'productVentures price action reaches the generic portfolio price writer');
assert.equal(productDeal.portfolioCompany.priceMultiplier,1.35);
assert.equal(modules.peUIAdapter.performPortfolio('setGymMembershipStrategy',{fundID:fund.id,dealID:productDeal.id,strategyID:'premium'}),false,'gym-only membership strategy remains unavailable to productVentures');
const qualityBefore=productDeal.portfolioCompany.qualityInvestment;
const portfolioCashBefore=productDeal.portfolioCompany.cash;
assert.equal(modules.peUIAdapter.performPortfolio('investQuality',{fundID:fund.id,dealID:productDeal.id}),true,'generic PE quality lever is reachable for productVentures');
assert(productDeal.portfolioCompany.qualityInvestment>qualityBefore,'quality action mutates only the acquired company lever');
assert(productDeal.portfolioCompany.cash<portfolioCashBefore,'quality investment spends only portfolio-company cash');
assert.deepEqual(
  {companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash},
  outsideBefore,
  'productVentures management actions do not touch self-company cash, personal cash, or fund cash'
);
assert.equal(saveCalls,2,'two successful direct management writes persist exactly once each');
assert.equal(randomCalls,rngBefore,'direct productVentures management actions consume no simulation RNG');

// Run the real D UI source with the production adapter and prove the player-facing manage route,
// price control, and generic lever controls are reachable for productVentures.
const listeners=new Map();
const screen={innerHTML:'',classList:{add(){}}};
const document={
  addEventListener(type,callback){listeners.set(type,callback);},
  querySelector(){return null;},
  getElementById(id){return id==='screen'?screen:null;}
};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
assert.equal(typeof listeners.get('click'),'function','pe-ui.js registered its real click handler');
assert.equal(typeof listeners.get('change'),'function','pe-ui.js registered its real change handler');

function click(selector,dataset={}){
  const target={dataset,closest(query){return query===selector?this:null;},matches(){return false;}};
  listeners.get('click')({target,preventDefault(){}});
}
click('[data-pe-view]',{peView:'portfolio'});
assert.match(screen.innerHTML,new RegExp(`data-pe-portfolio-manage="${productDeal.id}"`),'portfolio list exposes Manage for productVentures');
click('[data-pe-portfolio-manage]',{pePortfolioManage:productDeal.id});
assert.match(screen.innerHTML,/data-pe-view-root="portfolio-manage"/,'productVentures opens the real D UI management screen');
assert.match(screen.innerHTML,/data-pe-manage-price/,'productVentures management screen exposes the production-bound price control');
for(const action of ['investQuality','reformProcurement','setStaffing','renewProductMix','consolidateSites']){
  assert.match(screen.innerHTML,new RegExp(`data-pe-manage-lever="${action}"`),`${action} remains reachable through the calibrated generic PE lever path`);
}
assert.doesNotMatch(screen.innerHTML,/data-pe-manage-strategy=/,'productVentures never renders gym membership strategy controls');

const uiRngBefore=randomCalls;
const priceTarget={
  value:'1.55',
  dataset:{peFund:String(fund.id),peDeal:String(productDeal.id)},
  matches(query){return query==='[data-pe-manage-price]';}
};
listeners.get('change')({target:priceTarget});
assert.equal(productDeal.portfolioCompany.priceMultiplier,1.55,'D UI price change reaches the productVentures portfolio company');
assert.equal(saveCalls,3,'D UI price write persists exactly once');
assert.equal(randomCalls,uiRngBefore,'D UI productVentures price change and rerender consume no simulation RNG');
assert.deepEqual(
  {companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash},
  outsideBefore,
  'D UI productVentures management keeps all outside cash ledgers isolated'
);

console.log('PE productVentures UI connection tests passed');
