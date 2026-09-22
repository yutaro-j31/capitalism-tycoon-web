'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let randomCalls=0;
const handles=loadGame({random:()=>{randomCalls+=1;return .5;},isolatedLegacyIndex:true});
const {engineModule,modules}=handles,pf=modules.peFund,ops=modules.pePortfolioOperations,plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
  const e=new engineModule.TycoonEngine();
  e.configure({playerName:'Exit Preview',companyName:'Preview Partners',difficulty:'normal'});
  e.g.companyCash=7_000_000_000;e.g.personalCash=20_000_000_000;
  pf.recordExit(e.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
  const fund=pf.createFund(e.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
  const deal=ops.acquirePillarCompany(e.g,fund.id,{businessID:'ramen',enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
  deal.companyName='Preview Foods';deal.acquisitionPrice=2_150_000_000;
  deal.portfolioCompany.cash=360_000_000;deal.portfolioCompany.qualityInvestment=40;deal.portfolioCompany.improvementScore=67;deal.portfolioCompany.storeCount=2;
  e.g.week=157;
  return {e,fund,deal};
}
assert.deepEqual(plain(ops.EXIT_METHODS),[{id:'sale',label:'売却',implemented:true},{id:'ipo',label:'IPO',implemented:true}],'production registers sale and IPO exit methods');
assert.equal(typeof engineModule.TycoonEngine.prototype.previewPEPortfolioExit,'function');
assert.equal(typeof engineModule.TycoonEngine.prototype.getPEPortfolioExitCapabilities,'function');
assert.equal(typeof engineModule.TycoonEngine.prototype.previewPEPortfolioExitScenarios,'function');
{
  const {e,fund,deal}=fixture(),before=structuredClone(e.g),callsBefore=randomCalls;
  const capabilities=e.getPEPortfolioExitCapabilities(fund.id,deal.id);
  assert.deepEqual(plain(capabilities),[{id:'sale',label:'売却',implemented:true,eligible:true,reason:null},{id:'ipo',label:'IPO',implemented:true,eligible:true,reason:null}]);
  const preview=e.previewPEPortfolioExit(fund.id,deal.id,{method:'sale'}),again=e.previewPEPortfolioExit(fund.id,deal.id,{method:'sale'});
  assert.equal(preview.ok,true);assert.deepEqual(preview,again,'same state and arguments produce the same preview');
  assert.deepEqual(plain(e.g),before,'capability and preview reads do not mutate state, fund, deal, or any cash balance');
  assert.equal(randomCalls,callsBefore,'preview consumes no RNG');
  assert.equal(preview.companyName,'Preview Foods');assert.equal(preview.acquisitionPrice,deal.acquisitionPrice);assert.equal(preview.investedAmount,deal.investedAmount);
  assert.equal(preview.holdingWeeks,156);assert.equal(preview.optimalHoldingWeeks,pf.FIRST_FUND_HOLD_WEEKS);assert.equal(preview.currentMOIC,preview.grossProceeds/preview.investedAmount);
  assert.deepEqual(preview.settlement,pf.calculateExitSettlement(fund,deal,preview.grossProceeds,e.g.week),'preview reuses the pure production waterfall calculation');
  const companyBefore=e.g.companyCash,personalBefore=e.g.personalCash,distributedBefore=fund.distributed,coinvestBefore=fund.coinvestReturned;
  assert.equal(e.exitPEPortfolioCompany(fund.id,deal.id,{method:'sale'}),true);
  assert.equal(deal.exitProceeds,preview.grossProceeds,'execution records the exact preview proceeds');
  assert.deepEqual(deal.exitSettlement,preview.settlement,'execution records the exact preview settlement');
  assert.equal(fund.distributed-distributedBefore,preview.settlement.distributedToFund);
  assert.equal(fund.coinvestReturned-coinvestBefore,preview.settlement.returnedToCoinvestors);
  assert.ok(Math.abs((e.g.personalCash-personalBefore)-(preview.settlement.gpCarry+preview.settlement.gpPrincipalAndGain))<1);
  assert.equal(e.g.companyCash,companyBefore,'Exit never mixes proceeds into company cash');
  assert.equal(e.getPEPortfolioExitCapabilities(fund.id,deal.id)[0].eligible,false,'exited deals become ineligible');
  assert.equal(e.previewPEPortfolioExit(fund.id,deal.id,{method:'sale'}).reason,'deal-not-active');
}
{
  const {e,fund,deal}=fixture(),before=structuredClone(e.g),callsBefore=randomCalls,baseWeek=e.g.week;
  const center=e.previewPEPortfolioExitScenarios(fund.id,deal.id);
  assert.deepEqual(plain(center.scenarios.map(row=>row.horizonWeeks)),[0,26,52],'decision center exposes the bounded timing choices');
  assert.deepEqual(plain(center.scenarios.map(row=>row.label)),['今売却','+26週保有','+52週保有']);
  assert.deepEqual(plain(e.g),before,'exit timing scenarios are read-only');
  assert.equal(randomCalls,callsBefore,'exit timing scenarios consume no RNG');

  const now=e.previewPEPortfolioExit(fund.id,deal.id,{method:'sale'});
  assert.equal(center.scenarios[0].grossProceeds,now.grossProceeds,'now scenario is the canonical current exit preview');
  assert.deepEqual(center.scenarios[0].settlement,now.settlement,'now scenario reuses the canonical waterfall');

  const simulated=structuredClone(e.g);
  const simulatedFund=simulated.peFirm.funds.find(row=>row.id===fund.id);
  const simulatedDeal=simulatedFund.deals.find(row=>row.id===deal.id);
  for(let week=baseWeek+1;week<=baseWeek+26;week++){simulated.week=week;pf.processFundsWeek(simulated,week);ops.processDealWeek(simulatedFund,simulatedDeal,week,simulated);}
  const manual26=ops.previewPortfolioExit(simulated,fund.id,deal.id,{method:'sale',week:baseWeek+26});
  assert.equal(center.scenarios[1].grossProceeds,manual26.grossProceeds,'+26 weeks reuses the production weekly operating and exit calculations');
  assert.equal(center.scenarios[1].improvementScore,simulatedDeal.portfolioCompany.improvementScore);
  assert.deepEqual(center.scenarios[1].settlement,manual26.settlement);
  assert.equal(center.scenarios[1].holdingWeeks,now.holdingWeeks+26);
  assert.equal(center.scenarios[2].holdingWeeks,now.holdingWeeks+52);
  assert.equal(center.scenarios[1].assumptions.macro,'current-static');
  assert.equal(center.scenarios[1].assumptions.levers,'current-unchanged');
  assert.equal(center.scenarios[1].assumptions.newActions,false);
  assert.ok(Number.isFinite(center.scenarios[1].projectedFundDPI));
  assert.equal(center.scenarios[1].projectedNormalNextFundGate,center.scenarios[1].projectedFundDPI>=pf.NEXT_FUND_MIN_DPI&&center.scenarios[1].deploymentRate>=center.scenarios[1].deploymentGate);

  fund.deadlineWeek=baseWeek+10;
  const capped=e.previewPEPortfolioExitScenarios(fund.id,deal.id,{horizons:[26]}).scenarios[0];
  assert.equal(capped.ok,false);
  assert.equal(capped.reason,'fund-term','scenario beyond the fund term is not presented as executable');
}
{
  const {e,fund,deal}=fixture(),before=structuredClone(e.g),callsBefore=randomCalls;
  const sale=e.previewPEPortfolioExit(fund.id,deal.id,{method:'sale'}),ipo=e.previewPEPortfolioExit(fund.id,deal.id,{method:'ipo'});
  assert.equal(ipo.ok,true,'eligible pillar holding can preview an IPO exit');
  assert.equal(ipo.pricingDiscount,ops.IPO_EXIT_DISCOUNT);
  assert.ok(Math.abs(ipo.exitEnterpriseValue-sale.referenceEnterpriseValue*(1-ops.IPO_EXIT_DISCOUNT))<1e-6,'IPO applies the canonical listing discount to the same reference enterprise value');
  assert.ok(ipo.grossProceeds<sale.grossProceeds,'IPO discount makes current IPO proceeds lower than an otherwise identical sale');
  assert.deepEqual(ipo.settlement,pf.calculateExitSettlement(fund,deal,ipo.grossProceeds,e.g.week),'IPO reuses the canonical PE waterfall');
  assert.deepEqual(plain(e.g),before,'IPO preview is read-only');
  assert.equal(randomCalls,callsBefore,'IPO preview consumes no RNG');

  const companyBefore=e.g.companyCash,personalBefore=e.g.personalCash,distributedBefore=fund.distributed;
  assert.equal(e.exitPEPortfolioCompany(fund.id,deal.id,{method:'ipo'}),true,'eligible IPO exit executes through the existing PE exit writer');
  assert.equal(deal.exitMethod,'ipo');
  assert.equal(deal.exitProceeds,ipo.grossProceeds);
  assert.equal(fund.distributed-distributedBefore,ipo.settlement.distributedToFund);
  assert.ok(Math.abs((e.g.personalCash-personalBefore)-(ipo.settlement.gpCarry+ipo.settlement.gpPrincipalAndGain))<1);
  assert.equal(e.g.companyCash,companyBefore,'IPO proceeds never mix into company cash');
}
{
  const {e,fund,deal}=fixture();
  deal.portfolioCompany.improvementScore=ops.IPO_EXIT_MIN_SCORE-1;
  assert.equal(e.getPEPortfolioExitCapabilities(fund.id,deal.id).find(row=>row.id==='ipo').reason,'ipo-score');
  deal.portfolioCompany.improvementScore=ops.IPO_EXIT_MIN_SCORE;
  e.g.week=deal.acquiredWeek+ops.IPO_EXIT_MIN_HOLD_WEEKS-1;
  assert.equal(e.getPEPortfolioExitCapabilities(fund.id,deal.id).find(row=>row.id==='ipo').reason,'ipo-hold');
  e.g.week=deal.acquiredWeek+ops.IPO_EXIT_MIN_HOLD_WEEKS;
  deal.tierID='smallSuccession';
  assert.equal(e.getPEPortfolioExitCapabilities(fund.id,deal.id).find(row=>row.id==='ipo').reason,'ipo-not-supported');
  assert.equal(e.exitPEPortfolioCompany(fund.id,deal.id,{method:'ipo'}),false,'ineligible IPO never mutates the holding');
}
{
  const {e,fund,deal}=fixture();deal.status='exited';const before=structuredClone(e.g);
  assert.equal(e.getPEPortfolioExitCapabilities(fund.id,deal.id)[0].reason,'deal-not-active');
  assert.equal(e.exitPEPortfolioCompany(fund.id,deal.id,{method:'sale'}),false,'ineligible deals are rejected by execution');
  assert.equal(e.g.companyCash,before.companyCash);assert.equal(e.g.personalCash,before.personalCash);assert.equal(fund.distributed,before.peFirm.funds.find(f=>f.id===fund.id).distributed);
}
console.log('pe exit preview: purity, capabilities, parity, accounting, and determinism passed');
