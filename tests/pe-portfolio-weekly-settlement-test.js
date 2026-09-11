'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let randomCalls=0,seed=0x2468ace0;
const {engineModule,modules}=loadGame({random:()=>{randomCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;},isolatedLegacyIndex:true});
const ops=modules.pePortfolioOperations,pf=modules.peFund,plain=value=>JSON.parse(JSON.stringify(value));
function parityFixture(businessID='gym',id='parity-deal'){
  const pc=ops.defaultPortfolioCompany(10);
  Object.assign(pc,{cash:1234567,priceMultiplier:1.2,qualityInvestment:35,storeCount:3,procurementReform:.4,wageLevel:.9,headcountRatio:.85,productMixLevel:.6,productMixSetWeek:12,consolidatedRatio:.1,underperformingRatio:.2,lastProcessedWeek:10});
  const deal={id,businessID,enterpriseValue:2345678901,acquisitionMultiple:7.5,status:'active',portfolioCompany:pc};
  const fund={size:0,terms:{fee:0},team:{partners:1,principals:1,associates:2},deals:[deal]};
  return {fund,deal,pc};
}
{
  const {fund,deal,pc}=parityFixture(),before=plain({fund,deal}),callsBefore=randomCalls;
  const result=ops.calculatePortfolioOperatingWeek(fund,deal,80);
  assert.deepEqual(plain({fund,deal}),before,'calculation is pure');assert.equal(randomCalls,callsBefore,'calculation consumes no RNG');
  assert.equal(result.week,80);assert.equal(result.source,'generic');assert.equal(result.revenue,5033986.5342206545);assert.equal(result.profit,3644245.189303519);
  const cashBefore=pc.cash;assert.equal(ops.settlePortfolioOperatingWeek(deal,result),true);
  assert.equal(pc.weeklyRevenue,5033986.5342206545);assert.equal(pc.weeklyProfit,3644245.189303519);assert.equal(pc.cash-cashBefore,3644245.189303519);assert.equal(pc.improvementScore,55);
  assert.equal(ops.settlePortfolioOperatingWeek(deal,result),false,'same result cannot settle twice');assert.equal(pc.cash-cashBefore,3644245.189303519);
  ops.processDealWeek(fund,deal,80);assert.equal(pc.cash-cashBefore,3644245.189303519,'same-week process is also idempotent');
}
for(const businessID of ['ramen','conveni','gym','realEstateAgency','productVentures','non-pillar']){
  const {deal}=parityFixture(businessID,`fallback-${businessID}`);
  assert.equal(ops.resolvePortfolioOperatingCalculator(deal),ops.calculateGenericPortfolioOperatingWeek,`${businessID} falls back to generic`);
}
{
  const engine=new engineModule.TycoonEngine();engine.configure({playerName:'Settlement',companyName:'Isolation',difficulty:'normal'});
  engine.g.companyCash=9_000_000_000;engine.g.personalCash=12_000_000_000;
  pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
  const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
  const deals=['ramen','gym'].map(id=>ops.acquirePillarCompany(engine.g,fund.id,{businessID:id,enterpriseValue:2_000_000_000,useCoinvest:false,week:1}));
  const outside=plain({companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash,distributed:fund.distributed,coinvestCapital:engine.g.peFirm.coinvestCapital,stores:engine.g.stores,businesses:engine.g.businesses,finance:engine.g.finance});
  const cashBefore=deals.map(deal=>deal.portfolioCompany.cash);ops.processPortfolioWeek(engine.g,2);
  deals.forEach((deal,index)=>{assert.equal(deal.portfolioCompany.lastProcessedWeek,2);assert.equal(deal.portfolioCompany.cash-cashBefore[index],deal.portfolioCompany.weeklyProfit);});
  const afterFirst=deals.map(deal=>deal.portfolioCompany.cash);ops.processPortfolioWeek(engine.g,2);assert.deepEqual(deals.map(deal=>deal.portfolioCompany.cash),afterFirst,'multiple deals settle exactly once');
  assert.deepEqual(plain({companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash,distributed:fund.distributed,coinvestCapital:engine.g.peFirm.coinvestCapital,stores:engine.g.stores,businesses:engine.g.businesses,finance:engine.g.finance}),outside,'weekly settlement is isolated to target portfolio companies');
}
console.log('PE portfolio weekly single-settlement tests passed');
