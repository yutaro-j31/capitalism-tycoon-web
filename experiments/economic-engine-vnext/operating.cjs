'use strict';
// SPIKE-5: fixed-asset capitalization/depreciation, cash rent and maintenance.
// Uses SPIKE-4 inventory/AP and SPIKE-3 equity/store canonical journal.
// Isolated experiment, not a production writer or real durable commit protocol.
const core=require('./core.cjs');
const supply=require('./inventory-ap.cjs');
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
const copy=x=>JSON.parse(JSON.stringify(x));
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const allowed=['acquire-equipment','depreciate-equipment','pay-rent','pay-maintenance'];
function id(x,label){
 if(typeof x!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(x))throw Error('invalid-'+label);
 return x;
}
function safe(x,label){
 if(!Number.isSafeInteger(x)||x<=0)throw Error('invalid-'+label);return x;
}
function nonnegative(x,label){
 if(!Number.isSafeInteger(x)||x<0)throw Error('invalid-'+label);return x;
}
function entity(entities,x,label){id(x,label);if(!entities.includes(x))throw Error('unknown-'+label);return x;}
function key(company,assetId){return company+':fixed-asset:'+assetId;}
function balanceToNumber(x,label){
 if(x<0n||x>MAX)throw Error('overflow-'+label);return Number(x);
}
function depreciationDue(asset){
 if(asset.depreciationCount>=asset.usefulLifeWeeks)throw Error('asset-fully-depreciated');
 const residual=BigInt(asset.costMinor)-BigInt(asset.salvageMinor);
 const base=residual/BigInt(asset.usefulLifeWeeks);
 const used=base*BigInt(asset.depreciationCount);
 const remaining=residual-used;
 return balanceToNumber(asset.depreciationCount+1===asset.usefulLifeWeeks?remaining:base,'depreciation');
}
function replay(events){
 const assets=new Map(),operatingCharges=new Set(),rent=new Map(),maintenance=new Map();
 for(const e of events){
  const assetKey=e.company+':'+(e.assetId||'');
  if(e.type==='acquire-equipment'){
   if(assets.has(assetKey))throw Error('duplicate-asset');
   const cost=safe(e.amountMinor,'amount');
   const salvage=nonnegative(e.salvageMinor,'salvage');
   const life=safe(e.usefulLifeWeeks,'useful-life');
   if(salvage>=cost||BigInt(cost)-BigInt(salvage)<BigInt(life))throw Error('invalid-depreciation-schedule');
   assets.set(assetKey,{
    company:e.company,assetId:e.assetId,storeId:e.storeId,vendor:e.counterparty,
    costMinor:cost,salvageMinor:salvage,usefulLifeWeeks:life,
    depreciationCount:0,accumulatedMinor:0,lastWeek:0
   });
  } else if(e.type==='depreciate-equipment'){
   const a=assets.get(assetKey);
   if(!a||a.storeId!==e.storeId)throw Error('unknown-asset');
   if(e.week<=a.lastWeek)throw Error('nonmonotonic-depreciation-week');
   const due=depreciationDue(a);
   if(e.amountMinor!==due)throw Error('depreciation-schedule-mismatch');
   a.depreciationCount++;a.accumulatedMinor=balanceToNumber(BigInt(a.accumulatedMinor)+BigInt(due),'accumulated-depreciation');a.lastWeek=e.week;
  } else if(e.type==='pay-rent'||e.type==='pay-maintenance'){
   const distinct=[e.company,e.storeId,e.type,e.week].join(':');
   if(operatingCharges.has(distinct))throw Error('duplicate-weekly-charge');
   operatingCharges.add(distinct);
   const target=e.type==='pay-rent'?rent:maintenance;
   const sourceKey=e.company+':'+e.storeId;
   target.set(sourceKey,(target.get(sourceKey)||0n)+BigInt(e.amountMinor));
  } else throw Error('unknown-operating-event');
 }
 return {assets,rent,maintenance};
}
function postings(e){
 const c=e.company,n=e.amountMinor;
 switch(e.type){
 case 'acquire-equipment':return [
  {account:c+':fixed-asset:'+e.assetId,deltaMinor:n},
  {account:c+':cash',deltaMinor:-n},
  {account:e.counterparty+':cash',deltaMinor:n},
  {account:e.counterparty+':revenue:'+e.storeId+'-equipment',deltaMinor:-n}
 ];
 case 'depreciate-equipment':return [
  {account:c+':expense:'+e.storeId+'-depreciation',deltaMinor:n},
  {account:c+':fixed-asset:'+e.assetId,deltaMinor:-n}
 ];
 case 'pay-rent':
 case 'pay-maintenance':{
  const category=e.type==='pay-rent'?'rent':'maintenance';
  return [
   {account:c+':cash',deltaMinor:-n},
   {account:c+':expense:'+e.storeId+'-'+category,deltaMinor:n},
   {account:e.counterparty+':cash',deltaMinor:n},
   {account:e.counterparty+':revenue:'+e.storeId+'-'+category,deltaMinor:-n}
  ];
 }
 default:throw Error('unknown-operating-event');
 }
}
function openingState(supplyState){
 supply.validateSupplyState(supplyState);
 const s={schemaVersion:1,supply:copy(supplyState),events:[]};
 validateState(s);return s;
}
function validateState(s){
 if(!s||s.schemaVersion!==1||!s.supply||!Array.isArray(s.events))throw Error('invalid-operating-state');
 supply.validateSupplyState(s.supply);
 const c=s.supply.unified.core,ids=new Set();let previousSeq=0;
 for(const e of s.events){
  if(!e||!allowed.includes(e.type))throw Error('invalid-operating-event');
  id(e.operationId,'operation-id');id(e.company,'company');id(e.storeId,'store-id');
  entity(c.entities,e.company,'company');safe(e.amountMinor,'amount');
  if(e.type==='acquire-equipment'||e.type==='depreciate-equipment')id(e.assetId,'asset-id');
  if(e.type==='acquire-equipment'){
   entity(c.entities,e.counterparty,'vendor');
   if(e.counterparty===e.company)throw Error('self-vendor');
   nonnegative(e.salvageMinor,'salvage');safe(e.usefulLifeWeeks,'useful-life');
  }
  if(e.type==='pay-rent'||e.type==='pay-maintenance'){
   entity(c.entities,e.counterparty,'counterparty');
   if(e.counterparty===e.company)throw Error('self-counterparty');
  }
  if(e.type!=='acquire-equipment'){
   if(!Number.isSafeInteger(e.week)||e.week<=0||e.week>1000000)throw Error('invalid-week');
  }
  if(ids.has(e.operationId))throw Error('duplicate-operating-id');ids.add(e.operationId);
  if(!Number.isSafeInteger(e.sequence)||e.sequence<=previousSeq||c.receipts[e.operationId]!==e.sequence)throw Error('operating-receipt-mismatch');
  previousSeq=e.sequence;
  const j=c.journal[e.sequence-1];
  if(!j||j.operationId!==e.operationId||j.type!=='journal'||JSON.stringify(j.postings)!==JSON.stringify(postings(e)))throw Error('operating-journal-mismatch');
 }
 const state=replay(s.events);
 const expect=new Map();
 for(const a of state.assets.values())expect.set(key(a.company,a.assetId),BigInt(a.costMinor)-BigInt(a.accumulatedMinor));
 for(const [account,value]of expect)if(BigInt(c.balances[account]??0)!==value)throw Error('fixed-asset-reconciliation');
 for(const [account]of Object.entries(c.balances))if(account.includes(':fixed-asset:')&&!expect.has(account))throw Error('orphan-fixed-asset');
 for(const j of c.journal){
  if(j.postings.some(p=>p.account.includes(':fixed-asset:'))&&!ids.has(j.operationId))throw Error('unauthorized-fixed-asset-writer');
 }
 return true;
}
function plan(s,op){
 try{
  validateState(s);
  if(!op||!allowed.includes(op.type))throw Error('unsupported-operating-operation');
  const c=s.supply.unified.core;
  const company=entity(c.entities,op.company,'company'),storeId=id(op.storeId,'store-id');
  const operationId=id(op.id,'operation-id');
  const type=op.type,proposal=copy(s);
  const event={operationId,type,company,storeId,sequence:c.nextSequence,amountMinor:0};
  if(type==='depreciate-equipment'){
   event.assetId=id(op.assetId,'asset-id');
   event.week=safe(op.week,'week');
   const known=replay(s.events).assets.get(company+':'+event.assetId);
   if(!known||known.storeId!==storeId)throw Error('unknown-asset');
   if(event.week<=known.lastWeek)throw Error('nonmonotonic-depreciation-week');
   event.amountMinor=depreciationDue(known);
   if(op.amountMinor!==undefined&&op.amountMinor!==event.amountMinor)throw Error('depreciation-schedule-mismatch');
  }else{
   event.amountMinor=safe(op.amountMinor,'amount');
   if(type==='acquire-equipment'){
    event.assetId=id(op.assetId,'asset-id');
    event.salvageMinor=nonnegative(op.salvageMinor,'salvage');
    event.usefulLifeWeeks=safe(op.usefulLifeWeeks,'useful-life');
    event.counterparty=entity(c.entities,op.vendor,'vendor');
    if(event.counterparty===company)throw Error('self-vendor');
   }else{
    event.counterparty=entity(c.entities,op.counterparty,'counterparty');
    if(event.counterparty===company)throw Error('self-counterparty');
    event.week=safe(op.week,'week');
   }
  }
  proposal.events.push(event);
  replay(proposal.events);
  const r=core.planOperation(c,{id:operationId,type:'journal',postings:postings(event)});
  if(!r.ok)throw Error(r.reason);
  proposal.supply.unified.core=r.state;
  validateState(proposal);
  return {ok:true,state:proposal,receipt:r.receipt};
 }catch(e){return {ok:false,state:s,reason:e.message||'invalid-operating-transaction'};}
}
function admit(s,op,persist){
 const p=plan(s,op);
 if(!p.ok)return p;
 if(typeof persist!=='function')return {ok:false,state:s,reason:'persistence-required'};
 try{if(persist(copy(p.state))!==true)return {ok:false,state:s,reason:'persistence-rejected'};return p;}
 catch(e){return {ok:false,state:s,reason:'persistence-threw'};}
}
function snapshot(s,company,storeId){
 validateState(s);const c=s.supply.unified.core;
 entity(c.entities,company,'company');id(storeId,'store-id');
 const summary=replay(s.events);
 const assets=[...summary.assets.values()].filter(a=>a.company===company&&a.storeId===storeId)
 .sort((a,b)=>a.assetId.localeCompare(b.assetId))
 .map(a=>({assetId:a.assetId,grossMinor:String(a.costMinor),salvageMinor:String(a.salvageMinor),
  accumulatedDepreciationMinor:String(a.accumulatedMinor),bookMinor:String(a.costMinor-a.accumulatedMinor),
  remainingWeeks:a.usefulLifeWeeks-a.depreciationCount}));
 const code=company+':'+storeId;
 const depreciationMinor=assets.reduce((sum,a)=>sum+BigInt(a.accumulatedDepreciationMinor),0n);
 return {company,storeId,assets,rentExpenseMinor:String(summary.rent.get(code)||0n),
  maintenanceExpenseMinor:String(summary.maintenance.get(code)||0n),
  depreciationExpenseMinor:String(depreciationMinor)};
}
module.exports={openingState,validateState,plan,admit,snapshot};
