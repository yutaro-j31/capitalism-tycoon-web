'use strict';
// SPIKE-8F: read-only primary-source audit of material LOT ancestry, merged
// identities, catalogue suppliers and opening-stock/finance authority.
// A snapshot is not an event log; this module never invents per-lot COGS
// consumption, external supplier legal entities or company opening capital.
const {runAuthenticated:runCOGSFunding}=require('./legacy-cogs-funding.cjs');
const {verifySourceGraph}=require('./legacy-source-graph.cjs');
const {proof:physicalStockProof,readSnapshot}=require('./legacy-inventory-rollforward.cjs');
const pinned=require('./fixtures/legacy-real-13week-summary.json');
const check=(x,m)=>{if(!x)throw Error(m);};
function minor(n,what){
 check(typeof n==='number'&&Number.isFinite(n),'missing-'+what);
 const x=Math.round(n*100);
 check(Number.isSafeInteger(x)&&Math.abs(n*100-x)<1e-6,'noncent-'+what);
 return x;
}
function orderOrigin(id,known){
 if(id===null||id===undefined||id==='')return 'UNRESOLVED';
 if(id==='migration-v6')return 'LEGACY_MIGRATION_NOT_EXTERNAL_PURCHASE';
 if(id==='merged')return 'MERGED_PO_ANCESTRY_LOST';
 if(!/^po-[0-9]+$/.test(id))return 'UNRECOGNIZED_PO_SOURCE';
 return known.has(id)?'SOURCE_PO_VISIBLE':'SOURCE_PO_NOT_IN_WINDOW_SNAPSHOTS';
}
function validateSnapshot(s,store){
 check(s&&Number.isSafeInteger(s.week),'missing-source-week');
 const stock=readSnapshot(s,store);
 check(Array.isArray(s.orders)&&Array.isArray(s.lots)&&Array.isArray(s.supplierContracts),
  'missing-primary-source-purchase-contract-lots');
 const f=s.inventoryAuthoritySource;
 check(f&&typeof f.supplyMigrationV6Applied==='boolean','missing-supply-migration-origin');
 for(const k of ['openingAPBaselineJPY','financeOpeningAssetsJPY',
  'financeOpeningEquityJPY','financeOpeningRetainedEarningsJPY'])
  minor(f[k],k);
 const orders=new Map(),contracts=new Map(),lots=new Map();
 for(const o of s.orders){
  check(o&&/^po-[0-9]+$/.test(o.orderID)&&o.storeID===store,'foreign-source-order');
  check(typeof o.supplierID==='string'&&o.supplierID.length>0,'no-supplier-catalogue-ID');
  check(typeof o.materialID==='string'&&o.materialID.length>0,'no-material-identity');
  check(o.supplierContractID===null||typeof o.supplierContractID==='string','invalid-PO-contract-ID');
  check(!orders.has(o.orderID),'duplicate-original-PO');
  orders.set(o.orderID,o);
 }
 for(const c of s.supplierContracts){
  check(c&&typeof c.contractID==='string'&&c.contractID.length>0
   &&c.storeID===store&&typeof c.supplierID==='string','invalid-source-contract');
  check(!contracts.has(c.contractID),'duplicated-source-contract');
  contracts.set(c.contractID,c);
 }
 for(const lot of s.lots){
  check(lot&&typeof lot.lotID==='string'&&!lots.has(lot.lotID),'invalid-source-lot');
  check(lot.purchaseOrderID===null||typeof lot.purchaseOrderID==='string','invalid-source-lot-PO');
  check(lot.supplierContractID===null||lot.supplierContractID===undefined
   ||typeof lot.supplierContractID==='string','invalid-source-lot-contract');
  check(typeof lot.materialID==='string'&&lot.materialID.length>0,'lot-material-source');
  check(Number.isSafeInteger(lot.receivedWeek)&&lot.receivedWeek<=s.week,'invalid-source-lot-arrival');
  const v=minor(lot.bookValue,'source-lot-book');
  check(v>=0,'negative-source-lot-book');
  lots.set(lot.lotID,{...lot,valueMinor:v});
 }
 return {stock,orders,contracts,lots,week:s.week,authority:f};
}
function auditSource(source,financing){
 try{
  check(source&&source.evidence&&Array.isArray(source.evidence.weekly)
   &&source.evidence.weekly.length===13&&source.evidence.opening,'missing-original-14-week-source');
  check(source.storeID===pinned.provenance.storeId,'source-store-identity');
  check(financing?.status==='SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL'
    &&financing.cogsRows===13&&financing.cashReceiptRows===2
    &&financing.stillHeldSourceRows===96&&Array.isArray(financing.weeks)
    &&financing.weeks.length===13,'source-COGS-financing-not-authenticated');
  const images=[source.evidence.opening,...source.evidence.weekly]
    .map(x=>validateSnapshot(x,source.storeID));
  check(images[0].week===pinned.provenance.gameWeeks[0]-1,'incorrect-period-opening');
  const allPOs=new Map(),allContracts=new Map(),firstLotOrigin=new Map(),anomalies=[];
  for(const image of images){
   for(const [id,o]of image.orders){
    const old=allPOs.get(id);
    if(old)check(old.supplierID===o.supplierID&&old.materialID===o.materialID
      &&old.storeID===o.storeID,'purchase-order-source-changed');
    else allPOs.set(id,{supplierID:o.supplierID,materialID:o.materialID,
      supplierContractID:o.supplierContractID,isEmergency:o.isEmergency===true});
   }
   for(const [id,c]of image.contracts){
    const old=allContracts.get(id);
    if(old)check(old.supplierID===c.supplierID,'supplier-contract-source-changed');
    else allContracts.set(id,{supplierID:c.supplierID});
   }
  }
  const origins={SOURCE_PO_VISIBLE:0,SOURCE_PO_NOT_IN_WINDOW_SNAPSHOTS:0,
    LEGACY_MIGRATION_NOT_EXTERNAL_PURCHASE:0,MERGED_PO_ANCESTRY_LOST:0,
    UNRESOLVED:0,UNRECOGNIZED_PO_SOURCE:0};
  let merged=0,untraced=0,contractUnknown=0,originMissing=0;
  const opening=images[0];
  check(opening.stock.storeBookMinor===financing.openingPhysicalMinor,'physical-opening-mismatch');
  const originEvidence=[];
  for(const [id,lot]of opening.lots){
   if(lot.status!=='available'||lot.quantity<=0)continue;
   const origin=orderOrigin(lot.purchaseOrderID,allPOs);
   origins[origin]++;
   originEvidence.push({lotID:id,materialID:lot.materialID,origin,sourcePO:lot.purchaseOrderID,
     bookMinor:lot.valueMinor,receivedWeek:lot.receivedWeek,
     historicalFunding:'NOT_AUTHENTICATED_IN_CURRENT_CORE'});
  }
  const openingSum=originEvidence.reduce((a,x)=>a+x.bookMinor,0);
  check(openingSum===financing.openingPhysicalMinor,'opening-lot-source-sum-mismatch');
  const cashPOs=[];
  for(const po of financing.immediateCashPOs){
   const p=allPOs.get(po);
   check(p,'cash-PO-missing-original-source-'+po);
   const supplier=p.supplierID;
   check(typeof supplier==='string'&&supplier.length>0,'cash-supplier-catalogue-ID');
   const contract=p.supplierContractID?allContracts.get(p.supplierContractID):null;
   if(p.supplierContractID && !contract)contractUnknown++;
   if(contract)check(contract.supplierID===supplier,'cash-PO-contract-supplier-mutated');
   cashPOs.push({orderID:po,catalogueSupplierID:supplier,materialID:p.materialID,
    isEmergency:p.isEmergency,originalContractID:p.supplierContractID,
    contractCatalogueMatched:contract?true:false,
    legalEntityID:null,verifiedPaymentDestination:false});
  }
  check(cashPOs.length===2,'unproven-cash-PO-count');
  const weeks=[];
  for(let i=1;i<images.length;i++){
   const a=images[i-1],b=images[i],finance=financing.weeks[i-1];
   check(a.week+1===b.week&&b.week===finance.week,'source-week-sequence-mismatch');
   check(b.stock.storeBookMinor===finance.closingBookMinor,'lot-week-vs-finance-closing');
   const fresh=[],retired=[],continuing=[],mergedCarry=[],changedBook=[];
   for(const [id,now]of b.lots){
    const before=a.lots.get(id);
    if(!before){fresh.push(id);continue;}
    check(now.materialID===before.materialID,'lot-material-authority-changed');
    if(now.purchaseOrderID!==before.purchaseOrderID){
     // Production supply.recalcMaterial collapses multiple PO lots into a
     // survivor ID and sets purchaseOrderID="merged".
     check(now.purchaseOrderID==='merged','lot-PO-source-reassigned');
     mergedCarry.push(id);
    }
    continuing.push(id);
    if(now.valueMinor!==before.valueMinor||now.quantity!==before.quantity)
      changedBook.push({lotID:id,fromMinor:before.valueMinor,toMinor:now.valueMinor,
       kind:'UNATTRIBUTED_WEEK_NET_MOVEMENT'});
   }
   for(const id of a.lots.keys())if(!b.lots.has(id))retired.push(id);
   // Netting/survivor mergers and removals cannot authenticate an individual
   // sale/COGS event, even when all weekly book balances are perfect.
   merged+=mergedCarry.length;
   const alias=Array.from(b.lots.values()).filter(x=>x.purchaseOrderID==='merged').length;
   const missing=Array.from(b.lots.values()).filter(x=>x.purchaseOrderID===null
    ||(x.purchaseOrderID!=='merged'&&x.purchaseOrderID!=='migration-v6'
      &&!allPOs.has(x.purchaseOrderID))).length;
   untraced+=missing;
   weeks.push({week:b.week,physicalStockMinor:b.stock.storeBookMinor,
    financeCOGSMinor:finance.costOfSalesMinor,
    newLotIDs:fresh.length,retiredLotIDs:retired.length,
    stableIdentityLotIDs:continuing.length,changingBookLots:changedBook.length,
    sourceMergedAliasCount:alias,mergerTransitionCount:mergedCarry.length,
    currentUnresolvedPORefs:missing,individualCOGSEventIDs:0,
    exactLotConsumptionStatus:'NOT_PROVEN_BY_WEEK_END_SNAPSHOTS',
    cashPayeeStatus:'UNVERIFIED_LEGAL_PARTY'});
  }
  const allActive=images[13].lots.size;
  for(const snap of images)check(snap.authority.supplyMigrationV6Applied
    ===opening.authority.supplyMigrationV6Applied,'source-migration-flag-changed');
  // Report the actual completeness boundary, not a fake legal payee.
  const blockers=['catalogue-supplier-ID-has-no-verified-legal-entity-and-bank-account',
   'PO-contract-record-is-not-a-legal-counterparty-ledger',
   'original-opening-inventory-lots-not-booked-in-vnext-core',
   'lot-merges-can-hide-individual-PO-ancestry',
   'week-end-lot-net-changes-cannot-prove-every-consumption-event',
   '13-COGS-and-2-immediate-cash-receipts-remain-unposted',
   'full-durable-opening-balance-and-save-atomicity-unproven'];
  return {status:'CONTRACT_ORIGIN_AUDIT_ONLY',sourceWeeks:13,opening:{
   week:opening.week,physicalBookMinor:opening.stock.storeBookMinor,
   lotCount:originEvidence.length,lotOrigins:origins,lotEvidence:originEvidence,
   migrationApplied:opening.authority.supplyMigrationV6Applied,
   openingAPBaselineMinor:minor(opening.authority.openingAPBaselineJPY,'opening-AP-baseline'),
   financeOpeningAssetsMinor:minor(opening.authority.financeOpeningAssetsJPY,'opening-finance-assets'),
   financeOpeningEquityMinor:minor(opening.authority.financeOpeningEquityJPY,'opening-finance-equity')},
   cashPurchasePOs:cashPOs,
   catalogueSuppliers:[...new Set([...allPOs.values()].map(x=>x.supplierID))].sort(),
   originalPOsVisible:allPOs.size,originalSupplierContractsVisible:allContracts.size,
   contractPOUnresolved:contractUnknown,lotMergerTransitions:merged,
   unresolvedPORefAppearances:untraced,closingLotRows:allActive,
   weeks,previousSourceRowsPosted:53,previousSourceRowsHeld:96,
   newlyPostedCOGS:0,newlyPostedCashPurchases:0,canonicalLedgerUnchanged:true,
   blockers,
   disclaimer:'This classifies authentic-shaped snapshots only. Not original-game authenticated unless runAuthenticated is used.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)]};}
}
function runAuthenticated(observation){
 try{
  const funding=runCOGSFunding(observation);
  check(funding.status==='SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL',
    'not-authenticated-source-funding-'+(funding.reasons||[]).join(';'));
  const graph=verifySourceGraph(observation);
  check(graph.status==='SOURCE_GRAPH_PARTIAL','original-PO-graph-'+(graph.reasons||[]).join(';'));
  const stock=physicalStockProof(observation);
  check(stock.status==='SOURCE_STOCK_EVIDENCE_PARTIAL'
   &&stock.verifiedWeeks===13&&stock.blockedWeeks===0,
   'original-physical-stock-'+(stock.reasons||[]).join(';'));
  const result=auditSource({evidence:observation.sourceGraphEvidence,
   storeID:observation.observedStore?.id},funding);
  check(result.status==='CONTRACT_ORIGIN_AUDIT_ONLY',
    'failed-original-lot-origin-audit-'+(result.reasons||[]).join(';'));
  return {...result,status:'SOURCE_LOT_AUTHORITY_GAPS_PARTIAL',
   verifiedRealSource:true,
   note:'Actual source catalog and 14 physical snapshots inspected; legal payee/individual COGS event origins remain unproven. No new ledger postings.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)]};}
}
module.exports={orderOrigin,validateSnapshot,auditSource,runAuthenticated};
