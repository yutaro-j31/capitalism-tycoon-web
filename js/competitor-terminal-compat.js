// Phase 5B-4 compatibility: keep terminal competitors, lifecycle events, and linked projects consistent.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-terminal-compat.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-terminal-compat.js.');
if(!modules.competitor?.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-terminal-compat.js.');
if(modules.competitor.__terminalCompatInstalled)throw new Error('competitor terminal compatibility is already installed.');

const competitor=modules.competitor;
const TERMINAL_STATUSES=new Set(['inactive','bankrupt']);
const MAX_EVENTS=160;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));

function eventKey(event){
 if(typeof event==='string')return `string:${event}`;
 if(!event||typeof event!=='object')return null;
 if(event.operationID)return `operation:${event.operationID}`;
 return `event:${integer(event.week)}:${String(event.competitorID||'')}:${String(event.type||'')}:${String(event.text||event.message||'')}`;
}
function preserveCompetitorEvents(before,current){
 const rows=[],seen=new Set();
 for(const event of [...(Array.isArray(before)?before:[]),...(Array.isArray(current)?current:[])]){
  const key=eventKey(event);if(!key||seen.has(key))continue;
  seen.add(key);rows.push(event);
 }
 return rows.slice(-MAX_EVENTS);
}
function terminalStatus(company){
 const status=String(company?.lifecycleStatus||company?.status||'');
 return TERMINAL_STATUSES.has(status)?status:null;
}
function archiveLegacyCompetitor(state,company){
 const status=terminalStatus(company);
 if(!status||!company?.legacyCompetitorID)return null;
 const legacy=(state.competitors||[]).find(row=>row&&row.id===company.legacyCompetitorID);
 if(!legacy)return null;
 if(!legacy.archivedAreaID&&legacy.areaID!==`__${status}__`)legacy.archivedAreaID=legacy.areaID||null;
 legacy.areaID=`__${status}__`;
 legacy.stores=0;
 legacy.lifecycleStatus=status;
 legacy.terminalWeek=integer(company.bankruptcyWeek??company.lastLifecycleEvaluationWeek,state.week);
 return legacy;
}
function syncProjectFailureReasons(state){
 const projects=Array.isArray(state.competitorProjects)?state.competitorProjects:[];
 for(const action of state.competitorActions||[]){
  const lifecycleReason=action?.lifecycleFailureReason||action?.cancellationReason;
  if(!lifecycleReason||!action.applied||action.status!=='skipped')continue;
  const operationID=String(action.operationID||action.actionID||'');
  const project=projects.find(row=>row&&(row.operationID===operationID||row.actionID===action.actionID));
  if(!project)continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);
  project.status='failed';
  project.completedWeek=integer(action.appliedWeek,state.week);
  project.spentCost=0;
  project.failureReason=terminalStatus(company)==='bankrupt'?'bankruptcy':String(lifecycleReason);
 }
 return projects;
}
function applyTerminalCompatibility(state,beforeEvents=[]){
 state.competitorEvents=preserveCompetitorEvents(beforeEvents,state.competitorEvents);
 for(const company of state.competitorStates||[])archiveLegacyCompetitor(state,company);
 syncProjectFailureReasons(state);
 return state;
}
function validateTerminalCompatibility(state){
 const errors=[];
 for(const company of state.competitorStates||[]){
  const status=terminalStatus(company);if(!status||!company.legacyCompetitorID)continue;
  const legacy=(state.competitors||[]).find(row=>row&&row.id===company.legacyCompetitorID);
  if(legacy&&(legacy.areaID!==`__${status}__`||legacy.lifecycleStatus!==status||finite(legacy.stores)!==0))errors.push('terminal旧競合の市場退役不整合');
 }
 for(const action of state.competitorActions||[]){
  const lifecycleReason=action?.lifecycleFailureReason||action?.cancellationReason;
  if(!lifecycleReason||!action.applied||action.status!=='skipped')continue;
  const operationID=String(action.operationID||action.actionID||'');
  const project=(state.competitorProjects||[]).find(row=>row&&(row.operationID===operationID||row.actionID===action.actionID));
  if(!project)continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);
  const expected=terminalStatus(company)==='bankrupt'?'bankruptcy':String(lifecycleReason);
  if(project.status!=='failed'||finite(project.spentCost)!==0||project.failureReason!==expected)errors.push('lifecycle取消理由のproject伝播不整合');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseProcessDistressWeek=competitor.processDistressWeek;
const baseDeclareBankruptcy=competitor.declareBankruptcy;
const baseValidate=competitor.validate;
competitor.ensure=function(state){const before=(state?.competitorEvents||[]).slice();const result=baseEnsure(state);applyTerminalCompatibility(state,before);return result;};
competitor.processWeek=function(state){const before=(state?.competitorEvents||[]).slice();const result=baseProcessWeek(state);applyTerminalCompatibility(state,before);return result;};
competitor.processDistressWeek=function(state){const before=(state?.competitorEvents||[]).slice();const result=baseProcessDistressWeek(state);applyTerminalCompatibility(state,before);return result;};
competitor.declareBankruptcy=function(state,company,reason){const before=(state?.competitorEvents||[]).slice();const result=baseDeclareBankruptcy(state,company,reason);applyTerminalCompatibility(state,before);return result;};
competitor.validate=function(state){baseValidate(state);validateTerminalCompatibility(state);return true;};
Object.assign(competitor,{TERMINAL_STATUSES,preserveCompetitorEvents,archiveLegacyCompetitor,syncProjectFailureReasons,applyTerminalCompatibility,validateTerminalCompatibility,__terminalCompatInstalled:true});
})();

