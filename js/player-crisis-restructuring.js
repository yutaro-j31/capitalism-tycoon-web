// Phase 6A-3A: guided player-company asset disposition and operating cost restructuring during a liquidity crisis.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-restructuring.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerCrisis?.__installed)throw new Error('player-crisis.js must be loaded before player-crisis-restructuring.js.');
if(!modules.playerCrisisActions?.__installed)throw new Error('player-crisis-actions.js must be loaded before player-crisis-restructuring.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before player-crisis-restructuring.js.');
if(!modules.workforce)throw new Error('workforce.js must be loaded before player-crisis-restructuring.js.');
if(modules.playerCrisisRestructuring)throw new Error('player crisis restructuring module is already registered.');

const engine=modules.engine;
const finance=modules.finance;
const workforce=modules.workforce;
const playerCrisis=modules.playerCrisis;
const EngineClass=engine.TycoonEngine;
const HISTORY_LIMIT=52;
const DISPOSITION_TYPES=Object.freeze(['store','property','product']);
const COST_ACTION_TYPES=Object.freeze(['pauseProject','reduceDepartmentHeadcount']);
const ELIGIBLE_STATUSES=new Set(['watch','distressed','turnaround','recovered']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const text=value=>String(value??'');
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function normalizeHistory(value){
 const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const actionID=text(row.actionID);
  if(!actionID||seen.has(actionID))continue;
  seen.add(actionID);
  out.push({
   actionID,
   operationID:text(row.operationID||`player-crisis-restructuring-${actionID}`),
   week:integer(row.week),
   type:DISPOSITION_TYPES.includes(row.type)?row.type:'store',
   targetID:text(row.targetID),
   targetName:text(row.targetName),
   expectedCash:Math.max(0,finite(row.expectedCash)),
   cashBefore:finite(row.cashBefore),
   cashAfter:finite(row.cashAfter),
   realizedCash:finite(row.realizedCash),
   status:'completed',
   detail:text(row.detail)
  });
 }
 return out.slice(-HISTORY_LIMIT);
}
function normalizeCostHistory(value){
 const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const actionID=text(row.actionID);
  if(!actionID||seen.has(actionID))continue;
  seen.add(actionID);
  out.push({
   actionID,
   operationID:text(row.operationID||`player-crisis-cost-${actionID}`),
   week:integer(row.week),
   type:COST_ACTION_TYPES.includes(row.type)?row.type:'pauseProject',
   targetID:text(row.targetID),
   targetName:text(row.targetName),
   weeklySavings:Math.max(0,finite(row.weeklySavings)),
   oneTimeCost:Math.max(0,finite(row.oneTimeCost)),
   cashBefore:finite(row.cashBefore),
   cashAfter:finite(row.cashAfter),
   status:'completed',
   detail:text(row.detail)
  });
 }
 return out.slice(-HISTORY_LIMIT);
}
function ensure(state){
 if(!plain(state))throw new Error('player crisis restructuring state root must be an object.');
 const current=plain(state.playerCrisisRestructuring)?state.playerCrisisRestructuring:{};
 current.nextActionSeq=Math.max(1,integer(current.nextActionSeq,1));
 current.history=normalizeHistory(current.history);
 current.costHistory=normalizeCostHistory(current.costHistory);
 state.playerCrisisRestructuring=current;
 return current;
}
function status(state){return playerCrisis.ensure(state).status;}
function eligible(instance){return !instance.g.gameOver&&!instance.g.isCompanySold&&ELIGIBLE_STATUSES.has(status(instance.g));}
function storeExpectedCash(instance,store){return Math.max(0,finite(instance.business(store.businessID)?.storeCost)*.15);}
function propertyExpectedCash(property){return Math.max(0,finite(property.value)*.97);}
function productExpectedCash(product){return Math.max(0,finite(product.valuation),finite(product.profit)*52*8);}
function stableSort(rows){return rows.sort((a,b)=>a.priority-b.priority||b.expectedCash-a.expectedCash||String(a.id).localeCompare(String(b.id)));}
function options(instance){
 const state=instance.g,crisis=state.playerCrisis||{},canExecute=eligible(instance);
 const stores=stableSort((state.stores||[]).map(store=>({
  type:'store',id:text(store.id),name:text(store.name),expectedCash:storeExpectedCash(instance,store),weeklyProfit:finite(store.lastProfit),priority:finite(store.lastProfit)<0?0:1,canExecute
 })));
 const properties=stableSort((state.properties||[]).filter(property=>property.owner==='company').map(property=>({
  type:'property',id:text(property.id),name:text(property.name),expectedCash:propertyExpectedCash(property),weeklyProfit:finite(property.rentIncome)-finite(property.maintenanceCost),priority:0,canExecute
 })));
 const products=stableSort((state.productVentures||[]).map(product=>({
  type:'product',id:text(product.id),name:text(product.name),expectedCash:productExpectedCash(product),weeklyProfit:finite(product.profit),priority:finite(product.profit)<0?0:1,canExecute
 })));
 const all=[...stores,...properties,...products].sort((a,b)=>a.priority-b.priority||b.expectedCash-a.expectedCash||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
 return Object.freeze({status:text(crisis.status||'stable'),eligible:canExecute,liquidityGap:Math.max(0,finite(crisis.reserveThreshold)-finite(state.companyCash)),stores:Object.freeze(stores),properties:Object.freeze(properties),products:Object.freeze(products),recommended:Object.freeze(all.slice(0,5))});
}
function findCandidate(instance,type,id){
 if(!DISPOSITION_TYPES.includes(type))return null;
 const data=options(instance);
 return ({store:data.stores,property:data.properties,product:data.products})[type].find(row=>row.id===String(id))||null;
}
function execute(instance,type,id){
 if(!eligible(instance))return instance.fail('資産整理は資金繰り注意・危機・再建・回復確認中のみ実行できます。');
 const candidate=findCandidate(instance,type,id);
 if(!candidate)return instance.fail('売却・閉鎖対象が見つかりません。');
 const state=instance.g,previousStatus=status(state),actionState=ensure(state),seq=actionState.nextActionSeq++,actionID=`pcr-${seq}`,operationID=`player-crisis-restructuring-${actionID}`,cashBefore=finite(state.companyCash);
 let result=false;
 if(type==='store')result=instance.closeStore(id);
 else if(type==='property')result=instance.sellProperty(id);
 else if(type==='product')result=instance.sellProduct(id);
 if(!result)return false;
 const cashAfter=finite(state.companyCash),realizedCash=cashAfter-cashBefore;
 const crisis=playerCrisis.ensure(state);
 crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);
 const nextStatus=playerCrisis.evaluate(state).status;
 actionState.history.push({actionID,operationID,week:integer(state.week),type,targetID:String(id),targetName:candidate.name,expectedCash:candidate.expectedCash,cashBefore,cashAfter,realizedCash,status:'completed',detail:`${candidate.name} / 状態 ${previousStatus}→${nextStatus}`});
 actionState.history=actionState.history.slice(-HISTORY_LIMIT);
 instance.notify(`${candidate.name}の資産整理で${Math.round(realizedCash).toLocaleString('ja-JP')}円を確保しました。`,'warning');
 validate(state);
 const financeResult=finance.validate(state);
 if(financeResult?.ok===false)throw new Error(financeResult.errors.join(' / '));
 instance.save();instance.emit();return true;
}

