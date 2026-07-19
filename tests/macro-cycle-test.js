const fs=require('fs');const vm=require('vm');const assert=require('assert');
class Engine{normalize(){} updateProductInnovationWeekly(){return ['base'];}}
const context={globalThis:{__capitalismTycoonModules:{engine:{TycoonEngine:Engine}}},console};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(fs.readFileSync('js/macro-cycle.js','utf8'),context,{filename:'js/macro-cycle.js'});
const macro=context.globalThis.__capitalismTycoonModules.macroCycle;assert(macro&&macro.__installed,'macro module installed');
const legacy={week:1,economy:1,inflation:1,policyRate:.005,realEstateCycle:1,exchangeRate:1,news:[],history:[],saveVersion:9};
macro.ensure(legacy);assert.equal(legacy.saveVersion,9,'save version preserved');assert.equal(legacy.macroCycleVersion,2);assert(Array.isArray(legacy.macroHistory));assert(Array.isArray(legacy.industryEventHistory));assert.equal(legacy.activeIndustryEvent,null);
const first=macro.update(legacy);assert(first&&first.regime==='recovery');assert(legacy.economy>1);assert(legacy.industryClimate.consumer>1);assert.equal(macro.update(legacy),null,'same-week idempotency');
legacy.week=26;const eventStart=macro.update(legacy);assert.equal(eventStart.industryEvent,'energySpike');assert.equal(legacy.activeIndustryEvent.id,'energySpike');assert.equal(legacy.activeIndustryEvent.remainingWeeks,7);assert(legacy.industryClimate.consumer<macro.industryMultipliers(macro.regimeForWeek(26)).consumer);assert(legacy.news.some(x=>x.includes('資源価格ショック')));
const inflationAfterStart=legacy.inflation;assert.equal(macro.update(legacy),null,'industry event is not applied twice in same week');assert.equal(legacy.inflation,inflationAfterStart);
for(let week=27;week<=33;week++){legacy.week=week;macro.update(legacy);}assert.equal(legacy.activeIndustryEvent,null,'event expires after fixed duration');assert(legacy.industryEventHistory.some(x=>x.type==='industryEventEnded'&&x.eventId==='energySpike'));
legacy.week=52;macro.update(legacy);assert.equal(legacy.activeIndustryEvent.id,'digitalBoom');assert(legacy.industryClimate.enterprise>1.1,'digital boom lifts enterprise demand');
legacy.week=60;const hot=macro.update(legacy);assert.equal(hot.regime,'overheat');assert(legacy.policyRate>.005);
legacy.week=110;const recession=macro.update(legacy);assert.equal(recession.regime,'recession');assert(legacy.industryClimate.consumer<1);
for(let week=111;week<1500;week++){legacy.week=week;macro.update(legacy);}assert(legacy.macroHistory.length<=104,'history bounded');assert(legacy.industryEventHistory.length<=52,'event history bounded');assert(macro.validate(legacy).ok,'state validates');
const corrupted={week:26,macroCycleVersion:1,macroHistory:null,industryEventHistory:null,activeIndustryEvent:{id:'unknown'},economy:1,inflation:1,policyRate:.005,realEstateCycle:1,exchangeRate:1};macro.ensure(corrupted);assert.equal(corrupted.activeIndustryEvent,null,'invalid legacy event is discarded');assert.equal(corrupted.macroCycleVersion,2);
const engine=new Engine();engine.g={week:21,economy:1,inflation:1,policyRate:.005,realEstateCycle:1,exchangeRate:1,news:[],history:[],saveVersion:9};engine.normalize();assert.equal(engine.g.macroCycleVersion,2);const base=engine.updateProductInnovationWeekly();assert.deepEqual(base,['base']);assert.equal(engine.g.macroRegime,'expansion');
console.log('macro-cycle-test: ok');
