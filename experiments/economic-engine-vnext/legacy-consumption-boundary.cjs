'use strict';
// Disposable harness instrumentation only. IDs below identify observer calls,
// NOT production consume() events, legal parties, or authoritative journals.
const {runAuthenticated:lotAuthority}=require('./legacy-lot-authority.cjs');
const check=(ok,why)=>{if(!ok)throw Error(why);};
const copy=x=>JSON.parse(JSON.stringify(x));
function minor(n){
 check(typeof n==='number'&&Number.isFinite(n),'invalid-money');
 const v=Math.round(n*100);
 check(Number.isSafeInteger(v)&&Math.abs(n*100-v)<1e-6,'invalid-minor-money');
 return v;
}
function lots(g,id){
 const materials=g.inventoryByStoreID?.[id]?.materials;
 check(materials&&typeof materials==='object','missing-inventory');
 return copy(Object.entries(materials).flatMap(([materialID,m])=>(m.lots||[]).map(l=>({
  lotID:l.lotID,materialID,purchaseOrderID:l.purchaseOrderID??null,
  supplierContractID:l.supplierContractID??null,receivedWeek:l.receivedWeek,
  quantity:l.quantity,bookValue:l.bookValue,status:l.status
 })))).sort((a,b)=>a.lotID.localeCompare(b.lotID));
}
function install(modules,storeID){
 const supply=modules?.supply,finance=modules?.finance;
 check(typeof supply?.applyConstraint==='function'&&typeof finance?.event==='function','missing-observation-hooks');
 const originalApply=supply.applyConstraint,originalEvent=finance.event;
 const events=[];let active=null,restored=false;
 function event(g,category,amount,options){
  const result=Reflect.apply(originalEvent,this,arguments);
  if(active&&g===active.game&&options?.storeID===storeID){
   check(['emergency-receipt-cash','inventory-receipt-cash','inventory-receipt-ap'].includes(options.sourceType),
    'unexpected-finance-event-inside-supply-boundary');
   active.record.receipts.push({operationID:options.operationID,amountMinor:minor(amount),
    sourceType:options.sourceType});
   active.record.consumptionOpening=lots(g,storeID);
  }
  return result;
 }
 function apply(g,store){
  if(store?.id!==storeID)return Reflect.apply(originalApply,this,arguments);
  check(!active,'nested-supply-observation');
  const before=lots(g,storeID);
  const record={observerID:'supply-boundary-'+(events.length+1),week:g.week,storeID,
   before,consumptionOpening:before,receipts:[]};
  active={game:g,record};
  try{
   const result=Reflect.apply(originalApply,this,arguments);
   record.after=lots(g,storeID);record.returnedCOGSMinor=minor(result.totalCostOfSales);
   events.push(record);return result;
  }finally{active=null;}
 }
 supply.applyConstraint=apply;finance.event=event;
 return {snapshot:()=>copy(events),restore(){
  if(restored)return;
  check(supply.applyConstraint===apply&&finance.event===event,'observation-hook-replaced');
  supply.applyConstraint=originalApply;finance.event=originalEvent;restored=true;
 }};
}
function book(rows){
 check(Array.isArray(rows),'missing-lot-image');
 const map=new Map();let sum=0n;
 for(const row of rows){
  check(row&&/^lot-[0-9]+$/.test(row.lotID)&&!map.has(row.lotID),'invalid-or-duplicate-lot');
  check(typeof row.materialID==='string'&&row.materialID.length>0,'invalid-material');
  check(typeof row.quantity==='number'&&Number.isFinite(row.quantity)&&row.quantity>=0,'invalid-quantity');
  check(['available','consumed','expired','writtenOff'].includes(row.status),'invalid-lot-status');
  const value=minor(row.bookValue);check(value>=0,'negative-lot-book');
  // recalcMaterial removes depleted lots; retained nonavailable stock is not COGS.
  check(row.status==='available'||value===0,'nonavailable-valued-lot');
  check(row.status!=='available'||row.quantity>0,'empty-available-lot');
  sum+=BigInt(value);map.set(row.lotID,{...row,valueMinor:value});
 }
 check(sum<=BigInt(Number.MAX_SAFE_INTEGER),'book-overflow');
 return {map,total:Number(sum)};
}
function verify(events,observation){
 try{
  check(Array.isArray(events)&&events.length===13,'expected-13-boundaries');
  check(Array.isArray(observation?.storeWeeklyRows),'missing-finance-rows');
  const seen=new Set(),receiptIDs=new Set(),weeks=[];let total=0;
  for(let i=0;i<events.length;i++){
   const e=events[i];
   check(e&&e.observerID==='supply-boundary-'+(i+1)&&!seen.has(e.observerID),'observer-sequence');
   seen.add(e.observerID);
   check(e.storeID===observation.observedStore.id&&e.week===observation.observedWeeks[0]+i,'boundary-scope');
   const before=book(e.before),opening=book(e.consumptionOpening),after=book(e.after);
   check(Array.isArray(e.receipts),'missing-receipts');
   let receiptTotal=0;
   for(const r of e.receipts){
    check(typeof r.operationID==='string'&&!receiptIDs.has(r.operationID),'duplicate-receipt');
    receiptIDs.add(r.operationID);
    const source=observation.storeWeeklyRows.filter(x=>x.week===e.week&&x.operationID===r.operationID);
    check(source.length===1&&source[0].sourceType===r.sourceType&&
     ['emergency-receipt-cash','inventory-receipt-cash','inventory-receipt-ap'].includes(r.sourceType),
     'receipt-source-mismatch');
    check(Number.isSafeInteger(r.amountMinor)&&r.amountMinor>=0&&minor(source[0].amount)===r.amountMinor,'receipt-amount-mismatch');
    receiptTotal+=r.amountMinor;
   }
   check(Number.isSafeInteger(receiptTotal)&&opening.total-before.total===receiptTotal,'boundary-receipt-stock-mismatch');
   if(e.receipts.length===0)check(JSON.stringify(e.before)===JSON.stringify(e.consumptionOpening),'unobserved-opening-replacement');
   const reductions=[];
   for(const [id,a]of opening.map){
    const b=after.map.get(id);
    check(a.purchaseOrderID!==null&&a.purchaseOrderID!=='merged','unresolved-consumption-PO');
    if(b){
     check(a.materialID===b.materialID&&a.purchaseOrderID===b.purchaseOrderID&&
      a.supplierContractID===b.supplierContractID&&a.receivedWeek===b.receivedWeek,'boundary-lot-identity-changed');
     check(b.quantity<=a.quantity&&b.valueMinor<=a.valueMinor,'lot-increased-during-consumption');
    }
    const delta=a.valueMinor-(b?.valueMinor||0);
    if(delta>0)reductions.push({lotID:id,materialID:a.materialID,purchaseOrderID:a.purchaseOrderID,
     reductionMinor:delta,kind:'OBSERVED_APPLY_CONSTRAINT_NET_REDUCTION'});
   }
   for(const id of after.map.keys())check(opening.map.has(id),'new-lot-during-consumption');
   const cogs=observation.storeWeeklyRows.filter(r=>r.week===e.week&&r.category==='costOfSales');
   check(cogs.length===1,'expected-one-source-COGS');
   const cost=minor(cogs[0].amount);
   check(Number.isSafeInteger(e.returnedCOGSMinor)&&cost===e.returnedCOGSMinor&&
    opening.total-after.total===cost&&reductions.reduce((s,x)=>s+x.reductionMinor,0)===cost,'boundary-COGS-mismatch');
   total+=cost;check(Number.isSafeInteger(total),'COGS-overflow');
   weeks.push({week:e.week,sourceCOGSOperationID:cogs[0].operationID,observerID:e.observerID,
    costOfSalesMinor:cost,receiptCount:e.receipts.length,lotReductions:reductions});
  }
  return {status:'BOUNDARY_CONTRACT_ONLY',verifiedWeeks:13,totalCOGSMinor:total,weeks,
   productionConsumptionEventIDs:0,newCanonicalPostings:0,
   limitations:['observer-IDs-are-not-production-consumption-event-IDs',
    'boundary-net-reductions-do-not-prove-each-internal-consume-step',
    'opening-finance-and-external-legal-payees-remain-unverified']};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e.message||e)]};}
}
function runAuthenticated(observation){
 const authority=lotAuthority(observation);
 if(authority.status!=='SOURCE_LOT_AUTHORITY_GAPS_PARTIAL')return {status:'EVIDENCE_BLOCKED',reasons:['original-source-authority-blocked',...(authority.reasons||[])]};
 const result=verify(observation.consumptionBoundaryEvidence,observation);
 if(result.status==='EVIDENCE_BLOCKED')return result;
 try{
  // A new intraperiod lot may be consumed before any weekly snapshot. Its
  // PO must nevertheless exist in the independently checked source graph.
  const orders=new Map();
  for(const image of [observation.sourceGraphEvidence.opening,...observation.sourceGraphEvidence.weekly])
   for(const po of image.orders)orders.set(po.orderID,po);
  for(const e of observation.consumptionBoundaryEvidence)
   for(const image of [e.before,e.consumptionOpening,e.after])for(const lot of image){
    const po=orders.get(lot.purchaseOrderID);
    check(po&&po.storeID===e.storeID&&po.materialID===lot.materialID&&
     (po.supplierContractID??null)===(lot.supplierContractID??null),
     'boundary-lot-PO-not-in-original-source');
   }
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e.message||e)]};}
 return {...result,status:'SOURCE_CONSUMPTION_BOUNDARY_PARTIAL',previousRowsPosted:53,previousRowsHeld:96};
}
module.exports={install,verify,runAuthenticated};
