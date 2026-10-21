'use strict';
// SPIKE-8B: verified actual legacy material LOT book-value rollforward.
// Read-only; does NOT claim new-ledger cost-of-sales replay/parity.
const {verifySourceGraph}=require('./legacy-source-graph.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const assert=(condition,reason)=>{if(!condition)throw Error(reason);};
function toMinor(n,label){
 assert(typeof n==='number'&&Number.isFinite(n),'invalid-'+label);
 const c=Math.round(n*100);
 assert(Number.isSafeInteger(c)&&Math.abs(n*100-c)<1e-6,'non-cent-'+label);
 return c;
}
function readSnapshot(snapshot,storeID){
 assert(snapshot&&typeof snapshot==='object'&&Array.isArray(snapshot.lots)&&Array.isArray(snapshot.inventoryScope),'missing-material-lot-snapshot');
 const rows=snapshot.lots,byLot=new Map();let total=0n;
 for(const x of rows){
  assert(x&&typeof x.lotID==='string'&&/^lot-[0-9]+$/.test(x.lotID),'invalid-lot-id');
  assert(!byLot.has(x.lotID),'duplicate-lot-id');
  assert(typeof x.materialID==='string'&&x.materialID.length>0,'invalid-material-id');
  assert(x.purchaseOrderID===null||typeof x.purchaseOrderID==='string','invalid-lot-order');
  assert(Number.isFinite(x.quantity)&&x.quantity>=0,'invalid-lot-quantity');
  assert(Number.isSafeInteger(x.receivedWeek)&&x.receivedWeek<=snapshot.week,'invalid-lot-received-week');
  assert(Number.isSafeInteger(x.expiryWeek)&&x.expiryWeek>=x.receivedWeek,'invalid-expiry-week');
  const value=toMinor(x.bookValue,'book-value');
  assert(value>=0,'negative-lot-value');
  if(x.status==='available'){
   assert(x.quantity>0,'empty-available-lot');
   assert(x.expiryWeek>snapshot.week,'expired-available-lot');
   total+=BigInt(value);
  }else assert(['consumed','expired','writtenOff'].includes(x.status),'unknown-lot-status');
  byLot.set(x.lotID,{materialID:x.materialID,purchaseOrderID:x.purchaseOrderID,valueMinor:value,status:x.status});
 }
 assert(total<=BigInt(Number.MAX_SAFE_INTEGER),'stock-book-overflow');
 const self=snapshot.inventoryScope.filter(x=>x.storeID===storeID);
 assert(self.length===1,'store-scope-missing-or-duplicated');
 const storeTotal=toMinor(self[0].availableBookValueJPY,'scope-book');
 assert(Math.abs(Number(total)-storeTotal)<=1,'lot-vs-store-book-mismatch');
 let companySum=0n;
 const storeIds=new Set();
 for(const item of snapshot.inventoryScope){
  assert(item&&typeof item.storeID==='string'&&!storeIds.has(item.storeID),'duplicate-company-store');
  storeIds.add(item.storeID);
  const v=toMinor(item.availableBookValueJPY,'company-scope-book');
  assert(v>=0,'negative-company-stock');companySum+=BigInt(v);
 }
 assert(companySum<=BigInt(Number.MAX_SAFE_INTEGER),'company-book-overflow');
 const financial=toMinor(snapshot.financeInventoryJPY,'company-finance-inventory');
 // Production finance↔lot books are checked with a ¥0.50 tolerance by supply.validate.
 // Do not claim exact company-wide finance parity if the residual is sub-yen.
 const delta=Number(companySum)-financial;
 return {week:snapshot.week,storeBookMinor:Number(total),companyPhysicalBookMinor:Number(companySum),
  companyFinanceBookMinor:financial,companyReconciliationResidualMinor:delta,
  inventoryStoreCount:snapshot.inventoryScope.length,lotCount:rows.length,lots:byLot};
}
function proof(observation){
 try{
  const source=verifySourceGraph(observation);
  assert(source.status==='SOURCE_GRAPH_PARTIAL','source-graph-'+(source.reasons||[]).join(';'));
  const snapshots=observation.sourceGraphEvidence;
  assert(snapshots&&snapshots.opening&&Array.isArray(snapshots.weekly)&&snapshots.weekly.length===13,'missing-period-source');
  assert(Array.isArray(observation.nonStoreWeeklyRows),'missing-company-other-finance-rows');
  const id=ref.provenance.storeId;
  let previous=readSnapshot(snapshots.opening,id);
  assert(previous.week===ref.provenance.gameWeeks[0]-1,'wrong-opening-week');
  const beginning={week:previous.week,storeBookMinor:previous.storeBookMinor,
   lotCount:previous.lotCount,companyPhysicalBookMinor:previous.companyPhysicalBookMinor,
   companyFinanceBookMinor:previous.companyFinanceBookMinor,
   companyReconciliationResidualMinor:previous.companyReconciliationResidualMinor};
  let cumulativeGap=0,verified=0,blocked=0,spoilage=0,receiptAmount=0,cogsAmount=0;
  const rows=[];
  const otherIds=new Set();
  for(let i=0;i<13;i++){
   const expected=ref.weeks[i],week=expected[0],actual=readSnapshot(snapshots.weekly[i],id);
   assert(actual.week===week&&previous.week===week-1,'week-not-consecutive');
   const currentStore=observation.storeWeeklyRows.filter(r=>r.week===week);
   const receipts=currentStore.filter(r=>r.category==='workingCapitalIncrease')
     .reduce((s,r)=>s+toMinor(r.amount,'receipt'),0);
   const cost=currentStore.filter(r=>r.category==='costOfSales')
     .reduce((s,r)=>s+toMinor(r.amount,'cogs'),0);
   assert(currentStore.filter(r=>r.category==='costOfSales').length===1,'invalid-cost-of-sales-cardinality');
   const other=observation.nonStoreWeeklyRows.filter(r=>r.week===week);
   let relevantSpoilage=0;
   for(const r of other){
    assert(typeof r.operationID==='string'&&!otherIds.has(r.operationID),'duplicate-nonstore-id');
    otherIds.add(r.operationID);
    if(r.sourceType!=='spoilage')continue;
    const amt=toMinor(r.amount,'spoilage');
    assert(r.category==='otherOperating'&&r.sourceID==='week-'+week,'unverified-spoilage-source');
    assert(toMinor(r.cashEffect,'spoilage-cash')===0,'spoilage-has-cash');
    assert(toMinor(r.inventoryAmount,'spoilage-inventory')===-amt,'spoilage-inventory-mismatch');
    assert(toMinor(r.assetEffect,'spoilage-assets')===-amt,'spoilage-assets-mismatch');
    assert(toMinor(r.profitEffect,'spoilage-profit')===-amt,'spoilage-profit-mismatch');
    relevantSpoilage+=amt;
   }
   assert(receipts===expected[7]+expected[8],'receipt-amount-drift');
   assert(cost===expected[2],'COGS-amount-drift');
   receiptAmount+=receipts;cogsAmount+=cost;
   const gap=previous.storeBookMinor+receipts-cost-actual.storeBookMinor;
   const onlyThisStore=previous.inventoryStoreCount===1&&actual.inventoryStoreCount===1;
   const attributable=gap===0||(onlyThisStore&&gap===relevantSpoilage);
   const companyReconciled=Math.abs(previous.companyReconciliationResidualMinor)<=50&&
    Math.abs(actual.companyReconciliationResidualMinor)<=50;
   const precedingLots=previous.lots;
   const priorConflicts=[];
   for(const [lotID,lot] of actual.lots)if(precedingLots.has(lotID)){
    const prev=precedingLots.get(lotID);
    if(prev.materialID!==lot.materialID||prev.purchaseOrderID!==lot.purchaseOrderID)priorConflicts.push(lotID);
   }
   assert(priorConflicts.length===0,'lot-ancestry-mutated');
   const status=attributable&&companyReconciled?'SOURCE_STOCK_WEEK_MATCH':'SOURCE_STOCK_WEEK_BLOCKED';
   if(status==='SOURCE_STOCK_WEEK_MATCH')verified++;else blocked++;
   cumulativeGap+=gap;spoilage+=relevantSpoilage;
   rows.push({week,status,openingStoreBookMinor:previous.storeBookMinor,receiptMinor:receipts,
    costOfSalesMinor:cost,nonStoreSpoliageMinor:relevantSpoilage,closingStoreBookMinor:actual.storeBookMinor,
    residualMinor:gap-relevantSpoilage,attributionLimit:!onlyThisStore&&relevantSpoilage!==0?'company-wide-spoilage-not-store-attributable':null,
    companyFinanceResidualMinor:actual.companyReconciliationResidualMinor,
    reason:status==='SOURCE_STOCK_WEEK_MATCH'?null:
     !companyReconciled?'company-finance-physical-inventory-outside-tolerance':
     !attributable?'unattributed-stock-book-change':'unverified-company-inventory'});
   previous=actual;
  }
  assert(verified+blocked===13,'missing-week-classification');
  return {status:'SOURCE_STOCK_EVIDENCE_PARTIAL',verifiedWeeks:verified,blockedWeeks:blocked,
   opening:beginning,receiptTotalMinor:receiptAmount,costOfSalesTotalMinor:cogsAmount,
   observedNonStoreSpoilageMinor:spoilage,totalStockValueReductionMinor:cumulativeGap,
   weeks:rows,
   blockers:['company-opening-physical-inventory-not-synced-to-core-opening-ledger',
    'cash-purchase-inventory-not-backed-by-external-legal-entity',
    'material-lot-snapshot-is-week-end-not-full-intraweek-consumption-source',
    'missing-all-nonstore-legal-counterparties','no-store-specific-fixed-asset-acquisition',
    'no-full-138-journal-replay-or-save-durability'],
   note:'Authenticated physical-lot evidence/classification; even verified weeks do NOT authorize a source-to-core COGS posting.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e&&e.message||e)]};}
}
module.exports={readSnapshot,proof};
