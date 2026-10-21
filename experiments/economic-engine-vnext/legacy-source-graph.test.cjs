'use strict';
const assert=require('node:assert/strict');
const graph=require('./legacy-source-graph.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
let passed=0;const test=(name,cb)=>{cb();passed++;console.log('PASS '+name);};
function row(week,category,sourceType,sourceID,operationID,amount){
 return {week,storeID:'store-s2',businessID:'ramen',category,sourceType,sourceID,operationID,
  idempotencyKey:operationID,amount,cashEffect:category==='accountsPayablePayment'?-amount:
   sourceType==='emergency-receipt-cash'?-amount:0};
}
function order(id,orderWeek,receivedCost,paidAmount,supplierID='wholesaler'){
 return {orderID:id,storeID:'store-s2',businessID:'ramen',supplierID,materialID:'flour',
  orderWeek,receivedCost,paidAmount};
}
function scenario(){
 const opening={week:4,orders:[order('po-1',2,50,0)],companyAccountsPayableJPY:50,
  financeInventoryJPY:11,lots:[]};
 const rows=[
  row(5,'workingCapitalIncrease','inventory-receipt-ap','po-8-123.45','po-8-receipt-ap-123.45',123),
  row(5,'workingCapitalIncrease','emergency-receipt-cash','po-13-2.5','po-13-receipt-cash-2.5',10),
  row(6,'accountsPayablePayment','ap-payment','po-1','po-1-ap-pay-6',50),
  row(6,'accountsPayablePayment','ap-payment','po-8','po-8-ap-pay-6',123)
 ];
 const weekly=[];
 for(let week=5;week<=17;week++)weekly.push({
  week,companyAccountsPayableJPY:0,financeInventoryJPY:0,lots:[],
  orders:[order('po-1',2,50,week>=6?50:0),
   order('po-8',5,123,week>=6?123:0),
   order('po-13',5,10,10,'emergency-shop')]
 });
 const depreciation=Array.from({length:13},(_,i)=>({
  week:5+i,storeID:'store-s2',businessID:'ramen',category:'depreciation',
  fixedAssetEvidence:{bookBefore:1000-i*10,bookAfter:990-i*10}
 }));
 return {observedStore:{id:'store-s2',businessID:'ramen'},observedWeeks:[5,17],
  storeWeeklyRows:rows.concat(depreciation),
  sourceGraphEvidence:{opening,weekly}};
}
function passGraph(){
 const result=graph.buildPurchaseGraph(scenario());
 assert.equal(result.status,'SOURCE_GRAPH_PARTIAL',JSON.stringify(result));return result;
}
test('receipt compound ID maps to exact base purchase order',()=>{
 assert.equal(graph.baseOrderID(row(5,'workingCapitalIncrease','inventory-receipt-ap','po-8-123.45','po-8-receipt-ap-123.45',123)),'po-8');
});
test('payment receipt maps to exact purchase order ID',()=>{
 assert.equal(graph.baseOrderID(row(6,'accountsPayablePayment','ap-payment','po-8','po-8-ap-pay-6',123)),'po-8');
});
test('actual AP settlement provenance requires original PO ID',()=>{
 const r=row(6,'accountsPayablePayment','ap-payment','po-8','wrong-id',123);
 assert.throws(()=>graph.baseOrderID(r),/invalid-ap-payment-receipt-id/);
});
test('receipt suffix cannot be silently mismatched with sourceID',()=>{
 const r=row(5,'workingCapitalIncrease','inventory-receipt-ap','po-8-123.45','po-8-receipt-ap-0',123);
 assert.throws(()=>graph.baseOrderID(r),/invalid-po-receipt-id/);
});
test('no period opening source evidence is not considered reconciled',()=>{
 const s=scenario();delete s.sourceGraphEvidence;
 assert.equal(graph.buildPurchaseGraph(s).status,'EVIDENCE_BLOCKED');
});
test('one catalogue supplier is resolved from PO snapshot, not fabricated',()=>{
 const g=passGraph();assert.equal(g.counts.purchaseOrders,3);
 assert.equal(g.orders.find(o=>o.orderID==='po-13').supplierCatalogID,'emergency-shop');
 assert.ok(g.blockers.includes('supplier-catalog-ids-are-not-verified-legal-counterparties'));
});
test('prewindow payment cannot falsely create a new purchase receipt',()=>{
 const g=passGraph();assert.equal(g.counts.paymentOnlyPrewindowOrders,1);
 const po=g.orders.find(o=>o.orderID==='po-1');
 assert.equal(po.receipts.length,0);assert.equal(po.payments.length,1);
});
test('credit receipt and later payment form one source-PO ancestry',()=>{
 const g=passGraph();assert.equal(g.counts.ordersWithReceiptsAndPayments,1);
 const po=g.orders.find(o=>o.orderID==='po-8');
 assert.equal(po.receipts.length,1);assert.equal(po.payments.length,1);
});
test('emergency cash receipts never invent AP liability',()=>{
 const g=passGraph();assert.equal(g.counts.cashOnlyOrders,1);
 const po=g.orders.find(o=>o.orderID==='po-13');assert.equal(po.payments.length,0);
});
test('opening inventory and AP are company-wide, not single-store proof',()=>{
 const g=passGraph();assert.equal(g.opening.companyAccountsPayableMinor,5000);
 assert.equal(g.opening.companyInventoryMinor,1100);
 assert.ok(g.blockers.some(x=>x.includes('not-attributed-to-this-single-store')));
});
test('initial fixed asset book evidence does not prove prior acquisition cash',()=>{
 const g=passGraph();assert.equal(g.opening.assetBookBeforeFirstObservedDepreciationMinor,100000);
 assert.ok(g.blockers.includes('asset-acquisition-before-observation-not-a-source-receipt'));
});
test('missing PO snapshot at cash receipt fails closed',()=>{
 const s=scenario();s.sourceGraphEvidence.weekly[0].orders=s.sourceGraphEvidence.weekly[0].orders.filter(o=>o.orderID!=='po-13');
 assert.equal(graph.buildPurchaseGraph(s).status,'EVIDENCE_BLOCKED');
});
test('supplier swapping on a later week fails source lineage',()=>{
 const s=scenario();s.sourceGraphEvidence.weekly[4].orders[1].supplierID='fake-supplier';
 assert.equal(graph.buildPurchaseGraph(s).status,'EVIDENCE_BLOCKED');
});
test('cross-store order cannot be used to settle current store AP',()=>{
 const s=scenario();s.sourceGraphEvidence.weekly[0].orders[1].storeID='other';
 assert.equal(graph.buildPurchaseGraph(s).status,'EVIDENCE_BLOCKED');
});
test('finance payment exceeding PO paidAmount is rejected',()=>{
 const s=scenario();s.sourceGraphEvidence.weekly[1].orders[0].paidAmount=20;
 assert.equal(graph.buildPurchaseGraph(s).status,'EVIDENCE_BLOCKED');
});
test('a receipt cannot be attributed to a PO created after the event',()=>{
 const s=scenario();s.sourceGraphEvidence.weekly[0].orders[1].orderWeek=6;
 assert.equal(graph.buildPurchaseGraph(s).status,'EVIDENCE_BLOCKED');
});
test('depreciation observations require actual asset before/after evidence',()=>{
 const s=scenario();s.storeWeeklyRows.find(r=>r.category==='depreciation').fixedAssetEvidence=null;
 assert.equal(graph.buildPurchaseGraph(s).status,'EVIDENCE_BLOCKED');
});
test('bare source PO ID is insufficient evidence for inventory receipt',()=>{
 const r=row(5,'workingCapitalIncrease','inventory-receipt-ap','po-8','po-8-receipt-ap-123.45',123);
 assert.throws(()=>graph.baseOrderID(r),/invalid-receipt-order-id/);
});
test('a fake full parity claim is never returned by the source graph',()=>{
 const r=passGraph();assert.notEqual(r.status,'FULL_PARITY');
 assert.notEqual(r.status,'LEGAL_COUNTERPARTIES_CONFIRMED');
});
console.log('SPIKE-7 source PO/supplier-catalog/period opening evidence: '+passed+' PASS. Synthetic graph mocks only, real legacy verifier is separate.');
