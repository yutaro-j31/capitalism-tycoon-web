// Phase 6A-3A: behavior-preserving weekly company debt-service extension point.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-debt-service.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-debt-service.js.');
if(!modules.playerCrisisRestructuring?.__installed)throw new Error('player-crisis-restructuring.js must be loaded before player-debt-service.js.');
if(modules.playerDebtService)throw new Error('player debt service module is already registered.');

const EngineClass=modules.engine.TycoonEngine;
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
const baseCompanyBorrowRate=EngineClass.prototype.companyBorrowRate;
const weeklyContext=new WeakSet();
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));

function baseRate(instance){return clamp(baseCompanyBorrowRate.call(instance),0,.18);}
function weeklyRate(instance){
 const hook=instance?.companyWeeklyBorrowRate;
 const value=typeof hook==='function'?hook.call(instance):baseRate(instance);
 return Number.isFinite(Number(value))?clamp(Number(value),0,.18):baseRate(instance);
}
function weeklyInterest(instance){return Math.max(0,finite(instance?.g?.companyDebt))*weeklyRate(instance)/52;}
function inWeeklyContext(instance){return weeklyContext.has(instance);}

EngineClass.prototype.companyWeeklyBorrowRate=function(){return baseRate(this);};
EngineClass.prototype.companyWeeklyInterest=function(){return weeklyInterest(this);};
EngineClass.prototype.companyBorrowRate=function(){return inWeeklyContext(this)?weeklyRate(this):baseCompanyBorrowRate.call(this);};
EngineClass.prototype.advanceWeek=function(...args){
 if(weeklyContext.has(this))return baseAdvanceWeek.apply(this,args);
 weeklyContext.add(this);
 try{return baseAdvanceWeek.apply(this,args);}finally{weeklyContext.delete(this);}
};
EngineClass.prototype.__playerDebtServiceInstalled=true;

modules.playerDebtService=Object.freeze({baseRate,weeklyRate,weeklyInterest,inWeeklyContext,__installed:true});
})();
