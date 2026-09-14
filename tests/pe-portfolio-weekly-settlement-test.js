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
  assert.equal(ops.resolvePortfolioOperatingCalculator(deal),ops.calculateGenericPortfolioOperatingWeek,`${businessID} falls back to generic without production state`);
}
{
  const engine=new engineModule.TycoonEngine();engine.configure({playerName:'Gym Calculator',companyName:'Detached PE Gym',difficulty:'normal'});
  engine.g.companyCash=9_000_000_000;engine.g.personalCash=12_000_000_000;
  pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
  const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
  const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'gym',enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
  assert(deal&&deal.portfolioCompany.productionSite,'gym deal has production site');
  const before=plain(engine.g),callsBefore=randomCalls;
  const generic=ops.calculateGenericPortfolioOperatingWeek(fund,deal,2);
  const neutral=ops.calculatePortfolioOperatingWeek(fund,deal,2,engine.g);
  assert.equal(ops.resolvePortfolioOperatingCalculator(deal,engine.g),ops.calculateGymPortfolioOperatingWeek,'production state dispatches gym calculator');
  assert.equal(neutral.source,'gym');
  assert.equal(neutral.revenue,generic.revenue,'default gym controls preserve calibrated generic revenue');
  assert.equal(neutral.profit,generic.profit,'default gym controls preserve calibrated generic profit');
  assert(neutral.nextOperatingState?.gymMembership?.lastWeek,'gym calculator returns detached next membership state');
  assert.deepEqual(plain(engine.g),before,'gym calculation is pure before settlement');
  assert.equal(randomCalls,callsBefore,'gym calculation consumes no simulation RNG');
  const cashBefore=deal.portfolioCompany.cash;
  assert.equal(ops.settlePortfolioOperatingWeek(deal,neutral),true);
  assert.equal(deal.portfolioCompany.cash-cashBefore,neutral.profit);
  assert.equal(deal.portfolioCompany.gymOperatingState.gymMembership.lastWeek.week,2,'single settlement persists the detached membership state');
  assert.equal(ops.settlePortfolioOperatingWeek(deal,neutral),false,'gym weekly result cannot settle twice');
  assert.equal(deal.portfolioCompany.cash-cashBefore,neutral.profit);

  ops.setPriceMultiplier(engine.g,fund.id,deal.id,1.25);
  const beforePriceCalc=plain(engine.g),callsBeforePrice=randomCalls;
  const priced=ops.calculatePortfolioOperatingWeek(fund,deal,3,engine.g),oldGeneric=ops.calculateGenericPortfolioOperatingWeek(fund,deal,3);
  assert.equal(priced.source,'gym');
  assert(priced.components.gymSalesFactor>1,'higher PE gym fee raises production membership sales versus standard-price control');
  assert(priced.components.gymContributionFactor>1,'higher PE gym fee raises production contribution versus standard-price control');
  assert(priced.profit>oldGeneric.profit,'gym production fee economics replace the old inverse generic price response');
  assert.deepEqual(plain(engine.g),beforePriceCalc,'priced gym calculation stays read-only');
  assert.equal(randomCalls,callsBeforePrice,'priced gym calculation consumes no simulation RNG');
  const persistedBefore=plain(deal.portfolioCompany.gymOperatingState);
  assert.equal(ops.settlePortfolioOperatingWeek(deal,priced),true);
  assert.equal(deal.portfolioCompany.gymOperatingState.gymMembership.lastWeek.week,3);
  assert.notDeepEqual(plain(deal.portfolioCompany.gymOperatingState),persistedBefore,'next detached gym operating state advances only at settlement');
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
  assert.equal(deals[0].portfolioCompany.gymOperatingState,undefined,'non-gym deal gets no gym state');
  assert.equal(deals[1].portfolioCompany.gymOperatingState.gymMembership.lastWeek.week,2,'production loop dispatches and persists gym state');
  const afterFirst=deals.map(deal=>deal.portfolioCompany.cash);const gymState=plain(deals[1].portfolioCompany.gymOperatingState);ops.processPortfolioWeek(engine.g,2);
  assert.deepEqual(deals.map(deal=>deal.portfolioCompany.cash),afterFirst,'multiple deals settle exactly once');
  assert.deepEqual(plain(deals[1].portfolioCompany.gymOperatingState),gymState,'same-week replay cannot advance gym membership twice');
  assert.deepEqual(plain({companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash,distributed:fund.distributed,coinvestCapital:engine.g.peFirm.coinvestCapital,stores:engine.g.stores,businesses:engine.g.businesses,finance:engine.g.finance}),outside,'weekly settlement is isolated to target portfolio companies');
}
console.log('PE portfolio weekly single-settlement tests passed');
