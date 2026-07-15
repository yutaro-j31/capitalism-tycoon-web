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
