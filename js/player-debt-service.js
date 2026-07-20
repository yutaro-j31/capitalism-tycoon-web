// Phase 6A-4C / 8B-3: debt service, negotiated relief, and bank covenants.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-debt-service.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-debt-service.js.');
if(!modules.playerCrisisCreditor?.__installed)throw new Error('player-crisis-creditor.js must be loaded before player-debt-service.js.');
if(modules.playerDebtService)throw new Error('player debt service module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const negotiatedCompanyBorrowRate=EngineClass.prototype.companyBorrowRate;
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
const weeklyContext=new WeakSet();
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
function shadowWithoutNegotiatedDiscounts(instance){const state=instance?.g||{},financeState=state.finance&&typeof state.finance==='object'?state.finance:{},loans=Array.isArray(financeState.loans)?financeState.loans.map(loan=>({...loan,crisisNegotiatedRateDiscount:0})):[];const shadow=Object.create(instance||null);shadow.g={...state,finance:{...financeState,loans}};return shadow;}
function ordinaryRate(instance){return clamp(negotiatedCompanyBorrowRate.call(shadowWithoutNegotiatedDiscounts(instance)),.005,.18);}
function negotiatedRate(instance){return clamp(negotiatedCompanyBorrowRate.call(instance),.005,.18);}
function covenantState(instance){const state=instance?.g||instance||{},finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),raw=finance.bankCovenants&&typeof finance.bankCovenants==='object'?finance.bankCovenants:{};const c=finance.bankCovenants={maxDebtToCash:3,minInterestCoverage:1.25,breachWeeks:0,healthyWeeks:0,status:'compliant',rateSurcharge:0,lastCheckedWeek:-1,history:[],...raw};c.breachWeeks=Math.max(0,Math.floor(finite(c.breachWeeks)));c.healthyWeeks=Math.max(0,Math.floor(finite(c.healthyWeeks)));c.rateSurcharge=clamp(c.rateSurcharge,0,.02);c.history=Array.isArray(c.history)?c.history.slice(-52):[];if(!['compliant','warning','breach'].includes(c.status))c.status='compliant';return c;}
function covenantMetrics(instance){const state=instance?.g||instance||{},debt=Math.max(0,finite(state.companyDebt)),cash=Math.max(1_000_000,finite(state.companyCash)),r=state.lastReport&&typeof state.lastReport==='object'?state.lastReport:{},interest=Math.max(0,finite(r.interest)),operating=Math.max(0,finite(r.operatingProfit,finite(r.profit)+interest));return{debtToCash:debt/cash,interestCoverage:interest>0?operating/interest:99,debt};}
function evaluateCovenants(instance){const state=instance.g||instance,c=covenantState(instance),week=Math.floor(finite(state.week));if(c.lastCheckedWeek===week)return c;const m=covenantMetrics(instance),breached=m.debt>=30_000_000&&(m.debtToCash>c.maxDebtToCash||m.interestCoverage<c.minInterestCoverage);if(breached){c.breachWeeks++;c.healthyWeeks=0;c.status=c.breachWeeks>=2?'breach':'warning';c.rateSurcharge=clamp(c.breachWeeks*.0025,0,.02);state.companyCredit=clamp(finite(state.companyCredit,60)-(c.status==='breach'?2:1),0,100);}else{c.healthyWeeks++;c.breachWeeks=Math.max(0,c.breachWeeks-1);c.rateSurcharge=clamp(c.rateSurcharge-.00125,0,.02);c.status=c.breachWeeks?'warning':'compliant';}c.lastCheckedWeek=week;c.history.push({week,status:c.status,debtToCash:Math.round(m.debtToCash*100)/100,interestCoverage:Math.round(m.interestCoverage*100)/100,rateSurcharge:c.rateSurcharge});c.history=c.history.slice(-52);if(breached&&Array.isArray(state.news))state.news.unshift({week,title:'銀行コベナンツ警戒',body:`財務制限条項が${c.status==='breach'?'抵触':'警戒水準'}です。借入金利と信用力に影響します。`});return c;}
function weeklyRate(instance){const hook=instance?.companyWeeklyBorrowRate,value=typeof hook==='function'?hook.call(instance):negotiatedRate(instance);return Number.isFinite(Number(value))?clamp(Number(value),.005,.18):negotiatedRate(instance);}
function weeklyInterest(instance){return Math.max(0,finite(instance?.g?.companyDebt))*weeklyRate(instance)/52;}
function inWeeklyContext(instance){return weeklyContext.has(instance);}
EngineClass.prototype.companyWeeklyBorrowRate=function(){return clamp(negotiatedRate(this)+covenantState(this).rateSurcharge,.005,.18);};
EngineClass.prototype.companyWeeklyInterest=function(){return weeklyInterest(this);};
EngineClass.prototype.companyBorrowRate=function(){return inWeeklyContext(this)?weeklyRate(this):ordinaryRate(this);};
EngineClass.prototype.advanceWeek=function(...args){if(weeklyContext.has(this))return baseAdvanceWeek.apply(this,args);weeklyContext.add(this);try{const result=baseAdvanceWeek.apply(this,args);if(result!==false)evaluateCovenants(this);return result;}finally{weeklyContext.delete(this);}};
EngineClass.prototype.__playerDebtServiceInstalled=true;EngineClass.prototype.__playerBankCovenantsInstalled=true;
modules.playerDebtService=Object.freeze({ordinaryRate,negotiatedRate,weeklyRate,weeklyInterest,inWeeklyContext,shadowWithoutNegotiatedDiscounts,covenantState,covenantMetrics,evaluateCovenants,__installed:true});
modules.playerBankCovenants=Object.freeze({normalize:covenantState,metrics:covenantMetrics,evaluate:evaluateCovenants,__installed:true});
})();
