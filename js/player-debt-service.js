// Phase 6A-4C: apply creditor-negotiated rate relief only to weekly interest expense.
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

function shadowWithoutNegotiatedDiscounts(instance){
 const state=instance?.g||{};
 const financeState=state.finance&&typeof state.finance==='object'?state.finance:{};
 const loans=Array.isArray(financeState.loans)?financeState.loans.map(loan=>({...loan,crisisNegotiatedRateDiscount:0})):[];
 const shadow=Object.create(instance||null);
 shadow.g={...state,finance:{...financeState,loans}};
 return shadow;
}
function ordinaryRate(instance){return clamp(negotiatedCompanyBorrowRate.call(shadowWithoutNegotiatedDiscounts(instance)),.005,.18);}
function negotiatedRate(instance){return clamp(negotiatedCompanyBorrowRate.call(instance),.005,.18);}
function weeklyRate(instance){
 const hook=instance?.companyWeeklyBorrowRate;
 const value=typeof hook==='function'?hook.call(instance):negotiatedRate(instance);
 return Number.isFinite(Number(value))?clamp(Number(value),.005,.18):negotiatedRate(instance);
}
function weeklyInterest(instance){return Math.max(0,finite(instance?.g?.companyDebt))*weeklyRate(instance)/52;}
function inWeeklyContext(instance){return weeklyContext.has(instance);}

EngineClass.prototype.companyWeeklyBorrowRate=function(){return negotiatedRate(this);};
EngineClass.prototype.companyWeeklyInterest=function(){return weeklyInterest(this);};
EngineClass.prototype.companyBorrowRate=function(){return inWeeklyContext(this)?weeklyRate(this):ordinaryRate(this);};
EngineClass.prototype.advanceWeek=function(...args){
 if(weeklyContext.has(this))return baseAdvanceWeek.apply(this,args);
 weeklyContext.add(this);
 try{return baseAdvanceWeek.apply(this,args);}finally{weeklyContext.delete(this);}
};
EngineClass.prototype.__playerDebtServiceInstalled=true;

modules.playerDebtService=Object.freeze({ordinaryRate,negotiatedRate,weeklyRate,weeklyInterest,inWeeklyContext,shadowWithoutNegotiatedDiscounts,__installed:true});
})();
