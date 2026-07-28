// Script boundary: js/pmi-long-run-guard.js (classic JavaScript)
'use strict';
(function(exports){
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const money=(value,min,max)=>Math.round(Math.max(min,Math.min(max,finite(value,min))));
function normalizeSubsidiary(sub){if(!sub||typeof sub!=='object')return sub;sub.valuation=money(sub.valuation,1_000_000,9_900_000_000_000);sub.weeklyProfit=money(sub.weeklyProfit,-100_000_000_000,100_000_000_000);sub.standaloneWeeklyProfit=money(sub.standaloneWeeklyProfit,-100_000_000_000,100_000_000_000);sub.pmiWeeklySynergyProfit=money(sub.pmiWeeklySynergyProfit,0,50_000_000_000);sub.pmiWeeklyDisruptionCost=money(sub.pmiWeeklyDisruptionCost,0,50_000_000_000);sub.pmiPlanSpend=money(sub.pmiPlanSpend,0,9_900_000_000_000);return sub;}
function normalizeState(state){if(!Array.isArray(state?.maSubsidiaries))return state;for(const sub of state.maSubsidiaries)normalizeSubsidiary(sub);return state;}
function installPMILongRunGuard(TycoonEngine){if(!TycoonEngine||TycoonEngine.prototype.__pmiLongRunGuardInstalled)return;const proto=TycoonEngine.prototype,baseUpdate=proto.updateSubsidiaries,baseNormalize=proto.normalize,baseSave=proto.save;proto.updateSubsidiaries=function(){const result=baseUpdate.apply(this,arguments);normalizeState(this.g);return result;};proto.normalize=function(){const result=baseNormalize.apply(this,arguments);normalizeState(this.g);return result;};proto.save=function(){normalizeState(this.g);return baseSave.apply(this,arguments);};Object.defineProperty(proto,'__pmiLongRunGuardInstalled',{value:true});}
exports.installPMILongRunGuard=installPMILongRunGuard;exports.normalizeState=normalizeState;exports.normalizeSubsidiary=normalizeSubsidiary;if(globalThis.__capitalismTycoonModules?.engine?.TycoonEngine)installPMILongRunGuard(globalThis.__capitalismTycoonModules.engine.TycoonEngine);
})(globalThis.__capitalismTycoonModules.pmiLongRunGuard={});
