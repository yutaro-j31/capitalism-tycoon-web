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
const MAX_LIFECYCLE_HISTORY=104;
const MAX_LIFECYCLE_EVENTS=160;
const LIFECYCLE_STATUSES=Object.freeze(['active','growing','defending','distressed','turnaround','recovered','withdrawing','inactive','bankrupt']);
const TERMINAL_STATUSES=new Set(['inactive','bankrupt']);
const GROWTH_ACTIONS=new Set(['brandInvestment','qualityInvestment','capacityExpansion','marketEntry']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const weekOf=state=>Math.max(0,Math.floor(finite(state.week)));
const activePresences=company=>(company.marketPresence||[]).filter(presence=>presence.active);
const pendingPresences=company=>(company.marketPresence||[]).filter(presence=>presence.entryStatus==='planned'||presence.entryStatus==='opening');
const operatingCost=company=>Math.max(1,finite(company.weeklyFixedCost)+finite(company.weeklyMarketingCost)+finite(company.weeklyRDCost)+finite(company.weeklyInterestCost)+finite(company.weeklyCapacityCost));
const strategy=company=>competitor.STRATEGIES[company.strategyID]||competitor.STRATEGIES.balanced;

function normalizeHistory(rows){
 const byWeek=new Map();
 for(const raw of Array.isArray(rows)?rows:[]){
  if(!raw||!Number.isFinite(Number(raw.week)))continue;
  const row={week:weekOf(raw),status:LIFECYCLE_STATUSES.includes(raw.status)?raw.status:'active',distressScore:Math.max(0,finite(raw.distressScore)),cashRunwayWeeks:Math.max(0,finite(raw.cashRunwayWeeks)),leverage:Math.max(0,finite(raw.leverage)),weeklyProfit:finite(raw.weeklyProfit),cash:Math.max(0,finite(raw.cash)),debt:Math.max(0,finite(raw.debt)),lossWeeks:Math.max(0,Math.floor(finite(raw.lossWeeks))),insolvencyWeeks:Math.max(0,Math.floor(finite(raw.insolvencyWeeks))),recoveryStreak:Math.max(0,Math.floor(finite(raw.recoveryStreak))),activePresenceCount:Math.max(0,Math.floor(finite(raw.activePresenceCount)))};
  byWeek.set(row.week,row);
 }
 return [...byWeek.values()].sort((a,b)=>a.week-b.week).slice(-MAX_LIFECYCLE_HISTORY);
}
function ensurePlan(plan){
 if(!plan||typeof plan!=='object')return null;
 plan.planID=String(plan.planID||'');
 plan.status=['active','completed','failed','cancelled'].includes(plan.status)?plan.status:'active';
 plan.startWeek=weekOf({week:plan.startWeek});
 plan.targetEndWeek=Math.max(plan.startWeek,weekOf({week:plan.targetEndWeek}));
 plan.completedWeek=plan.completedWeek==null?null:Math.max(plan.startWeek,weekOf({week:plan.completedWeek}));
 plan.initialCash=Math.max(0,finite(plan.initialCash));
 plan.initialDebt=Math.max(0,finite(plan.initialDebt));
 plan.initialLossWeeks=Math.max(0,Math.floor(finite(plan.initialLossWeeks)));
 plan.recoveryStreak=Math.max(0,Math.floor(finite(plan.recoveryStreak)));
 plan.emergencyExitScheduled=Boolean(plan.emergencyExitScheduled);
 plan.failureReason=String(plan.failureReason||'');
 return plan;
}
function ensureLifecycleState(state){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 state.competitorEvents=state.competitorEvents.filter(event=>event&&typeof event==='object').slice(-MAX_LIFECYCLE_EVENTS);
 for(const company of state.competitorStates||[]){
  const initial=LIFECYCLE_STATUSES.includes(company.lifecycleStatus)?company.lifecycleStatus:(LIFECYCLE_STATUSES.includes(company.status)?company.status:'active');
  company.lifecycleStatus=initial;
  company.distressEnteredWeek=company.distressEnteredWeek==null?null:weekOf({week:company.distressEnteredWeek});
  company.recoveredWeek=company.recoveredWeek==null?null:weekOf({week:company.recoveredWeek});
  company.bankruptcyWeek=company.bankruptcyWeek==null?null:weekOf({week:company.bankruptcyWeek});
  company.lastLifecycleEvaluationWeek=Math.max(0,Math.floor(finite(company.lastLifecycleEvaluationWeek)));
  company.insolvencyWeeks=Math.max(0,Math.floor(finite(company.insolvencyWeeks)));
  company.recoveryStreak=Math.max(0,Math.floor(finite(company.recoveryStreak)));
  company.stabilizationWeeks=Math.max(0,Math.floor(finite(company.stabilizationWeeks)));
  company.recoveredWeeks=Math.max(0,Math.floor(finite(company.recoveredWeeks)));
  company.turnaroundAttempts=Math.max(0,Math.floor(finite(company.turnaroundAttempts)));
  company.distressEpisodes=Math.max(0,Math.floor(finite(company.distressEpisodes)));
  company.lastDistressScore=Math.max(0,finite(company.lastDistressScore));
  company.lastLifecycleReason=String(company.lastLifecycleReason||'');
  company.turnaroundPlan=ensurePlan(company.turnaroundPlan);
  company.lifecycleHistory=normalizeHistory(company.lifecycleHistory);
  if(company.lifecycleStatus==='bankrupt'){
   company.active=false;company.status='bankrupt';
   for(const presence of company.marketPresence||[]){presence.active=false;presence.totalCapacity=0;presence.storeCount=Math.max(0,Math.floor(finite(presence.storeCount)));}
  }
 }
 return state;
}
function pushEvent(state,company,type,text,operationID){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 if(state.competitorEvents.some(event=>event.operationID===operationID))return;
 state.competitorEvents.push({week:weekOf(state),competitorID:company.competitorID,type,text,operationID});
 state.competitorEvents=state.competitorEvents.slice(-MAX_LIFECYCLE_EVENTS);
}
function metrics(company){
 const cost=operatingCost(company),runway=Math.max(0,Number.isFinite(Number(company.cashRunwayWeeks))?finite(company.cashRunwayWeeks):finite(company.cash)/cost),limit=Math.max(1,finite(company.creditLimit)),leverage=Math.max(0,finite(company.debt)/limit),overLimit=Math.max(0,finite(company.overCreditLimit,Math.max(0,finite(company.debt)-limit)));
 return {cost,runway,leverage,overLimit,profit:finite(company.weeklyProfit),lossWeeks:Math.max(0,Math.floor(finite(company.lossWeeks))),missed:Math.max(0,Math.floor(finite(company.missedDebtPayments)))};
}
function distressScore(company){
 const m=metrics(company);let score=0;
 score+=m.lossWeeks>=10?4:m.lossWeeks>=6?3:m.lossWeeks>=3?1:0;
 score+=m.runway<.5?4:m.runway<1?3:m.runway<2?2:m.runway<4?1:0;
 score+=m.leverage>1.2?4:m.leverage>1?3:m.leverage>.8?1:0;
 score+=m.overLimit>0?2:0;
 score+=m.missed>=4?4:m.missed>=2?2:m.missed>=1?1:0;
 if(company.status==='distressed')score+=1;
 return Math.max(0,score);
}
function recordLifecycle(state,company,score){
 const m=metrics(company),week=weekOf(state),row={week,status:company.lifecycleStatus,distressScore:score,cashRunwayWeeks:m.runway,leverage:m.leverage,weeklyProfit:m.profit,cash:finite(company.cash),debt:finite(company.debt),lossWeeks:m.lossWeeks,insolvencyWeeks:company.insolvencyWeeks,recoveryStreak:company.recoveryStreak,activePresenceCount:activePresences(company).length};
 company.lifecycleHistory=normalizeHistory((company.lifecycleHistory||[]).filter(item=>finite(item.week,-1)!==week).concat([row]));
}
function failPendingAction(state,company,action,reason){
 if(!action||action.applied)return;
 action.status='skipped';action.applied=true;action.appliedWeek=weekOf(state);action.lifecycleFailureReason=reason;
 const presence=(company.marketPresence||[]).find(row=>row.presenceID===action.presenceID);
 if(action.actionType==='marketEntry'&&presence&&!presence.active){presence.entryStatus='failed';presence.entryFailureReason=reason;presence.totalCapacity=0;presence.storeCount=0;}
}
function cancelGrowthActions(state,company,reason){
 for(const action of state.competitorActions||[])if(action.competitorID===company.competitorID&&!action.applied&&GROWTH_ACTIONS.has(action.actionType))failPendingAction(state,company,action,reason);
}
function weakestPresence(company){
 return activePresences(company).slice().sort((a,b)=>finite(a.profit)-finite(b.profit)||finite(a.currentWeekShare)-finite(b.currentWeekShare)||String(a.presenceID).localeCompare(String(b.presenceID)))[0]||null;
}
function scheduleEmergencyExit(state,company,reason){
 const presences=activePresences(company);if(presences.length<=1)return null;
 const target=weakestPresence(company);if(!target)return null;
 const existing=(state.competitorActions||[]).find(action=>action.competitorID===company.competitorID&&action.actionType==='marketExit'&&action.presenceID===target.presenceID&&!action.applied);if(existing)return existing;
 const week=weekOf(state),action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:company.competitorID,presenceID:target.presenceID,decisionWeek:week,effectiveWeek:week+2,actionType:'marketExit',targetBusinessID:target.businessID||'ramen',targetPrefID:target.prefID,previousValue:target.totalCapacity,newValue:0,cost:0,reasonCodes:['distress','portfolio'],reasonText:reason,status:'pending',applied:false,appliedWeek:null,operationID:`op-${week}-${company.competitorID}-distress-exit-${target.presenceID}`};
 state.competitorActions.push(action);company.actionHistory=(company.actionHistory||[]).concat([JSON.parse(JSON.stringify(action))]).slice(-20);company.decisionCooldownWeeks=Math.max(2,finite(company.decisionCooldownWeeks));
 pushEvent(state,company,'emergencyExitScheduled',`${company.name}が不採算市場${target.prefID}からの撤退を決定`,`distress-exit-${company.competitorID}-${target.presenceID}-${week}`);return action;
}
function enterDistress(state,company,reason){
 const week=weekOf(state),wasDistressed=['distressed','turnaround'].includes(company.lifecycleStatus);
 company.lifecycleStatus='distressed';company.status='distressed';company.distressEnteredWeek=wasDistressed&&company.distressEnteredWeek!=null?company.distressEnteredWeek:week;company.distressEpisodes+=wasDistressed?0:1;company.recoveryStreak=0;company.stabilizationWeeks=0;company.lastLifecycleReason=reason;
 cancelGrowthActions(state,company,'財務危機により成長投資を中止');
 pushEvent(state,company,'distressEntered',`${company.name}が経営危機に移行：${reason}`,`distress-enter-${company.competitorID}-${company.distressEpisodes}`);
}
function startTurnaroundPlan(state,company,reason='財務危機の長期化'){
 const week=weekOf(state);if(company.turnaroundPlan?.status==='active')return company.turnaroundPlan;
 company.turnaroundAttempts+=1;company.turnaroundPlan={planID:`turnaround-${company.competitorID}-${company.turnaroundAttempts}`,status:'active',startWeek:week,targetEndWeek:week+12,completedWeek:null,initialCash:finite(company.cash),initialDebt:finite(company.debt),initialLossWeeks:finite(company.lossWeeks),recoveryStreak:0,emergencyExitScheduled:false,failureReason:''};
 company.lifecycleStatus='turnaround';company.status='turnaround';company.turnaroundWeeks=12;company.recoveryStreak=0;company.marketingBudget=Math.max(0,finite(company.marketingBudget)*.7);company.rdBudget=Math.max(0,finite(company.rdBudget)*.65);company.decisionCooldownWeeks=Math.max(4,finite(company.decisionCooldownWeeks));company.lastLifecycleReason=reason;
 cancelGrowthActions(state,company,'再建計画開始により成長投資を中止');
 pushEvent(state,company,'turnaroundStarted',`${company.name}が12週間の再建計画を開始`,`turnaround-start-${company.competitorID}-${company.turnaroundAttempts}`);return company.turnaroundPlan;
}
function markRecovered(state,company,reason){
 const week=weekOf(state);company.lifecycleStatus='recovered';company.status='recovered';company.recoveredWeek=week;company.recoveredWeeks=0;company.recoveryStreak=0;company.stabilizationWeeks=0;company.lastLifecycleReason=reason;
 if(company.turnaroundPlan?.status==='active'){company.turnaroundPlan.status='completed';company.turnaroundPlan.completedWeek=week;company.turnaroundPlan.recoveryStreak=4;}
 pushEvent(state,company,'recovered',`${company.name}が経営危機から回復`,`distress-recovered-${company.competitorID}-${week}`);
}
function declareBankruptcy(state,company,reason){
 const week=weekOf(state);if(company.lifecycleStatus==='bankrupt')return;
 company.lifecycleStatus='bankrupt';company.status='bankrupt';company.active=false;company.bankruptcyWeek=week;company.lastLifecycleReason=reason;company.cash=Math.max(0,finite(company.cash));
 for(const presence of company.marketPresence||[]){presence.active=false;presence.totalCapacity=0;presence.capacityPerStore=0;presence.storeCount=0;presence.exitWeek=presence.exitWeek??week;if(presence.entryStatus==='planned'||presence.entryStatus==='opening')presence.entryStatus='failed';else presence.entryStatus='inactive';presence.entryFailureReason=reason;}
 for(const action of state.competitorActions||[])if(action.competitorID===company.competitorID&&!action.applied)failPendingAction(state,company,action,reason);
 for(const project of state.competitorProjects||[])if(project.competitorID===company.competitorID&&!['completed','cancelled','failed'].includes(project.status)){project.status='failed';project.completedWeek=week;project.spentCost=0;project.failureReason='bankruptcy';}
 if(company.turnaroundPlan?.status==='active'){company.turnaroundPlan.status='failed';company.turnaroundPlan.completedWeek=week;company.turnaroundPlan.failureReason=reason;}
 pushEvent(state,company,'bankruptcy',`${company.name}が倒産：${reason}`,`bankruptcy-${company.competitorID}`);
}
function evaluateCompany(state,company){
 const week=weekOf(state);if(company.lastLifecycleEvaluationWeek===week)return;
 company.lastLifecycleEvaluationWeek=week;
 if(company.lifecycleStatus==='bankrupt'){recordLifecycle(state,company,company.lastDistressScore);return;}
 const available=activePresences(company).length+pendingPresences(company).length;if(available===0){company.lifecycleStatus='inactive';company.status='inactive';company.active=false;company.lastLifecycleReason='稼働市場なし';recordLifecycle(state,company,0);return;}
 const score=distressScore(company),m=metrics(company);company.lastDistressScore=score;
 const insolvent=(finite(company.cash)<=0&&m.profit<0&&(finite(company.debt)>0||m.lossWeeks>=6))||(m.runway<.25&&m.profit<0&&m.leverage>1);
 company.insolvencyWeeks=insolvent?company.insolvencyWeeks+1:Math.max(0,company.insolvencyWeeks-1);
 if(company.insolvencyWeeks>=4||(m.missed>=4&&m.leverage>1&&m.runway<1)){declareBankruptcy(state,company,'資金枯渇と債務返済不能');recordLifecycle(state,company,score);return;}
 const turnaroundAction=(state.competitorActions||[]).find(action=>action.competitorID===company.competitorID&&action.actionType==='turnaround'&&action.applied&&finite(action.appliedWeek)===week&&action.status!=='skipped');
 if(turnaroundAction&&company.turnaroundPlan?.status!=='active')startTurnaroundPlan(state,company,turnaroundAction.reasonText||'再建施策を実行');
 if(company.lifecycleStatus==='turnaround'||company.turnaroundPlan?.status==='active'){
  const plan=company.turnaroundPlan||startTurnaroundPlan(state,company,'再建状態を復元');company.lifecycleStatus='turnaround';company.status='turnaround';
  const healthy=m.profit>0&&m.runway>=3&&m.leverage<=.95&&m.missed<=1;company.recoveryStreak=healthy?company.recoveryStreak+1:0;plan.recoveryStreak=company.recoveryStreak;
  if(!plan.emergencyExitScheduled&&week-plan.startWeek>=2&&activePresences(company).length>1&&(score>=6||m.profit<0)){plan.emergencyExitScheduled=Boolean(scheduleEmergencyExit(state,company,'再建計画による不採算市場整理'));}
  if(company.recoveryStreak>=4){markRecovered(state,company,'4週間連続で黒字・資金余力・債務条件を達成');recordLifecycle(state,company,score);return;}
  if(week>=plan.targetEndWeek){plan.status='failed';plan.completedWeek=week;plan.failureReason='再建期限までに回復条件未達';if(company.turnaroundAttempts>=2||score>=9||company.insolvencyWeeks>=2){declareBankruptcy(state,company,'再建計画の失敗');recordLifecycle(state,company,score);return;}enterDistress(state,company,'再建計画の回復条件未達');}
  recordLifecycle(state,company,score);return;
 }
 if(company.lifecycleStatus==='distressed'){
  const stable=m.profit>=0&&m.runway>=3&&m.leverage<=1&&m.missed<=1;company.stabilizationWeeks=stable?company.stabilizationWeeks+1:0;
  if(company.stabilizationWeeks>=3){markRecovered(state,company,'3週間連続で財務状態が安定');recordLifecycle(state,company,score);return;}
  const age=company.distressEnteredWeek==null?0:week-company.distressEnteredWeek;if(age>=4&&(score>=5||m.missed>=2))startTurnaroundPlan(state,company,'危機状態が4週間以上継続');
  else{company.status='distressed';cancelGrowthActions(state,company,'経営危機中のため成長投資を中止');}
  recordLifecycle(state,company,score);return;
 }
 if(company.lifecycleStatus==='recovered'){
  if(score>=4){enterDistress(state,company,'回復後に財務状態が再悪化');recordLifecycle(state,company,score);return;}
  company.recoveredWeeks+=1;company.status='recovered';if(company.recoveredWeeks>=4){company.lifecycleStatus=m.profit>=0?'growing':'active';company.status=company.lifecycleStatus;company.lastLifecycleReason='回復監視期間を完了';}
  recordLifecycle(state,company,score);return;
 }
 if(company.status==='withdrawing'){company.lifecycleStatus='withdrawing';company.lastLifecycleReason='市場撤退を実行中';recordLifecycle(state,company,score);return;}
 if(score>=4||company.status==='distressed'){enterDistress(state,company,`危機スコア ${score.toFixed(1)}`);recordLifecycle(state,company,score);return;}
 company.lifecycleStatus=company.status==='growing'?'growing':company.status==='defending'?'defending':'active';company.status=company.lifecycleStatus;company.lastLifecycleReason='通常運営';recordLifecycle(state,company,score);
}
function processDistressWeek(state){ensureLifecycleState(state);for(const company of state.competitorStates||[])evaluateCompany(state,company);return state;}
function validateLifecycle(state){
 const errors=[];
 for(const company of state.competitorStates||[]){
  if(!LIFECYCLE_STATUSES.includes(company.lifecycleStatus))errors.push('lifecycleStatus不正');
  for(const key of ['lastLifecycleEvaluationWeek','insolvencyWeeks','recoveryStreak','stabilizationWeeks','recoveredWeeks','turnaroundAttempts','distressEpisodes','lastDistressScore'])if(!Number.isFinite(Number(company[key])))errors.push(`lifecycle.${key}非有限`);
  const history=company.lifecycleHistory;if(!Array.isArray(history))errors.push('lifecycleHistory配列不正');else{if(history.length>MAX_LIFECYCLE_HISTORY)errors.push('lifecycleHistory上限超過');const weeks=new Set();for(const row of history){if(weeks.has(row.week))errors.push('lifecycleHistory週重複');weeks.add(row.week);for(const [key,value] of Object.entries(row))if(typeof value==='number'&&!Number.isFinite(value))errors.push(`lifecycleHistory.${key}非有限`);}}
  if(company.turnaroundPlan){const plan=company.turnaroundPlan;if(!plan.planID||!['active','completed','failed','cancelled'].includes(plan.status))errors.push('turnaroundPlan不正');for(const key of ['startWeek','targetEndWeek','initialCash','initialDebt','initialLossWeeks','recoveryStreak'])if(!Number.isFinite(Number(plan[key])))errors.push(`turnaroundPlan.${key}非有限`);if(plan.targetEndWeek<plan.startWeek)errors.push('turnaroundPlan期間不正');}
  if(company.lifecycleStatus==='bankrupt'){if(company.active)errors.push('bankrupt競合がactive');if((company.marketPresence||[]).some(presence=>presence.active||finite(presence.totalCapacity)>0))errors.push('bankrupt市場が稼働');if((state.competitorActions||[]).some(action=>action.competitorID===company.competitorID&&!action.applied))errors.push('bankrupt未処理action');}
 }
 if(errors.length)throw new Error(errors.join(' / '));return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureLifecycleState(state);return state;};
competitor.processWeek=function(state){ensureLifecycleState(state);const result=baseProcessWeek(state);processDistressWeek(state);baseEnsure(state);return result;};
competitor.validate=function(state){baseValidate(state);validateLifecycle(state);return true;};
Object.assign(competitor,{MAX_LIFECYCLE_HISTORY,LIFECYCLE_STATUSES,ensureLifecycleState,distressScore,enterDistress,startTurnaroundPlan,markRecovered,declareBankruptcy,scheduleEmergencyExit,processDistressWeek,validateLifecycle,__distressInstalled:true});
})();
