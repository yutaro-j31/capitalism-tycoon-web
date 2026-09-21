'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

const {ctx,modules}=loadGame();
const engine=ctx.__ct_engine;
engine.configure({playerName:'Action Cost Test',companyName:'Action Cost Co',difficulty:'normal'});
engine.g.companyCash=9_000_000_000;
engine.g.personalCash=20_000_000_000;
engine.g.selectedTab='pe-portfolio';
const pf=modules.peFund,ops=modules.pePortfolioOperations;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'gym',enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
assert(deal?.portfolioCompany);
const pc=deal.portfolioCompany;
pc.cash=2_000_000_000;

let p=ops.previewManagementActions(engine.g,fund.id,deal.id);
assert.equal(p.investQuality.cost,10_000_000);
assert.equal(p.reformProcurement.cost,5_000_000,'+25pt procurement costs 0.25 * 1% * EV');
assert.equal(p.renewProductMix.cost,30_000_000,'+50pt product mix costs 0.5 * 3% * EV');
assert.equal(p.headcountDown.cost,0);
assert.equal(p.wageUp.cost,0);
assert.equal(p.consolidateSites.cost,0);

let before=pc.cash;
assert(ops.investQuality(engine.g,fund.id,deal.id,10_000_000));
assert.equal(before-pc.cash,p.investQuality.cost,'quality preview equals production spend');

p=ops.previewManagementActions(engine.g,fund.id,deal.id);
before=pc.cash;
assert(ops.reformProcurement(engine.g,fund.id,deal.id,Math.min(1,pc.procurementReform+.25)));
assert.equal(before-pc.cash,p.reformProcurement.cost,'procurement preview equals production spend');

p=ops.previewManagementActions(engine.g,fund.id,deal.id);
before=pc.cash;
assert(ops.renewProductMix(engine.g,fund.id,deal.id,Math.min(1,pc.productMixLevel+.5)));
assert.equal(before-pc.cash,p.renewProductMix.cost,'product-mix preview equals production spend');

pc.cash=1_000_000;
p=ops.previewManagementActions(engine.g,fund.id,deal.id);
assert.equal(p.reformProcurement.executable,false);
assert.equal(p.reformProcurement.reason,'cash');
assert.equal(p.renewProductMix.executable,false);
assert.equal(p.renewProductMix.reason,'cash');
assert.equal(p.investQuality.executable,true,'quality action remains executable as a partial spend');
assert.equal(p.investQuality.cost,1_000_000,'partial quality spend preview matches writer semantics');

let model=modules.peUIAdapter.getPEUIData({portfolioDealId:deal.id});
const l=model.portfolio.selected.management.levers;
assert.equal(l.canReformProcurement,false,'adapter disables unaffordable procurement reform');
assert.equal(l.costs.reformProcurement.reasonLabel,'買収先cash不足');
assert.equal(l.costs.reformProcurement.cost,p.reformProcurement.cost);
assert.equal(l.costs.investQuality.cost,1_000_000);

const listeners=new Map();
const screen={innerHTML:'',classList:{add(){},remove(){}}};
const document={
  addEventListener(type,cb){listeners.set(type,cb);},
  querySelector(){return null;},
  getElementById(id){return id==='screen'?screen:null;}
};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
function targetFor(selector,dataset={}){return {dataset,closest(q){return q===selector?this:null;},matches(){return false;}};}
function click(selector,dataset={}){listeners.get('click')({target:targetFor(selector,dataset),preventDefault(){}});}
click('[data-pe-view]',{peView:'portfolio'});
click('[data-pe-portfolio-manage]',{pePortfolioManage:deal.id});
assert.match(screen.innerHTML,/pe-action-cost/,'management UI renders action-cost rows');
assert.match(screen.innerHTML,/費用 0\.01億円/,'partial 100万円 quality spend is visible');
assert.match(screen.innerHTML,/実行後cash 0億円/,'post-action portfolio cash is visible');
assert.match(screen.innerHTML,/買収先cash不足/,'unaffordable action shows the exact disable reason');
assert.match(screen.innerHTML,/data-pe-manage-lever="reformProcurement"[^>]*disabled/,'unaffordable procurement action is disabled');

const source=fs.readFileSync('js/pe-portfolio-operations.js','utf8');
assert.doesNotMatch(source,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'cost preview adds no nondeterminism');

console.log('PE portfolio action cost preview tests passed');
