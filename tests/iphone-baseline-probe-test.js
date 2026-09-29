'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
function fakeIDB(){
 const databases=new Map();
 return {
  databases,
  open(name){
   const request={};
   queueMicrotask(()=>{
    let db=databases.get(name),upgrade=false;
    if(!db){
     upgrade=true;
     const stores=new Map();
     db={
      stores,
      objectStoreNames:{contains:key=>stores.has(key)},
      createObjectStore:key=>stores.set(key,new Map()),
      transaction(storeName){
       const tx={};
       tx.objectStore=()=>{
        const map=stores.get(storeName);
        const done=(req,result,mutate)=>queueMicrotask(()=>{mutate?.();req.result=result;req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});
        return {
         getAll(){const req={};done(req,[...map.values()]);return req;},
         getAllKeys(){const req={};done(req,[...map.keys()]);return req;},
         put(value,key){const req={};done(req,key,()=>map.set(String(key),String(value)));return req;},
         delete(key){const req={};done(req,undefined,()=>map.delete(String(key)));return req;}
        };
       };
       return tx;
      }
     };
     databases.set(name,db);
    }
    request.result=db;
    if(upgrade)request.onupgradeneeded?.();
    request.onsuccess?.();
   });
   return request;
  }
 };
}
(async()=>{
 let seed=787;const random=()=>((seed=(seed*48271)%2147483647)/2147483647);
 const idb=fakeIDB();const {ctx,modules}=loadGame({random,indexedDB:idb});
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));const probe=modules.iphoneBaselineProbe,live=ctx.__ct_engine;
 assert.ok(probe?.__installed);assert.equal(modules.engine.SAVE_VERSION,9);assert.equal(modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');
 live.g.configured=true;live.g.companyCash=1_000_000_000;live.g.finance=modules.finance.defaultFinanceState(live.g);
 await modules.saveStorageIDB.flush();const productionDb=idb.databases.get(modules.saveStorageIDB.DB_NAME),productionStore=productionDb.stores.get(modules.saveStorageIDB.STORE_NAME),productionRecordBefore=productionStore.get(modules.engine.SAVE_KEY);const stateBefore=JSON.stringify(live.g),rngBefore=JSON.stringify(live.g.simulationRng),historyStart={get:ctx.__localStorageHistory.getItem.length,set:ctx.__localStorageHistory.setItem.length,remove:ctx.__localStorageHistory.removeItem.length};
 const result=await probe.run({scenarioId:'current-save',warmupWeeks:0,measuredWeeks:1,loadSamples:1,measurementClass:'MEASURED_HEADLESS',env:ctx});
 assert.equal(result.passed,true,result.failures.join('\n'));assert.equal(JSON.stringify(live.g),stateBefore);assert.equal(JSON.stringify(live.g.simulationRng),rngBefore);assert.equal(productionStore.get(modules.engine.SAVE_KEY),productionRecordBefore,'production IndexedDB record must be byte-identical');
 for(const [kind,start] of Object.entries(historyStart)){const calls=ctx.__localStorageHistory[kind+'Item'].slice(start);assert.equal(calls.some(row=>row.key==='capitalism_tycoon_web_v1'||String(row.key).startsWith('capitalism_tycoon_web_v1_slot_')),false,`production localStorage ${kind}`);}
 assert.equal(result.safety.benchmarkStorageSeparated,true);assert.equal(result.safety.durableFlushAwaited,true);assert.equal(result.safety.productionSaveAccessed,false);assert.equal(result.weekAdvanceEndToEndMs.length,1);assert.equal(result.weekAdvanceSubtimings.durableFlushMs.length,1);assert.ok(result.weekAdvanceEndToEndMs[0]>=result.weekAdvanceSubtimings.durableFlushMs[0]);
 assert.equal(result.weekAdvanceStats.p99,null,'one sample must not invent p99');assert.equal(result.invariants.passed,true);assert.equal(result.scenario.sourceWeek,1);assert.equal(result.scenario.sourceStoreCount,0);assert.ok(result.scenario.rawSaveBytes>0);assert.ok(result.scenario.storedSaveBytes>0);assert.equal(result.measurementClass,'MEASURED_HEADLESS');assert.equal(result.mainSha,null);assert.equal(probe.runtimeBuildSha('ABCDEF0123456789ABCDEF0123456789ABCDEF01',ctx),'abcdef0123456789abcdef0123456789abcdef01');
 for(const key of ['probeVersion','harnessSchemaVersion','mainSha','device','scenario','weekAdvanceEndToEndMs','weekAdvanceStats','weekAdvanceSubtimings','isolatedLoadMs','save','nodeReference','invariants','safety','failures'])assert.ok(Object.hasOwn(result,key),`schema ${key}`);
 const fixture=await probe.createGrowthFixture({env:ctx});assert.equal(fixture.week,117);assert.equal(fixture.stores.length,40);assert.equal(fixture.saveVersion,9);assert.equal(probe.finiteIssues(fixture).length,0);
 const a=await probe.run({scenarioId:'growth-v1',warmupWeeks:0,measuredWeeks:1,loadSamples:0,measurementClass:'MEASURED_HEADLESS',env:ctx});
 const b=await probe.run({scenarioId:'growth-v1',warmupWeeks:0,measuredWeeks:1,loadSamples:0,measurementClass:'MEASURED_HEADLESS',env:ctx});
 assert.equal(a.scenario.sourceWeek,117);assert.equal(a.scenario.sourceStoreCount,40);assert.ok(a.scenario.rawSaveBytes>0);assert.ok(a.scenario.storedSaveBytes>0);assert.equal(a.determinism.finalHash,b.determinism.finalHash);assert.equal(a.passed,true,a.failures.join('\n'));assert.equal(b.passed,true,b.failures.join('\n'));
 const allDbs=[...idb.databases.keys()];assert.ok(allDbs.includes(probe.DATABASE_NAME));assert.ok(allDbs.includes(modules.saveStorageIDB.DB_NAME));assert.equal(allDbs.length,2);assert.notEqual(probe.DATABASE_NAME,modules.saveStorageIDB.DB_NAME);assert.notEqual(probe.STORE_NAME,modules.saveStorageIDB.STORE_NAME);assert.notEqual(probe.BENCHMARK_KEY,modules.engine.SAVE_KEY);
 console.log('iPhone baseline probe safety tests passed');
})().catch(error=>{console.error(error?.stack||error);process.exit(1);});