function activeCorporateCohorts(team){
 return (Array.isArray(team?.corporatePayrollCohorts)?team.corporatePayrollCohorts:[])
  .filter(row=>row?.status==='active'&&finite(row.headcount)>0)
  .sort((a,b)=>finite(b.weeklySalaryPerPerson)-finite(a.weeklySalaryPerPerson)||text(a.cohortID).localeCompare(text(b.cohortID)));
}
function reducibleSalary(team){
 const cohort=activeCorporateCohorts(team)[0];
 return Math.max(0,finite(cohort?.weeklySalaryPerPerson,team?.averageWeeklySalary));
}
function costOptions(instance){
 const state=instance.g,canExecute=eligible(instance);
 const projects=(state.workforceProjects||[])
  .filter(project=>project?.status==='active')
  .map(project=>{
   const remaining=Math.max(0,finite(project.totalBudget)-finite(project.spentBudget));
   const weeklySavings=Math.max(0,Math.min(finite(project.weeklyBudget),remaining));
   return {type:'pauseProject',id:text(project.projectID),name:text(project.name),weeklySavings,oneTimeCost:0,utilization:0,priority:0,canExecute};
  })
  .filter(row=>row.weeklySavings>0)
  .sort((a,b)=>b.weeklySavings-a.weeklySavings||a.id.localeCompare(b.id));
 const headcount=(state.workforceTeams||[])
  .filter(team=>team&&!team.storeID&&team.departmentID&&team.status!=='removed'&&team.status!=='closed'&&integer(team.headcount)>1&&integer(team.onboardingHeadcount)===0)
  .map(team=>{
   const department=state.departments?.[team.departmentID]||{};
   const result=state.workforceResultsByDepartmentID?.[team.departmentID]||{};
   const utilization=Math.max(0,finite(team.utilization,finite(result.utilization,1)));
   const weeklySavings=reducibleSalary(team);
   return {type:'reduceDepartmentHeadcount',id:text(team.teamID),name:`${text(department.name||team.departmentID)} 1名削減`,departmentID:text(team.departmentID),weeklySavings,oneTimeCost:weeklySavings*2,utilization,priority:utilization<.8?0:1,canExecute};
  })
  .filter(row=>row.weeklySavings>0&&row.utilization<1)
  .sort((a,b)=>a.priority-b.priority||a.utilization-b.utilization||b.weeklySavings-a.weeklySavings||a.id.localeCompare(b.id));
 const recommended=[...projects,...headcount].sort((a,b)=>a.priority-b.priority||b.weeklySavings-a.weeklySavings||a.oneTimeCost-b.oneTimeCost||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
 return Object.freeze({status:text(state.playerCrisis?.status||'stable'),eligible:canExecute,projects:Object.freeze(projects),headcount:Object.freeze(headcount),recommended:Object.freeze(recommended.slice(0,5)),totalPotentialWeeklySavings:recommended.reduce((sum,row)=>sum+Math.max(0,finite(row.weeklySavings)),0)});
}
function findCostCandidate(instance,type,id){
 if(!COST_ACTION_TYPES.includes(type))return null;
 const data=costOptions(instance);
 return ({pauseProject:data.projects,reduceDepartmentHeadcount:data.headcount})[type].find(row=>row.id===String(id))||null;
}
function reduceDepartmentHeadcount(state,team,candidate,operationID){
 const weeklySavings=Math.max(0,finite(candidate.weeklySavings));
 const oneTimeCost=Math.max(0,finite(candidate.oneTimeCost));
 const cohorts=activeCorporateCohorts(team);
 if(cohorts.length){
  const cohort=cohorts[0];
  cohort.headcount=Math.max(0,integer(cohort.headcount)-1);
  if(cohort.headcount<=0)cohort.status='closed';
 }
 team.headcount=Math.max(1,integer(team.headcount)-1);
 team.onboardingHeadcount=0;
 team.availableHeadcount=team.headcount;
 team.managerHeadcount=Math.min(integer(team.managerHeadcount),team.headcount);
 team.morale=Math.max(0,finite(team.morale,55)-4);
 team.engagement=Math.max(0,finite(team.engagement,55)-3);
 state.companyCash=finite(state.companyCash)-oneTimeCost;
 if(oneTimeCost>0)finance.event(state,'payroll',oneTimeCost,{cashEffect:-oneTimeCost,profitEffect:-oneTimeCost,sourceType:'crisisHeadcountReduction',sourceID:text(team.teamID),idempotencyKey:operationID,operationID,description:`${candidate.name} 退職関連費用`});
 workforce.syncDepartmentStaff(state);
 workforce.recompute(state);
 return true;
}
function executeCost(instance,type,id){
 if(!eligible(instance))return instance.fail('固定費削減は資金繰り注意・危機・再建・回復確認中のみ実行できます。');
 const candidate=findCostCandidate(instance,type,id);
 if(!candidate)return instance.fail('固定費削減対象が見つかりません。');
 const state=instance.g,previousStatus=status(state),actionState=ensure(state),seq=actionState.nextActionSeq++,actionID=`pcr-${seq}`,operationID=`player-crisis-cost-${actionID}`,cashBefore=finite(state.companyCash);
 let result=false;
 if(type==='pauseProject')result=workforce.setProjectStatus(state,id,'paused');
 else if(type==='reduceDepartmentHeadcount'){
  const team=(state.workforceTeams||[]).find(row=>text(row.teamID)===String(id));
  if(!team)return instance.fail('削減対象チームが見つかりません。');
  result=reduceDepartmentHeadcount(state,team,candidate,operationID);
 }
 if(!result)return false;
 const crisis=playerCrisis.ensure(state);
 crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);
 const nextStatus=playerCrisis.evaluate(state).status,cashAfter=finite(state.companyCash);
 actionState.costHistory.push({actionID,operationID,week:integer(state.week),type,targetID:String(id),targetName:candidate.name,weeklySavings:candidate.weeklySavings,oneTimeCost:candidate.oneTimeCost,cashBefore,cashAfter,status:'completed',detail:`${candidate.name} / 週次削減 ${Math.round(candidate.weeklySavings).toLocaleString('ja-JP')}円 / 状態 ${previousStatus}→${nextStatus}`});
 actionState.costHistory=actionState.costHistory.slice(-HISTORY_LIMIT);
 instance.notify(`${candidate.name}を実行し、週次固定費を約${Math.round(candidate.weeklySavings).toLocaleString('ja-JP')}円削減しました。`,'warning');
 validate(state);
 const workforceResult=workforce.validate(state);
 if(workforceResult?.ok===false)throw new Error(workforceResult.errors.join(' / '));
 const financeResult=finance.validate(state);
 if(financeResult?.ok===false)throw new Error(financeResult.errors.join(' / '));
 instance.save();instance.emit();return true;
}

