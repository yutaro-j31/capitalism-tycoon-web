'use strict';
// SPIKE-7: source-ID grounded purchase-order ancestry; READ-ONLY.
// Supplier catalogue identifier != independent legal-entity ledger identity.
const {verifyObservation}=require('./legacy-week-bridge.cjs');
const ensure=(ok,msg)=>{if(!ok)throw Error(msg)};
function cents(v,label){
 const n=Number(v),q=n*100,k=Math.round(q);
 ensure(v!==null&&v!==undefined&&Number.isFinite(n)&&Number.isSafeInteger(k)&&Math.abs(q-k)<1e-6,'invalid-'+label);
 return k;
}
function baseOrderID(row){
 if(row.category==='accountsPayablePayment'){
  ensure(row.sourceType==='ap-payment'&&/^po-[0-9]+$/.test(row.sourceID),'invalid-ap-order-id');
  ensure(row.operationID===row.sourceID+'-ap-pay-'+row.week,'invalid-ap-payment-receipt-id');
  return row.sourceID;
 }
 ensure(row.category==='workingCapitalIncrease','unsupported-procurement-type');
 ensure(['inventory-receipt-ap','emergency-receipt-cash','inventory-receipt-cash'].includes(row.sourceType),'unexpected-procurement-source');
 // js/supply.js receiptAccounting(): sourceID is exactly:
 //   po.orderID + '-' + po.receivedQuantity
 // while AP payment's sourceID is exactly po.orderID.
 const match=/^(po-[0-9]+)-([0-9]+(?:\.[0-9]+)?)$/.exec(row.sourceID);
 ensure(match,'invalid-receipt-order-id');
 const suffix=row.sourceType==='inventory-receipt-ap'?'ap':'cash';
 ensure(row.operationID===match[1]+'-receipt-'+suffix+'-'+match[2],'invalid-po-receipt-id');
 return match[1];
}
function buildPurchaseGraph(observation){
 try{
  ensure(observation&&Array.isArray(observation.storeWeeklyRows),'missing-source-rows');
  const evidence=observation.sourceGraphEvidence;
  ensure(evidence&&evidence.opening&&Array.isArray(evidence.weekly)&&evidence.weekly.length===13,'missing-source-snapshots');
  ensure(Array.isArray(evidence.opening.orders),'missing-opening-purchase-orders');
  const store=observation.observedStore?.id,business=observation.observedStore?.businessID;
  ensure(typeof store==='string'&&typeof business==='string','missing-store-identity');
  const weeks=observation.observedWeeks;
  ensure(Array.isArray(weeks)&&weeks[1]-weeks[0]===12,'invalid-week-window');
  ensure(evidence.opening.week===weeks[0]-1,'opening-week-mismatch');
  const all=[evidence.opening,...evidence.weekly];
  const orderMap=new Map(),snapshotByWeek=new Map();
  for(let i=0;i<all.length;i++){
   const entry=all[i],week=weeks[0]-1+i;
   ensure(entry&&entry.week===week&&Array.isArray(entry.orders),'source-snapshot-week-'+week);
   const byOrder=new Map();
   for(const order of entry.orders){
    ensure(order&&/^po-[0-9]+$/.test(order.orderID),'unknown-order-id');
    ensure(order.storeID===store&&order.businessID===business,'cross-store-order');
    ensure(typeof order.supplierID==='string'&&order.supplierID.length>0,'missing-supplier-catalog-id');
    ensure(typeof order.materialID==='string'&&order.materialID.length>0,'missing-material-source-id');
    ensure(Number.isSafeInteger(order.orderWeek)&&order.orderWeek<=week,'invalid-order-week');
    ensure(!byOrder.has(order.orderID),'duplicate-order-snapshot');
    const prior=orderMap.get(order.orderID);
    if(prior)ensure(prior.supplierCatalogID===order.supplierID&&prior.materialID===order.materialID&&prior.orderWeek===order.orderWeek,'changed-order-ancestry');
    else orderMap.set(order.orderID,{orderID:order.orderID,supplierCatalogID:order.supplierID,
      materialID:order.materialID,orderWeek:order.orderWeek,receipts:[],payments:[]});
    byOrder.set(order.orderID,order);
   }
   snapshotByWeek.set(week,byOrder);
  }
  const seen=new Set();let cashReceipts=0,creditReceipts=0,apPayments=0,sourceMissing=0;
  for(const row of observation.storeWeeklyRows){
   if(!['workingCapitalIncrease','accountsPayablePayment'].includes(row.category))continue;
   const orderID=baseOrderID(row),group=orderMap.get(orderID),week=row.week;
   ensure(!seen.has(row.operationID),'duplicate-finance-operation');seen.add(row.operationID);
   const snap=snapshotByWeek.get(week)?.get(orderID);
   // Don't silently synthesize an order if source PO has already been compacted.
   if(!group||!snap){sourceMissing++;continue;}
   ensure(row.storeID===store&&row.businessID===business,'wrong-store-finance-source');
   ensure(group.orderWeek<=week,'event-before-order');
   const n=cents(row.amount,'finance-amount');
   if(row.category==='workingCapitalIncrease'){
    ensure(cents(snap.receivedCost,'po-received-cost')>=n,'receipt-not-in-po-ledger');
    const isCredit=row.sourceType==='inventory-receipt-ap';
    if(isCredit)creditReceipts++;else cashReceipts++;
    group.receipts.push({operationID:row.operationID,week,amountMinor:n,
      kind:isCredit?'credit':'cash',sourceID:row.sourceID});
   }else{
    ensure(cents(snap.paidAmount,'po-paid-amount')>=n,'payment-not-in-po-ledger');
    apPayments++;
    group.payments.push({operationID:row.operationID,week,amountMinor:n});
   }
  }
  ensure(sourceMissing===0,'unmatched-finance-to-purchase-order-'+sourceMissing);
  const groups=[...orderMap.values()].filter(x=>x.receipts.length||x.payments.length)
   .sort((a,b)=>Number(a.orderID.slice(3))-Number(b.orderID.slice(3)));
  const prewindowPayable=groups.filter(x=>x.payments.length&&!x.receipts.length);
  const inWindowBoth=groups.filter(x=>x.payments.length&&x.receipts.length);
  const creditOutstanding=groups.filter(x=>x.receipts.some(y=>y.kind==='credit')&&!x.payments.length);
  const cashOnly=groups.filter(x=>x.receipts.some(y=>y.kind==='cash'));
  const opening=evidence.opening;
  ensure(opening.companyAccountsPayableJPY!==null&&opening.financeInventoryJPY!==null,'opening-company-finance-accounts-missing');
  const depreciation=observation.storeWeeklyRows.filter(r=>r.category==='depreciation');
  ensure(depreciation.length===13&&depreciation.every(r=>r.fixedAssetEvidence),'missing-fixed-asset-evidence');
  const initialAsset=depreciation[0];
  return {status:'SOURCE_GRAPH_PARTIAL',weeks:13,
   counts:{purchaseOrders:groups.length,creditReceiptRows:creditReceipts,cashReceiptRows:cashReceipts,
    apPaymentRows:apPayments,ordersWithReceiptsAndPayments:inWindowBoth.length,
    paymentOnlyPrewindowOrders:prewindowPayable.length,creditOrdersNotPaidInWindow:creditOutstanding.length,
    cashOnlyOrders:cashOnly.length},
   opening:{atWeek:opening.week,companyAccountsPayableMinor:cents(opening.companyAccountsPayableJPY,'opening-ap'),
    companyInventoryMinor:cents(opening.financeInventoryJPY,'opening-inventory'),
    storeLotsAvailable:opening.lots!==null,
    assetBookBeforeFirstObservedDepreciationMinor:cents(initialAsset.fixedAssetEvidence.bookBefore,'first-asset-book'),
    assetAccumulatedBeforeFirstDepreciationMinor:cents(initialAsset.fixedAssetEvidence.accumulatedBefore,'first-accumulated')},
   orders:groups,
   blockers:['supplier-catalog-ids-are-not-verified-legal-counterparties',
    'company-opening-AP-is-not-attributed-to-this-single-store',
    'company-opening-inventory-is-not-attributed-to-this-single-store',
    'asset-acquisition-before-observation-not-a-source-receipt',
    'non-store-financial-events-not-replayed','no-durable-vnext-transaction-application'],
   source:'Real game purchaseOrders lineage and finance receipts; not a legal-entity vNext journal parity verdict.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)]};}
}
function verifySourceGraph(observation){
 const b=verifyObservation(observation);
 if(b.status!=='SOURCE_ALIGNED_PARTIAL')return {status:'EVIDENCE_BLOCKED',reasons:['underlying-legacy-bridge-'+(b.reasons||[]).join(';')]};
 const g=buildPurchaseGraph(observation);
 if(g.status!=='SOURCE_GRAPH_PARTIAL')return g;
 // Counts reflect independently observed source rows; unexpected evidence
 // changes must fail closed, not be labeled source-consistent.
 const expected={creditReceiptRows:31,cashReceiptRows:2,apPaymentRows:27,
  ordersWithReceiptsAndPayments:22,paymentOnlyPrewindowOrders:5,creditOrdersNotPaidInWindow:8,cashOnlyOrders:2};
 for(const [k,v]of Object.entries(expected))if(g.counts[k]!==v)
   return {status:'EVIDENCE_BLOCKED',reasons:['source-graph-count-drift-'+k]};
 return g;
}
module.exports={baseOrderID,buildPurchaseGraph,verifySourceGraph};
