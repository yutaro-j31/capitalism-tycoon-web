'use strict';
// PE D UI generic management-lever reachability regression.
// Proves the actual player-facing pe-ui.js click path reaches the real pe-ui-adapter and the
// production pe-portfolio-operations writers for all five generic lever groups.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

let randomCalls=0,randomState=0x62d78f13;
const random=()=>{randomCalls+=1;randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/0x100000000;};
const {ctx,modules}=loadGame({random});
const engine=ctx.__ct_engine;
engine.configure({playerName:'D UI Lever Test',companyName:'Lever Test Co',difficulty:'normal'});
engine.g.selectedTab='pe-portfolio';
engine.g.companyCash=9_000_000_000;
engine.g.personalCash=20_000_000_000;

const pf=modules.peFund,ops=modules.pePortfolioOperations;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'gym',enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
assert(deal?.portfolioCompany,'gym portfolio deal created');
ops.ensure(engine.g);
const pc=deal.portfolioCompany;
pc.cash=2_000_000_000;

let saveCalls=0;
engine.save=()=>{saveCalls+=1;return true;};

// Run the real D UI source in a small DOM shell, but inject the real production adapter from the
// full game above. This lets synthetic clicks exercise pe-ui.js -> pe-ui-adapter.js -> production
// operations without replacing the adapter or the portfolio writers with mocks.
const listeners=new Map();
const screen={innerHTML:'',classList:{add(){}}};
const document={
  addEventListener(type,callback){listeners.set(type,callback);},
  querySelector(){return null;},
  getElementById(id){return id==='screen'?screen:null;}
};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
assert.equal(typeof listeners.get('click'),'function','pe-ui.js registered the production click handler');

function targetFor(selector,dataset={}){
  return {dataset,closest(query){return query===selector?this:null;},matches(){return false;}};
}
function click(selector,dataset={}){
  listeners.get('click')({target:targetFor(selector,dataset),preventDefault(){}});
}

// Reach the actual management screen through the same two D UI transitions a player uses.
click('[data-pe-view]',{peView:'portfolio'});
assert.match(screen.innerHTML,/data-pe-portfolio-manage=/,'portfolio D UI exposes the manage entry point');
click('[data-pe-portfolio-manage]',{pePortfolioManage:deal.id});
assert.match(screen.innerHTML,/data-pe-view-root="portfolio-manage"/,'manage transition renders the D UI management screen');

// All five generic lever groups must be visible on the real D UI manage screen. Staffing has two
// controls because headcount and wages are the two dimensions of the same lever group.
for(const action of ['investQuality','reformProcurement','setStaffing','renewProductMix','consolidateSites']){
  assert.match(screen.innerHTML,new RegExp(`data-pe-manage-lever="${action}"`),`${action} is reachable from D UI`);
}
assert.match(screen.innerHTML,/data-pe-manage-kind="headcount-down"/,'staffing exposes headcount control');
assert.match(screen.innerHTML,/data-pe-manage-kind="wage-up"/,'staffing exposes wage control');
assert.match(screen.innerHTML,/data-pe-manage-price/,'existing price control remains present');
assert.match(screen.innerHTML,/data-pe-manage-strategy/,'existing gym membership strategy remains present');

const outsideBefore={companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash};
const rngBefore=randomCalls;
const qualityBefore=pc.qualityInvestment;
const cashBeforeQuality=pc.cash;
click('[data-pe-manage-lever]',{peManageLever:'investQuality',peFund:fund.id,peDeal:deal.id});
assert(pc.qualityInvestment>qualityBefore,'quality D UI click reaches production investQuality');
assert(pc.cash<cashBeforeQuality,'quality investment spends portfolio-company cash');

const procurementBefore=pc.procurementReform;
click('[data-pe-manage-lever]',{peManageLever:'reformProcurement',peFund:fund.id,peDeal:deal.id});
assert.equal(pc.procurementReform,Math.min(1,procurementBefore+.25),'procurement D UI click reaches production reformProcurement');

const headcountBefore=pc.headcountRatio;
click('[data-pe-manage-lever]',{peManageLever:'setStaffing',peManageKind:'headcount-down',peFund:fund.id,peDeal:deal.id});
assert.equal(pc.headcountRatio,headcountBefore-.1,'staffing D UI click reaches production headcount write');

const wageBefore=pc.wageLevel;
click('[data-pe-manage-lever]',{peManageLever:'setStaffing',peManageKind:'wage-up',peFund:fund.id,peDeal:deal.id});
assert.equal(pc.wageLevel,wageBefore+.1,'staffing D UI wage click reaches production wage write');

const mixBefore=pc.productMixLevel;
click('[data-pe-manage-lever]',{peManageLever:'renewProductMix',peFund:fund.id,peDeal:deal.id});
assert.equal(pc.productMixLevel,Math.min(1,mixBefore+.5),'product-mix D UI click reaches production renewProductMix');

const consolidatedBefore=pc.consolidatedRatio;
click('[data-pe-manage-lever]',{peManageLever:'consolidateSites',peFund:fund.id,peDeal:deal.id});
assert(pc.consolidatedRatio>consolidatedBefore,'site-restructuring D UI click reaches production consolidateSites');
assert.equal(pc.closedSiteCount,1,'site restructuring records one closed site');

assert.deepEqual(
  {companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash},
  outsideBefore,
  'generic D UI management levers never touch self-company cash, personal cash, or fund cash'
);
assert.equal(randomCalls,rngBefore,'D UI management actions and rerenders consume no simulation RNG');
assert.equal(saveCalls,6,'six successful controls across five generic lever groups persist exactly once each');

// Employment promises must disable the two destructive controls in the player-facing D UI.
deal.employmentPromise=true;
uiContext.CapitalismTycoonPEUI.render();
assert.match(screen.innerHTML,/data-pe-manage-kind="headcount-down"[^>]*disabled/,'employment promise disables headcount cuts in D UI');
assert.match(screen.innerHTML,/data-pe-manage-lever="consolidateSites"[^>]*disabled/,'employment promise disables site restructuring in D UI');

// Mobile/touch contract: every generic lever action retains a 44px minimum target.
const css=fs.readFileSync('css/d-ui-pe.css','utf8');
assert.match(css,/\.pe-lever-card \.btn\{[^}]*min-height:44px/,'generic D UI lever controls keep a 44px tap target');

console.log('pe D UI generic management lever reachability tests passed');
