// Phase 5B-2 extension: deterministic competitor project lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-projects.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-projects.js.');
if(modules.competitor.__projectsInstalled)throw new Error('competitor project lifecycle is already installed.');

const competitor=modules.competitor;
const MAX_PROJECTS=160;
const PROJECT_ACTION_TYPES=Object.freeze(['brandInvestment','qualityInvestment','capacityExpansion','marketEntry','marketExit','turnaround']);
const PROJECT_STATUSES=Object.freeze(['planned','inProgress','completed','cancelled','failed']);
const terminal=new Set(['completed','cancelled','failed']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const projectAction=type=>PROJECT_ACTION_TYPES.includes(type);

function statusForAction(action,week){
 if(action.applied)return action.status==='skipped'?'failed':'completed';
 return finite(week)<finite(action.decisionWeek,week)?'planned':'inProgress';
}
function trimProjects(projects){
 const rows=(Array.isArray(projects)?projects:[]).filter(row=>row&&typeof row==='object');
 const active=rows.filter(row=>!terminal.has(row.status));
 const completed=rows.filter(row=>terminal.has(row.status)).sort((a,b)=>finite(a.completedWeek,a.completionWeek)-finite(b.completedWeek,b.completionWeek)||String(a.projectID).localeCompare(String(b.projectID)));
 const room=Math.max(0,MAX_PROJECTS-active.length);
 return active.concat(completed.slice(-room)).sort((a,b)=>finite(a.createdWeek)-finite(b.createdWeek)||String(a.projectID).localeCompare(String(b.projectID))).slice(-MAX_PROJECTS);
}
function sanitizeProject(project){
 project.projectID=String(project.projectID||'');
 project.competitorID=String(project.competitorID||'');
 project.presenceID=project.presenceID==null?null:String(project.presenceID);
 project.projectType=String(project.projectType||'');
 project.status=PROJECT_STATUSES.includes(project.status)?project.status:'planned';
 project.createdWeek=Math.max(0,Math.floor(finite(project.createdWeek)));
 project.startWeek=Math.max(project.createdWeek,Math.floor(finite(project.startWeek,project.createdWeek)));
 project.completionWeek=Math.max(project.startWeek,Math.floor(finite(project.completionWeek,project.startWeek)));
 project.completedWeek=project.completedWeek==null?null:Math.max(project.startWeek,Math.floor(finite(project.completedWeek,project.completionWeek)));
 project.committedCost=Math.max(0,finite(project.committedCost));
 project.spentCost=Math.max(0,finite(project.spentCost));
 project.previousValue=project.previousValue??null;
 project.targetValue=project.targetValue??null;
 project.operationID=String(project.operationID||project.actionID||project.projectID);
 project.actionID=String(project.actionID||'');
 project.reasonText=String(project.reasonText||'');
 project.failureReason=String(project.failureReason||'');
 return project;
}
function ensureProjectForAction(state,action){
 if(!projectAction(action?.actionType))return null;
 const operationID=String(action.operationID||action.actionID||'');
 let project=(state.competitorProjects||[]).find(row=>row.operationID===operationID);
 if(!project){
  project={
   projectID:`cp-${state.nextCompetitorProjectSeq++}`,
   competitorID:action.competitorID,
   presenceID:action.presenceID||null,
   projectType:action.actionType,
   status:'planned',
   createdWeek:finite(action.decisionWeek,state.week),
   startWeek:finite(action.decisionWeek,state.week),
   completionWeek:Math.max(finite(action.decisionWeek,state.week),finite(action.effectiveWeek,state.week)),
   completedWeek:null,
   committedCost:Math.max(0,finite(action.cost)),
   spentCost:0,
   previousValue:action.previousValue??null,
   targetValue:action.newValue??null,
   operationID,
   actionID:action.actionID,
   reasonText:action.reasonText||'',
   failureReason:''
  };
  state.competitorProjects.push(project);
 }
 project.status=statusForAction(action,state.week);
 if(terminal.has(project.status)){
  project.completedWeek=finite(action.appliedWeek,action.effectiveWeek);
  project.spentCost=project.status==='completed'?project.committedCost:0;
  project.failureReason=project.status==='failed'?'action-skipped':'';
 }else{
  project.completedWeek=null;
  project.spentCost=0;
  project.failureReason='';
 }
 return sanitizeProject(project);
}
function ensureProjects(state){
 if(!Array.isArray(state.competitorProjects))state.competitorProjects=[];
 state.nextCompetitorProjectSeq=Math.max(1,Math.floor(finite(state.nextCompetitorProjectSeq,state.nextCompetitorInvestmentSeq||1)));
 for(const action of state.competitorActions||[])ensureProjectForAction(state,action);
 state.competitorProjects=trimProjects(state.competitorProjects.map(sanitizeProject));
 return state.competitorProjects;
}
function validateProjects(state){
 const errors=[];
 if(!Array.isArray(state.competitorProjects))errors.push('competitorProjects配列不正');
 else{
  if(state.competitorProjects.length>MAX_PROJECTS)errors.push('competitorProjects上限超過');
  const competitorIDs=new Set((state.competitorStates||[]).map(row=>row.competitorID));
  const presenceIDs=new Set((state.competitorStates||[]).flatMap(row=>(row.marketPresence||[]).map(p=>p.presenceID)));
  const projectIDs=new Set();
  const operationIDs=new Set();
  for(const project of state.competitorProjects){
   if(projectIDs.has(project.projectID))errors.push('projectID重複');projectIDs.add(project.projectID);
   if(operationIDs.has(project.operationID))errors.push('project operationID重複');operationIDs.add(project.operationID);
   if(!competitorIDs.has(project.competitorID))errors.push('project競合参照不正');
   if(project.presenceID!==null&&!presenceIDs.has(project.presenceID))errors.push('project市場参照不正');
   if(!PROJECT_ACTION_TYPES.includes(project.projectType))errors.push('projectType不正');
   if(!PROJECT_STATUSES.includes(project.status))errors.push('projectStatus不正');
   for(const key of ['createdWeek','startWeek','completionWeek','committedCost','spentCost'])if(!Number.isFinite(Number(project[key])))errors.push(`project.${key}非有限`);
   if(finite(project.startWeek)<finite(project.createdWeek)||finite(project.completionWeek)<finite(project.startWeek))errors.push('project期間不正');
   if(terminal.has(project.status)&&project.completedWeek==null)errors.push('project完了週欠落');
   if(project.status==='completed'&&finite(project.spentCost)!==finite(project.committedCost))errors.push('project支出不一致');
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureProjects(state);return state;};
competitor.processWeek=function(state){ensureProjects(state);const result=baseProcessWeek(state);ensureProjects(state);return result;};
competitor.validate=function(state){baseValidate(state);validateProjects(state);return true;};
Object.assign(competitor,{MAX_PROJECTS,PROJECT_ACTION_TYPES,ensureProjectForAction,migrateProjectsFromActions:ensureProjects,validateProjects,__projectsInstalled:true});
})();

// Phase 8A-1 extension: reactive rivalry modes based on public player signals.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor rivalry.');
const competitor=globalThis.__capitalismTycoonModules.competitor;
if(!competitor||!competitor.__projectsInstalled)throw new Error('competitor-projects.js must install projects before competitor rivalry.');
if(competitor.__rivalryInstalled)throw new Error('competitor rivalry is already installed.');
const TARGET=competitor.TARGET_BUSINESS_ID||'ramen',MAX_RIVALRY_HISTORY=52;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const finiteR=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const MODE_NAMES=Object.freeze({neutral:'通常監視',price_war:'価格戦争',brand_defense:'ブランド防衛',capacity_race:'出店・能力競争'});
function defaultRivalry(){return {mode:'neutral',modeName:MODE_NAMES.neutral,startedWeek:null,untilWeek:0,cooldownUntilWeek:0,lastEvaluatedWeek:0,lastResponseWeek:0,lastObservedSignals:null,lastThreat:null,pendingResponse:false,history:[]};}
function normalizeSignal(signal){if(!signal||typeof signal!=='object')return null;return {week:Math.max(0,Math.floor(finiteR(signal.week))),prefID:String(signal.prefID||''),averagePrice:Math.max(0,finiteR(signal.averagePrice)),storeCount:Math.max(0,Math.floor(finiteR(signal.storeCount))),marketShare:clamp(signal.marketShare,0,1)};}
function ensureRivalry(state){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 if(!Array.isArray(state.news))state.news=[];
 for(const c of state.competitorStates||[]){
  const current=c.rivalry&&typeof c.rivalry==='object'?c.rivalry:{};
  c.rivalry={...defaultRivalry(),...current};
  if(!MODE_NAMES[c.rivalry.mode])c.rivalry.mode='neutral';
  c.rivalry.modeName=MODE_NAMES[c.rivalry.mode];
  c.rivalry.startedWeek=c.rivalry.startedWeek===null?null:Math.max(0,Math.floor(finiteR(c.rivalry.startedWeek)));
  c.rivalry.untilWeek=Math.max(0,Math.floor(finiteR(c.rivalry.untilWeek)));
  c.rivalry.cooldownUntilWeek=Math.max(0,Math.floor(finiteR(c.rivalry.cooldownUntilWeek)));
  c.rivalry.lastEvaluatedWeek=Math.max(0,Math.floor(finiteR(c.rivalry.lastEvaluatedWeek)));
  c.rivalry.lastResponseWeek=Math.max(0,Math.floor(finiteR(c.rivalry.lastResponseWeek)));
  c.rivalry.lastObservedSignals=normalizeSignal(c.rivalry.lastObservedSignals);
  c.rivalry.lastThreat=c.rivalry.lastThreat&&typeof c.rivalry.lastThreat==='object'?{...c.rivalry.lastThreat}:null;
  c.rivalry.pendingResponse=Boolean(c.rivalry.pendingResponse);
  c.rivalry.history=(Array.isArray(c.rivalry.history)?c.rivalry.history:[]).filter(x=>x&&typeof x==='object').slice(-MAX_RIVALRY_HISTORY);
 }
 return state;
}
function capturePlayerSignal(state,prefID){
 const stores=(state.stores||[]).filter(s=>s&&s.status==='open'&&s.businessID===TARGET&&s.prefID===prefID);
 const business=(state.businesses||[]).find(b=>b&&b.id===TARGET)||{};
 let share=0;
 for(const store of stores){const result=state.marketResultsByStoreID&&state.marketResultsByStoreID[store.id];if(result)share+=clamp(result.marketShare,0,1);}
 if(!stores.length)share=0;
 else if(share<=0){const summary=state.marketResultsByBusinessID&&state.marketResultsByBusinessID[TARGET];share=clamp(summary&&summary.marketShare,0,1);}
 return normalizeSignal({week:state.week,prefID,averagePrice:stores.length?finiteR(business.price):0,storeCount:stores.length,marketShare:clamp(share,0,1)});
}
function evaluateThreat(previous,current,competitorState,presence){
 previous=normalizeSignal(previous);current=normalizeSignal(current);
 if(!previous||!current)return null;
 const playerPriceDrop=previous.averagePrice>0&&current.averagePrice>0?(previous.averagePrice-current.averagePrice)/previous.averagePrice:0;
 const playerShareGain=current.marketShare-previous.marketShare;
 const playerStoreGrowth=current.storeCount-previous.storeCount;
 const rivalPrice=Math.max(1,finiteR(presence&&presence.price));
 const playerPriceGap=current.averagePrice>0?(rivalPrice-current.averagePrice)/rivalPrice:0;
 const rivalShare=clamp(presence&&presence.currentWeekShare,0,1);
 const utilization=finiteR(presence&&presence.totalCapacity)>0?finiteR(presence&&presence.fulfilledUnits)/finiteR(presence&&presence.totalCapacity):0;
 const lostDemand=Math.max(0,finiteR(presence&&presence.lostDemand));
 let mode='neutral',intensity=0,reason='';
 if(playerPriceDrop>=.04&&playerPriceGap>=.04){mode='price_war';intensity=clamp(playerPriceDrop+playerPriceGap,.1,.35);reason=`プレイヤー価格が前週比${(playerPriceDrop*100).toFixed(1)}%低下し、競合価格を${(playerPriceGap*100).toFixed(1)}%下回った`;}
 else if(playerShareGain>=.04||current.marketShare>=rivalShare+.08){mode='brand_defense';intensity=clamp(Math.max(playerShareGain,current.marketShare-rivalShare),.08,.30);reason=`プレイヤーの市場シェアが${(current.marketShare*100).toFixed(1)}%へ上昇した`;}
 else if(playerStoreGrowth>=1&&(utilization>=.75||lostDemand>0)){mode='capacity_race';intensity=clamp(.10+playerStoreGrowth*.04+Math.max(0,utilization-.75),.10,.35);reason=`プレイヤーが${playerStoreGrowth}店舗増やし、競合稼働率が${(utilization*100).toFixed(0)}%となった`;}
 if(mode==='neutral')return null;
 return {mode,modeName:MODE_NAMES[mode],intensity,reason,playerPriceDrop,playerPriceGap,playerShareGain,playerStoreGrowth,playerMarketShare:current.marketShare,rivalMarketShare:rivalShare,utilization,lostDemand};
}
function appendRivalryHistory(c,state,threat){
 const row={week:Math.max(0,Math.floor(finiteR(state.week))),mode:c.rivalry.mode,modeName:c.rivalry.modeName,reason:threat&&threat.reason||'',intensity:finiteR(threat&&threat.intensity),responsePending:Boolean(c.rivalry.pendingResponse)};
 c.rivalry.history=(c.rivalry.history||[]).filter(x=>finiteR(x.week,-1)!==row.week).concat([row]).slice(-MAX_RIVALRY_HISTORY);
}
function enterMode(state,c,threat){
 const duration=threat.mode==='price_war'?8:threat.mode==='brand_defense'?10:12;
 c.rivalry.mode=threat.mode;c.rivalry.modeName=MODE_NAMES[threat.mode];c.rivalry.startedWeek=state.week;c.rivalry.untilWeek=state.week+duration;c.rivalry.lastThreat={...threat,detectedWeek:state.week};c.rivalry.pendingResponse=true;
 const message=`第${state.week}週：${c.name}が「${c.rivalry.modeName}」へ移行。${threat.reason}。`;
 state.competitorEvents.unshift(message);state.competitorEvents=state.competitorEvents.slice(0,200);state.news.unshift(message);state.news=state.news.slice(0,300);
 appendRivalryHistory(c,state,threat);
}
function leaveMode(state,c){
 c.rivalry.cooldownUntilWeek=state.week+6;c.rivalry.mode='neutral';c.rivalry.modeName=MODE_NAMES.neutral;c.rivalry.startedWeek=null;c.rivalry.untilWeek=0;c.rivalry.pendingResponse=false;appendRivalryHistory(c,state,null);
}
function responseSpec(c,p){
 const threat=c.rivalry.lastThreat||{},intensity=clamp(threat.intensity,.08,.35);
 if(c.rivalry.mode==='price_war'){
  const floor=Math.max(2,Math.round(finiteR(c.baseUnitCost,320)*1.10));
  const next=Math.max(floor,Math.round(finiteR(p.price,920)*(1-clamp(.035+intensity*.10,.04,.07))));
  if(next>=finiteR(p.price))return null;
  return {actionType:'priceDecrease',newValue:next,cost:0,delay:1};
 }
 if(c.rivalry.mode==='brand_defense'){
  const cost=Math.round(260000+intensity*800000);if(finiteR(c.cash)<cost)return null;
  return {actionType:'brandInvestment',newValue:clamp(finiteR(p.brandAwareness)+3+intensity*10,0,100),cost,delay:1};
 }
 if(c.rivalry.mode==='capacity_race'){
  const cost=Math.round(550000+intensity*900000);if(finiteR(c.cash)<cost)return null;
  return {actionType:'capacityExpansion',newValue:Math.round(Math.max(1,finiteR(p.totalCapacity))*(1.08+intensity*.18)),cost,delay:4};
 }
 return null;
}
function queueResponse(state,c,p){
 if(!c.rivalry.pendingResponse||c.rivalry.lastResponseWeek>=finiteR(c.rivalry.startedWeek))return false;
 if((state.competitorActions||[]).some(a=>a&&a.competitorID===c.competitorID&&finiteR(a.decisionWeek)===finiteR(state.week)))return false;
 const spec=responseSpec(c,p);if(!spec)return false;
 const threat=c.rivalry.lastThreat||{};
 const action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:c.competitorID,presenceID:p.presenceID,decisionWeek:state.week,effectiveWeek:state.week+spec.delay,actionType:spec.actionType,targetBusinessID:TARGET,targetPrefID:p.prefID,previousValue:spec.actionType.indexOf('price')===0?p.price:null,newValue:spec.newValue,cost:spec.cost,reasonCodes:['rivalry',c.rivalry.mode],reasonText:`${c.rivalry.modeName}: ${threat.reason||'プレイヤーの攻勢を検知'}`,status:'pending',applied:false,appliedWeek:null,operationID:`rivalry-${state.week}-${c.competitorID}-${c.rivalry.mode}`};
 state.competitorActions.push(action);c.actionHistory=(Array.isArray(c.actionHistory)?c.actionHistory:[]).concat([JSON.parse(JSON.stringify(action))]).slice(-20);c.lastDecisionWeek=state.week;c.decisionCooldownWeeks=Math.max(3,finiteR(c.decisionCooldownWeeks));c.rivalry.lastResponseWeek=state.week;c.rivalry.pendingResponse=false;appendRivalryHistory(c,state,threat);return true;
}
function processAfterCompetitorWeek(state){
 ensureRivalry(state);
 for(const c of state.competitorStates||[]){
  if(!c||!c.active||c.status==='bankrupt'||c.status==='inactive')continue;
  const rivalry=c.rivalry;if(rivalry.lastEvaluatedWeek===finiteR(state.week))continue;
  rivalry.lastEvaluatedWeek=finiteR(state.week);
  const presence=(c.marketPresence||[]).filter(p=>p&&p.active&&p.businessID===TARGET).slice().sort((a,b)=>finiteR(b.currentWeekShare)-finiteR(a.currentWeekShare)||String(a.presenceID).localeCompare(String(b.presenceID)))[0];
  if(!presence)continue;
  const current=capturePlayerSignal(state,presence.prefID),previous=rivalry.lastObservedSignals;
  if(rivalry.mode!=='neutral'&&finiteR(state.week)>rivalry.untilWeek)leaveMode(state,c);
  if(rivalry.mode==='neutral'&&finiteR(state.week)>=rivalry.cooldownUntilWeek){const threat=evaluateThreat(previous,current,c,presence);if(threat)enterMode(state,c,threat);}
  if(rivalry.mode!=='neutral')queueResponse(state,c,presence);
  rivalry.lastObservedSignals=current;
 }
 state.competitorActions=(state.competitorActions||[]).slice(-160);
 competitor.migrateProjectsFromActions(state);
 return state;
}
const baseEnsureRivalry=competitor.ensure;
const baseProcessWeekRivalry=competitor.processWeek;
competitor.ensure=function(state){const result=baseEnsureRivalry(state);ensureRivalry(state);return result;};
competitor.processWeek=function(state){ensureRivalry(state);const result=baseProcessWeekRivalry(state);processAfterCompetitorWeek(state);return result;};
const rivalry=Object.freeze({MODE_NAMES,MAX_RIVALRY_HISTORY,ensure:ensureRivalry,capturePlayerSignal,evaluateThreat,processAfterCompetitorWeek});
Object.assign(competitor,{rivalry,__rivalryInstalled:true});
})();