// Phase 8A-1: strategic competitor memory and market-share response planning.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor strategic AI.');
const competitor=modules.competitor;
if(!competitor?.__terminalCompatInstalled)throw new Error('competitor-terminal-compat.js must install before competitor strategic AI.');
if(modules.competitorStrategicAI)throw new Error('competitor strategic AI is already installed.');

const SCHEMA_VERSION=1;
const MAX_MARKET_HISTORY=104;
const MAX_PLAN_HISTORY=52;
const PLAN_CADENCE_WEEKS=8;
const STANCES=Object.freeze({attack:'攻勢',defend:'防衛',expand:'能力増強',harvest:'採算重視',turnaround:'再建',hold:'維持'});
const PROFILES=Object.freeze({low_price:{targetShare:.24,aggression:.84,adaptability:.72},quality:{targetShare:.18,aggression:.56,adaptability:.76},brand:{targetShare:.20,aggression:.68,adaptability:.80},convenience:{targetShare:.22,aggression:.74,adaptability:.70},balanced:{targetShare:.20,aggression:.64,adaptability:.68}});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const copy=value=>JSON.parse(JSON.stringify(value));
const marketKey=(businessID,prefID)=>`${businessID}::${prefID}`;
const profileFor=company=>PROFILES[company?.strategyID]||PROFILES.balanced;
const strategicBaseEnsure=competitor.ensure;
const strategicBaseReceiveMarketResults=competitor.receiveMarketResults;
const strategicBaseProcessWeek=competitor.processWeek;
const strategicBaseValidate=competitor.validate;

