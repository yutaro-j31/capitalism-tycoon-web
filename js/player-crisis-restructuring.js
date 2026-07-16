// Phase 6A-2C: guided player-company asset disposition during a liquidity crisis.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-restructuring.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerCrisis?.__installed)throw new Error('player-crisis.js must be loaded before player-crisis-restructuring.js.');
if(!modules.playerCrisisActions?.__installed)throw new Error('player-crisis-actions.js must be loaded before player-crisis-restructuring.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before player-crisis-restructuring.js.');
if(modules.playerCrisisRestructuring)throw new Error('player crisis restructuring module is already registered.');

const engine=modules.engine;
const finance=modules.finance;
const playerCrisis=modules.playerCrisis;
const EngineClass=engine.TycoonEngine;
const HISTORY_LIMIT=52;
const DISPOSITION_TYPES=Object.freeze(['store','property','product']);
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
function ensure(state){
 if(!plain(state))throw new Error('player crisis restructuring state root must be an object.');
 const current=plain(state.playerCrisisRestructuring)?state.playerCrisisRestructuring:{};
 current.nextActionSeq=Math.max(1,integer(current.nextActionSeq,1));
 current.history=normalizeHistory(current.history);
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
 const state=instance.g,actionState=ensure(state),seq=actionState.nextActionSeq++,actionID=`pcr-${seq}`,operationID=`player-crisis-restructuring-${actionID}`,cashBefore=finite(state.companyCash);
 let result=false;
 if(type==='store')result=instance.closeStore(id);
 else if(type==='property')result=instance.sellProperty(id);
 else if(type==='product')result=instance.sellProduct(id);
 if(!result)return false;
 const cashAfter=finite(state.companyCash),realizedCash=cashAfter-cashBefore;
 const crisis=playerCrisis.ensure(state);
 crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);
 const nextStatus=playerCrisis.evaluate(state).status;
 actionState.history.push({actionID,operationID,week:integer(state.week),type,targetID:String(id),targetName:candidate.name,expectedCash:candidate.expectedCash,cashBefore,cashAfter,realizedCash,status:'completed',detail:`${candidate.name} / 状態 ${status(state)}→${nextStatus}`});
 actionState.history=actionState.history.slice(-HISTORY_LIMIT);
 instance.notify(`${candidate.name}の資産整理で${Math.round(realizedCash).toLocaleString('ja-JP')}円を確保しました。`,'warning');
 validate(state);finance.validate(state);instance.save();instance.emit();return true;
}
function validate(state){
 const current=state?.playerCrisisRestructuring,errors=[];
 if(!plain(current))errors.push('playerCrisisRestructuringがオブジェクトではありません。');
 else{
  if(!Number.isFinite(Number(current.nextActionSeq))||Number(current.nextActionSeq)<1)errors.push('playerCrisisRestructuring.nextActionSeqが不正です。');
  if(!Array.isArray(current.history))errors.push('playerCrisisRestructuring.historyが配列ではありません。');
  else{
   if(current.history.length>HISTORY_LIMIT)errors.push('playerCrisisRestructuring.historyが上限を超えています。');
   const ids=new Set();
   for(const row of current.history){
    if(!plain(row)||!row.actionID||!DISPOSITION_TYPES.includes(row.type))errors.push('playerCrisisRestructuring.history要素が不正です。');
    else if(ids.has(row.actionID))errors.push('playerCrisisRestructuring.history actionIDが重複しています。');else ids.add(row.actionID);
    for(const key of ['week','expectedCash','cashBefore','cashAfter','realizedCash'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisRestructuring.history.${key}が有限数ではありません。`);
   }
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

EngineClass.prototype.crisisRestructuringOptions=function(){ensure(this.g);return options(this);};
EngineClass.prototype.executeCrisisDisposition=function(type,id){return execute(this,type,id);};
const baseNormalize=EngineClass.prototype.normalize;
EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;
EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
EngineClass.prototype.__playerCrisisRestructuringInstalled=true;
modules.playerCrisisRestructuring=Object.freeze({HISTORY_LIMIT,DISPOSITION_TYPES,ELIGIBLE_STATUSES,ensure,options,validate,__installed:true});
})();
