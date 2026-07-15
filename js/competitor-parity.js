// Phase 5B-5A integration: isolate the legacy rival-counterattack layer from competitor AI state.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-parity.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before competitor-parity.js.');
if(!modules.parity?.installParity)throw new Error('parity.js must be loaded before competitor-parity.js.');
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-parity.js.');
if(modules.competitor.__parityCompatibilityRegistered)throw new Error('competitor parity compatibility is already installed.');

const competitor=modules.competitor;
const finance=modules.finance;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const COUNTER_LIMIT=20;
const RESPONSE_HISTORY_LIMIT=80;
const ACTIVE_LIFECYCLES=new Set(['active','growing','defending','distressed','turnaround','recovered','withdrawing']);
const DISTRESS_LIFECYCLES=new Set(['distressed','turnaround','bankrupt']);
const PROJECT_TERMINAL=new Set(['completed','cancelled','failed']);

function isAICompany(row){return Boolean(row&&typeof row==='object'&&row.competitorID&&row.businessID&&Array.isArray(row.marketPresence));}
function isLegacyCounter(row){return Boolean(row&&typeof row==='object'&&!row.competitorID&&(row.industryID||row.pricePressure!==undefined||row.aggression!==undefined));}
function primaryPresence(company){return (company.marketPresence||[]).find(row=>row.active)||(company.marketPresence||[])[0]||{};}
function strategyFor(company){return competitor.STRATEGIES?.[company.strategyID]||competitor.STRATEGIES?.balanced||{};}
function derivedStrength(company){
 const presence=primaryPresence(company),stores=(company.marketPresence||[]).reduce((sum,row)=>sum+Math.max(0,finite(row.storeCount)),0),capacity=(company.marketPresence||[]).reduce((sum,row)=>sum+Math.max(0,finite(row.totalCapacity)),0);
 return clamp(stores*7+finite(company.quality)*.45+finite(company.brand)*.35+capacity/180,10,140);
}
function lifecycleDistressed(company){return DISTRESS_LIFECYCLES.has(company.lifecycleStatus)||DISTRESS_LIFECYCLES.has(company.status)||finite(company.lastDistressScore)>=4;}
function normalizeCounter(counter,company=null){
 const presence=company?primaryPresence(company):{};
 counter.id=String(counter.id||counter.competitorID||company?.competitorID||'');
 counter.competitorID=String(counter.competitorID||company?.competitorID||counter.id);
 counter.name=String(company?.name||counter.name||'競合');
 counter.industryID=String(company?.businessID||counter.industryID||'ramen');
 counter.regionID=company?(presence.areaID||counter.regionID||null):(counter.regionID||null);
 counter.strength=clamp(counter.strength,0,140);
 if(!Number.isFinite(Number(counter.strength))||counter.strength<=0)counter.strength=derivedStrength(company||{});
 counter.cashShadow=Math.max(0,finite(counter.cashShadow,counter.cash??company?.cash));
 counter.cash=counter.cashShadow;
 counter.aggression=clamp(counter.aggression,0,1);
 if(!Number.isFinite(Number(counter.aggression))||counter.aggression<=0)counter.aggression=clamp(.25+finite(strategyFor(company||{}).riskTolerance,.5)*.55,.2,.85);
 counter.brandPower=clamp(counter.brandPower,0,140);
 if(!Number.isFinite(Number(counter.brandPower))||counter.brandPower<=0)counter.brandPower=clamp(company?.brand??company?.reputation??presence.brandAwareness,0,140);
 counter.pricePressure=clamp(counter.pricePressure,0,8);
 counter.isDistressed=company?lifecycleDistressed(company):Boolean(counter.isDistressed);
 counter.lastActionWeek=Math.max(0,Math.floor(finite(counter.lastActionWeek)));
 counter.active=company?Boolean(company.active&&ACTIVE_LIFECYCLES.has(company.lifecycleStatus||company.status)):counter.active!==false;
 counter.acquired=Boolean(counter.acquired||company?.acquiredByPlayer);
 return counter;
}
function eventText(event){
 if(typeof event==='string')return event;
 if(!event||typeof event!=='object')return String(event??'');
 return String(event.text||event.detail||event.reasonText||event.message||`${event.type||'競合イベント'}が発生。`);
}
function syncEventLog(state){
 if(!Array.isArray(state.competitorEventLog))state.competitorEventLog=[];
 for(const event of (state.competitorEvents||[]).slice(0,30).reverse()){
  const line=`第${Math.max(0,Math.floor(finite(event?.week,state.week)))}週：${eventText(event)}`;
  if(!state.competitorEventLog.includes(line))state.competitorEventLog.unshift(line);
 }
 state.competitorEventLog=state.competitorEventLog.filter(value=>typeof value==='string').slice(0,80);
}
function ensureCounterStates(state){
 if(!Array.isArray(state.competitorStates))state.competitorStates=[];
 if(!Array.isArray(state.competitorCounterStates))state.competitorCounterStates=[];
 if(!Array.isArray(state.rivalResponseHistory))state.rivalResponseHistory=[];
 const legacy=state.competitorStates.filter(isLegacyCounter).map(row=>clone(row));
 state.competitorStates=state.competitorStates.filter(isAICompany);
 const existing=new Map([...state.competitorCounterStates,...legacy].filter(row=>row&&typeof row==='object').map(row=>[String(row.competitorID||row.id||''),row]));
 const counters=[];
 for(const company of state.competitorStates){
  const key=String(company.competitorID),counter=normalizeCounter(existing.get(key)||{id:key,competitorID:key},company);
  counters.push(counter);
  company.id=key;
  company.industryID=company.businessID;
  company.regionID=counter.regionID;
  company.strength=counter.strength;
  company.aggression=counter.aggression;
  company.brandPower=counter.brandPower;
  company.pricePressure=counter.pricePressure;
  company.isDistressed=counter.isDistressed;
  company.lastActionWeek=counter.lastActionWeek;
 }
 state.competitorCounterStates=counters.sort((a,b)=>String(a.competitorID).localeCompare(String(b.competitorID))).slice(0,COUNTER_LIMIT);
 state.rivalResponseHistory=state.rivalResponseHistory.filter(row=>row&&typeof row==='object').slice(-RESPONSE_HISTORY_LIMIT);
 syncEventLog(state);
 return state.competitorCounterStates;
}
function findCounter(state,id){ensureCounterStates(state);return state.competitorCounterStates.find(row=>row.id===String(id)||row.competitorID===String(id))||null;}
function findCompany(state,id){return (state.competitorStates||[]).find(row=>row.competitorID===String(id)||row.id===String(id))||null;}
function responseOperationID(state,id,action){return `rival-response-${Math.max(0,Math.floor(finite(state.week)))}-${id}-${action}`;}
function hasResponse(state,operationID){return (state.rivalResponseHistory||[]).some(row=>row.operationID===operationID);}
function recordResponse(state,counter,action,cost,operationID){
 state.rivalResponseHistory.push({week:Math.max(0,Math.floor(finite(state.week))),competitorID:counter.competitorID,action,cost:Math.max(0,finite(cost)),operationID});
 state.rivalResponseHistory=state.rivalResponseHistory.slice(-RESPONSE_HISTORY_LIMIT);
}
function closeAcquiredCompany(state,company,week){
 company.active=false;company.status='inactive';company.lifecycleStatus='inactive';company.acquiredByPlayer=true;company.acquiredWeek=week;company.isDistressed=false;company.lastLifecycleReason='プレイヤー企業が買収';
 for(const presence of company.marketPresence||[]){presence.active=false;presence.totalCapacity=0;presence.capacityPerStore=0;presence.storeCount=0;presence.exitWeek=presence.exitWeek??week;presence.entryStatus='inactive';presence.entryFailureReason='プレイヤー企業が買収';}
 for(const action of state.competitorActions||[])if(action.competitorID===company.competitorID&&!action.applied){action.status='skipped';action.applied=true;action.appliedWeek=week;action.lifecycleFailureReason='acquired';}
 for(const project of state.competitorProjects||[])if(project.competitorID===company.competitorID&&!PROJECT_TERMINAL.has(project.status)){project.status='failed';project.completedWeek=week;project.spentCost=0;project.failureReason='acquired';}
 if(company.turnaroundPlan?.status==='active'){company.turnaroundPlan.status='cancelled';company.turnaroundPlan.completedWeek=week;company.turnaroundPlan.failureReason='acquired';}
}
function installCompatibility(TycoonEngine){
 if(TycoonEngine.prototype.__competitorParityCompatibilityInstalled)return;
 const baseEnsureParityDefaults=TycoonEngine.prototype.ensureParityDefaults;
 TycoonEngine.prototype.ensureParityDefaults=function(){const result=baseEnsureParityDefaults.call(this);if(!this.__usingCompetitorCounterStates)ensureCounterStates(this.g);return result;};
 const baseNormalize=TycoonEngine.prototype.normalize;
 TycoonEngine.prototype.normalize=function(){const result=baseNormalize.call(this);ensureCounterStates(this.g);return result;};
 TycoonEngine.prototype.seedCompetitorCounterStates=function(){if(this.__usingCompetitorCounterStates)return this.g.competitorStates;return ensureCounterStates(this.g);};
 TycoonEngine.prototype.competitorPressureMultiplier=function(businessID,prefID){
  const area=this.pref(prefID)?.areaID;
  const rows=this.__usingCompetitorCounterStates?(Array.isArray(this.g.competitorStates)?this.g.competitorStates:[]):ensureCounterStates(this.g);
  const pressure=rows.filter(row=>row.active&&row.industryID===businessID&&(!row.regionID||row.regionID===area)).reduce((sum,row)=>sum+finite(row.pricePressure),0);
  return clamp(1-pressure*.015,.86,1);
 };
 const baseUpdateParityWeekly=TycoonEngine.prototype.updateParityWeekly;
 TycoonEngine.prototype.updateParityWeekly=function(){
  const aiStates=this.g.competitorStates,counters=ensureCounterStates(this.g);
  this.__usingCompetitorCounterStates=true;this.g.competitorStates=counters;
  try{return baseUpdateParityWeekly.call(this);}finally{this.g.competitorCounterStates=Array.isArray(this.g.competitorStates)?this.g.competitorStates:counters;this.g.competitorStates=aiStates;this.__usingCompetitorCounterStates=false;ensureCounterStates(this.g);}
 };
 TycoonEngine.prototype.respondToCompetitor=function(id,action){
  const state=this.g,counter=findCounter(state,id),company=findCompany(state,id);if(!counter||!company)return false;
  const operationID=responseOperationID(state,counter.competitorID,action);if(hasResponse(state,operationID))return this.fail('同じ週に同じ競合対策は実行済みです。');
  let cost=0;
  if(action==='ads'){
   cost=2_000_000;if(state.companyCash<cost)return this.fail('広告防衛費が不足しています。');state.companyCash-=cost;counter.pricePressure=clamp(counter.pricePressure-1,0,8);state.companyReputation=clamp(state.companyReputation+1,0,100);
  }else if(action==='quality'){
   cost=2_500_000;if(state.companyCash<cost)return this.fail('品質防衛費が不足しています。');state.companyCash-=cost;counter.pricePressure=clamp(counter.pricePressure-.8,0,8);const business=this.business(counter.industryID);if(business)business.quality=clamp(business.quality+2,0,100);
  }else if(action==='acquire'){
   if(!counter.isDistressed||company.acquiredByPlayer)return this.fail('この競合は買収可能な状態ではありません。');
   cost=Math.max(5_000_000,counter.strength*1_000_000+finite(company.cash)*1.2);if(state.companyCash<cost)return this.fail('買収資金が不足しています。');state.companyCash-=cost;
   closeAcquiredCompany(state,company,Math.max(0,Math.floor(finite(state.week))));counter.active=false;counter.acquired=true;counter.isDistressed=false;counter.pricePressure=0;
   const subsidiaryID=`rival-acquisition-${company.competitorID}-${state.week}`;if(!(state.subsidiaries||[]).some(row=>row.id===subsidiaryID))state.subsidiaries.push({id:subsidiaryID,name:company.name,domain:company.businessID,industry:company.businessID,valuation:cost,carryingBookValue:cost,investedCost:cost,acquisitionPrice:cost,status:'active',weeklyProfit:Math.max(0,finite(company.weeklyProfit)),growth:.02,risk:.15,ownership:1,retainedEarnings:0,acquiredWeek:state.week,sourceCompetitorID:company.competitorID});
  }else return false;
  if(finance?.event)finance.event(state,action==='acquire'?'otherInvesting':'otherOperating',cost,{cashEffect:-cost,assetEffect:action==='acquire'?cost:0,profitEffect:action==='acquire'?0:-cost,sourceType:'rivalResponse',sourceID:counter.competitorID,operationID,description:`${company.name}への${action==='ads'?'広告防衛':action==='quality'?'品質防衛':'競合買収'}`});
  recordResponse(state,counter,action,cost,operationID);ensureCounterStates(state);this.notify(action==='acquire'?`${company.name}を買収しました。`:`${company.name}への対抗策を実行しました。`,'success');this.save();this.emit();return true;
 };
 TycoonEngine.prototype.__competitorParityCompatibilityInstalled=true;
}
function validateCompatibility(state){
 const errors=[];
 if(!Array.isArray(state.competitorCounterStates))errors.push('competitorCounterStates配列不正');
 else{
  if(state.competitorCounterStates.length>COUNTER_LIMIT)errors.push('competitorCounterStates上限超過');
  const ids=new Set((Array.isArray(state.competitorStates)?state.competitorStates:[]).map(row=>row?.competitorID).filter(Boolean));
  const counterIDs=new Set();
  for(const row of state.competitorCounterStates){
   if(!row||typeof row!=='object'){errors.push('competitorCounterStates要素不正');continue;}
   const id=String(row.competitorID||'');
   if(!id)errors.push('competitorCounterStates ID欠落');
   if(counterIDs.has(id))errors.push('competitorCounterStates ID重複');counterIDs.add(id);
   if(!ids.has(id))errors.push('competitorCounterStates参照不正');
   for(const key of ['strength','cashShadow','aggression','brandPower','pricePressure','lastActionWeek'])if(!Number.isFinite(Number(row[key])))errors.push(`competitorCounterStates.${key}非有限`);
   if(finite(row.pricePressure)<0||finite(row.pricePressure)>8)errors.push('competitorCounterStates.pricePressure範囲外');
   if(finite(row.aggression)<0||finite(row.aggression)>1)errors.push('competitorCounterStates.aggression範囲外');
  }
 }
 if(!Array.isArray(state.rivalResponseHistory))errors.push('rivalResponseHistory配列不正');
 else{
  if(state.rivalResponseHistory.length>RESPONSE_HISTORY_LIMIT)errors.push('rivalResponseHistory上限超過');
  const operations=new Set();
  const ids=new Set((Array.isArray(state.competitorStates)?state.competitorStates:[]).map(row=>row?.competitorID).filter(Boolean));
  for(const row of state.rivalResponseHistory){
   if(!row||typeof row!=='object'){errors.push('rivalResponseHistory要素不正');continue;}
   if(!ids.has(row.competitorID))errors.push('rivalResponseHistory参照不正');
   if(!['ads','quality','acquire'].includes(row.action))errors.push('rivalResponseHistory action不正');
   for(const key of ['week','cost'])if(!Number.isFinite(Number(row[key])))errors.push(`rivalResponseHistory.${key}非有限`);
   const operationID=String(row.operationID||'');if(!operationID)errors.push('rivalResponseHistory operationID欠落');if(operations.has(operationID))errors.push('rivalResponseHistory operationID重複');operations.add(operationID);
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));return true;
}

const baseInstallParity=modules.parity.installParity;
modules.parity.installParity=function(TycoonEngine){const result=baseInstallParity(TycoonEngine);installCompatibility(TycoonEngine);return result;};
const baseValidate=competitor.validate;
competitor.validate=function(state){baseValidate(state);validateCompatibility(state);return true;};
Object.assign(competitor,{ensureCounterStates,eventText,validateParityCompatibility:validateCompatibility,installParityCompatibility:installCompatibility,__parityCompatibilityRegistered:true});
})();
