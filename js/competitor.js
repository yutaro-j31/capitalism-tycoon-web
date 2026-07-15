// Script boundary: js/competitor.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor.js.');
var __modules=globalThis.__capitalismTycoonModules;if(!__modules.data)throw new Error('data.js must be loaded before competitor.js.');if(__modules.competitor)throw new Error('competitor module is already registered.');
(function(exports,data){
const MASTER=data.MASTER,TARGET='ramen',MAX_ACTIONS=160,MAX_HISTORY=104;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const STRATEGIES=Object.freeze({
 low_price:{id:'low_price',name:'低価格型',description:'低価格と稼働率を重視し、余剰能力を価格で埋める。',targetPriceIndex:.92,priceAggressiveness:.85,qualityPriority:.35,brandPriority:.35,marketingPriority:.45,capacityPriority:.55,cashBufferWeeks:6,debtTolerance:.45,entryThreshold:.62,exitThreshold:.22,turnaroundBias:.65,riskTolerance:.62},
 quality:{id:'quality',name:'品質型',description:'品質と満足度を重視し、高単価・高原価になりやすい。',targetPriceIndex:1.10,priceAggressiveness:.35,qualityPriority:.90,brandPriority:.55,marketingPriority:.50,capacityPriority:.45,cashBufferWeeks:10,debtTolerance:.35,entryThreshold:.70,exitThreshold:.18,turnaroundBias:.50,riskTolerance:.42},
 brand:{id:'brand',name:'ブランド型',description:'広告と信頼を重視し、ブランド投資が厚い。',targetPriceIndex:1.12,priceAggressiveness:.42,qualityPriority:.55,brandPriority:.90,marketingPriority:.90,capacityPriority:.42,cashBufferWeeks:9,debtTolerance:.40,entryThreshold:.67,exitThreshold:.20,turnaroundBias:.48,riskTolerance:.50},
 convenience:{id:'convenience',name:'利便性型',description:'店舗網と能力を重視し、利便性で需要を獲得する。',targetPriceIndex:1.02,priceAggressiveness:.48,qualityPriority:.45,brandPriority:.45,marketingPriority:.55,capacityPriority:.92,cashBufferWeeks:8,debtTolerance:.55,entryThreshold:.58,exitThreshold:.16,turnaroundBias:.55,riskTolerance:.66},
 balanced:{id:'balanced',name:'バランス型',description:'価格・品質・ブランド・店舗網を均衡させる。',targetPriceIndex:1.00,priceAggressiveness:.55,qualityPriority:.58,brandPriority:.58,marketingPriority:.58,capacityPriority:.58,cashBufferWeeks:8,debtTolerance:.38,entryThreshold:.65,exitThreshold:.18,turnaroundBias:.52,riskTolerance:.50}
});
function strategyID(s){if(s==='低価格型'||s==='low')return'low_price';if(s==='品質型'||s==='品質重視'||s==='quality')return'quality';if(s==='ブランド型'||s==='広告重視'||s==='brand')return'brand';if(s==='利便性型'||s==='出店攻勢'||s==='convenience')return'convenience';return'balanced';}
function prefForArea(state,areaID,seed){const prefs=(state.prefs||[]).filter(p=>p.areaID===areaID);return (prefs.length?prefs[Math.abs(hash(seed||areaID))%prefs.length]?.id:null)||state.selectedPref||'tokyo';}
function hash(s){s=String(s);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h|0;}
function legacyPrice(c,i){const b=(MASTER.businesses||[]).find(x=>x.id===c.businessID)||{};const ref=c.businessID==='ramen'?920:finite(b.price,1);const m={low_price:.90,quality:1.08,brand:1.12,convenience:1.02,balanced:1}[strategyID(c.strategy)]||1;return Math.max(1,Math.round(ref*m*(1+(i%3-1)*.025)));}
function objectMap(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function trimHistory(rows){return (Array.isArray(rows)?rows:[]).filter(x=>x&&typeof x==='object'&&Number.isFinite(Number(x.week))).sort((a,b)=>finite(a.week)-finite(b.week)).slice(-MAX_HISTORY);}
function sanitizeHistoryMap(map){for(const id of Object.keys(map))map[id]=trimHistory(map[id]);return map;}
function ensure(state){
 if(!Array.isArray(state.competitorStates))state.competitorStates=[];
 if(!Array.isArray(state.competitorActions))state.competitorActions=[];
 state.competitorMarketResultsByPresenceID=objectMap(state.competitorMarketResultsByPresenceID);
 state.competitorMarketResultsByCompetitorID=objectMap(state.competitorMarketResultsByCompetitorID);
 state.competitorPerformanceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPerformanceHistoryByID));
 state.competitorPresenceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPresenceHistoryByID));
 state.nextCompetitorStateSeq=Math.max(1,Math.floor(finite(state.nextCompetitorStateSeq,1)));
 state.nextCompetitorPresenceSeq=Math.max(1,Math.floor(finite(state.nextCompetitorPresenceSeq,1)));
 state.nextCompetitorActionSeq=Math.max(1,Math.floor(finite(state.nextCompetitorActionSeq,1)));
 state.nextCompetitorInvestmentSeq=Math.max(1,Math.floor(finite(state.nextCompetitorInvestmentSeq,1)));
 const legacy=(state.competitors||[]).filter(c=>c.businessID===TARGET).map(c=>c.id).sort().join('|');
 const migrated=(state.competitorStates||[]).filter(c=>c.businessID===TARGET).map(c=>c.legacyCompetitorID).sort().join('|');
 if(!state.competitorMigrationV8Applied||legacy!==migrated){state.competitorStates=(state.competitorStates||[]).filter(c=>c.businessID!==TARGET);state.competitorMigrationV8Applied=false;migrateV8(state);}
 sanitize(state);
}
function migrateV8(state){
 const existing=new Set((state.competitorStates||[]).map(x=>x.legacyCompetitorID));
 (state.competitors||[]).forEach((c,i)=>{
  if(c.businessID!==TARGET||existing.has(c.id))return;
  const sid=`cs-${state.nextCompetitorStateSeq++}`,pid=`competitor-${c.id||state.nextCompetitorPresenceSeq++}`,st=strategyID(c.strategy),prefID=prefForArea(state,c.areaID,i),price=legacyPrice(c,i),q=clamp(c.quality+({low_price:-4,quality:12,brand:4,convenience:1,balanced:4}[st]||0),0,100),br=clamp(c.brand+({low_price:-2,quality:3,brand:16,convenience:2,balanced:4}[st]||0),0,100),stores=Math.max(1,Math.floor(finite(c.stores,1)));
  state.competitorStates.push({competitorID:sid,legacyCompetitorID:c.id,name:c.name||'競合',businessID:TARGET,strategyID:st,active:true,status:'active',foundedWeek:finite(state.week,1),cash:16000000+stores*2500000,debt:0,creditScore:62,reputation:br,quality:q,brand:br,efficiency:45,dx:0,managementQuality:55,baseUnitCost:320,fixedCostPerPresence:70000,marketingBudget:0,rdBudget:0,weeklyRevenue:0,weeklyVariableCost:0,weeklyFixedCost:0,weeklyMarketingCost:0,weeklyRDCost:0,weeklyInterestCost:0,weeklyCapacityCost:0,weeklyProfit:0,accumulatedProfit:0,lastDecisionWeek:0,lastFinanceWeek:0,distressWeeks:0,profitableWeeks:0,lossWeeks:0,turnaroundWeeks:0,decisionCooldownWeeks:0,actionHistory:[],lastPresenceEvaluation:[],lastEvaluatedPresenceID:null,marketPresence:[{presenceID:pid,competitorID:sid,businessID:TARGET,prefID,areaID:c.areaID,active:true,storeCount:stores,capacityPerStore:Math.round(500+stores*25),totalCapacity:stores*Math.round(500+stores*25),price,quality:q,brandAwareness:br,convenience:clamp(55+({convenience:16,brand:2,quality:1,low_price:0,balanced:4}[st]||0)+stores*1.8,0,100),serviceQuality:clamp(50+q*.25,0,100),novelty:clamp(25+({brand:16,quality:3,low_price:-2,convenience:2,balanced:4}[st]||0),0,100),localReputation:br,marketingIntensity:0,entryWeek:finite(state.week,1),exitWeek:null,lastUpdatedWeek:finite(state.week,1),previousWeekShare:0,currentWeekShare:0,potentialDemand:0,fulfilledUnits:0,lostDemand:0,revenue:0,variableCost:0,contributionMargin:0,fixedCost:70000,profit:0}],lastKnownPlayerSignals:{},statusReason:'v8 migration from static competitor'});
 });
 state.competitorMigrationV8Applied=true;
}
function offers(state,businessID,prefID){ensure(state);if(businessID!==TARGET)return null;return state.competitorStates.filter(c=>c.businessID===TARGET&&c.active&&c.status!=='bankrupt'&&c.status!=='inactive').flatMap(c=>(c.marketPresence||[]).filter(p=>p.active&&p.businessID===businessID&&p.prefID===prefID&&p.areaID===((state.prefs||[]).find(x=>x.id===prefID)||{}).areaID&&p.totalCapacity>0).map(p=>{const last=(state.competitorActions||[]).filter(a=>a.competitorID===c.competitorID).slice(-1)[0]||null;return {id:p.presenceID,competitorID:c.competitorID,presenceID:p.presenceID,kind:'competitor',name:c.name,strategyID:c.strategyID,price:Math.max(2,Math.round(p.price)),quality:clamp(p.quality,0,100),brandAwareness:clamp(p.brandAwareness,0,100),brandTrust:clamp(p.brandAwareness*.7+p.quality*.25,0,100),convenience:clamp(p.convenience,0,100),serviceQuality:clamp(p.serviceQuality,0,100),novelty:clamp(p.novelty,0,100),customerSatisfaction:clamp(45+p.quality*.35+p.brandAwareness*.15,0,100),repeatRate:clamp(.25+p.brandAwareness/350,0,.8),capacity:Math.max(0,p.totalCapacity),variableCostPerUnit:Math.max(1,c.baseUnitCost*(1+p.quality/900)*(1-(c.efficiency-40)/500)),storeCount:p.storeCount,financialStatus:c.status,lastAction:last?last.actionType:null};}));}
function receiveMarketResults(state,batch){
 ensure(state);state.competitorMarketResultsByPresenceID={};state.competitorMarketResultsByCompetitorID={};
 for(const m of Object.values(batch?.byMarket||{})){
  for(const r of Object.values(m.competitorResults||{})){
   state.competitorMarketResultsByPresenceID[r.presenceID]=r;
   const a=state.competitorMarketResultsByCompetitorID[r.competitorID]||(state.competitorMarketResultsByCompetitorID[r.competitorID]={competitorID:r.competitorID,revenue:0,variableCost:0,fulfilledUnits:0,marketShare:0,results:[]});
   a.revenue+=r.revenue;a.variableCost+=r.variableCost;a.fulfilledUnits+=r.fulfilledUnits;a.marketShare+=r.marketShare;a.results.push(r);
   const c=state.competitorStates.find(x=>x.competitorID===r.competitorID),p=c&&(c.marketPresence||[]).find(x=>x.presenceID===r.presenceID);
   if(p)Object.assign(p,{previousWeekShare:p.currentWeekShare||0,currentWeekShare:r.realizedMarketShare,potentialDemand:r.potentialDemand,fulfilledUnits:r.fulfilledUnits,lostDemand:r.lostDemand,revenue:r.revenue,variableCost:r.variableCost,contributionMargin:r.contributionMargin,profit:r.contributionMargin-p.fixedCost,lastUpdatedWeek:state.week});
  }
 }
}
function upsertHistory(map,id,row){const week=finite(row.week);const rows=(Array.isArray(map[id])?map[id]:[]).filter(x=>finite(x.week,-1)!==week);rows.push(row);map[id]=rows.sort((a,b)=>finite(a.week)-finite(b.week)).slice(-MAX_HISTORY);}
function historyWindow(map,id,weeks,currentWeek){return (Array.isArray(map[id])?map[id]:[]).filter(x=>finite(x.week)>finite(currentWeek)-weeks&&finite(x.week)<=finite(currentWeek));}
function recordHistories(state,c){
 const active=(c.marketPresence||[]).filter(p=>p.active);
 const fulfilled=active.reduce((a,p)=>a+finite(p.fulfilledUnits),0),lost=active.reduce((a,p)=>a+finite(p.lostDemand),0),capacity=active.reduce((a,p)=>a+finite(p.totalCapacity),0),potential=active.reduce((a,p)=>a+Math.max(0,finite(p.potentialDemand)),0);
 const weightedShare=potential>0?active.reduce((a,p)=>a+clamp(p.currentWeekShare,0,1)*Math.max(0,finite(p.potentialDemand)),0)/potential:0;
 const runwayCost=finite(c.weeklyFixedCost)+finite(c.weeklyMarketingCost)+finite(c.weeklyRDCost)+finite(c.weeklyInterestCost)+finite(c.weeklyCapacityCost);
 upsertHistory(state.competitorPerformanceHistoryByID,c.competitorID,{week:finite(state.week),competitorID:c.competitorID,revenue:finite(c.weeklyRevenue),variableCost:finite(c.weeklyVariableCost),fixedCost:finite(c.weeklyFixedCost),marketingCost:finite(c.weeklyMarketingCost),rdCost:finite(c.weeklyRDCost),interestCost:finite(c.weeklyInterestCost),capacityCost:finite(c.weeklyCapacityCost),profit:finite(c.weeklyProfit),cash:finite(c.cash),debt:finite(c.debt),creditScore:clamp(c.creditScore,0,100),cashRunwayWeeks:finite(c.cash)/Math.max(1,runwayCost),marketShare:clamp(weightedShare,0,1),fulfilledUnits:fulfilled,lostDemand:lost,capacityUtilization:capacity>0?fulfilled/capacity:0,status:c.status});
 for(const p of c.marketPresence||[])upsertHistory(state.competitorPresenceHistoryByID,p.presenceID,{week:finite(state.week),competitorID:c.competitorID,presenceID:p.presenceID,active:Boolean(p.active),price:finite(p.price),marketShare:clamp(p.currentWeekShare,0,1),demandShare:clamp(p.currentWeekShare,0,1),fulfilledUnits:finite(p.fulfilledUnits),lostDemand:finite(p.lostDemand),capacityUtilization:finite(p.totalCapacity)>0?finite(p.fulfilledUnits)/finite(p.totalCapacity):0,revenue:finite(p.revenue),variableCost:finite(p.variableCost),contributionMargin:finite(p.contributionMargin),profit:finite(p.profit),storeCount:Math.max(0,Math.floor(finite(p.storeCount))),totalCapacity:Math.max(0,finite(p.totalCapacity))});
}
function evaluatePresence(state,c,p,s){
 const rows=historyWindow(state.competitorPresenceHistoryByID,p.presenceID,13,state.week),count=Math.max(1,rows.length);
 const recentProfit=rows.reduce((a,x)=>a+finite(x.profit),0),avgShare=rows.reduce((a,x)=>a+clamp(x.marketShare,0,1),0)/count,avgUtil=rows.reduce((a,x)=>a+clamp(x.capacityUtilization,0,2),0)/count;
 const util=finite(p.totalCapacity)>0?finite(p.fulfilledUnits)/finite(p.totalCapacity):0,cm=finite(p.revenue)>0?finite(p.contributionMargin)/finite(p.revenue):0,lostRate=(finite(p.fulfilledUnits)+finite(p.lostDemand))>0?finite(p.lostDemand)/(finite(p.fulfilledUnits)+finite(p.lostDemand)):0;
 const avgPrice=avgCompetitorPrice(state,p.prefID)||finite(p.price,920),targetPrice=avgPrice*s.targetPriceIndex,priceGap=Math.abs(targetPrice-finite(p.price))/Math.max(1,finite(p.price));
 const lossPressure=recentProfit<0?Math.min(2,Math.abs(recentProfit)/Math.max(1,finite(p.fixedCost)*count)):0,sharePressure=Math.max(0,s.exitThreshold-avgShare),opportunity=Math.max(0,util-.72)+lostRate+Math.max(0,cm-.2);
 const score=priceGap*35+lossPressure*22+sharePressure*32+opportunity*18+Math.max(0,avgUtil-.8)*8+(s.capacityPriority-.5)*Math.max(0,lostRate)*8;
 return {presenceID:p.presenceID,prefID:p.prefID,score:finite(score),utilization:finite(util),contributionMarginRate:finite(cm),lostDemandRate:finite(lostRate),recent13WeekProfit:finite(recentProfit),average13WeekShare:finite(avgShare),average13WeekUtilization:finite(avgUtil),targetPrice:finite(targetPrice)};
}
function evaluatePresences(state,c,strategy){const s=strategy||STRATEGIES[c.strategyID]||STRATEGIES.balanced;return (c.marketPresence||[]).filter(p=>p.active).map(p=>evaluatePresence(state,c,p,s)).sort((a,b)=>b.score-a.score||String(a.presenceID).localeCompare(String(b.presenceID)));}
function selectDecisionPresence(state,c,strategy){const evaluations=evaluatePresences(state,c,strategy);c.lastPresenceEvaluation=evaluations.map(x=>({...x}));c.lastEvaluatedPresenceID=evaluations[0]?.presenceID||null;return (c.marketPresence||[]).find(p=>p.presenceID===c.lastEvaluatedPresenceID)||null;}
function processWeek(state){
 ensure(state);applyActions(state);
 for(const c of state.competitorStates){
  if(!c.active||c.status==='bankrupt'||c.status==='inactive')continue;
  let rev=0,vc=0,fix=0,cap=0;
  for(const p of c.marketPresence||[]){if(!p.active)continue;rev+=finite(p.revenue);vc+=finite(p.variableCost);fix+=finite(p.fixedCost);cap+=finite(p.totalCapacity)*12;}
  const interest=c.debt*(.035+(100-c.creditScore)/1000)/52;
  c.weeklyRevenue=rev;c.weeklyVariableCost=vc;c.weeklyFixedCost=fix;c.weeklyMarketingCost=c.marketingBudget;c.weeklyRDCost=c.rdBudget;c.weeklyInterestCost=interest;c.weeklyCapacityCost=cap;c.weeklyProfit=rev-vc-fix-c.marketingBudget-c.rdBudget-cap-interest;c.accumulatedProfit+=c.weeklyProfit;c.cash=Math.max(0,c.cash+c.weeklyProfit);c.debt=Math.max(0,c.debt);c.lastFinanceWeek=state.week;c.profitMargin=rev>0?c.weeklyProfit/rev:0;c.lossWeeks=c.weeklyProfit<0?c.lossWeeks+1:0;c.profitableWeeks=c.weeklyProfit>=0?c.profitableWeeks+1:0;c.distressWeeks=(c.lossWeeks>=4||c.cash<fix*2)?c.distressWeeks+1:0;
  if(c.distressWeeks>=4)c.status='distressed';else if(c.weeklyProfit>0&&c.profitableWeeks>=4)c.status='growing';else if(c.lossWeeks>0)c.status='defending';
  recordHistories(state,c);decide(state,c);
 }
 state.competitorActions=state.competitorActions.slice(-MAX_ACTIONS);sanitize(state);
}
function addAction(state,c,p,type,newValue,cost,reasons,delay){const a={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:c.competitorID,presenceID:p&&p.presenceID,decisionWeek:state.week,effectiveWeek:state.week+(delay||1),actionType:type,targetBusinessID:TARGET,targetPrefID:p&&p.prefID,previousValue:type.indexOf('price')===0?p.price:null,newValue,cost:finite(cost),reasonCodes:reasons.map(x=>x.code),reasonText:reasons.map(x=>x.text).join(' / '),status:'pending',applied:false,appliedWeek:null,operationID:`op-${state.week}-${c.competitorID}-${type}`};state.competitorActions.push(a);c.actionHistory=(c.actionHistory||[]).concat([JSON.parse(JSON.stringify(a))]).slice(-20);c.lastDecisionWeek=state.week;c.decisionCooldownWeeks=4;return a;}
function decide(state,c){
 if(c.lastDecisionWeek===state.week)return;if(c.decisionCooldownWeeks>0){c.decisionCooldownWeeks--;return;}
 const s=STRATEGIES[c.strategyID]||STRATEGIES.balanced,p=selectDecisionPresence(state,c,s);if(!p)return;
 const util=p.totalCapacity>0?p.fulfilledUnits/p.totalCapacity:0,cm=p.revenue>0?p.contributionMargin/p.revenue:0,avgPrice=avgCompetitorPrice(state,p.prefID),player=publicSignals(state,p.prefID);c.lastKnownPlayerSignals=player;
 const reasons=[{code:'share',text:`市場シェア ${(p.currentWeekShare*100).toFixed(1)}%`},{code:'util',text:`能力稼働率 ${(util*100).toFixed(0)}%`},{code:'margin',text:`限界利益率 ${(cm*100).toFixed(0)}%`},{code:'strategy',text:`${s.name}戦略`},{code:'portfolio',text:`全${(c.marketPresence||[]).filter(x=>x.active).length}市場を比較し ${p.prefID} を選択`}];
 if(state.week%4===0){let target=(avgPrice||920)*s.targetPriceIndex;if(c.status==='distressed'||cm<.18)target=Math.max(target,p.price*1.04);const diff=(target-p.price)/Math.max(1,p.price);if(Math.abs(diff)>.025){const pct=clamp(diff,-.08,.08)*s.priceAggressiveness;const next=Math.max(Math.round(c.baseUnitCost*1.08),Math.round(p.price*(1+pct)));addAction(state,c,p,pct>=0?'priceIncrease':'priceDecrease',next,0,reasons,1);return;}if(c.cash<(c.weeklyFixedCost+c.weeklyMarketingCost)*s.cashBufferWeeks&&c.debt<c.cash*s.debtTolerance+12000000){addAction(state,c,null,'borrow',Math.round((c.weeklyFixedCost+200000)*8),0,[{code:'cash',text:`現金余力 ${Math.floor(c.cash/Math.max(1,c.weeklyFixedCost+1))}週`},{code:'credit',text:`信用 ${c.creditScore.toFixed(0)}`}],1);return;}}
 if(state.week%13===0&&c.cash>800000){if(s.marketingPriority>.55&&p.brandAwareness<75){addAction(state,c,p,'brandInvestment',clamp(p.brandAwareness+2+s.marketingPriority*2,0,100),300000*s.marketingPriority,reasons,1);return;}if(s.qualityPriority>.55&&p.quality<78){addAction(state,c,p,'qualityInvestment',clamp(p.quality+2+s.qualityPriority*2,0,100),500000*s.qualityPriority,reasons,4);return;}if((util>.85||p.lostDemand>20)&&s.capacityPriority>.5){addAction(state,c,p,'capacityExpansion',Math.round(p.totalCapacity*1.12),700000*s.capacityPriority,reasons,4);return;}if(c.lossWeeks>=8&&p.currentWeekShare<s.exitThreshold){addAction(state,c,p,'marketExit',0,250000,reasons,2);return;}}
 if(c.distressWeeks>=6&&c.status!=='turnaround')addAction(state,c,p,'turnaround',null,0,reasons,1);
}
function applyActions(state){for(const a of state.competitorActions||[]){if(a.applied||a.effectiveWeek>state.week)continue;const c=state.competitorStates.find(x=>x.competitorID===a.competitorID);if(!c)continue;const p=(c.marketPresence||[]).find(x=>x.presenceID===a.presenceID);if(a.actionType==='borrow'){c.cash+=a.newValue;c.debt+=a.newValue;}else if(p){if(a.cost&&c.cash<a.cost){a.status='skipped';a.applied=true;a.appliedWeek=state.week;continue;}c.cash=Math.max(0,c.cash-finite(a.cost));if(a.actionType==='priceIncrease'||a.actionType==='priceDecrease')p.price=a.newValue;if(a.actionType==='brandInvestment'){p.brandAwareness=clamp(a.newValue,0,100);p.marketingIntensity=clamp(p.marketingIntensity+5,0,100);c.marketingBudget+=Math.max(0,a.cost/13);}if(a.actionType==='qualityInvestment'){p.quality=clamp(a.newValue,0,100);p.serviceQuality=clamp(p.serviceQuality+2,0,100);c.quality=p.quality;c.baseUnitCost*=1.015;}if(a.actionType==='capacityExpansion'){p.totalCapacity=Math.max(p.totalCapacity,a.newValue);p.capacityPerStore=Math.ceil(p.totalCapacity/Math.max(1,p.storeCount));p.storeCount=Math.max(p.storeCount,Math.ceil(p.totalCapacity/650));p.fixedCost+=30000;}if(a.actionType==='marketExit'){p.active=false;p.totalCapacity=0;p.exitWeek=state.week;c.status='withdrawing';}if(a.actionType==='turnaround'){c.status='turnaround';c.marketingBudget*=.7;c.rdBudget*=.7;c.turnaroundWeeks=8;c.statusReason=a.reasonText;}}a.status='applied';a.applied=true;a.appliedWeek=state.week;}}
function avgCompetitorPrice(state,prefID){let arr=[];(state.competitorStates||[]).forEach(c=>(c.marketPresence||[]).forEach(p=>{if(p.active&&p.prefID===prefID)arr.push(p.price);}));return arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length);}
function publicSignals(state,prefID){const stores=(state.stores||[]).filter(s=>s.status==='open'&&s.businessID===TARGET&&s.prefID===prefID);return {week:Math.max(0,finite(state.week)-1),averagePrice:stores.reduce((a,s)=>a+finite((state.businesses||[]).find(b=>b.id===s.businessID)?.price,0),0)/Math.max(1,stores.length),storeCount:stores.length,marketShare:finite(state.marketResultsByBusinessID?.[TARGET]?.marketShare,0)};}
function sanitize(state){
 state.competitorPerformanceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPerformanceHistoryByID));state.competitorPresenceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPresenceHistoryByID));
 for(const c of state.competitorStates||[]){c.cash=Math.max(0,finite(c.cash));c.debt=Math.max(0,finite(c.debt));c.weeklyCapacityCost=Math.max(0,finite(c.weeklyCapacityCost));['quality','brand','efficiency','dx','managementQuality','reputation','creditScore'].forEach(k=>c[k]=clamp(c[k],0,100));c.actionHistory=(Array.isArray(c.actionHistory)?c.actionHistory:[]).slice(-20);c.lastPresenceEvaluation=(Array.isArray(c.lastPresenceEvaluation)?c.lastPresenceEvaluation:[]).filter(x=>x&&typeof x==='object').map(x=>({...x,score:finite(x.score)})).slice(0,Math.max(0,(c.marketPresence||[]).length));for(const p of c.marketPresence||[]){p.storeCount=Math.max(0,Math.floor(finite(p.storeCount)));p.totalCapacity=Math.max(0,finite(p.totalCapacity));p.price=Math.max(2,Math.round(finite(p.price,920)));['quality','brandAwareness','convenience','serviceQuality','novelty','localReputation','marketingIntensity'].forEach(k=>p[k]=clamp(p[k],0,100));p.currentWeekShare=clamp(p.currentWeekShare,0,1);p.previousWeekShare=clamp(p.previousWeekShare,0,1);}}
}
function validateHistory(rows,label,errors){if(!Array.isArray(rows)){errors.push(`${label}履歴配列不正`);return;}if(rows.length>MAX_HISTORY)errors.push(`${label}履歴上限超過`);const weeks=new Set();for(const row of rows){const week=Number(row?.week);if(!Number.isFinite(week))errors.push(`${label}履歴週不正`);if(weeks.has(week))errors.push(`${label}履歴週重複`);weeks.add(week);for(const [key,value] of Object.entries(row||{}))if(typeof value==='number'&&!Number.isFinite(value))errors.push(`${label}.${key}非有限`);}}
function validate(state){
 const errors=[],cids=new Set(),pids=new Set(),aids=new Set(),biz=new Set((state.businesses||[]).map(b=>b.id)),prefs=new Set((state.prefs||[]).map(p=>p.id)),companyHistory=objectMap(state.competitorPerformanceHistoryByID),presenceHistory=objectMap(state.competitorPresenceHistoryByID);
 for(const c of state.competitorStates||[]){
  if(cids.has(c.competitorID))errors.push('competitorID重複');cids.add(c.competitorID);if(!biz.has(c.businessID))errors.push('存在しないbusinessID');if(c.cash<0||c.debt<0||!Number.isFinite(c.cash+c.debt))errors.push('cash/debt不正');let rev=0,vc=0;
  for(const p of c.marketPresence||[]){if(pids.has(p.presenceID))errors.push('presenceID重複');pids.add(p.presenceID);if(!prefs.has(p.prefID))errors.push('存在しないprefID');if(p.price<=1||!Number.isFinite(p.price))errors.push('価格不正');if(p.storeCount<0||p.storeCount%1!==0)errors.push('storeCount不正');if(p.currentWeekShare<0||p.currentWeekShare>1)errors.push('share不正');rev+=finite(p.revenue);vc+=finite(p.variableCost);validateHistory(presenceHistory[p.presenceID]||[],`presence:${p.presenceID}`,errors);}
  validateHistory(companyHistory[c.competitorID]||[],`competitor:${c.competitorID}`,errors);
  if(Math.abs(rev-finite(c.weeklyRevenue))>1&&finite(c.lastFinanceWeek)===finite(state.week))errors.push('weeklyRevenue不一致');if(Math.abs(vc-finite(c.weeklyVariableCost))>1&&finite(c.lastFinanceWeek)===finite(state.week))errors.push('weeklyVariableCost不一致');
 }
 for(const a of state.competitorActions||[]){if(aids.has(a.actionID))errors.push('actionID重複');aids.add(a.actionID);}
 if(errors.length)throw new Error(errors.join(' / '));return true;
}
Object.assign(exports,{TARGET_BUSINESS_ID:TARGET,STRATEGIES,MAX_HISTORY,strategyID,ensure,migrateV8,offers,receiveMarketResults,recordHistories,evaluatePresences,selectDecisionPresence,processWeek,validate});
})(__modules.competitor={},__modules.data);
})();
