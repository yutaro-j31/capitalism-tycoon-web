// Phase 6B-1: normal-start progression balance gates.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before progression-balance.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before progression-balance.js.');
if(modules.progressionBalance)throw new Error('progression balance module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
if(typeof EngineClass.prototype.ipoMissingReasons!=='function')throw new Error('engine IPO progression API is missing.');
const REQUIRED_IPO_REPORT_WEEKS=52;
const REPORT_HISTORY_REASON='決算履歴52週';
const baseIpoMissingReasons=EngineClass.prototype.ipoMissingReasons;
function reportCount(state){return Array.isArray(state?.reports)?Math.min(REQUIRED_IPO_REPORT_WEEKS,state.reports.slice(-REQUIRED_IPO_REPORT_WEEKS).length):0;}
function missingReasons(instance){
 const reasons=baseIpoMissingReasons.call(instance);
 if(reportCount(instance?.g)<REQUIRED_IPO_REPORT_WEEKS&&!reasons.includes(REPORT_HISTORY_REASON))reasons.push(REPORT_HISTORY_REASON);
 return [...new Set(reasons)];
}
EngineClass.prototype.ipoMissingReasons=function(){return missingReasons(this);};
EngineClass.prototype.__progressionBalanceInstalled=true;
modules.progressionBalance=Object.freeze({REQUIRED_IPO_REPORT_WEEKS,REPORT_HISTORY_REASON,reportCount,missingReasons,__installed:true});
})();
