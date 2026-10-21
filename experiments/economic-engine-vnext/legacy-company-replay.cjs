'use strict';
// SPIKE-8A: real legacy authenticated -> vNext company-side journal subset.
// No fabricated legal counterparties and NO assertion of 138-row parity.
// Experimental only; not production/save/IndexedDB.
const core=require('./core.cjs');
const {validateRow}=require('./legacy-week-bridge.cjs');
const {verifySourceGraph,baseOrderID}=require('./legacy-source-graph.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const fail=(m)=>{throw Error(m);};
const ensure=(x,m)=>{if(!x)fail(m);};
const CENT=100,MAX=BigInt(Number.MAX_SAFE_INTEGER);
function cent(v,label){
 ensure(typeof v==='number'&&Number.isFinite(v),'invalid-'+label);
 const scaled=v*CENT,minor=Math.round(scaled);
 ensure(Number.isSafeInteger(minor)&&Math.abs(scaled-minor)<1e-7,'noncent-'+label);
 return minor;
}
const HOLD={
 revenue:'customer-legal-entity-and-cash-source-not-authenticated',
 costOfSales:'store-specific-opening-inventory-and-lot-consumption-not-authenticated',
 rent:'landlord-legal-entity-and-payment-source-not-authenticated',
 payroll:'employee-legal-entity-and-payment-source-not-authenticated',
 maintenance:'contractor-legal-entity-and-payment-source-not-authenticated',
 depreciation:'opening-fixed-asset-acquisition-and-store-ownership-not-authenticated',
 inventoryReceiptCash:'supplier-legal-entity-and-external-cash-receipt-not-authenticated',
 accountsPayablePayment:'supplier-legal-entity-and-prewindow-AP-allocation-not-authenticated'
};
function makeBaseline(){
 // "audit-slot" is a zero-balance core-SCHEMA sentinel, not a supplier or
 // external economic entity. It cannot post a single journal leg.
 // Opening company cash is intentionally NOT fabricated or represented.
 return core.createInitialState({'audit-slot':0,company:0});
}
function planSourceRows(rows,graph){
 try{
  ensure(Array.isArray(rows)&&graph&&graph.status==='SOURCE_GRAPH_PARTIAL'&&Array.isArray(graph.orders),'missing-source-graph');
  const mapped=new Map();
  for(const order of graph.orders){
   ensure(order&&/^po-[0-9]+$/.test(order.orderID)&&Array.isArray(order.receipts),'invalid-source-order');
   ensure(!mapped.has(order.orderID),'duplicate-source-order');
   mapped.set(order.orderID,order);
  }
  const entryRows=[],held=[],seen=new Set();
  let state=makeBaseline(),minorSum=0n,creditCount=0;
  const ordered=[...rows].sort((a,b)=>a.week-b.week || a.operationID.localeCompare(b.operationID));
  for(const row of ordered){
   ensure(row&&typeof row.operationID==='string','invalid-observation-row');
   ensure(!seen.has(row.operationID),'duplicate-source-receipt');
   seen.add(row.operationID);
   const entry=validateRow(row,row.week,ref.provenance.storeId,ref.provenance.businessId);
   const tag={operationID:row.operationID,week:row.week,kind:entry.kind,amountMinor:entry.amountMinor};
   if(entry.kind!=='inventoryReceiptCredit'){
    const reason=HOLD[entry.kind];
    ensure(typeof reason==='string','unexpected-finance-kind');
    held.push({...tag,status:'BLOCKED',reason});continue;
   }
   const po=baseOrderID(row),group=mapped.get(po);
   ensure(group&&typeof group.supplierCatalogID==='string'&&group.supplierCatalogID,'unverified-purchase-order-'+po);
   const matches=group.receipts.filter(x=>x.operationID===row.operationID&&x.kind==='credit'&&x.week===row.week);
   ensure(matches.length===1&&matches[0].amountMinor===entry.amountMinor,'unverified-credit-receipt-'+row.operationID);
   ensure(cent(row.cashEffect,'receipt-cash')===0&&cent(row.profitEffect,'receipt-profit')===0,'unexpected-credit-profit-cash');
   ensure(cent(row.inventoryAmount,'receipt-inventory')===entry.amountMinor&&cent(row.liabilityEffect,'receipt-liability')===entry.amountMinor,'receipt-legs-mismatch');
   ensure(entry.amountMinor>0,'nonpositive-receipt');
   const company='company';
   const postings=[
    {account:company+':inventory:'+row.storeID,deltaMinor:entry.amountMinor},
    {account:company+':payable:'+po,deltaMinor:-entry.amountMinor}
   ];
   const planned=core.planOperation(state,{type:'journal',id:row.operationID,postings});
   if(!planned.ok)fail('core-replay-'+row.operationID+':'+planned.reason);
   state=planned.state;
   entryRows.push({...tag,status:'POSTED',sourceOrderID:po,
    supplierCatalogID:group.supplierCatalogID,
    journalSequence:planned.receipt.sequence,postings});
   minorSum+=BigInt(entry.amountMinor);
   ensure(minorSum<=MAX,'credit-receipts-overflow');creditCount++;
  }
  core.validateState(state);
  // The sentinel cannot have changed and the zero-cash opening must stay zero.
  ensure(state.balances['audit-slot:cash']===0&&state.balances['audit-slot:opening-equity']===0,'audit-sentinel-corrupted');
  ensure(state.balances['company:cash']===0&&state.balances['company:opening-equity']===0,'unverified-cash-posting');
  ensure(state.journal.length===creditCount,'journal-count-mismatch');
  ensure(state.journal.every(j=>j.postings.every(p=>p.account.startsWith('company:')&&!p.account.endsWith(':cash'))),'external-ledger-posting-detected');
  ensure(state.balances['company:inventory:'+ref.provenance.storeId]===Number(minorSum),'inventory-receipt-reconciliation');
  const sumAP=Object.entries(state.balances).filter(([k])=>k.startsWith('company:payable:'))
   .reduce((n,[,v])=>n+BigInt(v),0n);
  ensure(sumAP===-minorSum,'payable-receipt-reconciliation');
  return {status:'CONTRACT_SIMULATION_ONLY',rows:rows.length,posted:entryRows.length,blocked:held.length,
   journal:state.journal,receipts:entryRows,held,
   balances:{creditInventoryMinor:Number(minorSum),creditPayableMinor:Number(-minorSum),companyCashDeltaMinor:0},
   evidenceWarning:'Supplied graph is untrusted here. Call runAuthenticatedReplay with actual engine output to claim SOURCE_LEDGER_PARTIAL.'};
 }catch(e){
  return {status:'EVIDENCE_BLOCKED',reasons:[String(e&&e.message||e)]};
 }
}
function runAuthenticatedReplay(observation){
 try{
  // Mandatory immutable original source SHA-pinned week/category bridge
  // AND actual supply source graph. No bypass / caller-supplied proof.
  const proof=verifySourceGraph(observation);
  ensure(proof.status==='SOURCE_GRAPH_PARTIAL','source-gate-'+(proof.reasons||[]).join(';'));
  const r=planSourceRows(observation.storeWeeklyRows,proof);
  ensure(r.status==='CONTRACT_SIMULATION_ONLY','source-ledger-'+(r.reasons||[]).join(';'));
  ensure(r.rows===ref.totals.rows,'source-row-count');
  ensure(r.posted===31&&r.blocked===107,'eligible-source-coverage-drift');
  ensure(r.balances.creditInventoryMinor===ref.totals.creditPurchaseMinor,'credit-inventory-source-drift');
  ensure(r.balances.creditPayableMinor===-ref.totals.creditPurchaseMinor,'credit-AP-source-drift');
  ensure(r.held.every(x=>typeof x.reason==='string'&&x.reason.length>0),'unexplained-held-row');
  return {...r,status:'SOURCE_LEDGER_PARTIAL',proofStatus:proof.status,
   sourceReceipts:ref.totals.rows,summary:'31 authentic credit receipts reposted as balanced company-only inventory/AP; 107 missing-party/opening-source rows deliberately blocked. NOT full parity.',
   blockers:['107-authentic-rows-not-replayed','no-verified-legal-counterparties','no-store-specific-opening-inventory-AP','no-authenticated-asset-acquisition','no-nonstore-finance-replay','no-durable-save-proof']};
 }catch(e){
  return {status:'EVIDENCE_BLOCKED',reasons:[String(e&&e.message||e)]};
 }
}
module.exports={planSourceRows,runAuthenticatedReplay};
