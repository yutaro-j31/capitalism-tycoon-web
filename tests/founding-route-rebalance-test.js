'use strict';

// Temporary production-harness calibration probe. The physical supply model owns ramen COGS,
// so production unitCost stays on the calibrated 300-yen basis while we isolate the narrow
// demand threshold that changes the standard-play expansion trajectory. Overrides exist only
// in this test process; this probe will be replaced by the final regression once calibration
// is complete.
const assert=require('node:assert/strict');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {loadGame}=require('./harness');

const SEED=190826041;
const REALESTATE_FALLBACK_POOL={realEstateAgency:'cafe'};
function lcg(seed=SEED){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
function tenantPool(engine,businessID){
  const free=engine.g.tenants.filter(t=>!t.occupiedBy),matching=free.filter(t=>t.businessID===businessID);
  if(matching.length)return matching.sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)));
  const fallbackID=REALESTATE_FALLBACK_POOL[businessID],fallback=fallbackID?free.filter(t=>t.businessID===fallbackID):[];
  return (fallback.length?fallback:free).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)));
}
function plannedFinancing(engine,businessID,tenant){
  const business=engine.business(businessID),cost=business.storeCost+tenant.deposit,cash=engine.g.companyCash;
  if(cash>=cost)return{affordable:true,cost,ordinaryBorrow:0};
  const ordinaryCapacity=Math.max(0,engine.companyCreditLimit()-engine.g.companyDebt),ordinaryBorrow=Math.min(cost-cash,ordinaryCapacity),cashAfterOrdinary=cash+ordinaryBorrow;
  if(cashAfterOrdinary>=cost)return{affordable:true,cost,ordinaryBorrow};
  const savedCash=engine.g.companyCash;engine.g.companyCash=cashAfterOrdinary;
  const estimate=engine.estimateStoreOpening({tenantID:tenant.id,businessID,operatingHours:3});engine.g.companyCash=savedCash;
  return estimate?.affordable?{affordable:true,cost,ordinaryBorrow}:{affordable:false,cost,ordinaryBorrow:0};
}
function bestAffordableTenant(engine,businessID){for(const tenant of tenantPool(engine,businessID)){const plan=plannedFinancing(engine,businessID,tenant);if(plan.affordable)return{tenant,plan};}return null;}
function tryOpenStore(engine,businessID){const found=bestAffordableTenant(engine,businessID);if(!found)return false;if(found.plan.ordinaryBorrow>0&&engine.borrow(Math.ceil(found.plan.ordinaryBorrow),'company')!==true)return false;return engine.openStore({tenantID:found.tenant.id,businessID,name:`${businessID}-${engine.g.stores.length+1}`,operatingHours:3})===true;}
function last8AvgProfit(engine){const h=engine.g.weeklyProfitHistory.slice(-8);return h.length?h.reduce((a,n)=>a+n,0)/h.length:0;}
function runStandardPlay({businessID='ramen',unitCost=300,demand,maxWeeks=301,allowExpansion=true,seed=SEED}){
  const {ctx}=loadGame({random:lcg(seed),headless:true}),engine=new ctx.__ct_headlessEngineClass();
  engine.save=()=>{};engine.configure({playerName:'Tester',companyName:`${businessID} Co`,difficulty:'normal',scenario:'free'});engine.g.skipWeeklyValidation=true;
  const business=engine.business(businessID);business.unitCost=unitCost;if(Number.isFinite(demand))business.demand=demand;
  const firstStoreOpened=tryOpenStore(engine,businessID);let weekReached1B=null;
  const openingWeeks=firstStoreOpened?[engine.g.week]:[];
  while(engine.g.week<maxWeeks&&!engine.g.gameOver&&weekReached1B===null){
    engine.advanceWeek(false);if(engine.companyValue()>=1e9)weekReached1B=engine.g.week;
    if(allowExpansion&&engine.g.week%4===0&&last8AvgProfit(engine)>0){
      const tenant=tenantPool(engine,businessID)[0];
      if(tenant){
        const nextCost=engine.business(businessID).storeCost+tenant.deposit;
        if(engine.g.companyCash>nextCost*3){const before=engine.g.stores.length;if(tryOpenStore(engine,businessID)&&engine.g.stores.length>before)openingWeeks.push(engine.g.week);}
      }
    }
  }
  return{businessID,unitCost:business.unitCost,demand:business.demand,week:engine.g.week,weekReached1B,firstStoreOpened,gameOver:engine.g.gameOver,companyValue:engine.companyValue(),companyCash:engine.g.companyCash,storeCount:engine.g.stores.filter(s=>s.businessID===businessID).length,avgProfitLast8:last8AvgProfit(engine),openingWeeks};
}
function runWorker(data){return new Promise((resolve,reject)=>{const w=new Worker(__filename,{workerData:data});w.once('message',resolve);w.once('error',reject);w.once('exit',code=>{if(code)reject(new Error(`worker exited ${code}`));});});}
if(!isMainThread){parentPort.postMessage(runStandardPlay(workerData));}
else{
  (async()=>{
    const candidates=[531,532,533,534].map(demand=>({businessID:'ramen',unitCost:300,demand,maxWeeks:301,seed:SEED}));
    const rows=await Promise.all(candidates.map(runWorker));
    console.log(`FOUNDING_RAMEN_NARROW_THRESHOLD ${JSON.stringify(rows)}`);
    const inRange=rows.filter(row=>row.weekReached1B!==null&&row.weekReached1B>=200&&row.weekReached1B<=300);
    assert.ok(inRange.length>0,`narrow demand candidates must reveal a 1B trajectory in [200,300] or confirm a discrete expansion cliff: ${JSON.stringify(rows.map(r=>({demand:r.demand,weekReached1B:r.weekReached1B,storeCount:r.storeCount,openingWeeks:r.openingWeeks,gameOver:r.gameOver})))}`);
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
