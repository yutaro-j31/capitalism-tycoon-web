// Phase 5B-4 compatibility: preserve competitor event data and render it safely in the weekly newspaper.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-news.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.expansion?.installExpansion)throw new Error('expansion.js must be loaded before competitor-news.js.');
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-news.js.');
if(modules.competitorNews)throw new Error('competitor news compatibility is already registered.');

const competitor=modules.competitor;
const baseInstallExpansion=modules.expansion.installExpansion;
const validEvent=event=>typeof event==='string'||Boolean(event&&typeof event==='object');
const eventKey=event=>typeof event==='string'?`text:${event}`:`object:${event?.operationID||event?.week||''}:${event?.type||''}:${event?.text||''}`;
function preserveEventEntries(before,current){
 const rows=[],seen=new Set();
 for(const event of [...(Array.isArray(before)?before:[]),...(Array.isArray(current)?current:[])]){
  if(!validEvent(event))continue;
  const key=eventKey(event);if(seen.has(key))continue;seen.add(key);rows.push(event);
 }
 return rows.slice(-160);
}
function competitorEventText(value){
 if(typeof value==='string')return value;
 if(value&&typeof value==='object')return String(value.text||value.reason||value.type||'主要競合は通常運転。');
 return '主要競合は通常運転。';
}
function normalizeNewspaperDetails(state){
 for(const paper of state?.weeklyNewspaper||[]){
  for(const article of paper?.articles||[]){
   if(article&&typeof article.detail==='object')article.detail=competitorEventText(article.detail);
  }
 }
 return state;
}
function wrapCompetitorEvents(methodName){
 const base=competitor[methodName];
 competitor[methodName]=function(state){
  const before=Array.isArray(state?.competitorEvents)?state.competitorEvents.slice():[];
  const result=base.apply(this,arguments);
  state.competitorEvents=preserveEventEntries(before,state.competitorEvents);
  return result;
 };
}
wrapCompetitorEvents('ensure');
wrapCompetitorEvents('processWeek');
function installExpansionWithCompetitorNews(TycoonEngine){
 baseInstallExpansion(TycoonEngine);
 if(TycoonEngine.prototype.__competitorNewsCompatibilityInstalled)return;
 TycoonEngine.prototype.__competitorNewsCompatibilityInstalled=true;
 const baseGenerateMediaWeekly=TycoonEngine.prototype.generateMediaWeekly;
 if(typeof baseGenerateMediaWeekly!=='function')throw new Error('generateMediaWeekly must be installed before competitor news compatibility.');
 TycoonEngine.prototype.generateMediaWeekly=function(){
  const result=baseGenerateMediaWeekly.apply(this,arguments);
  normalizeNewspaperDetails(this.g);
  return result;
 };
 const baseEnsureExpansionDefaults=TycoonEngine.prototype.ensureExpansionDefaults;
 TycoonEngine.prototype.ensureExpansionDefaults=function(){
  const result=baseEnsureExpansionDefaults.apply(this,arguments);
  normalizeNewspaperDetails(this.g);
  return result;
 };
}
modules.expansion.installExpansion=installExpansionWithCompetitorNews;
modules.competitorNews={competitorEventText,normalizeNewspaperDetails,preserveEventEntries,installExpansionWithCompetitorNews};
})();
