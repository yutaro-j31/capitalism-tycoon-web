// Phase 5B-3A extension: deterministic competitor market-entry projects.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-entry.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-entry.js.');
if(!modules.competitor.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-entry.js.');
if(!modules.data)throw new Error('data.js must be loaded before competitor-entry.js.');
if(modules.competitor.__entryInstalled)throw new Error('competitor market-entry lifecycle is already installed.');

const competitor=modules.competitor;
const MASTER=modules.data.MASTER;
const ENTRY_LEAD_WEEKS=6;
const MAX_PRESENCES_PER_COMPETITOR=3;
const ENTRY_STATUSES=Object.freeze(['active','planned','opening','failed','exited','inactive']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));

function strategy(company){return competitor.STRATEGIES[company.strategyID]||competitor.STRATEGIES.balanced;}
function ramenBusiness(state){return (state.businesses||[]).find(row=>row.id==='ramen')||(MASTER.businesses||[]).find(row=>row.id==='ramen')||{price:920,storeCost:1700000};}
function areaFor(state,pref){return (state.areas||[]).find(row=>row.id===pref.areaID)||{};}
function presenceOpenOrPending(presence){return Boolean(presence.active||presence.entryStatus==='planned'||presence.entryStatus==='opening');}
function pendingEntryAction(state,competitorID,prefID){return (state.competitorActions||[]).find(action=>action.actionType==='marketEntry'&&action.competitorID===competitorID&&action.targetPrefID===prefID&&!action.applied)||null;}
function activePresenceCount(company){return (company.marketPresence||[]).filter(presence=>presenceOpenOrPending(presence)).length;}
function localCompetitorCount(state,prefID){return (state.competitorStates||[]).reduce((sum,company)=>sum+(company.marketPresence||[]).filter(presence=>presence.active&&presence.prefID===prefID).length,0);}
function localPlayerStoreCount(state,prefID){return (state.stores||[]).filter(store=>store.status==='open'&&store.businessID==='ramen'&&store.prefID===prefID).length;}
function localReferencePrice(state,prefID){const prices=[];for(const company of state.competitorStates||[])for(const presence of company.marketPresence||[])if(presence.active&&presence.prefID===prefID&&finite(presence.price)>1)prices.push(finite(presence.price));if(prices.length)return prices.reduce((sum,value)=>sum+value,0)/prices.length;return finite(ramenBusiness(state).price,920);}
function entryCost(state,pref){return Math.round(Math.max(500000,finite(ramenBusiness(state).storeCost,1700000)+finite(pref.rent,80000)*4+300000));}
function entryScore(state,company,pref){
 const area=areaFor(state,pref),s=strategy(company),sameArea=(company.marketPresence||[]).some(presence=>presence.active&&presence.areaID===pref.areaID)?1:0;
 const rentPenalty=clamp(finite(pref.rent,80000)/210000,0,1.5),competition=finite(area.competition)+localCompetitorCount(state,pref.id)*.08+localPlayerStoreCount(state,pref.id)*.04;
 return finite(pref.traffic,1)*.46+finite(area.ramenFit,1)*.32+sameArea*.12+s.riskTolerance*.08-rentPenalty*.16-competition*.28;
}
function evaluateEntryCandidates(state,company){
 const represented=new Set((company.marketPresence||[]).filter(presence=>presenceOpenOrPending(presence)).map(presence=>presence.prefID));
 return (state.prefs||[]).filter(pref=>!represented.has(pref.id)&&!pendingEntryAction(state,company.competitorID,pref.id)).map(pref=>({prefID:pref.id,areaID:pref.areaID,score:entryScore(state,company,pref),cost:entryCost(state,pref),traffic:finite(pref.traffic,1),rent:finite(pref.rent)})).sort((a,b)=>b.score-a.score||String(a.prefID).localeCompare(String(b.prefID)));
}
function sanitizePresenceEntry(presence){
 if(!ENTRY_STATUSES.includes(presence.entryStatus))presence.entryStatus=presence.active?'active':presence.exitWeek!=null?'exited':'inactive';
 presence.plannedStoreCount=Math.max(0,Math.floor(finite(presence.plannedStoreCount,presence.active?presence.storeCount:0)));
 presence.plannedCapacity=Math.max(0,finite(presence.plannedCapacity,presence.active?presence.totalCapacity:0));
 presence.plannedEntryWeek=presence.plannedEntryWeek==null?null:Math.max(0,Math.floor(finite(presence.plannedEntryWeek)));
 presence.expectedOpenWeek=presence.expectedOpenWeek==null?null:Math.max(0,Math.floor(finite(presence.expectedOpenWeek)));
 presence.entryFailureReason=String(presence.entryFailureReason||'');
 return presence;
}
function ensureEntryState(state){
 for(const company of state.competitorStates||[]){
  company.lastEntryDecisionWeek=Math.max(0,Math.floor(finite(company.lastEntryDecisionWeek)));
  if(!Array.isArray(company.marketPresence))company.marketPresence=[];
  company.marketPresence.forEach(sanitizePresenceEntry);
 }
 return state;
}
function reusablePresence(company,prefID){return (company.marketPresence||[]).find(presence=>presence.prefID===prefID&&!presence.active&&!presenceOpenOrPending(presence)&&!presence.exitWeek)||null;}
function preparePresence(state,company,pref){
 const s=strategy(company),reference=localReferencePrice(state,pref.id),plannedCapacity=Math.round(500+clamp(pref.traffic,.5,1.7)*80);
 let presence=reusablePresence(company,pref.id);
 if(!presence){
  presence={presenceID:`competitor-entry-${state.nextCompetitorPresenceSeq++}`,competitorID:company.competitorID,businessID:'ramen',prefID:pref.id,areaID:pref.areaID,active:false,storeCount:0,capacityPerStore:0,totalCapacity:0,price:Math.max(2,Math.round(reference*s.targetPriceIndex)),quality:clamp(company.quality,0,100),brandAwareness:clamp(company.brand,0,100),convenience:clamp(50+s.capacityPriority*18,0,100),serviceQuality:clamp(48+company.quality*.28,0,100),novelty:clamp(25+s.brandPriority*12,0,100),localReputation:clamp(company.reputation,0,100),marketingIntensity:0,entryWeek:null,exitWeek:null,lastUpdatedWeek:finite(state.week),previousWeekShare:0,currentWeekShare:0,potentialDemand:0,fulfilledUnits:0,lostDemand:0,revenue:0,variableCost:0,contributionMargin:0,fixedCost:Math.max(60000,finite(company.fixedCostPerPresence,70000)),profit:0};
  company.marketPresence.push(presence);
 }
 Object.assign(presence,{active:false,entryStatus:'planned',plannedStoreCount:1,plannedCapacity,plannedEntryWeek:finite(state.week),expectedOpenWeek:finite(state.week)+ENTRY_LEAD_WEEKS,entryFailureReason:'',exitWeek:null,lastUpdatedWeek:finite(state.week),storeCount:0,capacityPerStore:0,totalCapacity:0});
 return sanitizePresenceEntry(presence);
}
function scheduleMarketEntry(state,company,prefID,reasonText=''){ 
 ensureEntryState(state);
 const pref=(state.prefs||[]).find(row=>row.id===prefID);
 if(!pref||!company||!company.active||company.status==='bankrupt'||company.status==='inactive')return null;
 if(activePresenceCount(company)>=MAX_PRESENCES_PER_COMPETITOR)return null;
 if((company.marketPresence||[]).some(presence=>presence.active&&presence.prefID===prefID)||pendingEntryAction(state,company.competitorID,prefID))return null;
 const presence=preparePresence(state,company,pref),cost=entryCost(state,pref),week=Math.max(0,Math.floor(finite(state.week)));
 const action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:company.competitorID,presenceID:presence.presenceID,decisionWeek:week,effectiveWeek:week+ENTRY_LEAD_WEEKS,actionType:'marketEntry',targetBusinessID:'ramen',targetPrefID:pref.id,previousValue:0,newValue:presence.plannedCapacity,cost,reasonCodes:['portfolio','entry','cash'],reasonText:reasonText||`${pref.name}市場へ出店準備 / 交通量 ${finite(pref.traffic,1).toFixed(2)} / 投資額 ${cost}`,status:'pending',applied:false,appliedWeek:null,operationID:`op-${week}-${company.competitorID}-marketEntry-${pref.id}`,entryLifecycleApplied:false};
 state.competitorActions.push(action);
 company.actionHistory=(company.actionHistory||[]).concat([JSON.parse(JSON.stringify(action))]).slice(-20);
 company.lastEntryDecisionWeek=week;
 competitor.migrateProjectsFromActions(state);
 return action;
}
function completeEntryActions(state){
 for(const action of state.competitorActions||[]){
  if(action.actionType!=='marketEntry'||!action.applied||action.entryLifecycleApplied)continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID),presence=company&&(company.marketPresence||[]).find(row=>row.presenceID===action.presenceID);
  if(!presence){action.entryLifecycleApplied=true;continue;}
  if(action.status==='skipped'){
   Object.assign(presence,{active:false,entryStatus:'failed',expectedOpenWeek:null,entryFailureReason:'insufficient-cash',storeCount:0,capacityPerStore:0,totalCapacity:0,lastUpdatedWeek:finite(state.week)});
  }else{
   const stores=Math.max(1,Math.floor(finite(presence.plannedStoreCount,1))),capacity=Math.max(1,finite(presence.plannedCapacity,action.newValue));
   Object.assign(presence,{active:true,entryStatus:'active',entryWeek:finite(action.appliedWeek,state.week),expectedOpenWeek:null,entryFailureReason:'',storeCount:stores,totalCapacity:capacity,capacityPerStore:Math.ceil(capacity/stores),lastUpdatedWeek:finite(state.week)});
   if(company.status==='active'||company.status==='defending')company.status='growing';
   if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
   state.competitorEvents.push({week:finite(state.week),competitorID:company.competitorID,presenceID:presence.presenceID,type:'marketEntry',prefID:presence.prefID,text:`${company.name}が${(state.prefs||[]).find(row=>row.id===presence.prefID)?.name||presence.prefID}市場へ参入`});
   state.competitorEvents=state.competitorEvents.slice(-160);
  }
  action.entryLifecycleApplied=true;
 }
}
function maybeScheduleEntries(state){
 const week=Math.max(0,Math.floor(finite(state.week)));
 if(week<26||week%13!==0)return [];
 const actions=[];
 for(const company of state.competitorStates||[]){
  if(!company.active||!['active','growing'].includes(company.status)||activePresenceCount(company)>=MAX_PRESENCES_PER_COMPETITOR||week-finite(company.lastEntryDecisionWeek)<26)continue;
  if((state.competitorActions||[]).some(action=>action.competitorID===company.competitorID&&action.actionType==='marketEntry'&&!action.applied))continue;
  const candidate=evaluateEntryCandidates(state,company)[0];
  if(!candidate)continue;
  const buffer=(finite(company.weeklyFixedCost)+finite(company.weeklyCapacityCost)+200000)*strategy(company).cashBufferWeeks;
  if(candidate.score<strategy(company).entryThreshold||finite(company.cash)<candidate.cost+buffer)continue;
  const action=scheduleMarketEntry(state,company,candidate.prefID,`市場魅力度 ${candidate.score.toFixed(2)} / 既存${activePresenceCount(company)}市場 / ${strategy(company).name}戦略`);
  if(action)actions.push(action);
 }
 return actions;
}
function validateEntries(state){
 const errors=[],valid=new Set(ENTRY_STATUSES);
 for(const company of state.competitorStates||[]){
  const activePrefs=new Set();
  for(const presence of company.marketPresence||[]){
   if(!valid.has(presence.entryStatus))errors.push('entryStatus不正');
   if(presence.active){if(activePrefs.has(presence.prefID))errors.push('競合の同一市場重複参入');activePrefs.add(presence.prefID);if(presence.storeCount<1||presence.totalCapacity<=0)errors.push('参入済み市場の能力不正');}
   if((presence.entryStatus==='planned'||presence.entryStatus==='opening')&&presence.active)errors.push('開業前市場がactive');
   for(const key of ['plannedStoreCount','plannedCapacity'])if(!Number.isFinite(Number(presence[key])))errors.push(`entry.${key}非有限`);
  }
 }
 for(const action of state.competitorActions||[]){
  if(action.actionType!=='marketEntry')continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID),presence=company&&(company.marketPresence||[]).find(row=>row.presenceID===action.presenceID);
  if(!presence)errors.push('marketEntry市場参照不正');
  if(finite(action.effectiveWeek)<finite(action.decisionWeek))errors.push('marketEntry期間不正');
  if(action.applied&&action.status!=='skipped'&&!presence?.active)errors.push('marketEntry完了未反映');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureEntryState(state);completeEntryActions(state);return state;};
competitor.processWeek=function(state){ensureEntryState(state);const result=baseProcessWeek(state);completeEntryActions(state);maybeScheduleEntries(state);competitor.migrateProjectsFromActions(state);ensureEntryState(state);return result;};
competitor.validate=function(state){baseValidate(state);validateEntries(state);return true;};
Object.assign(competitor,{ENTRY_LEAD_WEEKS,MAX_PRESENCES_PER_COMPETITOR,ENTRY_STATUSES,evaluateEntryCandidates,scheduleMarketEntry,maybeScheduleEntries,validateEntries,__entryInstalled:true});
})();
