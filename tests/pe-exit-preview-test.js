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
assert.deepEqual(plain(ops.EXIT_METHODS),[{id:'sale',label:'売却',implemented:true}],'only the production sale method is registered');
assert.equal(typeof engineModule.TycoonEngine.prototype.previewPEPortfolioExit,'function');
assert.equal(typeof engineModule.TycoonEngine.prototype.getPEPortfolioExitCapabilities,'function');
{
  const {e,fund,deal}=fixture(),before=structuredClone(e.g),callsBefore=randomCalls;
  const capabilities=e.getPEPortfolioExitCapabilities(fund.id,deal.id);
  assert.deepEqual(plain(capabilities),[{id:'sale',label:'売却',implemented:true,eligible:true,reason:null}]);
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
  const {e,fund,deal}=fixture(),before=structuredClone(e.g);
  assert.deepEqual(plain(e.previewPEPortfolioExit(fund.id,deal.id,{method:'ipo'})),{ok:false,fundID:fund.id,dealID:deal.id,method:'ipo',eligibility:{eligible:false,reason:'method-not-supported'},reason:'method-not-supported'});
  assert.equal(e.exitPEPortfolioCompany(fund.id,deal.id,{method:'ipo'}),false,'execution rejects methods outside the same capability registry');
  assert.equal(deal.status,'active');assert.equal(deal.settlement,undefined);assert.equal(fund.distributed,before.peFirm.funds.find(f=>f.id===fund.id).distributed);
  assert.equal(e.g.companyCash,before.companyCash);assert.equal(e.g.personalCash,before.personalCash);
}
{
  const {e,fund,deal}=fixture();deal.status='exited';const before=structuredClone(e.g);
  assert.equal(e.getPEPortfolioExitCapabilities(fund.id,deal.id)[0].reason,'deal-not-active');
  assert.equal(e.exitPEPortfolioCompany(fund.id,deal.id,{method:'sale'}),false,'ineligible deals are rejected by execution');
  assert.equal(e.g.companyCash,before.companyCash);assert.equal(e.g.personalCash,before.personalCash);assert.equal(fund.distributed,before.peFirm.funds.find(f=>f.id===fund.id).distributed);
}
console.log('pe exit preview: purity, capabilities, parity, accounting, and determinism passed');
