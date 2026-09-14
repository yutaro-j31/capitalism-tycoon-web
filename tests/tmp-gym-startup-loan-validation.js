'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
const {ctx,modules}=loadGame({random:lcg(190826200),headless:true});
const e=new ctx.__ct_headlessEngineClass();e.save=()=>{};e.emit=()=>{};
e.configure({playerName:'Tester',companyName:'Gym Co',difficulty:'normal',scenario:'free'});e.g.skipWeeklyValidation=true;
const tenant=e.g.tenants.filter(t=>!t.occupiedBy).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id))).find(t=>t.businessID==='gym')||e.g.tenants.find(t=>!t.occupiedBy);
assert.ok(tenant,'gym tenant exists');
const b=e.business('gym'),cost=b.storeCost+tenant.deposit,cashStart=e.g.companyCash;
const ordinaryCapacity=Math.max(0,e.companyCreditLimit()-e.g.companyDebt),ordinaryBorrow=Math.min(Math.max(0,cost-e.g.companyCash),ordinaryCapacity);
if(ordinaryBorrow>0)assert.equal(e.borrow(Math.ceil(ordinaryBorrow),'company'),true,'ordinary company credit should fund first layer');
const beforeEstimate=JSON.stringify(e.g),estimate=e.estimateStoreOpening({tenantID:tenant.id,businessID:'gym',operatingHours:3});
assert.equal(JSON.stringify(e.g),beforeEstimate,'gym estimate is read-only');
assert.ok(estimate?.startupLoan?.eligible,'first gym should expose startup loan after ordinary credit');
assert.equal(estimate.affordable,true,'startup-loan-backed first gym should be affordable');
assert.ok(estimate.startupLoan.principal>0&&estimate.startupLoan.principal<=5_500_000,'startup principal stays capped');
assert.equal(e.openStore({tenantID:tenant.id,businessID:'gym',name:'Gym-1',operatingHours:3}),true,'first gym should open');
assert.equal(modules.finance.validate(e.g).ok,true,'accounting balances after gym opening');
const debtAfterOpen=e.g.companyDebt,loan=e.g.finance.loans.find(l=>l.sourceType==='gymStartupLoan');
assert.ok(loan,'canonical finance contains gym startup loan');
for(let i=0;i<40&&!e.g.gameOver;i++){assert.notEqual(e.advanceWeek(false),false);assert.equal(modules.finance.validate(e.g).ok,true,`accounting balances week ${e.g.week}`);}
const active=e.g.finance.loans.find(l=>l.loanID===loan.loanID);
assert.ok(active.outstandingPrincipal<loan.principal,'startup loan amortizes');
console.log('GYM_STARTUP_LOAN_VALIDATION',JSON.stringify({cashStart,cost,ordinaryBorrow,startupLoan:estimate.startupLoan,debtAfterOpen,week:e.g.week,gameOver:e.g.gameOver,endingCash:e.g.companyCash,endingDebt:e.g.companyDebt,outstandingPrincipal:active.outstandingPrincipal,storeStatus:e.g.stores[0]?.status,avgProfitLast8:e.g.weeklyProfitHistory.slice(-8).reduce((a,n)=>a+n,0)/Math.max(1,e.g.weeklyProfitHistory.slice(-8).length)}));
