'use strict';
const assert=require('node:assert/strict');
const {readSnapshot,proof}=require('./legacy-inventory-rollforward.cjs');
const cp=x=>JSON.parse(JSON.stringify(x));
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
function snap(){
 return {week:4,lots:[{lotID:'lot-1',materialID:'ramen-noodles',purchaseOrderID:'po-1',
  status:'available',bookValue:100,quantity:10,originalQuantity:10,unitCost:10,
  receivedWeek:3,expiryWeek:7}],
  inventoryScope:[{storeID:'store-s2',businessID:'ramen',availableBookValueJPY:100}],
  financeInventoryJPY:100};
}
function invalid(edit,expected){
 const x=snap();edit(x);
 assert.throws(()=>readSnapshot(x,'store-s2'),expected);
}
test('authentic-shaped available lot has exact 0.01-JPY source value',()=>{
 const x=readSnapshot(snap(),'store-s2');
 assert.equal(x.storeBookMinor,10000);
 assert.equal(x.companyPhysicalBookMinor,10000);
 assert.equal(x.companyReconciliationResidualMinor,0);
 assert.equal(x.lotCount,1);
});
test('reading snapshots cannot change original source inputs',()=>{
 const x=snap(),before=JSON.stringify(x);
 readSnapshot(x,'store-s2');assert.equal(JSON.stringify(x),before);
});
test('consumed/expired lots are excluded from current inventory',()=>{
 const x=snap();x.lots.push({...x.lots[0],lotID:'lot-2',status:'consumed',quantity:0,bookValue:0});
 const y=readSnapshot(x,'store-s2');assert.equal(y.storeBookMinor,10000);assert.equal(y.lotCount,2);
});
test('other company inventory stores are visible but not attributed to source ramen',()=>{
 const x=snap();x.inventoryScope.push({storeID:'store-s3',businessID:'sushi',availableBookValueJPY:350});
 x.financeInventoryJPY=450;
 const y=readSnapshot(x,'store-s2');
 assert.equal(y.companyPhysicalBookMinor,45000);
 assert.equal(y.storeBookMinor,10000);
 assert.equal(y.inventoryStoreCount,2);
});
test('company book and physical book residual exposed rather than silently hidden',()=>{
 const x=snap();x.financeInventoryJPY=100.01;
 assert.equal(readSnapshot(x,'store-s2').companyReconciliationResidualMinor,-1);
});
test('lot book and per-store scope books must agree',()=>{
 invalid(x=>x.inventoryScope[0].availableBookValueJPY=101,/lot-vs-store-book-mismatch/);
});
test('the matching selected store must be included',()=>{
 invalid(x=>x.inventoryScope[0].storeID='other',/store-scope-missing-or-duplicated/);
});
test('duplicate selected inventory entry not accepted',()=>{
 invalid(x=>x.inventoryScope.push({...x.inventoryScope[0]}),/store-scope-missing-or-duplicated/);
});
test('duplicate lot IDs in one snapshot rejected',()=>{
 invalid(x=>x.lots.push({...x.lots[0]}),/duplicate-lot-id/);
});
test('missing lot identifier rejected',()=>{
 invalid(x=>delete x.lots[0].lotID,/invalid-lot-id/);
});
test('material identifier required',()=>{
 invalid(x=>x.lots[0].materialID='',/invalid-material-id/);
});
test('forged PO identity type rejected',()=>{
 invalid(x=>x.lots[0].purchaseOrderID=23,/invalid-lot-order/);
});
test('negative quantity rejected',()=>{
 invalid(x=>x.lots[0].quantity=-1,/invalid-lot-quantity/);
});
test('sub-cent floating lot book rejected',()=>{
 invalid(x=>x.lots[0].bookValue=100.001,/non-cent-book-value/);
});
test('negative stock book rejected',()=>{
 invalid(x=>x.lots[0].bookValue=-1,/negative-lot-value/);
});
test('lot received in the future rejected',()=>{
 invalid(x=>x.lots[0].receivedWeek=9,/invalid-lot-received-week/);
});
test('invalid expiry before receipt rejected',()=>{
 invalid(x=>x.lots[0].expiryWeek=2,/invalid-expiry-week/);
});
test('available expired lot cannot be included as owned inventory',()=>{
 invalid(x=>x.lots[0].expiryWeek=4,/expired-available-lot/);
});
test('zero-quantity available lot rejected',()=>{
 invalid(x=>x.lots[0].quantity=0,/empty-available-lot/);
});
test('unknown material status blocked rather than counted as inventory',()=>{
 invalid(x=>x.lots[0].status='lost',/unknown-lot-status/);
});
test('no invented finance opening if balance missing',()=>{
 invalid(x=>delete x.financeInventoryJPY,/invalid-company-finance-inventory/);
});
test('missing PO/lot source snapshots cannot claim even partial full-run proof',()=>{
 const r=proof({sourceGraphEvidence:{opening:snap(),weekly:[]}});
 assert.equal(r.status,'EVIDENCE_BLOCKED');
});
test('mock synthetic snapshot cannot bypass real original 138-receipt SHA and source graph',()=>{
 const r=proof({storeWeeklyRows:[],nonStoreWeeklyRows:[],observedStore:{id:'store-s2'}});
 assert.equal(r.status,'EVIDENCE_BLOCKED');
});
test('individual legacy source lot IDs are not external legal counterparties',()=>{
 const r=readSnapshot(snap(),'store-s2');
 assert.equal(r.lots.get('lot-1').purchaseOrderID,'po-1');
 assert.equal(Object.keys(r).includes('supplierLegalEntity'),false);
});
console.log('SPIKE-8B material lot physical source evidence: '+count+' PASS; mock shape checks only.');
