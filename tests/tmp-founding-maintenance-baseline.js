'use strict';
const {loadGame}=require('./harness');
const BUSINESS=process.env.BUSINESS_ID||'ramen';
const EXPAND=process.env.EXPAND==='true';
const THRESHOLD=Number(process.env.RENOVATE_THRESHOLD||70);
const BASE_SEEDS={ramen:190826041,conveni:190826042,gym:190826043,realEstateAgency:190826044};
function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
function tenantPool(e,id){const free=e.g.tenants.filter(t=>!t.occupiedBy);const matching=free.filter(t=>t.businessID===id);return(matching.length?matching:free).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)));}
function avg8(e){const h=e.g.weeklyProfitHistory.slice(-8);return h.length?h.reduce((a,n)=>a+n,0)/h.length:0;}
function plannedFinancing(e,id,t){const b=e.business(id),cost=b.storeCost+t.deposit,cash=e.g.companyCash;if(cash>=cost)return{ok:true,borrow:0,cost};const cap=Math.max(0,e.companyCreditLimit()-e.g.companyDebt),borrow=Math.min(cost-cash,cap),after=cash+borrow;if(after>=cost)return{ok:true,borrow,cost};const saved=e.g.companyCash;e.g.companyCash=after;const est=e.estimateStoreOpening({tenantID:t.id,businessID:id,operatingHours:3});e.g.companyCash=saved;return est?.affordable?{ok:true,borrow,cost}:{ok:false,borrow:0,cost};}
function tryOpen(e,id){for(const t of tenantPool(e,id)){const p=plannedFinancing(e,id,t);if(!p.ok)continue;if(p.borrow>0&&e.borrow(Math.ceil(p.borrow),'company')!==true)continue;if(e.openStore({tenantID:t.id,businessID:id,name:`${id}-${e.g.stores.length+1}`,operatingHours:3})===true)return true;}return false;}
function maintain(e,stats){for(const s of e.g.stores){if(s.status!=='open'||s.businessID!==BUSINESS||Number(s.condition)>THRESHOLD)continue;const p=e.storeRenovationPlan(s.id);if(!p?.needed||!p.affordable||e.g.companyCash<=p.cost*3)continue;const before=e.g.companyCash;if(e.renovateStore(s.id)===true){stats.count++;stats.cost+=before-e.g.companyCash;}}}
const {ctx}=loadGame({random:lcg(BASE_SEEDS[BUSINESS]||190826041),headless:true}),e=new ctx.__ct_headlessEngineClass();e.save=()=>{};e.emit=()=>{};
e.configure({playerName:'Tester',companyName:`${BUSINESS} Co`,difficulty:'normal',scenario:'free'});e.g.skipWeeklyValidation=true;
const opened=tryOpen(e,BUSINESS);let weekReached1B=null,minCash=e.g.companyCash;const maintenance={count:0,cost:0};
while(opened&&e.g.week<500&&!e.g.gameOver){e.advanceWeek(false);minCash=Math.min(minCash,e.g.companyCash);if(weekReached1B===null&&e.companyValue()>=1e9)weekReached1B=e.g.week;if(e.g.week%4===0){maintain(e,maintenance);if(EXPAND&&avg8(e)>0){const t=tenantPool(e,BUSINESS)[0];if(t){const next=e.business(BUSINESS).storeCost+t.deposit;if(e.g.companyCash>next*3)tryOpen(e,BUSINESS);}}}}
const stores=e.g.stores.filter(s=>s.businessID===BUSINESS&&s.status==='open');
const out={businessID:BUSINESS,expand:EXPAND,opened,threshold:THRESHOLD,week:e.g.week,weekReached1B,gameOver:e.g.gameOver,gameOverReason:e.g.gameOverReason||null,companyValue:e.companyValue(),companyCash:e.g.companyCash,companyDebt:e.g.companyDebt,storeCount:stores.length,avgProfitLast8:avg8(e),minCash,renovations:maintenance.count,renovationSpend:maintenance.cost,avgCondition:stores.length?stores.reduce((a,s)=>a+Number(s.condition||0),0)/stores.length:null,lossStores:stores.filter(s=>Number(s.lastProfit)<0).length};
console.log(`FOUNDING_MAINTENANCE_BASELINE ${JSON.stringify(out)}`);