function validate(state){
 const current=state?.playerCrisisRestructuring,errors=[];
 if(!plain(current))errors.push('playerCrisisRestructuringがオブジェクトではありません。');
 else{
  if(!Number.isFinite(Number(current.nextActionSeq))||Number(current.nextActionSeq)<1)errors.push('playerCrisisRestructuring.nextActionSeqが不正です。');
  const ids=new Set();
  if(!Array.isArray(current.history))errors.push('playerCrisisRestructuring.historyが配列ではありません。');
  else{
   if(current.history.length>HISTORY_LIMIT)errors.push('playerCrisisRestructuring.historyが上限を超えています。');
   for(const row of current.history){
    if(!plain(row)||!row.actionID||!DISPOSITION_TYPES.includes(row.type))errors.push('playerCrisisRestructuring.history要素が不正です。');
    else if(ids.has(row.actionID))errors.push('playerCrisisRestructuring actionIDが重複しています。');else ids.add(row.actionID);
    for(const key of ['week','expectedCash','cashBefore','cashAfter','realizedCash'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisRestructuring.history.${key}が有限数ではありません。`);
   }
  }
  if(!Array.isArray(current.costHistory))errors.push('playerCrisisRestructuring.costHistoryが配列ではありません。');
  else{
   if(current.costHistory.length>HISTORY_LIMIT)errors.push('playerCrisisRestructuring.costHistoryが上限を超えています。');
   for(const row of current.costHistory){
    if(!plain(row)||!row.actionID||!COST_ACTION_TYPES.includes(row.type))errors.push('playerCrisisRestructuring.costHistory要素が不正です。');
    else if(ids.has(row.actionID))errors.push('playerCrisisRestructuring actionIDが重複しています。');else ids.add(row.actionID);
    for(const key of ['week','weeklySavings','oneTimeCost','cashBefore','cashAfter'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisRestructuring.costHistory.${key}が有限数ではありません。`);
   }
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

EngineClass.prototype.crisisRestructuringOptions=function(){ensure(this.g);return options(this);};
EngineClass.prototype.executeCrisisDisposition=function(type,id){return execute(this,type,id);};
EngineClass.prototype.crisisCostReductionOptions=function(){ensure(this.g);return costOptions(this);};
EngineClass.prototype.executeCrisisCostReduction=function(type,id){return executeCost(this,type,id);};
const baseNormalize=EngineClass.prototype.normalize;
EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;
EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
EngineClass.prototype.__playerCrisisRestructuringInstalled=true;
modules.playerCrisisRestructuring=Object.freeze({HISTORY_LIMIT,DISPOSITION_TYPES,COST_ACTION_TYPES,ELIGIBLE_STATUSES,ensure,options,costOptions,validate,__installed:true});
})();