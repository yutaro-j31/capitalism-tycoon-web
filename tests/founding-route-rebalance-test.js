'use strict';

// Production-harness calibration probe. This intentionally keeps the real 200-300 week
// requirement in place while measuring nearby ramen unit-cost candidates in parallel. The
// candidate override exists only inside this test process; production data is not changed by it.
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
function bestAffordableTenant(engine,businessID){
  for(const tenant of tenantPool(engine,businessID)){const plan=plannedFinancing(engine,businessID,tenant);if(plan.affordable)return{tenant,plan};}
  return null;
}
function tryOpenStore(engine,businessID){
  const found=bestAffordableTenant(engine,businessID);if(!found)return false;
  if(found.plan.ordinaryBorrow>0&&engine.borrow(Math.ceil(found.plan.ordinaryBorrow),'company')!==true)return false;
  return engine.openStore({tenantID:found.tenant.id,businessID,name:`${businessID}-${engine.g.stores.length+1}`,operatingHours:3})===true;
}
function last8AvgProfit(engine){const h=engine.g.weeklyProfitHistory.slice(-8);return h.length?h.reduce((a,n)=>a+n,0)/h.length:0;}
function runStandardPlay({businessID='ramen',unitCost,demand,maxWeeks=320,allowExpansion=true,seed=SEED}){
  const {ctx}=loadGame({random:lcg(seed),headless:true}),engine=new ctx.__ct_headlessEngineClass();
  engine.save=()=>{};engine.configure({playerName:'Tester',companyName:`${businessID} Co`,difficulty:'normal',scenario:'free'});engine.g.skipWeeklyValidation=true;
  const business=engine.business(businessID);if(Number.isFinite(unitCost))business.unitCost=unitCost;if(Number.isFinite(demand))business.demand=demand;
  const firstStoreOpened=tryOpenStore(engine,businessID);let weekReached1B=null;
  while(engine.g.week<maxWeeks&&!engine.g.gameOver){
    engine.advanceWeek(false);if(weekReached1B===null&&engine.companyValue()>=1e9)weekReached1B=engine.g.week;
    if(allowExpansion&&engine.g.week%4===0&&last8AvgProfit(engine)>0){const tenant=tenantPool(engine,businessID)[0];if(tenant){const nextCost=engine.business(businessID).storeCost+tenant.deposit;if(engine.g.companyCash>nextCost*3)tryOpenStore(engine,businessID);}}
  }
  return{businessID,unitCost:business.unitCost,demand:business.demand,week:engine.g.week,weekReached1B,firstStoreOpened,gameOver:engine.g.gameOver,companyValue:engine.companyValue(),companyCash:engine.g.companyCash,storeCount:engine.g.stores.filter(s=>s.businessID===businessID).length,avgProfitLast8:last8AvgProfit(engine)};
}
function runWorker(data){return new Promise((resolve,reject)=>{const w=new Worker(__filename,{workerData:data});w.once('message',resolve);w.once('error',reject);w.once('exit',code=>{if(code)reject(new Error(`worker exited ${code}`));});});}

if(!isMainThread){parentPort.postMessage(runStandardPlay(workerData));}
else{
  (async()=>{
    const candidates=[257,265,270,275,280,285,290].map(unitCost=>({businessID:'ramen',unitCost,demand:538,maxWeeks:320,seed:SEED}));
    const rows=await Promise.all(candidates.map(runWorker));
    console.log(`FOUNDING_RAMEN_CALIBRATION ${JSON.stringify(rows)}`);
    const current=rows.find(row=>row.unitCost===257);
    assert.equal(current.firstStoreOpened,true,'ramen first store must open');
    assert.equal(current.gameOver,false,'ramen must remain solvent through the calibration horizon');
    assert.ok(current.weekReached1B!==null&&current.weekReached1B>=200&&current.weekReached1B<=300,`ramen must reach 1B in the design range [200, 300], current=${current.weekReached1B}`);
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
