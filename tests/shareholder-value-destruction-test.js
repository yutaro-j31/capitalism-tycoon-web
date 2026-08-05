'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const loaded=loadGame({headless:true});
const mod=loaded.modules.shareholderValueDestruction;
assert(mod,'value-destruction module is loaded');
function engine(){const e=new loaded.engineModule.TycoonEngine();e.normalize();e.g.configured=true;e.g.publicCompany=true;e.g.week=100;e.g.ticker='CPTY';e.g.ipoPrice=100;e.g.stockPrice=60;e.g.lastActivistCampaignWeek=0;e.g.activeActivistCampaign=null;e.g.activistMarketPerformanceHistory=[];return e;}
function adverseRows(count,recoveryEvery=0){return Array.from({length:count},(_,i)=>({week:74+i,price:60,referencePrice:100,rollingHigh:100,ownReturn:-.025,benchmarkReturn:.005,relativeReturn:-.03,recoveryAction:recoveryEvery>0&&i%recoveryEvery===0}));}
{
 const e=engine();delete e.g.activistMarketPerformanceHistory;e.normalize();assert.deepEqual(e.g.activistMarketPerformanceHistory,[],'old saves normalize to empty market-performance history');
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
console.log('shareholder-value-destruction-test: ok');
