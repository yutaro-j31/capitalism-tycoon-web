'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const loaded=loadGame({headless:true});
const mod=loaded.modules.shareholderValueDestruction;
const portfolio=loaded.modules.shareholderPortfolioInefficiency;
assert(mod,'value-destruction module is loaded');
assert(portfolio,'portfolio-inefficiency module is loaded');
function engine(){const e=new loaded.engineModule.TycoonEngine();e.normalize();e.g.configured=true;e.g.publicCompany=true;e.g.week=100;e.g.ticker='CPTY';e.g.ipoPrice=100;e.g.stockPrice=60;e.g.lastActivistCampaignWeek=0;e.g.activeActivistCampaign=null;e.g.activistMarketPerformanceHistory=[];e.g.activistPortfolioEfficiencyHistory=[];e.g.subsidiaries=[];e.g.maSubsidiaries=[];return e;}
function adverseRows(count,recoveryEvery=0){return Array.from({length:count},(_,i)=>({week:74+i,price:60,referencePrice:100,rollingHigh:100,ownReturn:-.025,benchmarkReturn:.005,relativeReturn:-.03,recoveryAction:recoveryEvery>0&&i%recoveryEvery===0}));}
function adversePortfolioRows(count,options={}){return Array.from({length:count},(_,i)=>({week:74+i,investedCapital:100_000_000,weightedRoic:.02,capitalCost:.08,lowCapitalShare:1,averageShortfall:.75,adverse:true,improvementAction:Boolean(options.improvementLast&&i===count-1),disposalAction:Boolean(options.disposalAt===i)}));}
{
 const e=engine();delete e.g.activistMarketPerformanceHistory;e.normalize();assert(Array.isArray(e.g.activistMarketPerformanceHistory),'old saves normalize market-performance history to an array');assert.equal(e.g.activistMarketPerformanceHistory.length,0,'old saves normalize to empty market-performance history');
 e.g.activistMarketPerformanceHistory=Array.from({length:70},(_,i)=>({week:i+1,price:100,referencePrice:100,rollingHigh:100}));e.normalize();assert.equal(e.g.activistMarketPerformanceHistory.length,52,'history is bounded to 52 rows');
}
{
 const e=engine();e.g.activistMarketPerformanceHistory=adverseRows(25);const p=mod.metrics(e.g);assert.equal(p.windowWeeks,25);assert(p.valueDestructionPressure<68,'immature 25-week window cannot independently trigger');assert.equal(mod.startCampaign(e),null);
}
{
 const e=engine();e.g.activistMarketPerformanceHistory=adverseRows(26);const p=mod.metrics(e.g);assert(p.valueDestructionPressure>=68,`sustained adverse path reaches threshold: ${p.valueDestructionPressure}`);const c=mod.startCampaign(e);assert(c&&c.triggerPath==='valueDestruction','sustained value destruction starts its own campaign');
}
{
 const e=engine();e.g.activistMarketPerformanceHistory=Array.from({length:26},(_,i)=>({week:74+i,price:i===25?50:100,referencePrice:100,rollingHigh:100,ownReturn:i===25?-.5:0,benchmarkReturn:0,relativeReturn:i===25?-.5:0,recoveryAction:false}));assert(mod.metrics(e.g).valueDestructionPressure<68,'one-week crash does not trigger persistent path');
}
{
 const e=engine();e.g.activistMarketPerformanceHistory=adverseRows(26,4);assert(mod.metrics(e.g).valueDestructionPressure<68,'repeated genuine recovery actions mitigate the path');
}
{
 const e=engine();e.g.stores=[{status:'open',lastProfit:120_000},{status:'open',lastProfit:80_000},{status:'open',lastProfit:40_000}];assert.equal(mod.operatingRecoveryForWeek(e.g),true,'profitable multi-store operations are recovery evidence');e.g.stores[2].lastProfit=-300_000;e.g.weeklyProfitHistory=[250_000,120_000,-50_000,80_000];assert.equal(mod.operatingRecoveryForWeek(e.g),true,'positive trailing operating profit survives one loss week');e.g.weeklyProfitHistory=[100_000,-200_000,-150_000,-50_000];e.g.companyValueHistory=[100_000_000,102_000_000,104_000_000,106_000_000];e.g.lastReport={profit:500_000};assert.equal(mod.operatingRecoveryForWeek(e.g),true,'positive report and non-declining enterprise value distinguish market weakness from management destruction');assert.equal(mod.recoveryActionForWeek(e.g,99),true,'fundamental recovery is recorded as a value-recovery action');e.g.lastReport={profit:-500_000};assert.equal(mod.operatingRecoveryForWeek(e.g),false,'deteriorating reported fundamentals do not suppress value-destruction pressure');
}
{
 const e=engine();delete e.g.activistPortfolioEfficiencyHistory;e.normalize();assert(Array.isArray(e.g.activistPortfolioEfficiencyHistory));assert.equal(e.g.activistPortfolioEfficiencyHistory.length,0,'old saves normalize portfolio history to empty');e.g.activistPortfolioEfficiencyHistory=Array.from({length:70},(_,i)=>({week:i+1,investedCapital:1,weightedRoic:0,capitalCost:.08,lowCapitalShare:1,averageShortfall:1,adverse:true}));e.normalize();assert.equal(e.g.activistPortfolioEfficiencyHistory.length,52,'portfolio history is bounded to 52 rows');
}
{
 const e=engine();e.g.subsidiaries=[{id:'low',status:'active',ownership:1,carryingBookValue:100_000_000,weeklyProfit:50_000},{id:'high',status:'active',ownership:.5,carryingBookValue:100_000_000,weeklyProfit:300_000}];const snapshot=portfolio.portfolioSnapshot(e.g);assert.equal(snapshot.investedCapital,150_000_000);assert(snapshot.weightedRoic>0&&snapshot.weightedRoic<.08);assert(snapshot.lowCapitalShare>.6&&snapshot.lowCapitalShare<.7);
}
{
 const e=engine();e.g.groupRestructuringHistory=[{week:99,type:'sale'}];let remedy=portfolio.portfolioRemedyForWeek(e.g,99);assert.equal(remedy.disposalAction,true,'canonical restructuring sale is recognized');e.g.groupRestructuringHistory=[];e.g.restructuringPrograms=[{startedWeek:90,status:'active'}];remedy=portfolio.portfolioRemedyForWeek(e.g,99);assert.equal(remedy.improvementAction,true,'active turnaround program is recognized');e.g.restructuringPrograms=[{startedWeek:90,status:'completed',completedWeek:99}];remedy=portfolio.portfolioRemedyForWeek(e.g,99);assert.equal(remedy.improvementAction,true,'completed turnaround program is recognized in its completion week');e.g.restructuringPrograms=[];e.g.saleNegotiations=[{startedWeek:95,status:'active'}];remedy=portfolio.portfolioRemedyForWeek(e.g,99);assert.equal(remedy.improvementAction,true,'active canonical sale negotiation is recognized');
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adversePortfolioRows(25);const p=portfolio.metrics(e.g);assert.equal(p.windowWeeks,25);assert.equal(p.maturity,0);assert.equal(p.portfolioInefficiencyPressure,0);assert.equal(portfolio.startCampaign(e),null,'25-week history cannot trigger');
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adversePortfolioRows(26);const p=portfolio.metrics(e.g);assert(p.portfolioInefficiencyPressure>=68,`26-week neglected portfolio reaches threshold: ${p.portfolioInefficiencyPressure}`);const c=portfolio.startCampaign(e);assert(c&&c.triggerPath==='portfolioInefficiency');assert.equal(e.g.lastActivistCampaignWeek,100);
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adversePortfolioRows(26,{improvementLast:true});assert(portfolio.metrics(e.g).portfolioInefficiencyPressure<68,'active improvement mitigates pressure');assert.equal(portfolio.startCampaign(e),null);
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adversePortfolioRows(26,{disposalAt:20});const p=portfolio.metrics(e.g);assert.equal(p.recentDisposal,true);assert(p.portfolioInefficiencyPressure<68,'disposal within the window mitigates pressure');
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=Array.from({length:26},(_,i)=>({week:74+i,investedCapital:100_000_000,weightedRoic:.15,capitalCost:.08,lowCapitalShare:0,averageShortfall:0,adverse:false}));assert.equal(portfolio.metrics(e.g).portfolioInefficiencyPressure,0,'high-ROIC portfolio stays neutral');
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adversePortfolioRows(26);e.g.lastActivistCampaignWeek=90;assert.equal(portfolio.startCampaign(e),null,'shared 26-week cooldown blocks portfolio path');e.g.lastActivistCampaignWeek=0;e.g.activeActivistCampaign={id:'other',status:'active'};assert.equal(portfolio.startCampaign(e),null,'active campaign blocks overlapping path');
}
console.log('shareholder-value-destruction-test: ok');
