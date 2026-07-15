// Compatibility layer: keep weekly newspaper article details scalar and save-safe.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before expansion-media-safety.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.expansion||!modules.expansion.installExpansion)throw new Error('expansion.js must be loaded before expansion-media-safety.js.');
if(modules.expansionMediaSafety)throw new Error('Capitalism Tycoon expansion media safety module is already registered.');

function articleDetail(value){
 if(value==null)return '主要競合は通常運転。';
 if(typeof value==='string')return value;
 if(typeof value==='number'||typeof value==='boolean')return String(value);
 if(typeof value==='object'){
  for(const key of ['text','detail','message','title','statusReason']){
   const candidate=value[key];
   if(typeof candidate==='string'&&candidate.trim())return candidate;
  }
 }
 return '競争環境に変化が確認された。';
}

const expansion=modules.expansion;
const baseInstallExpansion=expansion.installExpansion;
expansion.installExpansion=function(TycoonEngine){
 baseInstallExpansion(TycoonEngine);
 if(TycoonEngine.prototype.__expansionMediaSafetyInstalled)return;
 TycoonEngine.prototype.__expansionMediaSafetyInstalled=true;
 const baseGenerateMediaWeekly=TycoonEngine.prototype.generateMediaWeekly;
 if(typeof baseGenerateMediaWeekly!=='function')throw new Error('installExpansion must define generateMediaWeekly before media safety is installed.');
 TycoonEngine.prototype.generateMediaWeekly=function(){
  const result=baseGenerateMediaWeekly.call(this);
  for(const paper of this.g.weeklyNewspaper||[]){
   for(const article of paper?.articles||[])article.detail=articleDetail(article.detail);
  }
  return result;
 };
};

modules.expansionMediaSafety=Object.freeze({articleDetail});
})();
