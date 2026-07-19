const fs=require('fs');const vm=require('vm');const assert=require('assert');
class Engine{normalize(){} updateProductInnovationWeekly(){return ['base'];}}
const context={globalThis:{__capitalismTycoonModules:{engine:{TycoonEngine:Engine}}},console};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(fs.readFileSync('js/macro-cycle.js','utf8'),context,{filename:'js/macro-cycle.js'});
const macro=context.globalThis.__capitalismTycoonModules.macroCycle;assert(macro&&macro.__installed,'macro module installed');
const legacy={week:1,economy:1,inflation:1,policyRate:.005,realEstateCycle:1,exchangeRate:1,news:[],history:[],saveVersion:9};
macro.ensure(legacy);assert.equal(legacy.saveVersion,9,'save version preserved');assert.equal(legacy.macroCycleVersion,1);assert(Array.isArray(legacy.macroHistory));
const first=macro.update(legacy);assert(first&&first.regime==='recovery');assert(legacy.economy>1);assert(legacy.industryClimate.consumer>1);assert.equal(macro.update(legacy),null,'same-week idempotency');
legacy.week=60;const hot=macro.update(legacy);assert.equal(hot.regime,'overheat');assert(legacy.policyRate>.005);
legacy.week=110;const recession=macro.update(legacy);assert.equal(recession.regime,'recession');assert(legacy.industryClimate.consumer<1);
for(let week=111;week<400;week++){legacy.week=week;macro.update(legacy);}assert(legacy.macroHistory.length<=104,'history bounded');assert(macro.validate(legacy).ok,'state validates');
const engine=new Engine();engine.g={week:21,economy:1,inflation:1,policyRate:.005,realEstateCycle:1,exchangeRate:1,news:[],history:[],saveVersion:9};engine.normalize();assert.equal(engine.g.macroCycleVersion,1);const base=engine.updateProductInnovationWeekly();assert.deepEqual(base,['base']);assert.equal(engine.g.macroRegime,'expansion');
console.log('macro-cycle-test: ok');
