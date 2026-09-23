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
pf.addLPCommitment(fund,{lpTypeID:'regionalBankCorporate',committedAmount:100_000_000,promiseAccepted:true});
fund.cash=6_000_000_000;
fund.deals=[{id:'capital-display-deal',status:'active',fundPortion:4_000_000_000,investedAmount:4_000_000_000}];
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
assert.equal(d.capital.invested,4_000_000_000,'invested capital is derived from canonical fund deployment');
assert.equal(d.capital.fundCash,6_000_000_000,'fund cash is the actual fund cash balance');
assert.equal(d.capital.reserve,0,'active investing fund has no non-investable reserve while all fund cash is investable');
assert.equal(d.capital.investableCash,6_000_000_000,'investing fund cash is available for new investments');
assert.equal(d.capital.singleDealLimit,2_500_000_000,'single-deal limit respects the 25% diversification cap');
assert.equal(d.capital.coinvestRemaining,8_000_000_000,'co-invest headroom is shown separately from fund cash');
assert.equal(d.performance.normalGateMet,false,'synthetic failed fund does not pass the normal gate');
assert.equal(d.performance.rescue.newExits,pf.RESCUE_MIN_NEW_EXITS);
assert.equal(d.performance.rescue.currentScore,20);
assert.equal(d.performance.rescue.requiredScore,20);
assert.equal(d.performance.rescue.available,true,'rescue route is surfaced from production gate logic');
assert.equal(d.performance.nextFundEligible,true,'next-fund eligibility includes the rescue route');
assert.equal(d.performance.outlook.status.id,'both-short','current DPI and deployment shortfall are distinguished');
assert.equal(d.performance.outlook.weeksRemaining,pf.INVESTMENT_PERIOD_WEEKS);
assert.equal(d.performance.outlook.scheduledManagementFees,1_000_000_000,'five remaining annual management fees are deducted from the maturity cash estimate');
assert.equal(d.performance.outlook.cashReturnEstimate,5_000_000_000);
assert.equal(d.performance.outlook.projectedDPI,.5,'maturity reference DPI uses distributed proceeds plus fee-adjusted residual cash');
assert.equal(d.promiseCompliance.accepted,1);
assert.equal(d.promiseCompliance.pending,1);
assert.equal(d.promiseCompliance.rows[0].promiseID,'localInvestment');
assert.equal(d.promiseCompliance.rows[0].detail,'0/2件');

fund.status='harvesting';
const harvest=modules.peUIAdapter.getPEUIData().dashboard;
assert.equal(harvest.capital.fundCash,6_000_000_000,'cash balance remains visible after investment period');
assert.equal(harvest.capital.investableCash,0,'cash is not mislabelled as new-investment capacity after investment period');
assert.equal(harvest.capital.reserve,6_000_000_000,'harvesting cash is explicitly surfaced as non-investable reserve');
assert.equal(harvest.capital.singleDealLimit,0,'single-deal capacity is zero outside the investment period');
assert.equal(harvest.capital.coinvestRemaining,0,'co-invest headroom is not presented as usable outside the investment period');

fund.status='investing';
const screen={innerHTML:'',classList:{add(){},remove(){}}};
const document={addEventListener(){},querySelector(){return null;},getElementById(id){return id==='screen'?screen:null;}};
const uiContext=vm.createContext({console,document,CapitalismTycoonPEUIAdapter:modules.peUIAdapter});
new vm.Script(fs.readFileSync('js/pe-ui.js','utf8'),{filename:'js/pe-ui.js'}).runInContext(uiContext);
assert.equal(uiContext.CapitalismTycoonPEUI.render(),true,'fund D UI renders');
for(const label of ['投資済み','ファンド現金残高','新規投資余力','Reserve','1案件上限','共同投資余力','通常ルート','救済ルート']){
  assert.match(screen.innerHTML,new RegExp(label),`${label} is visible in the fund UI`);
}
assert.match(screen.innerHTML,/救済ルート達成/,'UI distinguishes rescue-route eligibility from the normal gate');
assert.match(screen.innerHTML,/新規Exit 2\/2件/,'UI states the rescue exit requirement and current progress');
assert.match(screen.innerHTML,/トラックレコード 20\/20点/,'UI states the rescue score requirement and current progress');
assert.match(screen.innerHTML,/次号ファンド解禁見通し/,'next-fund outlook panel renders');
assert.match(screen.innerHTML,/DPI・消化率とも不足/,'current blocker state is explicit');
assert.match(screen.innerHTML,/満了時cash返却見込み/,'maturity cash return is visible');
assert.match(screen.innerHTML,/data-pe-promise-compliance/,'LP promise compliance panel renders');
assert.match(screen.innerHTML,/LP約束の履行状況/);
assert.match(screen.innerHTML,/小型承継（smallSuccession）を2件以上取得/);
assert.match(screen.innerHTML,/進行中/);

