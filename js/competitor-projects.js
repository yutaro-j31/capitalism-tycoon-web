// Phase 5B-2 extension: deterministic competitor project lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-projects.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-projects.js.');
if(modules.competitor.__projectsInstalled)throw new Error('competitor project lifecycle is already installed.');

const competitor=modules.competitor;
const MAX_PROJECTS=160;
const PROJECT_ACTION_TYPES=Object.freeze(['brandInvestment','qualityInvestment','capacityExpansion','marketEntry','marketExit','turnaround']);
const PROJECT_STATUSES=Object.freeze(['planned','inProgress','completed','cancelled','failed']);
const terminal=new Set(['completed','cancelled','failed']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const projectAction=type=>PROJECT_ACTION_TYPES.includes(type);

function statusForAction(action,week){
 if(action.applied)return action.status==='skipped'?'failed':'completed';
 return finite(week)<finite(action.decisionWeek,week)?'planned':'inProgress';
}
function trimProjects(projects){
 const rows=(Array.isArray(projects)?projects:[]).filter(row=>row&&typeof row==='object');
 const active=rows.filter(row=>!terminal.has(row.status));
 const completed=rows.filter(row=>terminal.has(row.status)).sort((a,b)=>finite(a.completedWeek,a.completionWeek)-finite(b.completedWeek,b.completionWeek)||String(a.projectID).localeCompare(String(b.projectID)));
 const room=Math.max(0,MAX_PROJECTS-active.length);
 return active.concat(completed.slice(-room)).sort((a,b)=>finite(a.createdWeek)-finite(b.createdWeek)||String(a.projectID).localeCompare(String(b.projectID))).slice(-MAX_PROJECTS);
}
function sanitizeProject(project){
 project.projectID=String(project.projectID||'');
 project.competitorID=String(project.competitorID||'');
 project.presenceID=project.presenceID==null?null:String(project.presenceID);
 project.projectType=String(project.projectType||'');
 project.status=PROJECT_STATUSES.includes(project.status)?project.status:'planned';
 project.createdWeek=Math.max(0,Math.floor(finite(project.createdWeek)));
 project.startWeek=Math.max(project.createdWeek,Math.floor(finite(project.startWeek,project.createdWeek)));
 project.completionWeek=Math.max(project.startWeek,Math.floor(finite(project.completionWeek,project.startWeek)));
 project.completedWeek=project.completedWeek==null?null:Math.max(project.startWeek,Math.floor(finite(project.completedWeek,project.completionWeek)));
 project.committedCost=Math.max(0,finite(project.committedCost));
 project.spentCost=Math.max(0,finite(project.spentCost));
 project.previousValue=project.previousValue??null;
 project.targetValue=project.targetValue??null;
 project.operationID=String(project.operationID||project.actionID||project.projectID);
 project.actionID=String(project.actionID||'');
 project.reasonText=String(project.reasonText||'');
 project.failureReason=String(project.failureReason||'');
 return project;
}
function ensureProjectForAction(state,action){
 if(!projectAction(action?.actionType))return null;
 const operationID=String(action.operationID||action.actionID||'');
 let project=(state.competitorProjects||[]).find(row=>row.operationID===operationID);
 if(!project){
  project={
   projectID:`cp-${state.nextCompetitorProjectSeq++}`,
   competitorID:action.competitorID,
   presenceID:action.presenceID||null,
   projectType:action.actionType,
   status:'planned',
   createdWeek:finite(action.decisionWeek,state.week),
   startWeek:finite(action.decisionWeek,state.week),
   completionWeek:Math.max(finite(action.decisionWeek,state.week),finite(action.effectiveWeek,state.week)),
   completedWeek:null,
   committedCost:Math.max(0,finite(action.cost)),
   spentCost:0,
   previousValue:action.previousValue??null,
   targetValue:action.newValue??null,
   operationID,
   actionID:action.actionID,
   reasonText:action.reasonText||'',
   failureReason:''
  };
  state.competitorProjects.push(project);
 }
 project.status=statusForAction(action,state.week);
 if(terminal.has(project.status)){
  project.completedWeek=finite(action.appliedWeek,action.effectiveWeek);
  project.spentCost=project.status==='completed'?project.committedCost:0;
  project.failureReason=project.status==='failed'?'action-skipped':'';
 }else{
  project.completedWeek=null;
  project.spentCost=0;
  project.failureReason='';
 }
 return sanitizeProject(project);
}
function ensureProjects(state){
 if(!Array.isArray(state.competitorProjects))state.competitorProjects=[];
 state.nextCompetitorProjectSeq=Math.max(1,Math.floor(finite(state.nextCompetitorProjectSeq,state.nextCompetitorInvestmentSeq||1)));
 for(const action of state.competitorActions||[])ensureProjectForAction(state,action);
 state.competitorProjects=trimProjects(state.competitorProjects.map(sanitizeProject));
 return state.competitorProjects;
}
function validateProjects(state){
 const errors=[];
 if(!Array.isArray(state.competitorProjects))errors.push('competitorProjects配列不正');
 else{
  if(state.competitorProjects.length>MAX_PROJECTS)errors.push('competitorProjects上限超過');
  const competitorIDs=new Set((state.competitorStates||[]).map(row=>row.competitorID));
  const presenceIDs=new Set((state.competitorStates||[]).flatMap(row=>(row.marketPresence||[]).map(p=>p.presenceID)));
  const projectIDs=new Set();
  const operationIDs=new Set();
  for(const project of state.competitorProjects){
   if(projectIDs.has(project.projectID))errors.push('projectID重複');projectIDs.add(project.projectID);
   if(operationIDs.has(project.operationID))errors.push('project operationID重複');operationIDs.add(project.operationID);
   if(!competitorIDs.has(project.competitorID))errors.push('project競合参照不正');
   if(project.presenceID!==null&&!presenceIDs.has(project.presenceID))errors.push('project市場参照不正');
   if(!PROJECT_ACTION_TYPES.includes(project.projectType))errors.push('projectType不正');
   if(!PROJECT_STATUSES.includes(project.status))errors.push('projectStatus不正');
   for(const key of ['createdWeek','startWeek','completionWeek','committedCost','spentCost'])if(!Number.isFinite(Number(project[key])))errors.push(`project.${key}非有限`);
   if(finite(project.startWeek)<finite(project.createdWeek)||finite(project.completionWeek)<finite(project.startWeek))errors.push('project期間不正');
   if(terminal.has(project.status)&&project.completedWeek==null)errors.push('project完了週欠落');
   if(project.status==='completed'&&finite(project.spentCost)!==finite(project.committedCost))errors.push('project支出不一致');
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureProjects(state);return state;};
competitor.processWeek=function(state){ensureProjects(state);const result=baseProcessWeek(state);ensureProjects(state);return result;};
competitor.validate=function(state){baseValidate(state);validateProjects(state);return true;};
Object.assign(competitor,{MAX_PROJECTS,PROJECT_ACTION_TYPES,ensureProjectForAction,migrateProjectsFromActions:ensureProjects,validateProjects,__projectsInstalled:true});
})();
