// Phase 5B-4 extension: deterministic competitor distress, turnaround, recovery, and bankruptcy lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-distress.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-distress.js.');
if(!modules.competitor.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-distress.js.');
if(!modules.competitor.__entryInstalled)throw new Error('competitor-entry.js must be loaded before competitor-distress.js.');
if(!modules.competitor.__creditInstalled)throw new Error('competitor-credit.js must be loaded before competitor-distress.js.');
if(modules.competitor.__distressInstalled)throw new Error('competitor distress lifecycle is already installed.');

const competitor=modules.competitor;
const TURNAROUND_DURATION_WEEKS=8;
const TURNAROUND_RECOVERY_WEEKS=3;
const TURNAROUND_RETRY_COOLDOWN_WEEKS=4;
const MAX_TURNAROUND_PLANS=8;
const PLAN_STATUSES=Object.freeze(['active','completed','failed','cancelled']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const money=value=>Math.max(0,Math.round(finite(value)));

function activePresences(company){return (company.marketPresence||[]).filter(presence=>presence.active);}
function activePlan(company){return (company.turnaroundPlans||[]).find(plan=>plan.status==='active')||null;}
function operatingCost(company){return Math.max(1,finite(company.weeklyFixedCost)+finite(company.weeklyMarketingCost)+finite(company.weeklyRDCost)+finite(company.weeklyInterestCost)+finite(company.weeklyCapacityCost));}
function planID(company,action,week){return `turnaround-${company.competitorID}-${action?.actionID||`legacy-${week}`}`;}
function normalizePlan(raw){
 const plan=raw&&typeof raw==='object'?raw:{};
 return {
  planID:String(plan.planID||''),competitorID:String(plan.competitorID||''),actionID:plan.actionID==null?null:String(plan.actionID),status:PLAN_STATUSES.includes(plan.status)?plan.status:'active',
  startWeek:integer(plan.startWeek),deadlineWeek:integer(plan.deadlineWeek,integer(plan.startWeek)+TURNAROUND_DURATION_WEEKS),completedWeek:plan.completedWeek==null?null:integer(plan.completedWeek),
  recoveryStreak:integer(plan.recoveryStreak),targetRecoveryWeeks:Math.max(1,integer(plan.targetRecoveryWeeks,TURNAROUND_RECOVERY_WEEKS)),
  initialCash:money(plan.initialCash),initialDebt:money(plan.initialDebt),initialCreditScore:clamp(plan.initialCreditScore,0,100),initialActivePresenceCount:integer(plan.initialActivePresenceCount),
  finalCash:plan.finalCash==null?null:money(plan.finalCash),finalDebt:plan.finalDebt==null?null:money(plan.finalDebt),finalCreditScore:plan.finalCreditScore==null?null:clamp(plan.finalCreditScore,0,100),
  outcome:String(plan.outcome||''),reason:String(plan.reason||'')
 };
}
function normalizePlans(rows){
 const map=new Map();
 for(const raw of Array.isArray(rows)?rows:[]){const plan=normalizePlan(raw);if(!plan.planID)continue;map.set(plan.planID,plan);}
 const plans=[...map.values()].sort((a,b)=>a.startWeek-b.startWeek||a.planID.localeCompare(b.planID));
 const active=plans.filter(plan=>plan.status==='active');
 const terminal=plans.filter(plan=>plan.status!=='active').slice(-Math.max(0,MAX_TURNAROUND_PLANS-active.length));
 return terminal.concat(active).sort((a,b)=>a.startWeek-b.startWeek||a.planID.localeCompare(b.planID)).slice(-MAX_TURNAROUND_PLANS);
}
function ensureDistressState(state){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 state.competitorEvents=state.competitorEvents.filter(event=>event&&typeof event==='object').slice(-160);
 for(const company of state.competitorStates||[]){
  company.turnaroundPlans=normalizePlans(company.turnaroundPlans);
  company.turnaroundAttempts=integer(company.turnaroundAttempts);
  company.failedTurnaroundAttempts=integer(company.failedTurnaroundAttempts);
  company.distressEpisodeCount=integer(company.distressEpisodeCount);
  company.distressEpisodeActive=Boolean(company.distressEpisodeActive);
  company.distressEnteredWeek=company.distressEnteredWeek==null?null:integer(company.distressEnteredWeek);
  company.turnaroundRetryEligibleWeek=integer(company.turnaroundRetryEligibleWeek);
  company.lastLifecycleReviewWeek=integer(company.lastLifecycleReviewWeek);
  company.bankruptcyWeek=company.bankruptcyWeek==null?null:integer(company.bankruptcyWeek);
  company.bankruptcyReason=String(company.bankruptcyReason||'');
  company.liquidationValue=money(company.liquidationValue);
  company.creditorRecovery=money(company.creditorRecovery);
  company.turnaroundWeeks=integer(company.turnaroundWeeks);
  if(company.status==='bankrupt'){
   company.active=false;
   for(const presence of company.marketPresence||[]){presence.active=false;presence.totalCapacity=0;presence.capacityPerStore=0;}
  }
 }
 return state;
}
function pushLifecycleEvent(state,company,type,text,operationID,extra={}){
 if((state.competitorEvents||[]).some(event=>event.operationID===operationID))return null;
 const event={week:integer(state.week),competitorID:company.competitorID,type,text,operationID,...extra};
 state.competitorEvents.push(event);state.competitorEvents=state.competitorEvents.slice(-160);return event;
}
function assessDistress(company){
 const cost=operatingCost(company),runway=Math.max(0,finite(company.cashRunwayWeeks,finite(company.cash)/cost)),limit=Math.max(1,finite(company.creditLimit)),leverage=finite(company.debt)/limit;
 const lossPressure=integer(company.lossWeeks)>=4||finite(company.weeklyProfit)<0&&runway<2;
 const creditPressure=finite(company.overCreditLimit)>0||integer(company.missedDebtPayments)>=2||company.creditStatus==='restricted';
 const severeCash=finite(company.cash)<=cost*.5&&finite(company.weeklyProfit)<0;
 const noOperations=activePresences(company).length===0;
 const score=(lossPressure?2:0)+(creditPressure?2:0)+(runway<1?2:runway<2?1:0)+(leverage>1?2:leverage>.85?1:0)+(integer(company.distressWeeks)>=6?1:0)+(noOperations?3:0);
 return {distressed:score>=3||company.status==='distressed'||company.status==='turnaround',critical:noOperations||score>=7||severeCash&&creditPressure,score,runway,leverage,lossPressure,creditPressure,noOperations};
}
function enterDistress(state,company,assessment,reason=''){ 
 if(!company.distressEpisodeActive){
  company.distressEpisodeActive=true;company.distressEpisodeCount+=1;company.distressEnteredWeek=integer(state.week);
  pushLifecycleEvent(state,company,'distress',`${company.name}が経営危機入り：${reason||`危機度 ${assessment.score}`}`,`distress-${company.competitorID}-${company.distressEpisodeCount}`,{score:assessment.score});
 }
 company.status='distressed';company.statusReason=reason||`危機度 ${assessment.score}`;return company;
}
function startTurnaroundPlan(state,company,action=null,reason=''){ 
 const week=integer(action?.appliedWeek,state.week),id=planID(company,action,week),existing=(company.turnaroundPlans||[]).find(plan=>plan.planID===id);
 if(existing)return existing;
 const current=activePlan(company);if(current)return current;
 const plan=normalizePlan({planID:id,competitorID:company.competitorID,actionID:action?.actionID||null,status:'active',startWeek:week,deadlineWeek:week+TURNAROUND_DURATION_WEEKS,recoveryStreak:0,targetRecoveryWeeks:TURNAROUND_RECOVERY_WEEKS,initialCash:company.cash,initialDebt:company.debt,initialCreditScore:company.creditScore,initialActivePresenceCount:activePresences(company).length,reason:reason||action?.reasonText||'経営再建計画'});
 company.turnaroundPlans=normalizePlans((company.turnaroundPlans||[]).concat([plan]));
 company.turnaroundAttempts+=1;company.status='turnaround';company.turnaroundWeeks=TURNAROUND_DURATION_WEEKS;company.decisionCooldownWeeks=Math.max(integer(company.decisionCooldownWeeks),2);
 if(action)action.turnaroundLifecycleApplied=true;
 pushLifecycleEvent(state,company,'turnaroundStarted',`${company.name}が${TURNAROUND_DURATION_WEEKS}週間の経営再建を開始`,`turnaround-start-${plan.planID}`,{planID:plan.planID,deadlineWeek:plan.deadlineWeek});
 return activePlan(company)||plan;
}
function applyTurnaroundActions(state){
 for(const action of state.competitorActions||[]){
  if(action.actionType!=='turnaround'||!action.applied||action.status==='skipped'||action.turnaroundLifecycleApplied)continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);if(!company||!company.active||company.status==='bankrupt'){action.turnaroundLifecycleApplied=true;continue;}
  startTurnaroundPlan(state,company,action,action.reasonText);
 }
}
function recoveryHealthy(company,assessment){return finite(company.weeklyProfit)>0&&assessment.runway>=4&&finite(company.overCreditLimit)<=0&&clamp(company.creditScore,0,100)>=35&&activePresences(company).length>0;}
function completeTurnaround(state,company,plan){
 plan.status='completed';plan.completedWeek=integer(state.week);plan.outcome='recovered';plan.finalCash=money(company.cash);plan.finalDebt=money(company.debt);plan.finalCreditScore=clamp(company.creditScore,0,100);
 company.status='recovering';company.statusReason='再建計画の回復条件を達成';company.distressEpisodeActive=false;company.distressWeeks=0;company.lossWeeks=0;company.profitableWeeks=Math.max(integer(company.profitableWeeks),TURNAROUND_RECOVERY_WEEKS);company.turnaroundWeeks=0;company.decisionCooldownWeeks=Math.max(integer(company.decisionCooldownWeeks),4);company.creditScore=clamp(company.creditScore+2,10,95);
 pushLifecycleEvent(state,company,'turnaroundCompleted',`${company.name}が経営再建を完了`,`turnaround-complete-${plan.planID}`,{planID:plan.planID});
 competitor.refreshCreditMetrics?.(state,company);return company;
}
function cancelPendingOperations(state,company,reason){
 const week=integer(state.week);
 for(const action of state.competitorActions||[]){
  if(action.competitorID!==company.competitorID||action.applied)continue;
  action.status='skipped';action.applied=true;action.appliedWeek=week;action.cancellationReason=reason;
 }
 competitor.migrateProjectsFromActions?.(state);
 for(const project of state.competitorProjects||[]){if(project.competitorID===company.competitorID&&['planned','inProgress'].includes(project.status)){project.status='failed';project.completedWeek=week;project.spentCost=0;project.failureReason=reason;}}
}
function bankruptCompany(state,company,reason='再建計画失敗'){
 if(company.status==='bankrupt')return company;
 const week=integer(state.week),presences=company.marketPresence||[],liquidation=money(presences.reduce((sum,presence)=>sum+integer(presence.storeCount)*250000+finite(presence.totalCapacity)*250,0)),available=money(company.cash)+liquidation,recovery=Math.min(money(company.debt),available);
 cancelPendingOperations(state,company,'bankruptcy');
 for(const presence of presences){presence.active=false;presence.exitWeek=week;presence.entryStatus=presence.entryStatus==='planned'||presence.entryStatus==='opening'?'failed':'exited';presence.entryFailureReason='bankruptcy';presence.storeCount=0;presence.capacityPerStore=0;presence.totalCapacity=0;presence.fulfilledUnits=0;presence.lostDemand=0;presence.revenue=0;presence.variableCost=0;presence.contributionMargin=0;presence.profit=0;presence.lastUpdatedWeek=week;}
 company.liquidationValue=liquidation;company.creditorRecovery=recovery;company.cash=0;company.debt=Math.max(0,money(company.debt)-recovery);company.creditScore=10;company.active=false;company.status='bankrupt';company.statusReason=reason;company.bankruptcyWeek=week;company.bankruptcyReason=reason;company.distressEpisodeActive=false;company.turnaroundWeeks=0;company.weeklyRevenue=0;company.weeklyVariableCost=0;company.weeklyFixedCost=0;company.weeklyMarketingCost=0;company.weeklyRDCost=0;company.weeklyInterestCost=0;company.weeklyCapacityCost=0;company.weeklyProfit=0;
 const plan=activePlan(company);if(plan){plan.status='failed';plan.completedWeek=week;plan.outcome='bankrupt';plan.reason=reason;plan.finalCash=0;plan.finalDebt=money(company.debt);plan.finalCreditScore=10;}
 competitor.refreshCreditMetrics?.(state,company);
 pushLifecycleEvent(state,company,'bankruptcy',`${company.name}が倒産：${reason}`,`bankruptcy-${company.competitorID}-${week}`,{liquidationValue:liquidation,creditorRecovery:recovery});return company;
}
function failTurnaround(state,company,plan,assessment,reason='回復条件未達'){
 plan.status='failed';plan.completedWeek=integer(state.week);plan.outcome='failed';plan.reason=reason;plan.finalCash=money(company.cash);plan.finalDebt=money(company.debt);plan.finalCreditScore=clamp(company.creditScore,0,100);
 company.failedTurnaroundAttempts+=1;company.turnaroundWeeks=0;
 pushLifecycleEvent(state,company,'turnaroundFailed',`${company.name}の経営再建が失敗：${reason}`,`turnaround-failed-${plan.planID}`,{planID:plan.planID,attempt:company.failedTurnaroundAttempts});
 if(assessment.critical||company.failedTurnaroundAttempts>=2||activePresences(company).length===0)return bankruptCompany(state,company,reason);
 company.status='distressed';company.statusReason=reason;company.distressEpisodeActive=true;company.distressWeeks=Math.max(integer(company.distressWeeks),6);company.turnaroundRetryEligibleWeek=integer(state.week)+TURNAROUND_RETRY_COOLDOWN_WEEKS;company.decisionCooldownWeeks=Math.max(integer(company.decisionCooldownWeeks),TURNAROUND_RETRY_COOLDOWN_WEEKS);return company;
}
function reviewCompanyLifecycle(state,company){
 const week=integer(state.week);if(company.lastLifecycleReviewWeek===week)return company;
 company.lastLifecycleReviewWeek=week;
 if(!company.active||company.status==='bankrupt')return company;
 const assessment=assessDistress(company),plan=activePlan(company);
 if(plan){
  company.status='turnaround';company.turnaroundWeeks=Math.max(0,plan.deadlineWeek-week);
  plan.recoveryStreak=recoveryHealthy(company,assessment)?plan.recoveryStreak+1:0;
  if(plan.recoveryStreak>=plan.targetRecoveryWeeks)return completeTurnaround(state,company,plan);
  if(week>=plan.deadlineWeek)return failTurnaround(state,company,plan,assessment,assessment.critical?'資金・信用条件が臨界水準':'期限内に回復条件を達成できず');
  return company;
 }
 if(assessment.distressed)return enterDistress(state,company,assessment);
 if(company.status==='recovering'){
  if(finite(company.weeklyProfit)>0&&assessment.runway>=4&&integer(company.profitableWeeks)>=4)company.status='growing';
  else if(finite(company.weeklyProfit)<0)company.status='defending';
 }
 return company;
}
function prepareLifecycleWeek(state){
 const week=integer(state.week);
 for(const company of state.competitorStates||[]){
  const plan=activePlan(company);
  if(plan||week<integer(company.turnaroundRetryEligibleWeek))company.decisionCooldownWeeks=Math.max(integer(company.decisionCooldownWeeks),2);
 }
}
function processLifecycleWeek(state){ensureDistressState(state);applyTurnaroundActions(state);for(const company of state.competitorStates||[])reviewCompanyLifecycle(state,company);ensureDistressState(state);return state;}
function validateDistress(state){
 const errors=[];
 for(const company of state.competitorStates||[]){
  for(const key of ['turnaroundAttempts','failedTurnaroundAttempts','distressEpisodeCount','turnaroundRetryEligibleWeek','lastLifecycleReviewWeek','liquidationValue','creditorRecovery','turnaroundWeeks'])if(!Number.isFinite(Number(company[key]))||Number(company[key])<0)errors.push(`distress.${key}不正`);
  if(company.distressEnteredWeek!==null&&!Number.isFinite(Number(company.distressEnteredWeek)))errors.push('distressEnteredWeek不正');if(company.bankruptcyWeek!==null&&!Number.isFinite(Number(company.bankruptcyWeek)))errors.push('bankruptcyWeek不正');
  if(!Array.isArray(company.turnaroundPlans))errors.push('turnaroundPlans配列不正');else{if(company.turnaroundPlans.length>MAX_TURNAROUND_PLANS)errors.push('turnaroundPlans上限超過');const ids=new Set();let active=0;for(const plan of company.turnaroundPlans){if(ids.has(plan.planID))errors.push('turnaround planID重複');ids.add(plan.planID);if(!PLAN_STATUSES.includes(plan.status))errors.push('turnaround status不正');if(plan.status==='active')active+=1;for(const key of ['startWeek','deadlineWeek','recoveryStreak','targetRecoveryWeeks','initialCash','initialDebt','initialCreditScore','initialActivePresenceCount'])if(!Number.isFinite(Number(plan[key])))errors.push(`turnaround.${key}非有限`);if(plan.deadlineWeek<plan.startWeek)errors.push('turnaround期間不正');if(plan.status!=='active'&&plan.completedWeek===null)errors.push('turnaround完了週欠落');}if(active>1)errors.push('active turnaround重複');}
  if(company.status==='bankrupt'){if(company.active)errors.push('bankrupt企業がactive');if((company.marketPresence||[]).some(presence=>presence.active||finite(presence.totalCapacity)>0))errors.push('bankrupt企業の市場が稼働');if((state.competitorActions||[]).some(action=>action.competitorID===company.competitorID&&!action.applied))errors.push('bankrupt企業に未処理action');}
 }
 if(errors.length)throw new Error(errors.join(' / '));return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureDistressState(state);return state;};
competitor.processWeek=function(state){ensureDistressState(state);prepareLifecycleWeek(state);const result=baseProcessWeek(state);processLifecycleWeek(state);return result;};
competitor.validate=function(state){baseValidate(state);validateDistress(state);return true;};
Object.assign(competitor,{TURNAROUND_DURATION_WEEKS,TURNAROUND_RECOVERY_WEEKS,TURNAROUND_RETRY_COOLDOWN_WEEKS,MAX_TURNAROUND_PLANS,PLAN_STATUSES,assessDistress,ensureDistressState,enterDistress,startTurnaroundPlan,applyTurnaroundActions,reviewCompanyLifecycle,processLifecycleWeek,bankruptCompany,validateDistress,__distressInstalled:true});
})();
