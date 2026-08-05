'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const loaded=loadGame({headless:true});
const mod=loaded.modules.shareholderPortfolioInefficiency;
assert(mod,'portfolio-inefficiency module is loaded');
function engine(){const e=new loaded.engineModule.TycoonEngine();e.normalize();e.g.configured=true;e.g.publicCompany=true;e.g.week=100;e.g.ticker='CPTY';e.g.lastActivistCampaignWeek=0;e.g.activeActivistCampaign=null;e.g.activistPortfolioEfficiencyHistory=[];e.g.subsidiaries=[];e.g.maSubsidiaries=[];return e;}
function adverseRows(count,options={}){return Array.from({length:count},(_,i)=>({week:74+i,investedCapital:100_000_000,weightedRoic:.02,capitalCost:.08,lowCapitalShare:1,averageShortfall:.75,adverse:true,improvementAction:Boolean(options.improvementLast&&i===count-1),disposalAction:Boolean(options.disposalAt===i)}));}
{
 const e=engine();delete e.g.activistPortfolioEfficiencyHistory;e.normalize();assert(Array.isArray(e.g.activistPortfolioEfficiencyHistory));assert.equal(e.g.activistPortfolioEfficiencyHistory.length,0,'old saves normalize portfolio history to empty');
 e.g.activistPortfolioEfficiencyHistory=Array.from({length:70},(_,i)=>({week:i+1,investedCapital:1,weightedRoic:0,capitalCost:.08,lowCapitalShare:1,averageShortfall:1,adverse:true}));e.normalize();assert.equal(e.g.activistPortfolioEfficiencyHistory.length,52,'portfolio history is bounded to 52 rows');
}
{
 const e=engine();e.g.subsidiaries=[{id:'low',status:'active',ownership:1,carryingBookValue:100_000_000,weeklyProfit:50_000},{id:'high',status:'active',ownership:.5,carryingBookValue:100_000_000,weeklyProfit:300_000}];const snapshot=mod.portfolioSnapshot(e.g);assert.equal(snapshot.investedCapital,150_000_000);assert(snapshot.weightedRoic>0&&snapshot.weightedRoic<.08);assert(snapshot.lowCapitalShare>.6&&snapshot.lowCapitalShare<.7);
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adverseRows(25);const p=mod.metrics(e.g);assert.equal(p.windowWeeks,25);assert.equal(p.maturity,0);assert.equal(p.portfolioInefficiencyPressure,0);assert.equal(mod.startCampaign(e),null,'25-week history cannot trigger');
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adverseRows(26);const p=mod.metrics(e.g);assert(p.portfolioInefficiencyPressure>=68,`26-week neglected portfolio reaches threshold: ${p.portfolioInefficiencyPressure}`);const c=mod.startCampaign(e);assert(c&&c.triggerPath==='portfolioInefficiency');assert.equal(e.g.lastActivistCampaignWeek,100);
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adverseRows(26,{improvementLast:true});assert(mod.metrics(e.g).portfolioInefficiencyPressure<68,'active improvement mitigates pressure');assert.equal(mod.startCampaign(e),null);
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adverseRows(26,{disposalAt:20});const p=mod.metrics(e.g);assert.equal(p.recentDisposal,true);assert(p.portfolioInefficiencyPressure<68,'disposal within the window mitigates pressure');
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=Array.from({length:26},(_,i)=>({week:74+i,investedCapital:100_000_000,weightedRoic:.15,capitalCost:.08,lowCapitalShare:0,averageShortfall:0,adverse:false}));assert.equal(mod.metrics(e.g).portfolioInefficiencyPressure,0,'high-ROIC portfolio stays neutral');
}
{
 const e=engine();e.g.activistPortfolioEfficiencyHistory=adverseRows(26);e.g.lastActivistCampaignWeek=90;assert.equal(mod.startCampaign(e),null,'shared 26-week cooldown blocks portfolio path');e.g.lastActivistCampaignWeek=0;e.g.activeActivistCampaign={id:'other',status:'active'};assert.equal(mod.startCampaign(e),null,'active campaign blocks overlapping path');
}
console.log('shareholder-portfolio-inefficiency-test: ok');