function cleanPlanHistory(value){return(Array.isArray(value)?value:[]).filter(row=>plain(row)&&Number.isFinite(Number(row.week))).map(row=>({...row,week:finite(row.week),score:finite(row.score),ownShare:clamp(row.ownShare,0,1),playerShare:clamp(row.playerShare,0,1)})).sort((a,b)=>a.week-b.week).slice(-MAX_PLAN_HISTORY);}
function ensureCompany(company){
 const profile=profileFor(company),ai=plain(company.strategicAI)?company.strategicAI:{};
 ai.schemaVersion=SCHEMA_VERSION;ai.marketShareGoal=clamp(finite(ai.marketShareGoal,profile.targetShare),.05,.60);ai.aggression=clamp(finite(ai.aggression,profile.aggression),0,1);ai.adaptability=clamp(finite(ai.adaptability,profile.adaptability),0,1);ai.stance=Object.prototype.hasOwnProperty.call(STANCES,ai.stance)?ai.stance:'hold';ai.targetMarketKey=typeof ai.targetMarketKey==='string'?ai.targetMarketKey:'';ai.targetPresenceID=typeof ai.targetPresenceID==='string'?ai.targetPresenceID:'';ai.lastPlanWeek=Math.max(0,Math.floor(finite(ai.lastPlanWeek,0)));ai.threatScore=Math.max(0,finite(ai.threatScore,0));ai.opportunityScore=Math.max(0,finite(ai.opportunityScore,0));ai.marketSignals=plain(ai.marketSignals)?ai.marketSignals:{};ai.planHistory=cleanPlanHistory(ai.planHistory);company.strategicAI=ai;return ai;
}
function ensure(state){
 strategicBaseEnsure(state);const root=plain(state.competitorStrategicAI)?state.competitorStrategicAI:{};root.schemaVersion=SCHEMA_VERSION;root.marketHistoryByKey=plain(root.marketHistoryByKey)?root.marketHistoryByKey:{};root.lastCaptureWeek=Math.max(0,Math.floor(finite(root.lastCaptureWeek,0)));state.competitorStrategicAI=root;for(const company of state.competitorStates||[])ensureCompany(company);return root;
}
function pushMarketHistory(root,key,row){const current=(Array.isArray(root.marketHistoryByKey[key])?root.marketHistoryByKey[key]:[]).filter(item=>finite(item.week,-1)!==finite(row.week,-1));current.push(row);root.marketHistoryByKey[key]=current.sort((a,b)=>finite(a.week)-finite(b.week)).slice(-MAX_MARKET_HISTORY);}
function aggregateCompetitors(market){
 const rows={};for(const result of Object.values(market?.competitorResults||{})){const id=String(result?.competitorID||'');if(!id)continue;const row=rows[id]||(rows[id]={competitorID:id,name:result.name||id,share:0,potentialDemand:0,fulfilledUnits:0,lostDemand:0,revenue:0,contributionMargin:0,storeCount:0});row.share+=clamp(finite(result.realizedMarketShare,result.marketShare),0,1);row.potentialDemand+=Math.max(0,finite(result.potentialDemand));row.fulfilledUnits+=Math.max(0,finite(result.fulfilledUnits));row.lostDemand+=Math.max(0,finite(result.lostDemand));row.revenue+=Math.max(0,finite(result.revenue));row.contributionMargin+=finite(result.contributionMargin);row.storeCount+=Math.max(0,Math.floor(finite(result.storeCount,1)));}return rows;
}
function playerAveragePrice(market){const rows=Object.values(market?.stores||{}),units=rows.reduce((sum,row)=>sum+Math.max(0,finite(row.unitsSold)),0);if(units>0)return rows.reduce((sum,row)=>sum+finite(row.price)*Math.max(0,finite(row.unitsSold)),0)/units;return rows.reduce((sum,row)=>sum+finite(row.price),0)/Math.max(1,rows.length);}
function captureMarketResults(state,batch){
 const root=ensure(state),week=Math.max(0,Math.floor(finite(state.week,0)));for(const market of Object.values(batch?.byMarket||{})){const key=market.marketKey||marketKey(market.businessID,market.prefID),previous=(root.marketHistoryByKey[key]||[]).slice(-1)[0]||null,playerShare=clamp(finite(market.ownMarketShare),0,1),competitors=aggregateCompetitors(market),competitorShares={};let leaderID='player',leaderShare=playerShare,hhi=playerShare*playerShare;for(const id of Object.keys(competitors).sort()){const share=clamp(competitors[id].share,0,1);competitorShares[id]=share;hhi+=share*share;if(share>leaderShare){leaderID=id;leaderShare=share;}}const row={week,marketKey:key,businessID:market.businessID,prefID:market.prefID,marketPotential:Math.max(0,finite(market.marketPotential)),playerShare,playerShareChange:playerShare-clamp(finite(previous?.playerShare),0,1),playerAveragePrice:Math.max(0,finite(playerAveragePrice(market))),leaderID,leaderShare:clamp(leaderShare,0,1),hhi:clamp(hhi,0,1),competitorShares};pushMarketHistory(root,key,row);for(const company of state.competitorStates||[]){const summary=competitors[company.competitorID];if(!summary)continue;const ai=ensureCompany(company),ownShare=clamp(summary.share,0,1),previousOwn=clamp(finite(previous?.competitorShares?.[company.competitorID]),0,1),demand=Math.max(0,summary.fulfilledUnits+summary.lostDemand);ai.marketSignals[key]={week,marketKey:key,businessID:market.businessID,prefID:market.prefID,ownShare,ownShareChange:ownShare-previousOwn,playerShare,playerShareChange:row.playerShareChange,gapToPlayer:playerShare-ownShare,leaderShare:row.leaderShare,hhi:row.hhi,marketPotential:row.marketPotential,playerAveragePrice:row.playerAveragePrice,lostDemandRate:demand>0?summary.lostDemand/demand:0,capacityUtilization:demand>0?summary.fulfilledUnits/Math.max(1,demand):0,contributionMarginRate:summary.revenue>0?summary.contributionMargin/summary.revenue:0};}}
 root.lastCaptureWeek=week;return root;
}
function targetCandidate(company,presence){
 const ai=ensureCompany(company),key=marketKey(presence.businessID,presence.prefID),signal=ai.marketSignals[key];if(!signal)return null;const shareGap=Math.max(0,ai.marketShareGoal-signal.ownShare),playerThreat=Math.max(0,signal.gapToPlayer),playerMomentum=Math.max(0,signal.playerShareChange-signal.ownShareChange),capacityPressure=Math.max(0,signal.lostDemandRate-.04)+Math.max(0,signal.capacityUtilization-.82),marginPenalty=Math.max(0,.12-signal.contributionMarginRate),opportunityScore=shareGap*60+playerThreat*45+playerMomentum*55+capacityPressure*24+Math.max(0,signal.marketPotential/5000)*2,threatScore=playerThreat*55+playerMomentum*70+marginPenalty*25+Math.max(0,-signal.ownShareChange)*40;return{company,presence,signal,key,score:opportunityScore+threatScore*.55,opportunityScore,threatScore};
}
function selectTarget(company){return(company.marketPresence||[]).filter(p=>p.active&&p.totalCapacity>0).map(p=>targetCandidate(company,p)).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.presence.presenceID).localeCompare(String(b.presence.presenceID)))[0]||null;}
function stanceFor(company,target){const ai=ensureCompany(company),signal=target.signal;if(company.status==='distressed'||company.status==='turnaround'||company.distressWeeks>=6)return'turnaround';if(signal.lostDemandRate>=.10||signal.capacityUtilization>=.90)return'expand';if(signal.contributionMarginRate<.06&&signal.ownShare<ai.marketShareGoal*.65)return'harvest';if(signal.gapToPlayer>=.03||signal.ownShare<ai.marketShareGoal*.78)return'attack';if(signal.playerShareChange>=.015||signal.ownShareChange<=-.015)return'defend';return'hold';}
function actionSpec(company,presence,signal,stance){
 const ai=ensureCompany(company),strategy=company.strategyID||'balanced',baseCost=Math.max(1,finite(company.baseUnitCost,300));const capacity=()=>({type:'capacityExpansion',newValue:Math.max(presence.totalCapacity+1,Math.round(presence.totalCapacity*(1.10+ai.aggression*.08))),cost:Math.round(450000+ai.aggression*450000)}),brand=()=>({type:'brandInvestment',newValue:clamp(presence.brandAwareness+2.5+ai.adaptability*3.5,0,100),cost:Math.round(220000+ai.aggression*260000)}),quality=()=>({type:'qualityInvestment',newValue:clamp(presence.quality+2+ai.adaptability*3,0,100),cost:Math.round(360000+ai.aggression*340000)}),priceDown=()=>{const cut=.025+ai.aggression*.035+Math.max(0,signal.playerShareChange)*.25;return{type:'priceDecrease',newValue:Math.max(Math.round(baseCost*1.10),Math.round(presence.price*(1-clamp(cut,.02,.08)))),cost:0};};if(stance==='expand')return capacity();if(stance==='harvest')return{type:'priceIncrease',newValue:Math.max(presence.price+1,Math.round(presence.price*(1.035+ai.aggression*.02))),cost:0};if(stance==='attack'||stance==='defend'){if(strategy==='low_price')return priceDown();if(strategy==='quality')return quality();if(strategy==='brand')return brand();if(strategy==='convenience')return capacity();if(signal.playerAveragePrice>0&&presence.price>signal.playerAveragePrice*1.04)return priceDown();if(presence.brandAwareness<presence.quality)return brand();return quality();}return null;
}
function queueAction(state,company,target,stance,spec){
 if(!spec)return null;const ai=ensureCompany(company),presence=target.presence,operationID=`strategic-${state.week}-${company.competitorID}-${presence.presenceID}-${spec.type}`;if((state.competitorActions||[]).some(action=>action.operationID===operationID))return null;if(spec.cost>0&&finite(company.cash)<spec.cost*1.1)return null;const action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:company.competitorID,presenceID:presence.presenceID,decisionWeek:state.week,effectiveWeek:state.week+1,actionType:spec.type,targetBusinessID:presence.businessID,targetPrefID:presence.prefID,previousValue:spec.type.startsWith('price')?presence.price:null,newValue:spec.newValue,cost:finite(spec.cost),reasonCodes:['strategicAI','marketShare',stance],reasonText:`${STANCES[stance]}: 自社シェア ${(target.signal.ownShare*100).toFixed(1)}%、プレイヤー ${(target.signal.playerShare*100).toFixed(1)}%、目標 ${(ai.marketShareGoal*100).toFixed(1)}%`,status:'pending',applied:false,appliedWeek:null,operationID,strategicAI:true,strategyStance:stance,marketKey:target.key,targetShare:ai.marketShareGoal};state.competitorActions.push(action);company.actionHistory=(Array.isArray(company.actionHistory)?company.actionHistory:[]).concat([copy(action)]).slice(-20);company.lastDecisionWeek=state.week;company.decisionCooldownWeeks=Math.max(3,finite(company.decisionCooldownWeeks));return action;
}
function planWeek(state){
 ensure(state);const week=Math.max(0,Math.floor(finite(state.week,0)));for(const company of state.competitorStates||[]){if(!company.active||company.status==='bankrupt'||company.status==='inactive')continue;const ai=ensureCompany(company),target=selectTarget(company);if(!target)continue;const stance=stanceFor(company,target);ai.stance=stance;ai.targetMarketKey=target.key;ai.targetPresenceID=target.presence.presenceID;ai.threatScore=finite(target.threatScore);ai.opportunityScore=finite(target.opportunityScore);const emergency=target.signal.playerShareChange>=.03||target.signal.ownShareChange<=-.03,due=week>=ai.lastPlanWeek+(emergency?4:PLAN_CADENCE_WEEKS);if(!due)continue;const pending=(state.competitorActions||[]).some(action=>action.competitorID===company.competitorID&&!action.applied&&action.status==='pending'),spec=pending?null:actionSpec(company,target.presence,target.signal,stance),action=pending?null:queueAction(state,company,target,stance,spec);ai.lastPlanWeek=week;ai.planHistory=cleanPlanHistory(ai.planHistory.concat([{week,marketKey:target.key,presenceID:target.presence.presenceID,stance,score:target.score,threatScore:target.threatScore,opportunityScore:target.opportunityScore,ownShare:target.signal.ownShare,playerShare:target.signal.playerShare,actionType:action?.actionType||null,operationID:action?.operationID||null}]));}return state;
}
function validateStrategic(state){
 const root=state.competitorStrategicAI;if(root!==undefined&&!plain(root))throw new Error('competitorStrategicAI不正');for(const[key,rows]of Object.entries(root?.marketHistoryByKey||{})){if(!Array.isArray(rows)||rows.length>MAX_MARKET_HISTORY)throw new Error(`市場シェア履歴不正: ${key}`);const weeks=new Set();for(const row of rows){if(!Number.isFinite(Number(row.week)))throw new Error(`市場シェア履歴週不正: ${key}`);if(weeks.has(row.week))throw new Error(`市場シェア履歴週重複: ${key}`);weeks.add(row.week);for(const value of[row.playerShare,row.playerShareChange,row.leaderShare,row.hhi,row.marketPotential,row.playerAveragePrice])if(!Number.isFinite(Number(value)))throw new Error(`市場シェア履歴数値不正: ${key}`);}}for(const company of state.competitorStates||[]){const ai=company.strategicAI;if(ai===undefined)continue;if(!plain(ai)||!Array.isArray(ai.planHistory)||ai.planHistory.length>MAX_PLAN_HISTORY)throw new Error('競合戦略AI不正');for(const value of[ai.marketShareGoal,ai.aggression,ai.adaptability,ai.threatScore,ai.opportunityScore,ai.lastPlanWeek])if(!Number.isFinite(Number(value)))throw new Error('競合戦略AI数値不正');if(ai.marketShareGoal<0||ai.marketShareGoal>1)throw new Error('競合目標シェア不正');}return true;
}
competitor.ensure=function(state){return ensure(state);};
competitor.receiveMarketResults=function(state,batch){const result=strategicBaseReceiveMarketResults(state,batch);captureMarketResults(state,batch);return result;};
competitor.processWeek=function(state){const result=strategicBaseProcessWeek(state);planWeek(state);return result;};
competitor.validate=function(state){strategicBaseValidate(state);validateStrategic(state);return true;};
competitor.__strategicAIInstalled=true;
Object.assign(modules.competitorStrategicAI={},{SCHEMA_VERSION,MAX_MARKET_HISTORY,MAX_PLAN_HISTORY,PLAN_CADENCE_WEEKS,STANCES,PROFILES,ensure,captureMarketResults,selectTarget,stanceFor,planWeek,validate:validateStrategic,__installed:true});
})();
