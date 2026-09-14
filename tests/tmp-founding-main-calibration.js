'use strict';

// Temporary latest-main calibration only. No production code is changed here.
// Candidate: ramen chain brand support = +1 brand point per additional open ramen store,
// capped at +20. The benefit is derived from current open-store count and is zero for one store.
const assert=require('node:assert/strict');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {loadGame}=require('./harness');
const SEED=190826041;
function lcg(seed=SEED){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
function tenantPool(engine,businessID){const free=engine.g.tenants.filter(t=>!t.occupiedBy);const matching=free.filter(t=>t.businessID===businessID);return (matching.length?matching:free).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)));}
function plannedFinancing(engine,businessID,tenant){const business=engine.business(businessID),cost=business.storeCost+tenant.deposit,cash=engine.g.companyCash;if(cash>=cost)return{affordable:true,cost,ordinaryBorrow:0};const ordinaryCapacity=Math.max(0,engine.companyCreditLimit()-engine.g.companyDebt),ordinaryBorrow=Math.min(cost-cash,ordinaryCapacity),cashAfterOrdinary=cash+ordinaryBorrow;if(cashAfterOrdinary>=cost)return{affordable:true,cost,ordinaryBorrow};const savedCash=engine.g.companyCash;engine.g.companyCash=cashAfterOrdinary;const estimate=engine.estimateStoreOpening({tenantID:tenant.id,businessID,operatingHours:3});engine.g.companyCash=savedCash;return estimate?.affordable?{affordable:true,cost,ordinaryBorrow}:{affordable:false,cost,ordinaryBorrow:0};}
function bestAffordableTenant(engine,businessID){for(const tenant of tenantPool(engine,businessID)){const plan=plannedFinancing(engine,businessID,tenant);if(plan.affordable)return{tenant,plan};}return null;}
function tryOpenStore(engine,businessID){const found=bestAffordableTenant(engine,businessID);if(!found)return false;if(found.plan.ordinaryBorrow>0&&engine.borrow(Math.ceil(found.plan.ordinaryBorrow),'company')!==true)return false;return engine.openStore({tenantID:found.tenant.id,businessID,name:`${businessID}-${engine.g.stores.length+1}`,operatingHours:3})===true;}
function last8AvgProfit(engine){const h=engine.g.weeklyProfitHistory.slice(-8);return h.length?h.reduce((a,n)=>a+n,0)/h.length:0;}
function applyChainBrand(engine,businessID,baseBrand,perStore,cap){const count=engine.g.stores.filter(s=>s.businessID===businessID&&s.status==='open').length;const benefit=Math.min(cap,Math.max(0,count-1)*perStore);engine.business(businessID).brand=baseBrand+benefit;return benefit;}
function run({perStore=0,cap=0,maxWeeks=500,allowExpansion=true,seed=SEED}){const {ctx}=loadGame({random:lcg(seed),headless:true}),engine=new ctx.__ct_headlessEngineClass();engine.save=()=>{};engine.configure({playerName:'Tester',companyName:'Ramen Co',difficulty:'normal',scenario:'free'});engine.g.skipWeeklyValidation=true;const business=engine.business('ramen'),baseBrand=business.brand;const master={price:business.price,unitCost:business.unitCost,demand:business.demand,storeCost:business.storeCost,fixedCost:business.fixedCost,baseBrand};const firstStoreOpened=tryOpenStore(engine,'ramen');let weekReached1B=null,finalBenefit=0;const openingWeeks=firstStoreOpened?[engine.g.week]:[];while(engine.g.week<maxWeeks&&!engine.g.gameOver){finalBenefit=applyChainBrand(engine,'ramen',baseBrand,perStore,cap);engine.advanceWeek(false);if(weekReached1B===null&&engine.companyValue()>=1e9)weekReached1B=engine.g.week;if(allowExpansion&&engine.g.week%4===0&&last8AvgProfit(engine)>0){const tenant=tenantPool(engine,'ramen')[0];if(tenant){const nextCost=engine.business('ramen').storeCost+tenant.deposit;if(engine.g.companyCash>nextCost*3){const before=engine.g.stores.length;if(tryOpenStore(engine,'ramen')&&engine.g.stores.length>before)openingWeeks.push(engine.g.week);}}}}finalBenefit=applyChainBrand(engine,'ramen',baseBrand,perStore,cap);return{perStore,cap,allowExpansion,...master,week:engine.g.week,weekReached1B,firstStoreOpened,gameOver:engine.g.gameOver,companyValue:engine.companyValue(),companyCash:engine.g.companyCash,companyDebt:engine.g.companyDebt,storeCount:engine.g.stores.filter(s=>s.businessID==='ramen').length,avgProfitLast8:last8AvgProfit(engine),finalBenefit,openingWeeks};}
function worker(data){return new Promise((resolve,reject)=>{const w=new Worker(__filename,{workerData:data});w.once('message',resolve);w.once('error',reject);w.once('exit',code=>{if(code)reject(new Error(`worker exited ${code}`));});});}
if(!isMainThread){parentPort.postMessage(run(workerData));}
else{(async()=>{const [baseline,candidate,oneStoreBaseline,oneStoreCandidate]=await Promise.all([
 worker({perStore:0,cap:0,maxWeeks:500,allowExpansion:true}),
 worker({perStore:1,cap:20,maxWeeks:500,allowExpansion:true}),
 worker({perStore:0,cap:0,maxWeeks:500,allowExpansion:false}),
 worker({perStore:1,cap:20,maxWeeks:500,allowExpansion:false})
]);
 console.log(`FOUNDING_MAIN_RAMEN_BASELINE ${JSON.stringify(baseline)}`);
 console.log(`FOUNDING_MAIN_RAMEN_CHAIN_BRAND ${JSON.stringify(candidate)}`);
 console.log(`FOUNDING_MAIN_RAMEN_ONE_STORE ${JSON.stringify(oneStoreCandidate)}`);
 assert.equal(candidate.firstStoreOpened,true);
 assert.equal(candidate.gameOver,false,'candidate must survive 500 weeks');
 assert.ok(candidate.weekReached1B!==null&&candidate.weekReached1B>=200&&candidate.weekReached1B<=300,`candidate reach week ${candidate.weekReached1B} must be within [200,300]`);
 assert.ok(candidate.avgProfitLast8>0,`candidate must remain profitable at week 500, got ${candidate.avgProfitLast8}`);
 const strip=x=>({week:x.week,weekReached1B:x.weekReached1B,firstStoreOpened:x.firstStoreOpened,gameOver:x.gameOver,companyValue:x.companyValue,companyCash:x.companyCash,companyDebt:x.companyDebt,storeCount:x.storeCount,avgProfitLast8:x.avgProfitLast8,openingWeeks:x.openingWeeks});
 assert.deepEqual(strip(oneStoreCandidate),strip(oneStoreBaseline),'chain brand support must be exactly neutral for one-store play');
})().catch(error=>{console.error(error);process.exitCode=1;});}
