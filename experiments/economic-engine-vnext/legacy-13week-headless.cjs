'use strict';
// EXECUTION ENTRYPOINT: node experiments/economic-engine-vnext/legacy-13week-headless.cjs
// Must be run in a complete checkout of the legacy repository. Does not import
// or change the production runtime source. Runs a disposable in-memory game.
const assert=require('node:assert/strict');
const {loadGame}=require('../../tests/harness');
const {capture13Weeks,evaluateCapture}=require('./legacy-13week-capture.cjs');
const fixture=require('./fixtures/13-week-retail.json');
const SEED=0x74110001;
const HOST_SEED=74100;
function lcg(seed) {
 let value=seed>>>0;
 return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/0x100000000;};
}
const loaded=loadGame({headless:true,random:lcg(HOST_SEED)});
const engine=new loaded.engineModule.TycoonEngine();
engine.configure({
 playerName:'VNext read-only experiment',
 companyName:'VNext 13 Week Legacy Observation',
 difficulty:'normal',scenario:'free'
});
assert.equal(typeof loaded.modules.simulationRng?.reseed,'function','simulation RNG reseed available');
loaded.modules.simulationRng.reseed(engine.g,SEED);
engine.g.personalCash=1_500_000_000;
const contributed=engine.contributeFounderCapital(500_000_000);
assert.equal(contributed,true,'sufficient capital for a safe 13-week experiment');
const tenants=engine.g.tenants.filter(t=>!t.occupiedBy).sort((a,b)=>
 Number(b.traffic||0)-Number(a.traffic||0)
 || Number(a.deposit||0)-Number(b.deposit||0)
 || String(a.id).localeCompare(String(b.id)));
const tenant=tenants[0];
assert.ok(tenant,'available tenant');
const preExistingStoreIDs=new Set(engine.g.stores.map(s=>s.id));
assert.equal(engine.openStore({tenantID:tenant.id,businessID:'ramen',name:'VNext Observation Ramen',operatingHours:3}),true,'ramen store opening');
const createdStore=engine.g.stores.find(s=>s.businessID==='ramen'&&!preExistingStoreIDs.has(s.id));
assert.ok(createdStore,'newly created ramen store exists');
const createdStoreID=createdStore.id;
const currentStore=()=>engine.g.stores.find(s=>s.id===createdStoreID);
let readinessWeeks=0;
// Production store opening is staged. Resolve the store by its stable ID
// after each advance because normalize may replace nested state objects.
while(currentStore()?.status!=='open' && readinessWeeks<16){
  assert.equal(engine.g.gameOver,false,'company survived opening preparation');
  assert.equal(engine.advanceWeek(false),true,'store opening preparation advances');
  readinessWeeks++;
}
assert.equal(currentStore()?.status,'open','ramen store is operating after preparation');
const capture=capture13Weeks(engine,{storeID:createdStoreID,businessID:'ramen'});
const result=evaluateCapture(capture,fixture);
const perWeek=capture.records.map(x=>({
 step:x.step,week:x.week,cashDeltaJPY:x.cashDeltaJPY,
 postedCashEffectJPY:x.observedFinanceCashEffectJPY,
 unassignedCashJPY:x.unassignedCompanyCashDeltaJPY,
 inventoryBookJPY:x.inventoryBookJPY,categoryCounts:x.storeFinanceCategoryCounts,
 storeFinanceRows:x.storeRows.length,nonStoreFinanceRows:x.otherRows.length
}));
const output={
 runtime:'full production index via tests/harness (disposable)',seed:SEED,hostSeed:HOST_SEED,
 scope:'legacy observational evidence only; no production-save import',
 companyCashJPY:{opening:capture.openingCashJPY,closing:capture.closingCashJPY},
 observedStore:{id:capture.storeID,businessID:capture.businessID},
 readinessWeeksBeforeObservation:readinessWeeks,
 observedWeeks:[capture.records[0].week,capture.records[12].week],
 storeWeeklyRows:capture.records.flatMap(w=>w.storeRows),
 weeklyEvidence:perWeek,
 compareToSyntheticFixture:result,
 evidenceLevel:'HEADLESS_EXECUTION',
 warning:'UNSUPPORTED is expected for supply-aware ramen. Do not interpret MATCH vs a synthetic scenario as true game parity.'
};
console.log(JSON.stringify(output,null,2));
if(result.status==='EVIDENCE_BLOCKED'){
 console.error('EVIDENCE_BLOCKED: legacy row provenance/schema must be investigated; do not infer parity');
 process.exitCode=1;
}
