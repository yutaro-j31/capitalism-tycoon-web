'use strict';
const {loadGame}=require('./harness');
const SEED=190826044;
function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
const {ctx}=loadGame({random:lcg(SEED),headless:true}),e=new ctx.__ct_headlessEngineClass();e.save=()=>{};e.emit=()=>{};
e.configure({playerName:'Tester',companyName:'RE Co',difficulty:'normal',scenario:'free'});e.g.skipWeeklyValidation=true;
const free=e.g.tenants.filter(t=>!t.occupiedBy).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)));
const t=free.find(x=>x.businessID==='realEstateAgency')||free[0],b=e.business('realEstateAgency'),upfront=b.storeCost+t.deposit;
console.log('RE_START',JSON.stringify({week:e.g.week,cash:e.g.companyCash,debt:e.g.companyDebt,tenant:{id:t.id,prefID:t.prefID,rent:t.rent,deposit:t.deposit,traffic:t.traffic},business:{storeCost:b.storeCost,fixedCost:b.fixedCost,wage:b.wage},upfront}));
console.log('RE_OPEN',e.openStore({tenantID:t.id,businessID:'realEstateAgency',name:'RE-1',operatingHours:3}));
const store=e.g.stores[0];
for(let i=0;i<24&&!e.g.gameOver;i++){
  const before=e.g.companyCash;
  e.advanceWeek(false);
  const p=store?.brokeragePipeline,lr=e.g.lastReport;
  console.log('RE_WEEK',JSON.stringify({week:e.g.week,status:store?.status,cashBefore:before,cash:e.g.companyCash,cashDelta:e.g.companyCash-before,debt:e.g.companyDebt,storeProfit:store?.lastProfit,storeSales:store?.lastSales,reportProfit:lr?.profit,condition:store?.condition,pipeline:p?.lastWeek?{activeDeals:p.lastWeek.activeDeals,inquiries:p.lastWeek.inquiries,newMandates:p.lastWeek.newMandates,closedDeals:p.lastWeek.closedDeals,lostDeals:p.lastWeek.lostDeals,commissionRevenue:p.lastWeek.commissionRevenue}:null,negativeWeeks:e.g.consecutiveNegativeCashWeeks,gameOver:e.g.gameOver,reason:e.g.gameOverReason||null}));
}
