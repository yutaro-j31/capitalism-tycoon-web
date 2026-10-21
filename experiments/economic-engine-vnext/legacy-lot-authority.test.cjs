'use strict';
const assert=require('node:assert/strict');
const {orderOrigin,validateSnapshot,auditSource,runAuthenticated}=require('./legacy-lot-authority.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function lot(book,po='migration-v6'){
 return {lotID:'lot-1',materialID:'ramen_noodles',purchaseOrderID:po,
  supplierContractID:null,quality:55,status:'available',
  bookValue:book/100,quantity:100,originalQuantity:100,unitCost:1.35,
  receivedWeek:2,expiryWeek:99};
}
function snap(week,book,po='migration-v6'){
 const orders=week<5?[]:[
  {orderID:'po-1',storeID:'store-s2',businessID:'ramen',supplierID:'quick_local',
   supplierContractID:'contract-1',materialID:'ramen_noodles',orderWeek:5,
   isEmergency:true,receivedCost:100,paidAmount:100},
  {orderID:'po-2',storeID:'store-s2',businessID:'ramen',supplierID:'quick_local',
   supplierContractID:'contract-1',materialID:'ramen_soup',orderWeek:5,
   isEmergency:true,receivedCost:150,paidAmount:150}
 ];
 const supplierContracts=[{contractID:'contract-1',supplierID:'quick_local',
  storeID:'store-s2',businessID:'ramen',active:true,status:'active',startedWeek:4}];
 return {week,orders,supplierContracts,lots:[lot(book,po)],
  inventoryScope:[{storeID:'store-s2',businessID:'ramen',availableBookValueJPY:book/100}],
  financeInventoryJPY:book/100,
  inventoryAuthoritySource:{supplyMigrationV6Applied:true,openingAPBaselineJPY:0,
   financeOpeningAssetsJPY:12345,financeOpeningEquityJPY:54321,
   financeOpeningRetainedEarningsJPY:54321}};
}
const spoils={8:6247752,9:1333209,10:5871552,11:205862,12:5407595,
 14:1881756,15:5291677,16:4351276,17:1200910};
