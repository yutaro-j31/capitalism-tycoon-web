'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./harness');

const {ctx,modules}=loadGame();
const engine=ctx.__ct_engine;
engine.configure({playerName:'Fund Capital UI Test',companyName:'Fund Capital UI Co',difficulty:'normal'});
engine.g.personalCash=20_000_000_000;
const pf=modules.peFund;
pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:engine.g.week});
assert(fund,'fund created');
fund.cash=6_000_000_000;
fund.coinvestCommitted=2_000_000_000;
fund.trackScoreAtFormation=10;
engine.g.peFirm.trackRecord.score=20;
engine.g.peFirm.trackRecord.exits.push(
  {id:'rescue-1',exitType:'buyout',recordedWeek:fund.y0+1},
  {id:'rescue-2',exitType:'ipo',recordedWeek:fund.y0+2}
);
engine.g.selectedTab='pe-portfolio';
pf.ensure(engine.g); // Snapshot the canonical normalized production state, not raw test mutations.

const before=JSON.stringify(engine.g);
const model=modules.peUIAdapter.getPEUIData();
assert.equal(JSON.stringify(engine.g),before,'capital/gate adaptation is read-only');
const d=model.dashboard;
assert.equal(d.capital.fundCash,6_000_000_000,'fund cash is the actual fund cash balance');
assert.equal(d.capital.investableCash,6_000_000_000,'investing fund cash is available for new investments');
assert.equal(d.capital.singleDealLimit,2_500_000_000,'single-deal limit respects the 25% diversification cap');
assert.equal(d.capital.coinvestRemaining,8_000_000_000,'co-invest headroom is shown separately from fund cash');
assert.equal(d.performance.normalGateMet,false,'synthetic failed fund does not pass the normal gate');
assert.equal(d.performance.rescue.newExits,pf.RESCUE_MIN_NEW_EXITS);
assert.equal(d.performance.rescue.currentScore,20);
assert.equal(d.performance.rescue.requiredScore,20);
assert.equal(d.performance.rescue.available,true,'rescue route is surfaced from production gate logic');
assert.equal(d.performance.nextFundEligible,true,'next-fund eligibility includes the rescue route');

fund.status='harvesting';
const harvest=modules.peUIAdapter.getPEUIData().dashboard;
assert.equal(harvest.capital.fundCash,6_000_000_000,'cash balance remains visible after investment period');
assert.equal(harvest.capital.investableCash,0,'cash is not mislabelled as new-investment capacity after investment period');
assert.equal(harvest.capital.singleDealLimit,0,'single-deal capacity is zero outside the investment period');
assert.equal(harvest.capital.coinvestRemaining,0,'co-invest headroom is not presented as usable outside the investment period');

fund.status='investing';
const screen={innerHTML:'',classList:{add(){},remove(){}}};
const document={addEventListener(){},querySelector(){return null;},getElementById(id){return id==='screen'?screen:null;}};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
assert.equal(uiContext.CapitalismTycoonPEUI.render(),true,'fund D UI renders');
for(const label of ['ファンド現金残高','新規投資余力','1案件上限','共同投資余力','通常ルート','救済ルート']){
  assert.match(screen.innerHTML,new RegExp(label),`${label} is visible in the fund UI`);
}
assert.match(screen.innerHTML,/救済ルート達成/,'UI distinguishes rescue-route eligibility from the normal gate');
assert.match(screen.innerHTML,/新規Exit 2\/2件/,'UI states the rescue exit requirement and current progress');
assert.match(screen.innerHTML,/トラックレコード 20\/20点/,'UI states the rescue score requirement and current progress');

console.log('PE fund capital and next-fund gate UI tests passed');
