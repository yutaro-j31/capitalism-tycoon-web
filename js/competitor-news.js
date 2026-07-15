// Phase 5B-4 compatibility: render structured competitor events safely in the weekly newspaper.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-news.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.expansion?.installExpansion)throw new Error('expansion.js must be loaded before competitor-news.js.');
if(modules.competitorNews)throw new Error('competitor news compatibility is already registered.');

const baseInstallExpansion=modules.expansion.installExpansion;
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
modules.competitorNews={competitorEventText,normalizeNewspaperDetails,installExpansionWithCompetitorNews};
})();
