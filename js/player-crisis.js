// Phase 6A-1: deterministic player-company liquidity crisis and recovery lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-crisis.js.');
if(!modules.engine.__saveV9Installed)throw new Error('save-v9.js must be loaded before player-crisis.js.');
if(modules.playerCrisis)throw new Error('player crisis module is already registered.');

const engine=modules.engine;
const EngineClass=engine.TycoonEngine;
const STATUSES=Object.freeze(['stable','watch','distressed','turnaround','recovered','insolvent']);
const ACTIVE_CRISIS=new Set(['distressed','turnaround']);
const HISTORY_LIMIT=52;
const LEGACY_GAME_OVER_REASON='会社現金が2週連続でマイナスになりました。';
const INSOLVENCY_REASON='再建猶予期間内に資金不足を解消できませんでした。';
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const text=value=>String(value??'');
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function graceForDifficulty(difficulty){return difficulty==='easy'?4:difficulty==='hard'?2:3;}
function reserveThreshold(state){
 const report=plain(state?.lastReport)?state.lastReport:{};
 return Math.max(3_000_000,Math.max(0,finite(report.expenses))*2);
}
function normalizeHistory(value){
 const rows=Array.isArray(value)?value:[];
 const seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const week=integer(row.week),from=STATUSES.includes(row.from)?row.from:'stable',to=STATUSES.includes(row.to)?row.to:'stable';
  const operationID=text(row.operationID||`player-crisis-${week}-${from}-${to}`);
  if(seen.has(operationID))continue;
  seen.add(operationID);out.push({week,from,to,reason:text(row.reason),operationID});
 }
 return out.slice(-HISTORY_LIMIT);
}
function ensure(state){
 if(!plain(state))throw new Error('player crisis state root must be an object.');
 const current=plain(state.playerCrisis)?state.playerCrisis:{};
 current.status=STATUSES.includes(current.status)?current.status:'stable';
 current.startedWeek=current.startedWeek==null?null:integer(current.startedWeek);
 current.lastEvaluationWeek=integer(current.lastEvaluationWeek);
 current.lastNegativeCashWeek=current.lastNegativeCashWeek==null?null:integer(current.lastNegativeCashWeek);
 current.negativeCashWeeks=integer(current.negativeCashWeeks,state.consecutiveNegativeCashWeeks);
 current.graceWeeksRemaining=integer(current.graceWeeksRemaining);
 current.recoveryWeeks=integer(current.recoveryWeeks);
 current.reserveThreshold=Math.max(0,finite(current.reserveThreshold,reserveThreshold(state)));
 current.lastCash=finite(current.lastCash,state.companyCash);
 current.lastCompanyValue=Math.max(0,finite(current.lastCompanyValue));
 current.reason=text(current.reason);
 current.history=normalizeHistory(current.history);
 if(ACTIVE_CRISIS.has(current.status)&&current.graceWeeksRemaining===0)current.graceWeeksRemaining=graceForDifficulty(state.difficulty);
 if(current.status==='insolvent')current.graceWeeksRemaining=0;
 state.playerCrisis=current;
 state.consecutiveNegativeCashWeeks=integer(state.consecutiveNegativeCashWeeks,current.negativeCashWeeks);
 return current;
}
function recordTransition(state,crisis,from,to,reason){
 if(from===to)return;
 const week=integer(state.week),operationID=`player-crisis-${week}-${from}-${to}`;
 if(!crisis.history.some(row=>row.operationID===operationID))crisis.history.push({week,from,to,reason:text(reason),operationID});
 crisis.history=crisis.history.slice(-HISTORY_LIMIT);
 if(Array.isArray(state.news)){
  const labels={stable:'安定',watch:'要注意',distressed:'資金危機',turnaround:'再建中',recovered:'回復確認',insolvent:'支払不能'};
  state.news.unshift(`第${week}週：会社状態が「${labels[to]}」になりました。${reason}`);
  state.news=state.news.slice(0,300);
 }
}
function setStatus(state,crisis,status,reason){
 const from=crisis.status;
 crisis.status=status;
 crisis.reason=text(reason);
 recordTransition(state,crisis,from,status,reason);
}
function snapshot(state){
 const crisis=ensure(state);
 return Object.freeze({
  status:crisis.status,
  startedWeek:crisis.startedWeek,
  negativeCashWeeks:crisis.negativeCashWeeks,
  graceWeeksRemaining:crisis.graceWeeksRemaining,
  recoveryWeeks:crisis.recoveryWeeks,
  reserveThreshold:crisis.reserveThreshold,
  lastCash:crisis.lastCash,
  reason:crisis.reason
 });
}
function validate(state){
 const crisis=state?.playerCrisis,errors=[];
 if(!plain(crisis))errors.push('playerCrisisがオブジェクトではありません。');
 else{
  if(!STATUSES.includes(crisis.status))errors.push('playerCrisis.statusが不正です。');
  for(const key of ['lastEvaluationWeek','negativeCashWeeks','graceWeeksRemaining','recoveryWeeks','reserveThreshold','lastCash','lastCompanyValue'])if(!Number.isFinite(Number(crisis[key])))errors.push(`playerCrisis.${key}が有限数ではありません。`);
  if(!Array.isArray(crisis.history))errors.push('playerCrisis.historyが配列ではありません。');
  else{
   if(crisis.history.length>HISTORY_LIMIT)errors.push('playerCrisis.historyが上限を超えています。');
   const ids=new Set();
   for(const row of crisis.history){if(!plain(row)||!row.operationID)errors.push('playerCrisis.history要素が不正です。');else if(ids.has(row.operationID))errors.push('playerCrisis.history operationIDが重複しています。');else ids.add(row.operationID);}
  }
  if(crisis.status==='insolvent'&&(!state.gameOver||state.gameOverReason!==INSOLVENCY_REASON))errors.push('支払不能状態とgameOverが不整合です。');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}
function evaluate(state){
 const crisis=ensure(state),week=integer(state.week);
 if(crisis.lastEvaluationWeek===week)return snapshot(state);
 crisis.lastEvaluationWeek=week;
 crisis.reserveThreshold=reserveThreshold(state);
 crisis.lastCash=finite(state.companyCash);
 crisis.lastCompanyValue=Math.max(0,finite(modules.engine?.finite?state.companyCash:0));
 const cash=crisis.lastCash;
 if(cash<0){
  crisis.negativeCashWeeks+=1;
  state.consecutiveNegativeCashWeeks=crisis.negativeCashWeeks;
  crisis.recoveryWeeks=0;
  if(!ACTIVE_CRISIS.has(crisis.status)){
   crisis.startedWeek=week;
   crisis.graceWeeksRemaining=graceForDifficulty(state.difficulty);
   setStatus(state,crisis,'distressed',`会社現金が${Math.round(cash).toLocaleString('ja-JP')}円です。再建猶予は${crisis.graceWeeksRemaining}週です。`);
  }else{
   crisis.graceWeeksRemaining=Math.max(0,crisis.graceWeeksRemaining-1);
   if(crisis.status==='turnaround')setStatus(state,crisis,'distressed','資金残高が再びマイナスになり、再建が後退しました。');
   else crisis.reason=`会社現金がマイナスです。再建猶予は残り${crisis.graceWeeksRemaining}週です。`;
  }
  crisis.lastNegativeCashWeek=week;
  if(crisis.graceWeeksRemaining===0){
   setStatus(state,crisis,'insolvent',INSOLVENCY_REASON);
   state.gameOver=true;
   state.gameOverReason=INSOLVENCY_REASON;
  }
 }else{
  state.consecutiveNegativeCashWeeks=0;
  crisis.negativeCashWeeks=0;
  if(ACTIVE_CRISIS.has(crisis.status)){
   crisis.recoveryWeeks+=1;
   if(crisis.status==='distressed')setStatus(state,crisis,'turnaround','会社現金が非マイナスへ戻りました。回復を2週確認します。');
   if(crisis.recoveryWeeks>=2){
    crisis.graceWeeksRemaining=0;
    setStatus(state,crisis,'recovered','2週連続で会社現金が非マイナスとなりました。');
   }
  }else if(crisis.status==='recovered'){
   crisis.recoveryWeeks=0;
   setStatus(state,crisis,cash>=crisis.reserveThreshold?'stable':'watch',cash>=crisis.reserveThreshold?'必要運転資金を確保しました。':'現金は回復しましたが、必要運転資金を下回っています。');
  }else{
   crisis.recoveryWeeks=0;
   crisis.graceWeeksRemaining=0;
   setStatus(state,crisis,cash<crisis.reserveThreshold?'watch':'stable',cash<crisis.reserveThreshold?'会社現金が必要運転資金を下回っています。':'資金繰りは安定しています。');
  }
 }
 validate(state);
 return snapshot(state);
}

const baseNormalize=EngineClass.prototype.normalize;
EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;
EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
EngineClass.prototype.advanceWeek=function(showSummary=true){
 if(this.g.gameOver||this.g.isCompanySold)return baseAdvanceWeek.call(this,showSummary);
 const originalEmit=this.emit;
 let capturedWeekDetail=null;
 this.emit=function(type,detail={}){if(type==='week'){capturedWeekDetail=detail;return;}return originalEmit.call(this,type,detail);};
 let result;
 try{result=baseAdvanceWeek.call(this,showSummary);}finally{this.emit=originalEmit;}
 if(result===false)return result;
 const legacyTriggered=this.g.gameOver&&this.g.gameOverReason===LEGACY_GAME_OVER_REASON;
 const crisis=evaluate(this.g);
 if(legacyTriggered&&crisis.status!=='insolvent'){this.g.gameOver=false;this.g.gameOverReason='';}
 if(this.g.lastWeeklySummary)this.g.lastWeeklySummary.crisis=crisis;
 this.save();
 originalEmit.call(this,'week',{...(capturedWeekDetail||{}),summary:showSummary?this.g.lastWeeklySummary:null});
 return result;
};
EngineClass.prototype.__playerCrisisInstalled=true;

modules.playerCrisis=Object.freeze({STATUSES,HISTORY_LIMIT,LEGACY_GAME_OVER_REASON,INSOLVENCY_REASON,graceForDifficulty,reserveThreshold,ensure,evaluate,snapshot,validate,__installed:true});
})();
