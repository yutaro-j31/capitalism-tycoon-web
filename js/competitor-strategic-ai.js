// Phase 8A-2: persistent market-share memory and strategic competitor planning.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-strategic-ai.js.');
const competitor=modules.competitor;
if(!competitor?.__projectsInstalled)throw new Error('competitor-projects.js must load before competitor-strategic-ai.js.');
if(!competitor?.__rivalryInstalled)throw new Error('competitor rivalry must load before competitor-strategic-ai.js.');
if(modules.competitorStrategicAI)throw new Error('competitor strategic AI is already installed.');

const SCHEMA_VERSION=1;
const MAX_MARKET_HISTORY=104;
const MAX_PLAN_HISTORY=52;
const PLAN_CADENCE_WEEKS=8;
const EMERGENCY_CADENCE_WEEKS=4;
const STANCES=Object.freeze({attack:'攻勢',defend:'防衛',expand:'能力増強',harvest:'採算重視',turnaround:'再建',hold:'維持'});
const PROFILES=Object.freeze({
 low_price:{targetShare:.24,aggression:.84,adaptability:.72},
 quality:{targetShare:.18,aggression:.56,adaptability:.76},
 brand:{targetShare:.20,aggression:.68,adaptability:.80},
 convenience:{targetShare:.22,aggression:.74,adaptability:.70},
 balanced:{targetShare:.20,aggression:.64,adaptability:.68}
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const clone=value=>JSON.parse(JSON.stringify(value));
const marketKey=(businessID,prefID)=>`${businessID}::${prefID}`;
const profileFor=company=>PROFILES[company?.strategyID]||PROFILES.balanced;
const baseEnsure=competitor.ensure;
const baseReceiveMarketResults=competitor.receiveMarketResults;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;

function normalizePlanHistory(value){
 return (Array.isArray(value)?value:[])
  .filter(row=>plain(row)&&Number.isFinite(Number(row.week)))
  .map(row=>({...row,week:Math.max(0,Math.floor(finite(row.week))),score:finite(row.score),ownShare:clamp(row.ownShare,0,1),playerShare:clamp(row.playerShare,0,1)}))
  .sort((a,b)=>a.week-b.week)
  .slice(-MAX_PLAN_HISTORY);
}
function ensureCompany(company){
 const profile=profileFor(company),current=plain(company.marketStrategy)?company.marketStrategy:{};
 current.schemaVersion=SCHEMA_VERSION;
 current.targetShare=clamp(finite(current.targetShare,profile.targetShare),.05,.60);
 current.aggression=clamp(finite(current.aggression,profile.aggression),0,1);
 current.adaptability=clamp(finite(current.adaptability,profile.adaptability),0,1);
 current.stance=Object.prototype.hasOwnProperty.call(STANCES,current.stance)?current.stance:'hold';
 current.targetMarketKey=typeof current.targetMarketKey==='string'?current.targetMarketKey:'';
 current.targetPresenceID=typeof current.targetPresenceID==='string'?current.targetPresenceID:'';
 current.lastPlanWeek=Math.max(0,Math.floor(finite(current.lastPlanWeek)));
 current.threatScore=Math.max(0,finite(current.threatScore));
 current.opportunityScore=Math.max(0,finite(current.opportunityScore));
 current.signals=plain(current.signals)?current.signals:{};
 current.planHistory=normalizePlanHistory(current.planHistory);
 company.marketStrategy=current;
 return current;
}
function ensure(state){
 baseEnsure(state);
 const root=plain(state.competitorMarketStrategy)?state.competitorMarketStrategy:{};
 root.schemaVersion=SCHEMA_VERSION;
 root.marketHistoryByKey=plain(root.marketHistoryByKey)?root.marketHistoryByKey:{};
 root.lastCaptureWeek=Math.max(0,Math.floor(finite(root.lastCaptureWeek)));
 state.competitorMarketStrategy=root;
 for(const company of state.competitorStates||[])ensureCompany(company);
 return root;
}
function pushMarketHistory(root,key,row){
 const rows=(Array.isArray(root.marketHistoryByKey[key])?root.marketHistoryByKey[key]:[]).filter(item=>finite(item.week,-1)!==row.week);
 rows.push(row);
 root.marketHistoryByKey[key]=rows.sort((a,b)=>finite(a.week)-finite(b.week)).slice(-MAX_MARKET_HISTORY);
}
function playerAveragePrice(market){
 const rows=Object.values(market?.stores||{}),units=rows.reduce((sum,row)=>sum+Math.max(0,finite(row.unitsSold)),0);
 if(units>0)return rows.reduce((sum,row)=>sum+Math.max(0,finite(row.price))*Math.max(0,finite(row.unitsSold)),0)/units;
 return rows.reduce((sum,row)=>sum+Math.max(0,finite(row.price)),0)/Math.max(1,rows.length);
}
function companyMarketSummary(company,market){
 const key=market.marketKey||marketKey(market.businessID,market.prefID);
 const presences=(company.marketPresence||[]).filter(row=>row&&row.active&&marketKey(row.businessID,row.prefID)===key);
 const results=Object.values(market.competitorResults||{}).filter(row=>row?.competitorID===company.competitorID);
 const ownShare=presences.length?presences.reduce((sum,row)=>sum+clamp(row.currentWeekShare,0,1),0):results.reduce((sum,row)=>sum+clamp(row.realizedMarketShare??row.marketShare,0,1),0);
 const fulfilled=results.reduce((sum,row)=>sum+Math.max(0,finite(row.fulfilledUnits)),0);
 const lostDemand=results.reduce((sum,row)=>sum+Math.max(0,finite(row.lostDemand)),0);
 const revenue=results.reduce((sum,row)=>sum+Math.max(0,finite(row.revenue)),0);
 const margin=results.reduce((sum,row)=>sum+finite(row.contributionMargin),0);
 const capacity=presences.reduce((sum,row)=>sum+Math.max(0,finite(row.totalCapacity)),0);
 return {presences,ownShare:clamp(ownShare,0,1),fulfilled,lostDemand,revenue,margin,capacity};
}
function captureMarketResults(state,batch){
 const root=ensure(state),week=Math.max(0,Math.floor(finite(state.week)));
 for(const market of Object.values(batch?.byMarket||{})){
  if(!market||!market.businessID||!market.prefID)continue;
  const key=market.marketKey||marketKey(market.businessID,market.prefID),previous=(root.marketHistoryByKey[key]||[]).slice(-1)[0]||null;
  const playerShare=clamp(market.ownMarketShare,0,1),competitorShares={},summaries={};
  let leaderID='player',leaderShare=playerShare,hhi=playerShare*playerShare;
  for(const company of state.competitorStates||[]){
   const summary=companyMarketSummary(company,market);
   if(!summary.presences.length&&!Object.values(market.competitorResults||{}).some(row=>row?.competitorID===company.competitorID))continue;
   summaries[company.competitorID]=summary;
   competitorShares[company.competitorID]=summary.ownShare;
   hhi+=summary.ownShare*summary.ownShare;
   if(summary.ownShare>leaderShare){leaderID=company.competitorID;leaderShare=summary.ownShare;}
  }
  const row={
   week,marketKey:key,businessID:market.businessID,prefID:market.prefID,
   marketPotential:Math.max(0,finite(market.marketPotential)),playerShare,
   playerShareChange:previous?playerShare-clamp(previous.playerShare,0,1):0,
   playerAveragePrice:Math.max(0,finite(playerAveragePrice(market))),leaderID,
   leaderShare:clamp(leaderShare,0,1),hhi:clamp(hhi,0,1),competitorShares
  };
  pushMarketHistory(root,key,row);
  for(const company of state.competitorStates||[]){
   const summary=summaries[company.competitorID];if(!summary)continue;
   const strategy=ensureCompany(company),previousOwn=previous?clamp(previous.competitorShares?.[company.competitorID],0,1):summary.ownShare;
   const demand=Math.max(0,summary.fulfilled+summary.lostDemand);
   strategy.signals[key]={
    week,marketKey:key,businessID:market.businessID,prefID:market.prefID,
    ownShare:summary.ownShare,ownShareChange:summary.ownShare-previousOwn,
    playerShare,playerShareChange:row.playerShareChange,gapToPlayer:playerShare-summary.ownShare,
    leaderShare:row.leaderShare,hhi:row.hhi,marketPotential:row.marketPotential,
    playerAveragePrice:row.playerAveragePrice,
    lostDemandRate:demand>0?clamp(summary.lostDemand/demand,0,1):0,
    capacityUtilization:summary.capacity>0?clamp(summary.fulfilled/summary.capacity,0,1):0,
    contributionMarginRate:summary.revenue>0?finite(summary.margin)/summary.revenue:0
   };
  }
 }
 root.lastCaptureWeek=week;
 return root;
}
function targetCandidate(company,presence){
 const strategy=ensureCompany(company),key=marketKey(presence.businessID,presence.prefID),signal=strategy.signals[key];
 if(!signal)return null;
 const shareGap=Math.max(0,strategy.targetShare-signal.ownShare);
 const playerThreat=Math.max(0,signal.gapToPlayer);
 const playerMomentum=Math.max(0,signal.playerShareChange-signal.ownShareChange);
 const capacityPressure=Math.max(0,signal.lostDemandRate-.04)+Math.max(0,signal.capacityUtilization-.82);
 const marginPenalty=Math.max(0,.12-signal.contributionMarginRate);
 const marketScale=Math.min(10,Math.max(0,signal.marketPotential/5000));
 const opportunityScore=shareGap*60+playerThreat*45+playerMomentum*55+capacityPressure*24+marketScale*2;
 const threatScore=playerThreat*55+playerMomentum*70+marginPenalty*25+Math.max(0,-signal.ownShareChange)*40;
 return {company,presence,signal,key,score:opportunityScore+threatScore*.55,opportunityScore,threatScore};
}
function selectTarget(company){
 return (company.marketPresence||[])
  .filter(row=>row&&row.active&&finite(row.totalCapacity)>0)
  .map(row=>targetCandidate(company,row)).filter(Boolean)
  .sort((a,b)=>b.score-a.score||String(a.presence.presenceID).localeCompare(String(b.presence.presenceID)))[0]||null;
}
function stanceFor(company,target){
 const strategy=ensureCompany(company),signal=target.signal,rivalry=company.rivalry?.mode||'neutral';
 if(company.status==='distressed'||company.status==='turnaround'||finite(company.distressWeeks)>=6)return'turnaround';
 if(rivalry==='capacity_race')return'expand';
 if(rivalry==='price_war'||rivalry==='brand_defense')return'defend';
 if(signal.lostDemandRate>=.10||signal.capacityUtilization>=.90)return'expand';
 if(signal.contributionMarginRate<.06&&signal.ownShare<strategy.targetShare*.65)return'harvest';
 if(signal.gapToPlayer>=.03||signal.ownShare<strategy.targetShare*.78)return'attack';
 if(signal.playerShareChange>=.015||signal.ownShareChange<=-.015)return'defend';
 return'hold';
}
function actionSpec(company,presence,signal,stance){
 const strategy=ensureCompany(company),profile=company.strategyID||'balanced',baseCost=Math.max(1,finite(company.baseUnitCost,300));
 const capacity=()=>({actionType:'capacityExpansion',newValue:Math.max(finite(presence.totalCapacity)+1,Math.round(finite(presence.totalCapacity)*(1.10+strategy.aggression*.08))),cost:Math.round(450000+strategy.aggression*450000),delay:4});
 const brand=()=>({actionType:'brandInvestment',newValue:clamp(finite(presence.brandAwareness)+2.5+strategy.adaptability*3.5,0,100),cost:Math.round(220000+strategy.aggression*260000),delay:1});
 const quality=()=>({actionType:'qualityInvestment',newValue:clamp(finite(presence.quality)+2+strategy.adaptability*3,0,100),cost:Math.round(360000+strategy.aggression*340000),delay:2});
 const priceDown=()=>{const cut=.025+strategy.aggression*.035+Math.max(0,signal.playerShareChange)*.25;return{actionType:'priceDecrease',newValue:Math.max(Math.round(baseCost*1.10),Math.round(finite(presence.price,920)*(1-clamp(cut,.02,.08)))),cost:0,delay:1};};
 if(stance==='expand')return capacity();
 if(stance==='harvest')return{actionType:'priceIncrease',newValue:Math.max(finite(presence.price)+1,Math.round(finite(presence.price)*(1.035+strategy.aggression*.02))),cost:0,delay:1};
 if(stance==='attack'||stance==='defend'){
  if(profile==='low_price')return priceDown();
  if(profile==='quality')return quality();
  if(profile==='brand')return brand();
  if(profile==='convenience')return capacity();
  if(signal.playerAveragePrice>0&&finite(presence.price)>signal.playerAveragePrice*1.04)return priceDown();
  if(finite(presence.brandAwareness)<finite(presence.quality))return brand();
  return quality();
 }
 return null;
}
function queueAction(state,company,target,stance,spec){
 if(!spec)return null;
 const strategy=ensureCompany(company),presence=target.presence;
 const operationID=`market-strategy-${state.week}-${company.competitorID}-${presence.presenceID}-${spec.actionType}`;
 if((state.competitorActions||[]).some(action=>action?.operationID===operationID))return null;
 if((state.competitorActions||[]).some(action=>action?.competitorID===company.competitorID&&!action.applied&&action.status==='pending'))return null;
 if(spec.cost>0&&finite(company.cash)<spec.cost*1.1)return null;
 const action={
  actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:company.competitorID,presenceID:presence.presenceID,
  decisionWeek:state.week,effectiveWeek:state.week+spec.delay,actionType:spec.actionType,
  targetBusinessID:presence.businessID,targetPrefID:presence.prefID,
  previousValue:spec.actionType.indexOf('price')===0?presence.price:null,newValue:spec.newValue,cost:finite(spec.cost),
  reasonCodes:['marketStrategy','marketShare',stance],
  reasonText:`${STANCES[stance]}: 自社シェア ${(target.signal.ownShare*100).toFixed(1)}%、プレイヤー ${(target.signal.playerShare*100).toFixed(1)}%、目標 ${(strategy.targetShare*100).toFixed(1)}%`,
  status:'pending',applied:false,appliedWeek:null,operationID,marketStrategy:true,strategyStance:stance,
  marketKey:target.key,targetShare:strategy.targetShare
 };
 state.competitorActions.push(action);
 company.actionHistory=(Array.isArray(company.actionHistory)?company.actionHistory:[]).concat([clone(action)]).slice(-20);
 company.lastDecisionWeek=state.week;
 company.decisionCooldownWeeks=Math.max(3,finite(company.decisionCooldownWeeks));
 return action;
}
function planWeek(state){
 ensure(state);
 const week=Math.max(0,Math.floor(finite(state.week)));
 for(const company of state.competitorStates||[]){
  if(!company?.active||company.status==='bankrupt'||company.status==='inactive')continue;
  const strategy=ensureCompany(company),target=selectTarget(company);if(!target)continue;
  const stance=stanceFor(company,target);
  strategy.stance=stance;strategy.targetMarketKey=target.key;strategy.targetPresenceID=target.presence.presenceID;
  strategy.threatScore=finite(target.threatScore);strategy.opportunityScore=finite(target.opportunityScore);
  const emergency=target.signal.playerShareChange>=.03||target.signal.ownShareChange<=-.03;
  const cadence=emergency?EMERGENCY_CADENCE_WEEKS:PLAN_CADENCE_WEEKS;
  if(week<strategy.lastPlanWeek+cadence)continue;
  const spec=actionSpec(company,target.presence,target.signal,stance),action=queueAction(state,company,target,stance,spec);
  strategy.lastPlanWeek=week;
  strategy.planHistory=normalizePlanHistory(strategy.planHistory.concat([{
   week,marketKey:target.key,presenceID:target.presence.presenceID,stance,score:target.score,
   threatScore:target.threatScore,opportunityScore:target.opportunityScore,
   ownShare:target.signal.ownShare,playerShare:target.signal.playerShare,
   rivalryMode:company.rivalry?.mode||'neutral',actionType:action?.actionType||null,operationID:action?.operationID||null
  }]));
 }
 if(typeof competitor.migrateProjectsFromActions==='function')competitor.migrateProjectsFromActions(state);
 return state;
}
function validateStrategic(state){
 const root=state.competitorMarketStrategy;
 if(root!==undefined&&!plain(root))throw new Error('competitorMarketStrategy不正');
 for(const [key,rows] of Object.entries(root?.marketHistoryByKey||{})){
  if(!Array.isArray(rows)||rows.length>MAX_MARKET_HISTORY)throw new Error(`市場シェア履歴不正: ${key}`);
  const weeks=new Set();
  for(const row of rows){
   if(!Number.isFinite(Number(row.week)))throw new Error(`市場シェア履歴週不正: ${key}`);
   if(weeks.has(row.week))throw new Error(`市場シェア履歴週重複: ${key}`);weeks.add(row.week);
   for(const value of [row.playerShare,row.playerShareChange,row.leaderShare,row.hhi,row.marketPotential,row.playerAveragePrice])if(!Number.isFinite(Number(value)))throw new Error(`市場シェア履歴数値不正: ${key}`);
  }
 }
 for(const company of state.competitorStates||[]){
  const strategy=company.marketStrategy;if(strategy===undefined)continue;
  if(!plain(strategy)||!Array.isArray(strategy.planHistory)||strategy.planHistory.length>MAX_PLAN_HISTORY)throw new Error('競合市場戦略不正');
  for(const value of [strategy.targetShare,strategy.aggression,strategy.adaptability,strategy.threatScore,strategy.opportunityScore,strategy.lastPlanWeek])if(!Number.isFinite(Number(value)))throw new Error('競合市場戦略数値不正');
  if(strategy.targetShare<0||strategy.targetShare>1)throw new Error('競合目標シェア不正');
 }
 return true;
}

competitor.ensure=function(state){return ensure(state);};
competitor.receiveMarketResults=function(state,batch){const result=baseReceiveMarketResults(state,batch);captureMarketResults(state,batch);return result;};
competitor.processWeek=function(state){const result=baseProcessWeek(state);planWeek(state);return result;};
competitor.validate=function(state){baseValidate(state);validateStrategic(state);return true;};
competitor.__strategicAIInstalled=true;
Object.assign(modules.competitorStrategicAI={},{
 SCHEMA_VERSION,MAX_MARKET_HISTORY,MAX_PLAN_HISTORY,PLAN_CADENCE_WEEKS,EMERGENCY_CADENCE_WEEKS,
 STANCES,PROFILES,ensure,captureMarketResults,selectTarget,stanceFor,planWeek,validate:validateStrategic,__installed:true
});
})();
