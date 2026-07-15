// Phase 5B-4 bridge: preserve lifecycle cancellation reasons on linked competitor projects.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-distress-projects.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor?.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-distress-projects.js.');
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-distress-projects.js.');
if(modules.competitor.__distressProjectsInstalled)throw new Error('competitor distress project bridge is already installed.');

const competitor=modules.competitor;
const baseMigrateProjectsFromActions=competitor.migrateProjectsFromActions;
function applyLifecycleCancellationReasons(state){
 const projects=Array.isArray(state?.competitorProjects)?state.competitorProjects:[];
 for(const action of state?.competitorActions||[]){
  if(!action?.cancellationReason)continue;
  const operationID=String(action.operationID||action.actionID||'');
  const project=projects.find(row=>row.operationID===operationID||row.actionID===action.actionID);
  if(!project)continue;
  project.status='failed';
  project.completedWeek=Number.isFinite(Number(action.appliedWeek))?Number(action.appliedWeek):Number(state.week)||0;
  project.spentCost=0;
  project.failureReason=String(action.cancellationReason);
 }
 return projects;
}
competitor.migrateProjectsFromActions=function(state){
 const result=baseMigrateProjectsFromActions(state);
 applyLifecycleCancellationReasons(state);
 return result;
};
Object.assign(competitor,{applyLifecycleCancellationReasons,__distressProjectsInstalled:true});
})();