// A realistic post-exit Fund I can be below 1.20x today while already meeting deployment.
// The adapter must show that scheduled fee-adjusted residual cash return can take it over the
// gate at maturity without changing the production gate itself.
const original={cash:fund.cash,deals:fund.deals,distributed:fund.distributed,lastManagementFeePeriod:fund.lastManagementFeePeriod,status:fund.status};
fund.cash=2_000_000_000;
fund.deals=[{id:'projection-deal',status:'exited',fundPortion:8_000_000_000,investedAmount:8_000_000_000}];
fund.distributed=11_200_000_000;
fund.lastManagementFeePeriod=0;
fund.status='investing';
const canonicalGateBeforeProjection=modules.peFund.canFormNextFund(engine.g);
const projectionBefore=JSON.stringify(engine.g);
const projectionModel=modules.peUIAdapter.getPEUIData().dashboard;
const projection=projectionModel.performance.outlook;
assert.equal(JSON.stringify(engine.g),projectionBefore,'next-fund outlook calculation is read-only');
assert.equal(projection.currentDPI,1.12);
assert.ok(Math.abs(projection.projectedDPI-1.22)<1e-9);
assert.equal(projection.cashReturnEstimate,1_000_000_000);
assert.equal(projection.status.id,'projected');
assert.equal(projection.status.label,'満了時達成見込み');
assert.equal(projectionModel.performance.normalGateMet,false,'reference projection never marks the current normal gate as achieved');
assert.equal(modules.peFund.canFormNextFund(engine.g),canonicalGateBeforeProjection,'reference projection never mutates canonical next-fund eligibility, including an independently satisfied rescue route');
uiContext.CapitalismTycoonPEUI.render();
assert.match(screen.innerHTML,/満了時達成見込み/,'UI surfaces projected gate achievement');
assert.match(screen.innerHTML,/1\.22x/,'UI shows the fee-adjusted maturity reference DPI');
assert.match(screen.innerHTML,/追加投資・将来Exitは含まず/,'UI states the projection scope instead of presenting it as guaranteed');
Object.assign(fund,original);

fund.status='harvesting';
const fund2=pf.createFund(engine.g,{size:4_000_000_000,gpCommit:400_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:engine.g.week+1});
assert(fund2,'Fund II created for comparison');
fund2.cash=3_000_000_000;
fund2.deals=[{id:'fund-2-display-deal',status:'active',fundPortion:1_000_000_000,investedAmount:1_000_000_000}];
pf.ensure(engine.g);
const beforeComparison=JSON.stringify(engine.g);
const comparisonModel=modules.peUIAdapter.getPEUIData().dashboard;
assert.equal(JSON.stringify(engine.g),beforeComparison,'fund comparison adaptation is read-only');
assert.equal(comparisonModel.fund.ordinal,2,'latest fund is the active Fund II');
assert.deepEqual([...comparisonModel.fundComparison.map(row=>row.ordinal)],[1,2],'comparison exposes Fund I and Fund II side by side');
assert.equal(comparisonModel.fundComparison[0].invested,4_000_000_000);
assert.equal(comparisonModel.fundComparison[0].investableCash,0);
assert.equal(comparisonModel.fundComparison[0].reserve,6_000_000_000);
assert.equal(comparisonModel.fundComparison[1].invested,1_000_000_000);
assert.equal(comparisonModel.fundComparison[1].investableCash,3_000_000_000);
assert.equal(comparisonModel.fundComparison[1].reserve,0);
assert.equal(comparisonModel.multiFund.investingCount,1,'Fund II is investing while Fund I harvests');
assert.equal(comparisonModel.multiFund.harvestingCount,1);
assert.equal(comparisonModel.multiFund.rows.length,2);
assert.equal(comparisonModel.multiFund.sharedDD.remaining,pf.ddSlotsRemaining(engine.g,engine.g.week));
assert.equal(comparisonModel.multiFund.rows[0].ordinal,1);
assert.equal(comparisonModel.multiFund.rows[1].ordinal,2);

// When both vehicles are investing, the adapter exposes both as explicit allocation choices for
// a tier that fits both funds. This remains a read-only decision surface.
fund.status='investing';
const multiBefore=JSON.stringify(engine.g);
const desk=modules.peUIAdapter.multiFundDesk(engine.g);
const choices=modules.peUIAdapter.dealFundChoices(engine.g,{peTierID:'pillar'},{});
assert.equal(JSON.stringify(engine.g),multiBefore,'multi-fund desk and allocation choices are read-only');
assert.equal(desk.investingCount,2);
assert.deepEqual(Array.from(choices,row=>row.ordinal),[1,2]);
assert.ok(choices.every(row=>row.slotsRemaining>=0));
assert.ok(choices.every(row=>row.singleDealLimit>=0));
uiContext.CapitalismTycoonPEUI.render();
assert.match(screen.innerHTML,/data-pe-fund-comparison/,'Fund capital comparison section renders');
assert.match(screen.innerHTML,/data-pe-multi-fund-desk/,'Multi-Fund Desk renders');
assert.match(screen.innerHTML,/複数ファンド運用/);
assert.match(screen.innerHTML,/Firm-wide DD/);
assert.match(screen.innerHTML,/全Fundで共用/);
assert.match(screen.innerHTML,/data-pe-fund-summary="1"/,'Fund I summary renders');
assert.match(screen.innerHTML,/data-pe-fund-summary="2"/,'Fund II summary renders');
assert.match(screen.innerHTML,/現金残高/);
assert.match(screen.innerHTML,/投資可能/);
assert.match(screen.innerHTML,/Reserve/);

assert.match(fs.readFileSync('css/d-ui-pe.css','utf8'),/\.pe-promise-grid\{grid-template-columns:1fr\}/,'promise compliance cards stack on mobile');
assert.match(fs.readFileSync('css/d-ui-pe.css','utf8'),/\.pe-multi-fund-grid\{grid-template-columns:1fr\}/,'multi-fund cards stack on mobile');
assert.match(fs.readFileSync('css/d-ui-pe.css','utf8'),/\.pe-deal-fund-select select\{[^}]*min-height:44px/,'fund selector keeps an iPhone-safe tap target');
console.log('PE fund capital and next-fund gate UI tests passed');
