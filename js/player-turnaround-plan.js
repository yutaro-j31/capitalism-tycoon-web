// Phase 6A-5A: deterministic player turnaround plan tracking.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-turnaround-plan.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerDebtService?.__installed)throw new Error('player-debt-service.js must be loaded before player-turnaround-plan.js.');
if(modules.playerTurnaroundPlan)throw new Error('player turnaround plan module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const STATUSES=Object.freeze(['inactive','active','completed','failed','cancelled']);
const ELIGIBLE=new Set(['watch','distressed','turnaround','recovered']);
const HISTORY_LIMIT=26,TERM_WEEKS=8;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const integer=(v,f=0)=>Math.max(0,Math.floor(finite(v,f)));
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
function normalizeHistory(value){return (Array.isArray(value)?value:[]).filter(plain).slice(-HISTORY_LIMIT).map(row=>({planID:String(row.planID||''),startedWeek:integer(row.startedWeek),endedWeek:integer(row.endedWeek),status:STATUSES.includes(row.status)?row.status:'failed',targetCash:Math.max(0,finite(row.targetCash)),targetDebt:Math.max(0,finite(row.targetDebt)),endingCash:finite(row.endingCash),endingDebt:Math.max(0,finite(row.endingDebt))}));}
function ensure(state){
 const current=plain(state.playerTurnaroundPlan)?state.playerTurnaroundPlan:{};
 current.status=STATUSES.includes(current.status)?current.status:'inactive';
 current.planID=String(current.planID||'');
 current.startedWeek=integer(current.startedWeek);
 current.deadlineWeek=integer(current.deadlineWeek);
 current.targetCash=Math.max(0,finite(current.targetCash));
 current.startingCash=finite(current.startingCash);
 current.startingDebt=Math.max(0,finite(current.startingDebt));
 current.targetDebt=Math.max(0,finite(current.targetDebt));
 current.progress=Math.max(0,Math.min(1,finite(current.progress)));
 current.lastEvaluationWeek=integer(current.lastEvaluationWeek);
 current.history=normalizeHistory(current.history);
 state.playerTurnaroundPlan=current;return current;
}
function metrics(state,plan=ensure(state)){
 const cash=finite(state.companyCash),debt=Math.max(0,finite(state.companyDebt));
 const cashBase=Math.max(1,plan.targetCash-plan.startingCash),cashProgress=Math.max(0,Math.min(1,(cash-plan.startingCash)/cashBase));
 const debtBase=Math.max(1,plan.startingDebt-plan.targetDebt),debtProgress=plan.startingDebt<=plan.targetDebt?1:Math.max(0,Math.min(1,(plan.startingDebt-debt)/debtBase));
 return Object.freeze({cash,debt,cashProgress,debtProgress,progress:(cashProgress+debtProgress)/2,weeksRemaining:Math.max(0,plan.deadlineWeek-integer(state.week))});
}
function archive(state,plan,status){const m=metrics(state,plan);plan.history.push({planID:plan.planID,startedWeek:plan.startedWeek,endedWeek:integer(state.week),status,targetCash:plan.targetCash,targetDebt:plan.targetDebt,endingCash:m.cash,endingDebt:m.debt});plan.history=plan.history.slice(-HISTORY_LIMIT);plan.status=status;plan.progress=m.progress;}
function start(state){
 const plan=ensure(state),crisis=modules.playerCrisis.ensure(state);
 if(!ELIGIBLE.has(crisis.status)||plan.status==='active'||state.gameOver||state.isCompanySold)return false;
 const week=integer(state.week),reserve=modules.playerCrisis.reserveThreshold(state),debt=Math.max(0,finite(state.companyDebt));
 Object.assign(plan,{status:'active',planID:`turnaround-${week}`,startedWeek:week,deadlineWeek:week+TERM_WEEKS,targetCash:reserve,startingCash:finite(state.companyCash),startingDebt:debt,targetDebt:debt*0.9,progress:0,lastEvaluationWeek:week});
 return true;
}
function cancel(state){const plan=ensure(state);if(plan.status!=='active')return false;archive(state,plan,'cancelled');return true;}
function evaluate(state){
 const plan=ensure(state),week=integer(state.week);if(plan.status!=='active'||plan.lastEvaluationWeek===week)return snapshot(state);
 plan.lastEvaluationWeek=week;const m=metrics(state,plan);plan.progress=m.progress;
 if(m.cash>=plan.targetCash&&m.debt<=plan.targetDebt)archive(state,plan,'completed');
 else if(week>=plan.deadlineWeek)archive(state,plan,'failed');
 return snapshot(state);
}
function snapshot(state){const plan=ensure(state),m=metrics(state,plan);return Object.freeze({status:plan.status,planID:plan.planID,startedWeek:plan.startedWeek,deadlineWeek:plan.deadlineWeek,targetCash:plan.targetCash,targetDebt:plan.targetDebt,progress:plan.progress,weeksRemaining:m.weeksRemaining,cashProgress:m.cashProgress,debtProgress:m.debtProgress});}
function validate(state){const p=state?.playerTurnaroundPlan;if(!plain(p))throw new Error('playerTurnaroundPlan must be an object.');if(!STATUSES.includes(p.status))throw new Error('playerTurnaroundPlan.status is invalid.');for(const key of ['startedWeek','deadlineWeek','targetCash','startingCash','startingDebt','targetDebt','progress','lastEvaluationWeek'])if(!Number.isFinite(Number(p[key])))throw new Error(`playerTurnaroundPlan.${key} must be finite.`);if(!Array.isArray(p.history)||p.history.length>HISTORY_LIMIT)throw new Error('playerTurnaroundPlan.history is invalid.');return true;}
const baseNormalize=EngineClass.prototype.normalize;EngineClass.prototype.normalize=function(){const r=baseNormalize.call(this);ensure(this.g);return r;};
const baseSave=EngineClass.prototype.save;EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;EngineClass.prototype.advanceWeek=function(showSummary=true){const result=baseAdvanceWeek.call(this,showSummary);if(result!==false)evaluate(this.g);return result;};
EngineClass.prototype.startTurnaroundPlan=function(){return start(this.g);};
EngineClass.prototype.cancelTurnaroundPlan=function(){return cancel(this.g);};
EngineClass.prototype.turnaroundPlanSnapshot=function(){return snapshot(this.g);};
EngineClass.prototype.__playerTurnaroundPlanInstalled=true;
modules.playerTurnaroundPlan=Object.freeze({STATUSES,ELIGIBLE_STATUSES:Object.freeze([...ELIGIBLE]),HISTORY_LIMIT,TERM_WEEKS,ensure,start,cancel,evaluate,snapshot,metrics,validate,__installed:true});
})();