function inputs(){
 let book=13483;
 const evidence={opening:snap(4,book),weekly:[]};
 const weeks=[];
 for(const f of ref.weeks){
  const week=f[0],credit=f[8],cash=f[7],cogs=f[2],spoil=spoils[week]||0,open=book;
  book=book+credit+cash-cogs-spoil;
  evidence.weekly.push(snap(week,book));
  weeks.push({week,openingBookMinor:open,creditReceiptMinor:credit,
   immediateCashReceiptMinor:cash,costOfSalesMinor:cogs,
   spoilageMinor:spoil,closingBookMinor:book});
 }
 return {source:{storeID:'store-s2',evidence},
  financing:{status:'SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL',cogsRows:13,cashReceiptRows:2,
   stillHeldSourceRows:96,immediateCashPOs:['po-1','po-2'],openingPhysicalMinor:13483,
   weeks}};
}
function pass(x=inputs()){
 const r=auditSource(x.source,x.financing);
 assert.equal(r.status,'CONTRACT_ORIGIN_AUDIT_ONLY',JSON.stringify(r));return r;
}
function rejects(edit){
 const x=inputs();edit(x);
 const r=auditSource(x.source,x.financing);
 assert.equal(r.status,'EVIDENCE_BLOCKED',JSON.stringify(r));
}
test('migration opening lot is source valuation, not legal vendor evidence',()=>{
 const r=pass();assert.equal(r.opening.physicalBookMinor,13483);
 assert.equal(r.opening.lotOrigins.LEGACY_MIGRATION_NOT_EXTERNAL_PURCHASE,1);
});
test('source inventory origin is classified without pretending full core opening',()=>{
 const r=pass();assert.equal(r.opening.lotCount,1);
 assert.equal(r.opening.lotEvidence[0].historicalFunding,'NOT_AUTHENTICATED_IN_CURRENT_CORE');
});
test('cash supplier contract is catalog only and never a verified legal bank payee',()=>{
 const r=pass();assert.equal(r.cashPurchasePOs.length,2);
 assert.ok(r.cashPurchasePOs.every(p=>p.catalogueSupplierID==='quick_local'
  &&p.contractCatalogueMatched &&p.legalEntityID===null &&p.verifiedPaymentDestination===false));
});
test('same lot across snapshots is an observed net balance only',()=>{
 const r=pass();assert.equal(r.weeks.length,13);
 assert.ok(r.weeks.every(w=>w.individualCOGSEventIDs===0));
});
test('reported source weeks match exact synthetic opening/closing physical book',()=>{
 const r=pass();
 assert.equal(r.weeks[0].week,5);
 assert.equal(r.weeks[12].week,17);
 assert.equal(r.weeks[12].physicalStockMinor,99645966);
});
test('53 earlier canonical postings remain unchanged and no new COGS or cash added',()=>{
 const r=pass();
 assert.equal(r.previousSourceRowsPosted,53);assert.equal(r.previousSourceRowsHeld,96);
 assert.equal(r.newlyPostedCOGS,0);assert.equal(r.newlyPostedCashPurchases,0);
});
test('method is read-only across all 14 input snapshots',()=>{
 const x=inputs(),before=JSON.stringify(x);auditSource(x.source,x.financing);
 assert.equal(JSON.stringify(x),before);
});
test('mock planner cannot claim genuine source validation',()=>{
 assert.equal(pass().status,'CONTRACT_ORIGIN_AUDIT_ONLY');
 assert.equal(runAuthenticated({}).status,'EVIDENCE_BLOCKED');
});
test('all PO provenance classifications are explicit',()=>{
 const known=new Map([['po-1',{}]]);
 assert.equal(orderOrigin('po-1',known),'SOURCE_PO_VISIBLE');
 assert.equal(orderOrigin('po-99',known),'SOURCE_PO_NOT_IN_WINDOW_SNAPSHOTS');
 assert.equal(orderOrigin('migration-v6',known),'LEGACY_MIGRATION_NOT_EXTERNAL_PURCHASE');
 assert.equal(orderOrigin('merged',known),'MERGED_PO_ANCESTRY_LOST');
 assert.equal(orderOrigin(null,known),'UNRESOLVED');
 assert.equal(orderOrigin('arbitrary',known),'UNRECOGNIZED_PO_SOURCE');
});
test('merged PO book origins remain explicitly untraceable',()=>{
 const x=inputs();x.source.evidence.opening.lots[0].purchaseOrderID='merged';
 for(const w of x.source.evidence.weekly)w.lots[0].purchaseOrderID='merged';
 const r=pass(x);assert.equal(r.opening.lotOrigins.MERGED_PO_ANCESTRY_LOST,1);
});
test('supplier contracts can exist without a legally verified counterparty',()=>{
 const x=inputs();x.source.evidence.weekly[3].supplierContracts=[];
 const r=pass(x);assert.equal(r.originalSupplierContractsVisible,1);
});
test('missing original store lot valuation is an evidence gap',()=>rejects(x=>{
 x.source.evidence.opening.lots[0].bookValue=0;
}));
test('one-cent source lot accounting drift is detected',()=>rejects(x=>{
 x.source.evidence.weekly[0].lots[0].bookValue+=0.01;
}));
test('lot mutation from purchase PO to a different PO is rejected',()=>rejects(x=>{
 x.source.evidence.opening.lots[0].purchaseOrderID='po-1';
 x.source.evidence.weekly[0].lots[0].purchaseOrderID='po-2';
}));
test('lot material cannot change under same source lotID',()=>rejects(x=>{
 x.source.evidence.weekly[0].lots[0].materialID='ramen_soup';
}));
test('finance physical closing book must be identical to prior approved source',()=>rejects(x=>{
 x.financing.weeks[1].closingBookMinor+=1;
}));
test('source store identity must match pinned ramen store',()=>rejects(x=>{
 x.source.storeID='other-store';
}));
test('missing source supplier contract tables cannot be treated as zero contracts',()=>rejects(x=>{
 delete x.source.evidence.opening.supplierContracts;
}));
test('unknown purchase order catalogue ID fails closed',()=>rejects(x=>{
 x.source.evidence.weekly[0].orders[0].supplierID='';
}));
test('PO catalogue supplier change cannot masquerade as legal payee continuity',()=>rejects(x=>{
 x.source.evidence.weekly[3].orders[0].supplierID='fake-vendor';
}));
test('contract catalogue supplier spoofing blocked',()=>rejects(x=>{
 x.source.evidence.weekly[1].supplierContracts[0].supplierID='fake-vendor';
}));
test('PO and original supplier contract must identify same catalogue supplier',()=>rejects(x=>{
 for(const week of x.source.evidence.weekly)
  week.orders[0].supplierID='wrong-other';
}));
test('original company opening AP baseline must be observed, not invented',()=>rejects(x=>{
 x.source.evidence.opening.inventoryAuthoritySource.openingAPBaselineJPY=null;
}));
test('missing migration source flag blocked',()=>rejects(x=>{
 delete x.source.evidence.opening.inventoryAuthoritySource.supplyMigrationV6Applied;
}));
test('changing migration flag mid-period blocked',()=>rejects(x=>{
 x.source.evidence.weekly[3].inventoryAuthoritySource.supplyMigrationV6Applied=false;
}));
test('unexpected extra cash receipt lacks source PO authentication',()=>rejects(x=>{
 x.financing.immediateCashPOs.push('po-999');
}));
test('missing source snapshot prohibits complete observation',()=>rejects(x=>{
 x.source.evidence.weekly.pop();
}));
test('source week index must be consecutive',()=>rejects(x=>{
 x.source.evidence.weekly[4].week=99;
}));
test('future-dated material lot can never prove opening stock',()=>rejects(x=>{
 x.source.evidence.opening.lots[0].receivedWeek=7;
}));
test('wrong finance supplier type is never promoted to money receiver',()=>{
 const r=pass();assert.ok(r.blockers.some(x=>x.includes('legal-entity')));
});
console.log('SPIKE-8F original material lot/supplier authority audit: '+count+' PASS (mock contracts only).');
