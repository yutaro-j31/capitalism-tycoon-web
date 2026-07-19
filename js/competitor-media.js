// Phase 5B-4 integration: keep competitor newspaper articles serializable.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-media.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before competitor-media.js.');
if(!modules.expansion?.installExpansion)throw new Error('expansion.js must be loaded before competitor-media.js.');
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-media.js.');
if(modules.competitor.__mediaInstallerRegistered)throw new Error('competitor media integration is already installed.');

function eventText(value){
 if(value==null)return '主要競合は通常運転。';
 if(typeof value==='string')return value;
 if(typeof value==='number'||typeof value==='boolean')return String(value);
 if(typeof value==='object'){
  const text=value.text??value.detail??value.reasonText??value.title??value.message;
  if(text!=null&&typeof text!=='object')return String(text);
  const company=value.competitorID?`競合${value.competitorID}`:'主要競合';
  const type=value.type?`で${value.type}`:'に動き';
  return `${company}${type}が発生。`;
 }
 return String(value);
}
function sanitizeNewspapers(state){
 if(!Array.isArray(state.weeklyNewspaper))state.weeklyNewspaper=[];
 for(const issue of state.weeklyNewspaper){
  if(!issue||typeof issue!=='object')continue;
  if(!Array.isArray(issue.articles))issue.articles=[];
  for(const article of issue.articles){
   if(!article||typeof article!=='object')continue;
   article.category=String(article.category??'');
   article.title=String(article.title??'');
   article.detail=eventText(article.detail);
  }
 }
 return state.weeklyNewspaper;
}
function installCompetitorMedia(TycoonEngine){
 if(TycoonEngine.prototype.__competitorMediaInstalled)return;
 const baseNormalize=TycoonEngine.prototype.normalize;
 TycoonEngine.prototype.normalize=function(){const result=baseNormalize.call(this);sanitizeNewspapers(this.g);return result;};
 const baseGenerateMediaWeekly=TycoonEngine.prototype.generateMediaWeekly;
 if(typeof baseGenerateMediaWeekly!=='function')throw new Error('installExpansion must define generateMediaWeekly before competitor media integration.');
 TycoonEngine.prototype.generateMediaWeekly=function(){const result=baseGenerateMediaWeekly.call(this);sanitizeNewspapers(this.g);return result;};
 TycoonEngine.prototype.__competitorMediaInstalled=true;
}

const baseInstallExpansion=modules.expansion.installExpansion;
modules.expansion.installExpansion=function(TycoonEngine){
 const result=baseInstallExpansion(TycoonEngine);
 installCompetitorMedia(TycoonEngine);
 return result;
};
Object.assign(modules.competitor,{sanitizeNewspapers,newspaperEventText:eventText,installCompetitorMedia,__mediaInstallerRegistered:true});
})();

// Phase 8A-1 integration: use physical capacity, not demand fulfillment, for strategic pressure.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
const competitor=modules?.competitor;
if(!competitor?.__strategicAIInstalled)return;
if(competitor.__strategicCapacitySignalInstalled)throw new Error('strategic capacity signal integration is already installed.');
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const keyFor=presence=>`${presence.businessID}::${presence.prefID}`;
const baseReceiveMarketResults=competitor.receiveMarketResults;
competitor.receiveMarketResults=function(state,batch){
 const result=baseReceiveMarketResults(state,batch);
 const markets=batch?.byMarket||{};
 for(const company of state.competitorStates||[]){
  const signals=company.strategicAI?.marketSignals;
  if(!signals)continue;
  for(const presence of company.marketPresence||[]){
   const key=keyFor(presence),signal=signals[key],market=markets[key];
   if(!signal||!market)continue;
   let fulfilled=0;
   for(const row of Object.values(market.competitorResults||{})){
    if(row?.competitorID===company.competitorID)fulfilled+=Math.max(0,finite(row.fulfilledUnits));
   }
   const capacity=Math.max(0,finite(presence.totalCapacity));
   signal.capacityUtilization=capacity>0?clamp(fulfilled/capacity,0,1):0;
  }
 }
 return result;
};
competitor.__strategicCapacitySignalInstalled=true;
})();
