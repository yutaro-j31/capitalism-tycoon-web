'use strict';
// PE realEstateAgency player-facing UI connection regression.
// The detached brokerage pipeline is safe to manage, but its production model never reads
// business.price. The UI therefore exposes generic PE value-creation levers while deliberately
// omitting/rejecting the legacy generic price control.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

let randomCalls=0,randomState=0x4e414749;
const random=()=>{randomCalls+=1;randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/0x100000000;};
const {ctx,modules}=loadGame({random});
const engine=ctx.__ct_engine;
engine.configure({playerName:'Agency UI Test',companyName:'Agency UI Co',difficulty:'normal'});
engine.g.selectedTab='pe-portfolio';
engine.g.companyCash=9_000_000_000;
engine.g.personalCash=20_000_000_000;

const pf=modules.peFund,ops=modules.pePortfolioOperations,context=modules.managementContext;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'realEstateAgency',enterpriseValue:2_000_000_000,useCoinvest:false,week:engine.g.week});
assert(deal?.portfolioCompany,'realEstateAgency portfolio deal created');
ops.ensure(engine.g);
deal.portfolioCompany.cash=2_000_000_000;

assert.equal(context.resolvePortfolioManagementCapability(deal).actionsEnabled,true,'realEstateAgency management is enabled after its detached production bridge');
let model=modules.peUIAdapter.getPEUIData({portfolioDealId:deal.id});
let holding=model.portfolio.holdings.find(row=>row.dealID===deal.id);
assert(holding,'realEstateAgency holding is present in the real adapter model');
assert.equal(holding.management.actionsEnabled,true,'adapter exposes realEstateAgency management actions');
assert.equal(holding.management.priceEnabled,false,'adapter explicitly marks pricing unavailable because the brokerage model ignores price');
assert.deepEqual(Object.keys(holding.management.gym),['priceMultiplier'],'realEstateAgency still carries the generic persisted multiplier for compatibility, but no gym-only fields');

let saveCalls=0;
engine.save=()=>{saveCalls+=1;return true;};
const outsideBefore={companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash};
const rngBefore=randomCalls;
const priceBefore=deal.portfolioCompany.priceMultiplier;

assert.equal(
  modules.peUIAdapter.performPortfolio('setGymPriceMultiplier',{fundID:fund.id,dealID:deal.id,value:1.7}),
  false,
  'adapter rejects the inert realEstateAgency price action even when management itself is enabled'
);
assert.equal(deal.portfolioCompany.priceMultiplier,priceBefore,'rejected price action cannot mutate the compatibility field');
assert.equal(saveCalls,0,'rejected price action must not save');

const qualityBefore=deal.portfolioCompany.qualityInvestment;
const portfolioCashBefore=deal.portfolioCompany.cash;
assert.equal(modules.peUIAdapter.performPortfolio('investQuality',{fundID:fund.id,dealID:deal.id}),true,'generic PE quality lever remains available');
assert(deal.portfolioCompany.qualityInvestment>qualityBefore,'quality lever mutates the acquired company');
assert(deal.portfolioCompany.cash<portfolioCashBefore,'quality investment spends only portfolio-company cash');
assert.equal(saveCalls,1,'successful generic lever persists once');
assert.deepEqual(
  {companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash},
  outsideBefore,
  'realEstateAgency management never touches self-company, personal, or fund cash'
);
assert.equal(randomCalls,rngBefore,'management actions consume no simulation RNG');

// Exercise the actual D UI route with the production adapter.
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

function click(selector,dataset={}){
  const target={dataset,closest(query){return query===selector?this:null;},matches(){return false;}};
  listeners.get('click')({target,preventDefault(){}});
}

click('[data-pe-view]',{peView:'portfolio'});
assert.match(screen.innerHTML,new RegExp(`data-pe-portfolio-manage="${deal.id}"`),'portfolio list exposes Manage for realEstateAgency');
click('[data-pe-portfolio-manage]',{pePortfolioManage:deal.id});
assert.match(screen.innerHTML,/data-pe-view-root="portfolio-manage"/,'realEstateAgency opens the real D UI management screen');
assert.match(screen.innerHTML,/価格操作なし/,'management screen explains why pricing is unavailable');
assert.doesNotMatch(screen.innerHTML,/data-pe-manage-price(?:\s|=)/,'realEstateAgency renders no inert price slider');
assert.doesNotMatch(screen.innerHTML,/data-pe-manage-strategy=/,'realEstateAgency renders no gym membership strategy');
for(const action of ['investQuality','reformProcurement','setStaffing','renewProductMix','consolidateSites']){
  assert.match(screen.innerHTML,new RegExp(`data-pe-manage-lever="${action}"`),`${action} remains reachable through the calibrated generic PE lever path`);
}

const uiCashBefore=deal.portfolioCompany.cash;
const uiRngBefore=randomCalls;
click('[data-pe-manage-lever]',{peManageLever:'investQuality',peFund:fund.id,peDeal:deal.id});
assert(deal.portfolioCompany.cash<uiCashBefore,'D UI generic lever reaches the acquired realEstateAgency company');
assert.equal(saveCalls,2,'D UI generic lever persists exactly once');
assert.equal(randomCalls,uiRngBefore,'D UI action and rerender consume no simulation RNG');
assert.deepEqual(
  {companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash},
  outsideBefore,
  'D UI realEstateAgency management preserves outside cash isolation'
);

console.log('PE realEstateAgency UI connection tests passed');
