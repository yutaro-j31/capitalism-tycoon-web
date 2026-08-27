// Phase 6B-3: difficulty opening-balance reconciliation and scenario lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before difficulty-scenario-balance.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before difficulty-scenario-balance.js.');
if(!modules.finance?.ensureFinance)throw new Error('finance.js must be loaded before difficulty-scenario-balance.js.');
if(!modules.playerEngineBridge?.__installed)throw new Error('player-engine-bridge.js must be loaded before difficulty-scenario-balance.js.');
if(!modules.engine.TycoonEngine.prototype.__completionInstalled||!modules.engine.TycoonEngine.prototype.__parityInstalled)throw new Error('app.js must install completion and parity before difficulty-scenario-balance.js.');
if(modules.difficultyScenarioBalance)throw new Error('difficulty scenario balance module is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const VERSION=1,STANDARD_TARGET_WEEK=208,HISTORY_LIMIT=24,LEGACY_BASE_CASH=8000000;
const EASY_DEMAND_VERSION=1,EASY_DEMAND_MULTIPLIER=1.1,WEEKLY_CASH_ROUNDING_LIMIT=.05,ROUNDING_HISTORY_LIMIT=52,ROUNDING_ADJUSTMENT_PER_52_WEEKS=1,HARD_IPO_ANNUAL_PROFIT=25000000;
const WARNING_WEEKS=Object.freeze([52,104,156,196,208]);
const DIFFICULTY_PROFILES=Object.freeze({easy:Object.freeze({id:'easy',label:'やさしい',startingCash:12000000,startingCredit:70,crisisGraceWeeks:4}),normal:Object.freeze({id:'normal',label:'標準',startingCash:8000000,startingCredit:60,crisisGraceWeeks:3}),hard:Object.freeze({id:'hard',label:'ハード',startingCash:6000000,startingCredit:50,crisisGraceWeeks:2})});
const SCENARIO_PROFILES=Object.freeze({free:Object.freeze({id:'free',label:'自由プレイ',targetIPOWeek:null}),standard:Object.freeze({id:'standard',label:'標準シナリオ',targetIPOWeek:STANDARD_TARGET_WEEK})});
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const text=v=>String(v??'');
const round2=v=>Math.round(finite(v)*100)/100;
function difficultyProfile(v){return DIFFICULTY_PROFILES[v]||DIFFICULTY_PROFILES.normal;}
function scenarioProfile(v){return SCENARIO_PROFILES[v]||SCENARIO_PROFILES.free;}
function gradeForWeek(week){week=integer(week);return week<=78?'S':week<=104?'A':week<=130?'B':week<=156?'C':week<=STANDARD_TARGET_WEEK?'D':'E';}
function scoreForWeek(week){week=integer(week);return Math.max(0,Math.min(100,Math.round(100-Math.max(0,week-52)*100/(STANDARD_TARGET_WEEK-52))));}
function applyEasyDemand(state){
 if(!plain(state)||difficultyProfile(state.difficulty).id!=='easy'||integer(state.easyDifficultyDemandVersion)>=EASY_DEMAND_VERSION)return false;
 for(const business of Array.isArray(state.businesses)?state.businesses:[])business.demand=Math.max(.1,finite(business.demand)*EASY_DEMAND_MULTIPLIER);
 state.easyDifficultyDemandVersion=EASY_DEMAND_VERSION;
 return true;
}
function normalizeHistory(value){const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];for(const row of rows){if(!plain(row))continue;const operationID=text(row.operationID||`scenario-${integer(row.week)}-${text(row.kind)}`);if(seen.has(operationID))continue;seen.add(operationID);out.push({week:integer(row.week),kind:text(row.kind),status:text(row.status),message:text(row.message),operationID});}return out.slice(-HISTORY_LIMIT);}
function ensure(state){
 if(!plain(state))throw new Error('difficulty scenario state root must be an object.');
 state.difficulty=difficultyProfile(state.difficulty).id;state.scenario=scenarioProfile(state.scenario).id;
 const profile=scenarioProfile(state.scenario),current=plain(state.scenarioProgress)?state.scenarioProgress:{};
 current.scenario=profile.id;current.targetIPOWeek=profile.targetIPOWeek;current.status=profile.id==='free'?'free':state.publicCompany?'completed':integer(state.week)>STANDARD_TARGET_WEEK?'overdue':'active';
 current.startedWeek=Math.max(1,integer(current.startedWeek,1));current.completedWeek=current.completedWeek==null?null:integer(current.completedWeek);current.score=current.score==null?null:integer(current.score);current.grade=current.grade==null?null:text(current.grade);current.lastEvaluationWeek=integer(current.lastEvaluationWeek);
 current.notifiedWeeks=[...new Set((Array.isArray(current.notifiedWeeks)?current.notifiedWeeks:[]).map(value=>integer(value)).filter(v=>WARNING_WEEKS.includes(v)))];current.history=normalizeHistory(current.history);
 if(profile.id==='free'){current.completedWeek=null;current.score=null;current.grade=null;current.notifiedWeeks=[];}
 if(state.publicCompany&&profile.id==='standard'&&current.completedWeek==null){current.completedWeek=integer(state.week);current.score=scoreForWeek(current.completedWeek);current.grade=gradeForWeek(current.completedWeek);}
 state.scenarioProgress=current;return current;
}
function markFinanceDirty(state,f){f.dirtyWeeks=[...new Set([...(Array.isArray(f.dirtyWeeks)?f.dirtyWeeks:[]),...(Array.isArray(f.weeklySnapshots)?f.weeklySnapshots.map(row=>integer(row.week)):[])])].filter(Boolean).sort((a,b)=>a-b);f.lastStatements=null;if(f.dirtyWeeks.length)finance.rebuildDirtySnapshots(state);}
function reconcileOpeningFinance(state){
 if(!plain(state))return false;
 const profile=difficultyProfile(state.difficulty),f=finance.ensureFinance(state);
 if(integer(state.difficultyScenarioBalanceVersion)>=VERSION)return false;
 const currentOpening=finite(f.openingCash,profile.startingCash);
 const legacySignature=Math.abs(currentOpening-LEGACY_BASE_CASH)<=.01;
 const alreadyAligned=Math.abs(currentOpening-profile.startingCash)<=.01;
 const delta=legacySignature?round2(profile.startingCash-LEGACY_BASE_CASH):0;
 if(Math.abs(delta)>.001){
  f.openingCash=round2(currentOpening+delta);f.openingAssets=round2(finite(f.openingAssets)+delta);f.openingEquity=round2(finite(f.openingEquity)+delta);f.openingRetainedEarnings=round2(finite(f.openingRetainedEarnings)+delta);
  for(const s of Array.isArray(f.weeklySnapshots)?f.weeklySnapshots:[]){s.openingCash=round2(finite(s.openingCash)+delta);s.endingCash=round2(finite(s.endingCash)+delta);s.cashDifference=round2(finite(s.actualCompanyCash)-finite(s.endingCash));}
  markFinanceDirty(state,f);
 }
 state.difficultyOpeningBalanceApplied=Boolean(state.difficultyOpeningBalanceApplied)||legacySignature||alreadyAligned;
 state.difficultyScenarioBalanceVersion=VERSION;
 return Math.abs(delta)>.001;
}
function ensureRoundingAudit(state){
 const f=finance.ensureFinance(state);
 f.roundingAdjustmentTotal=round2(finite(f.roundingAdjustmentTotal));
 f.roundingAdjustmentAbsoluteTotal=round2(Math.max(0,finite(f.roundingAdjustmentAbsoluteTotal)));
 f.roundingAdjustmentCount=integer(f.roundingAdjustmentCount);
 f.roundingAdjustmentHistory=(Array.isArray(f.roundingAdjustmentHistory)?f.roundingAdjustmentHistory:[]).filter(plain).map(row=>({week:integer(row.week),adjustment:round2(row.adjustment),differenceBefore:round2(row.differenceBefore)})).slice(-ROUNDING_HISTORY_LIMIT);
 return f;
}
function roundingAdjustmentLimit(state){
 const f=finance.ensureFinance(state),openingWeek=Math.max(1,integer(f.openingWeek,1)),elapsedWeeks=Math.max(1,integer(state?.week,1)-openingWeek+1);
 return Math.max(ROUNDING_ADJUSTMENT_PER_52_WEEKS,Math.ceil(elapsedWeeks/52)*ROUNDING_ADJUSTMENT_PER_52_WEEKS);
}
function reconcileWeeklyCashRounding(state){
 if(!plain(state))return false;
 const f=ensureRoundingAudit(state),week=integer(state.week),snap=(Array.isArray(f.weeklySnapshots)?f.weeklySnapshots:[]).find(row=>integer(row.week)===week);
 if(!snap)return false;
 const actual=finite(snap.actualCompanyCash,state.companyCash),ending=finite(snap.endingCash),difference=round2(actual-ending);
 if(Math.abs(difference)<.001||Math.abs(difference)>WEEKLY_CASH_ROUNDING_LIMIT)return false;
 const adjustment=round2(ending-actual);
 state.companyCash=round2(ending);snap.actualCompanyCash=state.companyCash;snap.cashDifference=0;f.lastStatements=null;
 f.roundingAdjustmentTotal=round2(f.roundingAdjustmentTotal+adjustment);
 f.roundingAdjustmentAbsoluteTotal=round2(f.roundingAdjustmentAbsoluteTotal+Math.abs(adjustment));
 f.roundingAdjustmentCount+=1;
 f.roundingAdjustmentHistory.push({week,adjustment,differenceBefore:difference});f.roundingAdjustmentHistory=f.roundingAdjustmentHistory.slice(-ROUNDING_HISTORY_LIMIT);
 if(plain(state.lastWeeklySummary))state.lastWeeklySummary.companyCash=state.companyCash;
 return true;
}
function addHistory(state,p,kind,message){const operationID=`scenario-${integer(state.week)}-${kind}`;if(p.history.some(row=>row.operationID===operationID))return false;p.history.push({week:integer(state.week),kind,status:p.status,message:text(message),operationID});p.history=p.history.slice(-HISTORY_LIMIT);const line=`第${integer(state.week)}週：${text(message)}`;state.news=[line,...(Array.isArray(state.news)?state.news:[]).filter(row=>String(row)!==line)].slice(0,300);return true;}
function snapshot(state){const p=ensure(state),profile=scenarioProfile(p.scenario),week=integer(state.week);return Object.freeze({scenario:profile.id,label:profile.label,status:p.status,targetIPOWeek:p.targetIPOWeek,weeksRemaining:profile.targetIPOWeek==null?null:Math.max(0,profile.targetIPOWeek-week),completedWeek:p.completedWeek,score:p.score,grade:p.grade});}
function evaluate(state){
 const p=ensure(state),week=integer(state.week);
 const completionPending=p.scenario==='standard'&&Boolean(state.publicCompany)&&!p.history.some(row=>row.kind==='completed');
 if(p.lastEvaluationWeek===week&&!completionPending)return snapshot(state);
 p.lastEvaluationWeek=week;
 if(p.scenario==='free')return snapshot(state);
 if(state.publicCompany){if(p.completedWeek==null)p.completedWeek=week;p.status='completed';p.score=scoreForWeek(p.completedWeek);p.grade=gradeForWeek(p.completedWeek);addHistory(state,p,'completed',`標準シナリオのIPO目標を第${p.completedWeek}週に達成しました。評価${p.grade}（${p.score}点）。`);}else{p.status=week>STANDARD_TARGET_WEEK?'overdue':'active';if(WARNING_WEEKS.includes(week)&&!p.notifiedWeeks.includes(week)){p.notifiedWeeks.push(week);const remaining=Math.max(0,STANDARD_TARGET_WEEK-week);addHistory(state,p,'checkpoint',remaining>0?`標準シナリオのIPO目標まで残り${remaining}週です。`:'標準シナリオのIPO目標週に到達しました。次週から期限超過として記録されます。');}if(p.status==='overdue')addHistory(state,p,'overdue',`標準シナリオのIPO目標（第${STANDARD_TARGET_WEEK}週）を超過しました。IPO後に最終評価を確定します。`);}
 return snapshot(state);
}
function validate(state){const errors=[],profile=difficultyProfile(state?.difficulty),p=state?.scenarioProgress,f=state?.finance;if(!plain(p))errors.push('scenarioProgressがオブジェクトではありません。');else{if(p.scenario!==state.scenario)errors.push('scenarioProgress.scenarioがstate.scenarioと不一致です。');if(!['free','active','completed','overdue'].includes(p.status))errors.push('scenarioProgress.statusが不正です。');if(!Array.isArray(p.history)||p.history.length>HISTORY_LIMIT)errors.push('scenarioProgress.historyが不正です。');}if(integer(state?.difficultyScenarioBalanceVersion)<VERSION)errors.push('difficultyScenarioBalanceVersionが未適用です。');if(state?.difficultyOpeningBalanceApplied===true&&plain(f)&&Math.abs(finite(f.openingCash)-profile.startingCash)>.01)errors.push('難易度別の期首現金が不一致です。');if(profile.id==='easy'&&integer(state?.easyDifficultyDemandVersion)<EASY_DEMAND_VERSION)errors.push('Easy需要補正が未適用です。');if(errors.length)throw new Error(errors.join(' / '));return true;}
const baseFinanceValidate=finance.validate;finance.validate=function(state){const result=baseFinanceValidate(state),f=ensureRoundingAudit(state),limit=roundingAdjustmentLimit(state);if(f.roundingAdjustmentAbsoluteTotal<=limit+.001)return result;const message=`週次現金丸め補正の累積が許容値を超過 ${f.roundingAdjustmentAbsoluteTotal}円 / ${limit}円`;return {...result,ok:false,errors:[...(Array.isArray(result?.errors)?result.errors:[]),message]};};
const baseNormalize=EngineClass.prototype.normalize;EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);reconcileOpeningFinance(this.g);applyEasyDemand(this.g);ensure(this.g);ensureRoundingAudit(this.g);return result;};
const baseSave=EngineClass.prototype.save;EngineClass.prototype.save=function(slot=null){reconcileOpeningFinance(this.g);applyEasyDemand(this.g);ensure(this.g);ensureRoundingAudit(this.g);return baseSave.call(this,slot);};
const baseConfigure=EngineClass.prototype.configure;EngineClass.prototype.configure=function(options={}){return this.runTransaction(()=>{const result=baseConfigure.call(this,options);reconcileOpeningFinance(this.g);applyEasyDemand(this.g);ensureRoundingAudit(this.g);const scenario=evaluate(this.g);if(scenario.scenario==='standard')addHistory(this.g,this.g.scenarioProgress,'started',`標準シナリオを開始しました。第${STANDARD_TARGET_WEEK}週までのIPOを目指します。期限超過後も経営は継続できます。`);return result;});};
const baseReset=EngineClass.prototype.reset;EngineClass.prototype.reset=function(){return this.runTransaction(()=>{const result=baseReset.call(this);reconcileOpeningFinance(this.g);applyEasyDemand(this.g);ensure(this.g);ensureRoundingAudit(this.g);return result;});};
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;EngineClass.prototype.advanceWeek=function(showSummary=true){if(this.g.gameOver||this.g.isCompanySold)return baseAdvanceWeek.call(this,showSummary);return this.runTransaction(()=>{const result=baseAdvanceWeek.call(this,false);if(result===false)return result;reconcileWeeklyCashRounding(this.g);const scenario=evaluate(this.g);if(this.g.lastWeeklySummary)this.g.lastWeeklySummary.scenario=scenario;return result;},'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));};
// Hard previously became indistinguishable from Normal once the opening-cash/credit handicap was overcome.
// Slow-opening routes could therefore land in a later favorable macro regime and reach the same 1,000万円
// IPO profit gate before Normal. Keep Hard meaningfully harder through listing readiness without touching
// operating demand, shared RNG, accounting, or the Easy/Normal contracts.
const baseIPOMissingReasons=EngineClass.prototype.ipoMissingReasons;if(typeof baseIPOMissingReasons==='function')EngineClass.prototype.ipoMissingReasons=function(){let reasons=baseIPOMissingReasons.call(this);if(difficultyProfile(this.g?.difficulty).id!=='hard')return reasons;const annualProfit=(Array.isArray(this.g?.reports)?this.g.reports:[]).slice(-52).reduce((sum,row)=>sum+finite(row?.profit),0);if(annualProfit>=HARD_IPO_ANNUAL_PROFIT)return reasons;reasons=reasons.filter(reason=>reason!=='直近52週利益1,000万円');return [...reasons,'Hard：直近52週利益2,500万円'];};
const baseExecuteIPO=EngineClass.prototype.executeIPO;if(typeof baseExecuteIPO==='function')EngineClass.prototype.executeIPO=function(...args){return this.runTransaction(()=>{const result=baseExecuteIPO.apply(this,args);if(result)evaluate(this.g);return result;});};
EngineClass.prototype.__difficultyScenarioBalanceInstalled=true;
const activeEngine=modules.playerEngineBridge.getEngine();if(activeEngine){reconcileOpeningFinance(activeEngine.g);applyEasyDemand(activeEngine.g);ensure(activeEngine.g);ensureRoundingAudit(activeEngine.g);}
modules.difficultyScenarioBalance=Object.freeze({VERSION,STANDARD_TARGET_WEEK,HISTORY_LIMIT,WARNING_WEEKS,EASY_DEMAND_VERSION,EASY_DEMAND_MULTIPLIER,WEEKLY_CASH_ROUNDING_LIMIT,ROUNDING_HISTORY_LIMIT,ROUNDING_ADJUSTMENT_PER_52_WEEKS,HARD_IPO_ANNUAL_PROFIT,DIFFICULTY_PROFILES,SCENARIO_PROFILES,difficultyProfile,scenarioProfile,gradeForWeek,scoreForWeek,applyEasyDemand,ensure,ensureRoundingAudit,roundingAdjustmentLimit,reconcileOpeningFinance,reconcileWeeklyCashRounding,evaluate,snapshot,validate,__installed:true});
})();
