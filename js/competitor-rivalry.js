// Script boundary: js/competitor-rivalry.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-rivalry.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(!__modules.competitor)throw new Error('competitor.js must be loaded before competitor-rivalry.js.');
if(__modules.competitorRivalry)throw new Error('competitor rivalry module is already registered.');
(function(exports,competitor){
const TARGET=competitor.TARGET_BUSINESS_ID||'ramen',MAX_HISTORY=52;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const MODE_NAMES=Object.freeze({neutral:'通常監視',price_war:'価格戦争',brand_defense:'ブランド防衛',capacity_race:'出店・能力競争'});
function defaultRivalry(){return {mode:'neutral',modeName:MODE_NAMES.neutral,startedWeek:null,untilWeek:0,cooldownUntilWeek:0,lastEvaluatedWeek:0,lastResponseWeek:0,lastObservedSignals:null,lastThreat:null,pendingResponse:false,history:[]};}
function normalizeSignal(signal){if(!signal||typeof signal!=='object')return null;return {week:Math.max(0,Math.floor(finite(signal.week))),prefID:String(signal.prefID||''),averagePrice:Math.max(0,finite(signal.averagePrice)),storeCount:Math.max(0,Math.floor(finite(signal.storeCount))),marketShare:clamp(signal.marketShare,0,1)};}
function ensure(state){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 if(!Array.isArray(state.news))state.news=[];
 for(const c of state.competitorStates||[]){
  const current=c.rivalry&&typeof c.rivalry==='object'?c.rivalry:{};
  c.rivalry={...defaultRivalry(),...current};
  if(!MODE_NAMES[c.rivalry.mode])c.rivalry.mode='neutral';
  c.rivalry.modeName=MODE_NAMES[c.rivalry.mode];
  c.rivalry.startedWeek=c.rivalry.startedWeek===null?null:Math.max(0,Math.floor(finite(c.rivalry.startedWeek)));
  c.rivalry.untilWeek=Math.max(0,Math.floor(finite(c.rivalry.untilWeek)));
  c.rivalry.cooldownUntilWeek=Math.max(0,Math.floor(finite(c.rivalry.cooldownUntilWeek)));
  c.rivalry.lastEvaluatedWeek=Math.max(0,Math.floor(finite(c.rivalry.lastEvaluatedWeek)));
  c.rivalry.lastResponseWeek=Math.max(0,Math.floor(finite(c.rivalry.lastResponseWeek)));
  c.rivalry.lastObservedSignals=normalizeSignal(c.rivalry.lastObservedSignals);
  c.rivalry.lastThreat=c.rivalry.lastThreat&&typeof c.rivalry.lastThreat==='object'?{...c.rivalry.lastThreat}:null;
  c.rivalry.pendingResponse=Boolean(c.rivalry.pendingResponse);
  c.rivalry.history=(Array.isArray(c.rivalry.history)?c.rivalry.history:[]).filter(x=>x&&typeof x==='object').slice(-MAX_HISTORY);
 }
 return state;
}
function capturePlayerSignal(state,prefID){
 const stores=(state.stores||[]).filter(s=>s&&s.status==='open'&&s.businessID===TARGET&&s.prefID===prefID);
 const business=(state.businesses||[]).find(b=>b&&b.id===TARGET)||{};
 let share=0;
 for(const store of stores){const r=state.marketResultsByStoreID&&state.marketResultsByStoreID[store.id];if(r)share+=clamp(r.marketShare,0,1);}
 if(!stores.length)share=0;
 else if(share<=0){const summary=state.marketResultsByBusinessID&&state.marketResultsByBusinessID[TARGET];share=clamp(summary&&summary.marketShare,0,1);}
 return normalizeSignal({week:state.week,prefID,averagePrice:stores.length?finite(business.price):0,storeCount:stores.length,marketShare:clamp(share,0,1)});
}
function evaluateThreat(previous,current,competitorState,presence){
 previous=normalizeSignal(previous);current=normalizeSignal(current);
 if(!previous||!current)return null;
 const playerPriceDrop=previous.averagePrice>0&&current.averagePrice>0?(previous.averagePrice-current.averagePrice)/previous.averagePrice:0;
 const playerShareGain=current.marketShare-previous.marketShare;
 const playerStoreGrowth=current.storeCount-previous.storeCount;
 const rivalPrice=Math.max(1,finite(presence&&presence.price));
 const playerPriceGap=current.averagePrice>0?(rivalPrice-current.averagePrice)/rivalPrice:0;
 const rivalShare=clamp(presence&&presence.currentWeekShare,0,1);
 const utilization=finite(presence&&presence.totalCapacity)>0?finite(presence&&presence.fulfilledUnits)/finite(presence&&presence.totalCapacity):0;
 const lostDemand=Math.max(0,finite(presence&&presence.lostDemand));
 let mode='neutral',intensity=0,reason='';
 if(playerPriceDrop>=.04&&playerPriceGap>=.04){mode='price_war';intensity=clamp(playerPriceDrop+playerPriceGap,.1,.35);reason=`プレイヤー価格が前週比${(playerPriceDrop*100).toFixed(1)}%低下し、競合価格を${(playerPriceGap*100).toFixed(1)}%下回った`;}
 else if(playerShareGain>=.04||current.marketShare>=rivalShare+.08){mode='brand_defense';intensity=clamp(Math.max(playerShareGain,current.marketShare-rivalShare),.08,.30);reason=`プレイヤーの市場シェアが${(current.marketShare*100).toFixed(1)}%へ上昇した`;}
 else if(playerStoreGrowth>=1&&(utilization>=.75||lostDemand>0)){mode='capacity_race';intensity=clamp(.10+playerStoreGrowth*.04+Math.max(0,utilization-.75),.10,.35);reason=`プレイヤーが${playerStoreGrowth}店舗増やし、競合稼働率が${(utilization*100).toFixed(0)}%となった`;}
 if(mode==='neutral')return null;
 return {mode,modeName:MODE_NAMES[mode],intensity,reason,playerPriceDrop,playerPriceGap,playerShareGain,playerStoreGrowth,playerMarketShare:current.marketShare,rivalMarketShare:rivalShare,utilization,lostDemand};
}
function appendHistory(c,state,threat){
 const row={week:Math.max(0,Math.floor(finite(state.week))),mode:c.rivalry.mode,modeName:c.rivalry.modeName,reason:threat&&threat.reason||'',intensity:finite(threat&&threat.intensity),responsePending:Boolean(c.rivalry.pendingResponse)};
 c.rivalry.history=(c.rivalry.history||[]).filter(x=>finite(x.week,-1)!==row.week).concat([row]).slice(-MAX_HISTORY);
}
function enterMode(state,c,threat){
 const duration=threat.mode==='price_war'?8:threat.mode==='brand_defense'?10:12;
 c.rivalry.mode=threat.mode;c.rivalry.modeName=MODE_NAMES[threat.mode];c.rivalry.startedWeek=state.week;c.rivalry.untilWeek=state.week+duration;c.rivalry.lastThreat={...threat,detectedWeek:state.week};c.rivalry.pendingResponse=true;
 const message=`第${state.week}週：${c.name}が「${c.rivalry.modeName}」へ移行。${threat.reason}。`;
 state.competitorEvents.unshift(message);state.competitorEvents=state.competitorEvents.slice(0,200);state.news.unshift(message);state.news=state.news.slice(0,300);
 appendHistory(c,state,threat);
}
function leaveMode(state,c){
 c.rivalry.cooldownUntilWeek=state.week+6;c.rivalry.mode='neutral';c.rivalry.modeName=MODE_NAMES.neutral;c.rivalry.startedWeek=null;c.rivalry.untilWeek=0;c.rivalry.pendingResponse=false;appendHistory(c,state,null);
}
function responseSpec(c,p){
 const threat=c.rivalry.lastThreat||{},intensity=clamp(threat.intensity,.08,.35);
 if(c.rivalry.mode==='price_war'){
  const floor=Math.max(2,Math.round(finite(c.baseUnitCost,320)*1.10));
  const next=Math.max(floor,Math.round(finite(p.price,920)*(1-clamp(.035+intensity*.10,.04,.07))));
  if(next>=finite(p.price))return null;
  return {actionType:'priceDecrease',newValue:next,cost:0,delay:1};
 }
 if(c.rivalry.mode==='brand_defense'){
  const cost=Math.round(260000+intensity*800000);if(finite(c.cash)<cost)return null;
  return {actionType:'brandInvestment',newValue:clamp(finite(p.brandAwareness)+3+intensity*10,0,100),cost,delay:1};
 }
 if(c.rivalry.mode==='capacity_race'){
  const cost=Math.round(550000+intensity*900000);if(finite(c.cash)<cost)return null;
  return {actionType:'capacityExpansion',newValue:Math.round(Math.max(1,finite(p.totalCapacity))*(1.08+intensity*.18)),cost,delay:4};
 }
 return null;
}
function queueResponse(state,c,p){
 if(!c.rivalry.pendingResponse||c.rivalry.lastResponseWeek>=finite(c.rivalry.startedWeek))return false;
 if((state.competitorActions||[]).some(a=>a&&a.competitorID===c.competitorID&&finite(a.decisionWeek)===finite(state.week)))return false;
 const spec=responseSpec(c,p);if(!spec)return false;
 const threat=c.rivalry.lastThreat||{};
 const action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:c.competitorID,presenceID:p.presenceID,decisionWeek:state.week,effectiveWeek:state.week+spec.delay,actionType:spec.actionType,targetBusinessID:TARGET,targetPrefID:p.prefID,previousValue:spec.actionType.indexOf('price')===0?p.price:null,newValue:spec.newValue,cost:spec.cost,reasonCodes:['rivalry',c.rivalry.mode],reasonText:`${c.rivalry.modeName}: ${threat.reason||'プレイヤーの攻勢を検知'}`,status:'pending',applied:false,appliedWeek:null,operationID:`rivalry-${state.week}-${c.competitorID}-${c.rivalry.mode}`};
 state.competitorActions.push(action);c.actionHistory=(Array.isArray(c.actionHistory)?c.actionHistory:[]).concat([JSON.parse(JSON.stringify(action))]).slice(-20);c.lastDecisionWeek=state.week;c.decisionCooldownWeeks=Math.max(3,finite(c.decisionCooldownWeeks));c.rivalry.lastResponseWeek=state.week;c.rivalry.pendingResponse=false;appendHistory(c,state,threat);return true;
}
function processAfterCompetitorWeek(state){
 ensure(state);
 for(const c of state.competitorStates||[]){
  if(!c||!c.active||c.status==='bankrupt'||c.status==='inactive')continue;
  const r=c.rivalry;if(r.lastEvaluatedWeek===finite(state.week))continue;
  r.lastEvaluatedWeek=finite(state.week);
  const presences=(c.marketPresence||[]).filter(p=>p&&p.active&&p.businessID===TARGET);
  const p=presences.slice().sort((a,b)=>finite(b.currentWeekShare)-finite(a.currentWeekShare)||String(a.presenceID).localeCompare(String(b.presenceID)))[0];
  if(!p)continue;
  const current=capturePlayerSignal(state,p.prefID),previous=r.lastObservedSignals;
  if(r.mode!=='neutral'&&finite(state.week)>r.untilWeek)leaveMode(state,c);
  if(r.mode==='neutral'&&finite(state.week)>=r.cooldownUntilWeek){const threat=evaluateThreat(previous,current,c,p);if(threat)enterMode(state,c,threat);}
  if(r.mode!=='neutral')queueResponse(state,c,p);
  r.lastObservedSignals=current;
 }
 state.competitorActions=(state.competitorActions||[]).slice(-160);
 return state;
}
const baseEnsure=competitor.ensure,baseProcessWeek=competitor.processWeek;
competitor.ensure=function(state){const result=baseEnsure(state);ensure(state);return result;};
competitor.processWeek=function(state){ensure(state);const result=baseProcessWeek(state);processAfterCompetitorWeek(state);return result;};
Object.defineProperty(competitor.processWeek,'__competitorRivalryWrapped',{value:true});
Object.assign(exports,{MODE_NAMES,ensure,capturePlayerSignal,evaluateThreat,processAfterCompetitorWeek});
})(__modules.competitorRivalry={},__modules.competitor);
})();
