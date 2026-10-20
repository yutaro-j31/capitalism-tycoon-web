'use strict';
// SPIKE-4: source-backed inventory and payable settlement in the SAME unified ledger.
// Isolated experiment only. No production/save-v9 or durable IDB integration.
const core=require('./core.cjs');
const unified=require('./unified.cjs');
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clone=v=>JSON.parse(JSON.stringify(v));
function id(v,label){
  if(typeof v!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(v))throw Error('invalid-'+label);
  return v;
}
function positive(v,label){
  if(!Number.isSafeInteger(v)||v<=0)throw Error('invalid-'+label);
  return v;
}
function safe(v,label){
  if(v<0n||v>MAX)throw Error('overflow-'+label);
  return Number(v);
}
function entity(s,v,label){
  id(v,label);
  if(!s.unified.core.entities.includes(v))throw Error('unknown-'+label);
  return v;
}
const entry=(account,deltaMinor)=>({account,deltaMinor});
function legs(e){
  const company=e.company, supplier=e.supplier, store=e.storeId, order=e.orderId, n=e.amountMinor;
  if(e.type==='receive-inventory-credit')return [
    entry(company+':inventory:'+store,n),
    entry(company+':payable:'+order,-n),
    entry(supplier+':receivable:'+order,n),
    entry(supplier+':revenue:'+store,-n)
  ];
  if(e.type==='receive-inventory-cash')return [
    entry(company+':inventory:'+store,n),
    entry(company+':cash',-n),
    entry(supplier+':cash',n),
    entry(supplier+':revenue:'+store,-n)
  ];
  if(e.type==='pay-inventory-ap')return [
    entry(company+':cash',-n),
    entry(company+':payable:'+order,n),
    entry(supplier+':cash',n),
    entry(supplier+':receivable:'+order,-n)
  ];
  if(e.type==='consume-inventory')return [
    entry(company+':expense:'+store+'-cogs',n),
    entry(company+':inventory:'+store,-n)
  ];
  throw Error('unknown-supply-type');
}
function openingState(unifiedState){
  unified.validateUnifiedState(unifiedState);
  if(unifiedState.core.journal.some(j=>j.postings.some(p=>p.account.includes(':inventory:')||p.account.includes(':payable:'))))throw Error('nonempty-inventory-genesis');
  const state={schemaVersion:1,unified:clone(unifiedState),events:[]};
  validateSupplyState(state);return state;
}
function exposure(events){
  const orders=new Map(),inventory=new Map();
  for(const e of events){
    const k=e.company+':'+e.storeId,prev=inventory.get(k)||0n;
    if(e.type==='receive-inventory-credit'||e.type==='receive-inventory-cash'){
      if(orders.has(e.orderId))throw Error('duplicate-purchase-order');
      orders.set(e.orderId,{company:e.company,supplier:e.supplier,storeId:e.storeId,credit:e.type==='receive-inventory-credit',amount:BigInt(e.amountMinor),paid:0n});
      inventory.set(k,prev+BigInt(e.amountMinor));
    } else if(e.type==='consume-inventory'){
      if(prev<BigInt(e.amountMinor))throw Error('insufficient-inventory');
      inventory.set(k,prev-BigInt(e.amountMinor));
    } else if(e.type==='pay-inventory-ap'){
      const o=orders.get(e.orderId);
      if(!o||!o.credit||o.company!==e.company||o.supplier!==e.supplier||o.storeId!==e.storeId)throw Error('unknown-purchase-payable');
      o.paid+=BigInt(e.amountMinor);
      if(o.paid>o.amount)throw Error('overpayment');
    } else throw Error('unknown-supply-type');
  }
  return {orders,inventory};
}
function validateSupplyState(s){
  if(!s||s.schemaVersion!==1||!s.unified||!Array.isArray(s.events))throw Error('invalid-supply-state');
  unified.validateUnifiedState(s.unified);
  const coreState=s.unified.core,seen=new Set();
  let prevSeq=0;
  for(const e of s.events){
    if(!e||typeof e!=='object'||!['receive-inventory-credit','receive-inventory-cash','consume-inventory','pay-inventory-ap'].includes(e.type))throw Error('invalid-supply-event');
    id(e.operationId,'operation-id');
    id(e.company,'company');id(e.storeId,'store-id');
    if(!coreState.entities.includes(e.company))throw Error('unknown-company');
    if(e.type!=='consume-inventory'){
      id(e.supplier,'supplier');id(e.orderId,'order-id');
      if(!coreState.entities.includes(e.supplier)||e.supplier===e.company)throw Error('invalid-counterparty');
    }
    positive(e.amountMinor,'amount');
    if(seen.has(e.operationId))throw Error('duplicate-event-id');seen.add(e.operationId);
    if(!Number.isSafeInteger(e.sequence)||e.sequence<=prevSeq||coreState.receipts[e.operationId]!==e.sequence)throw Error('supply-receipt-mismatch');
    prevSeq=e.sequence;
    const j=coreState.journal[e.sequence-1];
    if(!j||j.operationId!==e.operationId||j.type!=='journal'||JSON.stringify(j.postings)!==JSON.stringify(legs(e)))throw Error('supply-journal-mismatch');
  }
  const {orders,inventory}=exposure(s.events);
  // No writer outside source-backed supply events can touch authoritative
  // inventory/AP accounts, even if that writer emits balanced core journal legs.
  for(const j of coreState.journal) {
    if(j.postings.some(p=>p.account.includes(':inventory:')||p.account.includes(':payable:'))&&!seen.has(j.operationId))throw Error('unauthorized-inventory-writer');
  }
  const expectedInv=new Map();
  for(const [key,balance] of inventory.entries()){
    const sep=key.indexOf(':'),company=key.slice(0,sep),storeId=key.slice(sep+1);
    expectedInv.set(company+':inventory:'+storeId,balance);
  }
  const expectedAP=new Map(),expectedAR=new Map();
  for(const [order,info] of orders.entries())if(info.credit){
    expectedAP.set(info.company+':payable:'+order,-(info.amount-info.paid));
    expectedAR.set(info.supplier+':receivable:'+order,info.amount-info.paid);
  }
  const balances=coreState.balances;
  for(const [k,v] of expectedInv)if(BigInt(balances[k]??0)!==v)throw Error('inventory-balance-mismatch');
  for(const [k,v] of expectedAP)if(BigInt(balances[k]??0)!==v)throw Error('payable-balance-mismatch');
  for(const [k,v] of expectedAR)if(BigInt(balances[k]??0)!==v)throw Error('supplier-receivable-mismatch');
  for(const [k,v] of Object.entries(balances)){
    if(k.includes(':inventory:')&&!expectedInv.has(k))throw Error('orphan-inventory-account');
    if(k.includes(':payable:')&&!expectedAP.has(k))throw Error('orphan-payable-account');
    if(k.includes(':receivable:')){
      // Core loan receivables are canonical, but supply PO receivables must
      // use distinct prefixed order IDs and have a matched source receipt.
      const order=k.split(':').slice(2).join(':');
      if(order.startsWith('po-')&&!expectedAR.has(k))throw Error('orphan-supplier-receivable');
    }
  }
  return true;
}
function planSupply(s,op){
  try{
    validateSupplyState(s);
    if(!op||!['receive-inventory-credit','receive-inventory-cash','pay-inventory-ap','consume-inventory'].includes(op.type))throw Error('unsupported-supply-operation');
    const company=entity(s,op.company,'company'),storeId=id(op.storeId,'store-id');
    const operationId=id(op.id,'operation-id');
    const amountMinor=positive(op.amountMinor,'amount');
    if(op.type!=='consume-inventory'){
      entity(s,op.supplier,'supplier');
      if(op.supplier===company)throw Error('self-supply');
      id(op.orderId,'order-id');
      if(!op.orderId.startsWith('po-'))throw Error('order-id-prefix-required');
    }
    const event={operationId,type:op.type,company,storeId,amountMinor,sequence:s.unified.core.nextSequence};
    if(op.type!=='consume-inventory'){
      event.supplier=op.supplier;event.orderId=op.orderId;
      if(has(s.unified.core.loans,op.orderId))throw Error('order-loan-id-collision');
    }
    const proposed=clone(s);
    proposed.events.push(event);
    // Verify orders, independent shareholder claims, unpaid balances and
    // inventory conservation BEFORE invoking the core journal writer.
    exposure(proposed.events);
    const result=core.planOperation(s.unified.core,{id:operationId,type:'journal',postings:legs(event)});
    if(!result.ok)throw Error(result.reason);
    proposed.unified.core=result.state;
    validateSupplyState(proposed);
    return {ok:true,state:proposed,receipt:result.receipt};
  }catch(e){return {ok:false,state:s,reason:e.message||'invalid-supply-operation'};}
}
function admitSupply(s,op,persist){
  const staged=planSupply(s,op);
  if(!staged.ok)return staged;
  if(typeof persist!=='function')return {ok:false,state:s,reason:'persistence-required'};
  try{
    if(persist(clone(staged.state))!==true)return {ok:false,state:s,reason:'persistence-rejected'};
    return staged;
  }catch(_){return {ok:false,state:s,reason:'persistence-threw'};}
}
function snapshot(s,company,storeId){
  validateSupplyState(s);
  entity(s,company,'company');id(storeId,'store-id');
  const {orders,inventory}=exposure(s.events);
  const current=inventory.get(company+':'+storeId)||0n;
  const items=[...orders.entries()].filter(([,v])=>v.company===company&&v.storeId===storeId)
    .sort(([a],[b])=>a.localeCompare(b)).map(([orderId,v])=>({
      orderId,supplier:v.supplier,credit:v.credit,
      originalMinor:v.amount.toString(),
      outstandingMinor:(v.credit?v.amount-v.paid:0n).toString()
    }));
  return {company,storeId,inventoryMinor:current.toString(),outstandingPayableMinor:items.reduce((a,o)=>a+BigInt(o.outstandingMinor),0n).toString(),orders:items};
}
module.exports={openingState,validateSupplyState,planSupply,admitSupply,snapshot};
