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
