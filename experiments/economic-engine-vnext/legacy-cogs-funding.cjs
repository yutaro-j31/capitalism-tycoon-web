'use strict';
// SPIKE-8E: authentic-source COGS + immediate-purchase DEPENDENCY GRAPH.
// NO new core journal postings. Store-level material cost alone is not legal
// cash settlement / vendor provenance. All submitted mocks are untrusted.
const {runAuthenticated:runSpoilage}=require('./legacy-spoilage-replay.cjs');
const {proof:proveStock}=require('./legacy-inventory-rollforward.cjs');
const {verifySourceGraph,baseOrderID}=require('./legacy-source-graph.cjs');
const {validateRow}=require('./legacy-week-bridge.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const ensure=(ok,why)=>{if(!ok)throw Error(why);};
function cents(v,label){
 ensure(typeof v==='number'&&Number.isFinite(v),'invalid-'+label);
 const scaled=v*100,minor=Math.round(scaled);
 ensure(Number.isSafeInteger(minor)&&Math.abs(scaled-minor)<1e-7,'non-cent-'+label);
 return minor;
}
function planCOGSFunding(observation,stock,graph,prior){
 try{
  ensure(observation&&Array.isArray(observation.storeWeeklyRows),'missing-finance-source');
  ensure(stock?.status==='SOURCE_STOCK_EVIDENCE_PARTIAL'&&stock.verifiedWeeks===13
   &&stock.blockedWeeks===0&&Array.isArray(stock.weeks)&&stock.weeks.length===13,'missing-verified-physical-stock');
  ensure(prior?.status==='SOURCE_LEDGER_STOCK_LOSS_PARTIAL'
   &&prior.postedSourceRows===53&&prior.heldSourceRows===96
   &&prior.canonicalJournalCount===54&&Array.isArray(prior.journal)&&prior.journal.length===54,
   'missing-prior-canonical-core');
  ensure(graph?.status==='SOURCE_GRAPH_PARTIAL'&&Array.isArray(graph.orders),'missing-order-source');
  const cashOrders=new Map();
  for(const order of graph.orders){
   ensure(order&&typeof order.orderID==='string'&&!cashOrders.has(order.orderID),'duplicate-source-order');
   cashOrders.set(order.orderID,order);
  }
  const weeks=[],held=[],seen=new Set(),cashSourceIDs=new Set(),physicalSourceIDs=[];
  let previous=stock.opening?.storeBookMinor;
  ensure(Number.isSafeInteger(previous)&&previous>=0,'no-physical-opening');
  const openingPhysicalMinor=previous;
  let totalCOGS=0,totalCash=0,totalCredit=0,totalSpoilage=0;
  let cashCount=0,creditCount=0,cogsCount=0,companyCoreStock=null;
  for(let i=0;i<13;i++){
   const week=ref.provenance.gameWeeks[0]+i,stockWeek=stock.weeks[i];
   ensure(stockWeek&&stockWeek.week===week&&stockWeek.status==='SOURCE_STOCK_WEEK_MATCH',
     'source-stock-week-'+week);
   ensure(stockWeek.openingStoreBookMinor===previous,'discontinuous-opening-book-'+week);
   const rows=observation.storeWeeklyRows.filter(r=>r.week===week&&
    (r.category==='costOfSales'||r.category==='workingCapitalIncrease'));
   let cogs=0,credit=0,cash=0,weekCOGS=0,weekCash=0,weekCredit=0;
   for(const row of rows){
    ensure(row&&typeof row.operationID==='string'&&!seen.has(row.operationID),
      'duplicate-finance-operation-'+week);
    seen.add(row.operationID);
    const parsed=validateRow(row,week,ref.provenance.storeId,ref.provenance.businessId);
    const a=parsed.amountMinor;
    if(parsed.kind==='costOfSales'){
     ensure(parsed.cashMinor===0&&parsed.profitMinor===-a&&cents(row.inventoryAmount,'cogs-inventory')===-a,
       'invalid-cogs-legs');
     ensure(a>0,'nonpositive-cogs');
     cogs++;cogsCount++;weekCOGS+=a;
     held.push({week,operationID:row.operationID,kind:'costOfSales',amountMinor:a,status:'BLOCKED',
       reasons:['physical-lot-source-is-weekly-not-individual-consumption-event',
        'opening-material-book-not-in-source-canonical-core',
        'two-immediate-inventory-payments-have-unverified-legal-payees']});
     physicalSourceIDs.push(row.operationID);
    }else{
     ensure(['inventoryReceiptCash','inventoryReceiptCredit'].includes(parsed.kind),
      'unknown-inventory-financing-kind');
     const orderID=baseOrderID(row),source=cashOrders.get(orderID);
     ensure(source&&Array.isArray(source.receipts),'missing-actual-order-'+orderID);
     const found=source.receipts.filter(r=>r.operationID===row.operationID&&r.week===week
       &&r.amountMinor===a&&r.kind===(parsed.kind==='inventoryReceiptCash'?'cash':'credit'));
     ensure(found.length===1,'unverified-receipt-finance-link-'+row.operationID);
     if(parsed.kind==='inventoryReceiptCash'){
      ensure(parsed.cashMinor===-a&&parsed.profitMinor===0&&cents(row.inventoryAmount,'cash-stock')===a,
       'cash-stock-legs');
      cash++;cashCount++;weekCash+=a;
      ensure(!cashSourceIDs.has(orderID),'duplicate-source-cash-PO');
      cashSourceIDs.add(orderID);
      held.push({week,operationID:row.operationID,kind:'inventoryReceiptCash',sourceOrderID:orderID,
       amountMinor:a,status:'BLOCKED',
       reasons:['supplier-catalog-ID-is-not-legally-verified-cash-counterparty',
        'canonical-core-requires-two-authenticated-entities-for-any-cash-journal']});
     }else{
      ensure(parsed.cashMinor===0&&parsed.profitMinor===0,'credit-stock-cash-profit-drift');
      credit++;creditCount++;weekCredit+=a;
     }
    }
   }
   const expected=ref.weeks[i];
   ensure(cogs===1&&weekCOGS===expected[2],'week-cogs-source-drift-'+week);
   ensure(weekCash===expected[7]&&cash===expected[10],'week-immediate-cash-source-drift-'+week);
   ensure(weekCredit===expected[8]&&credit===expected[11],'week-credit-source-drift-'+week);
   const spoil=stockWeek.nonStoreSpoliageMinor;
   ensure(Number.isSafeInteger(spoil)&&spoil>=0,'invalid-company-spoilage-week-'+week);
   const close=previous+weekCredit+weekCash-weekCOGS-spoil;
   ensure(Number.isSafeInteger(close)&&close>=0,'invalid-source-stock-closing-'+week);
   ensure(close===stockWeek.closingStoreBookMinor&&stockWeek.residualMinor===0,
    'source-physical-balance-mismatch-'+week);
   weeks.push({week,openingBookMinor:previous,creditReceiptMinor:weekCredit,
    immediateCashReceiptMinor:weekCash,costOfSalesMinor:weekCOGS,spoilageMinor:spoil,
    closingBookMinor:close,financeGapMinor:0,
    coreCOGSPosted:false,
    dependencyStatus:'BLOCKED_LEGAL_CASH_AND_OPENING_STOCK'});
   totalCOGS+=weekCOGS;totalCredit+=weekCredit;totalCash+=weekCash;totalSpoilage+=spoil;
   previous=close;
  }
  ensure(cogsCount===13&&cashCount===2&&creditCount===31&&held.length===15,
    'original-source-category-cardinality-drift');
  ensure(totalCash===ref.totals.cashPurchaseMinor
   &&totalCredit===ref.totals.creditPurchaseMinor
   &&totalSpoilage===prior.periodSpoilageMinor,'finance-source-total-drift');
  ensure(previous===stock.weeks[12].closingStoreBookMinor,'closing-book-drift');
  ensure(openingPhysicalMinor+totalCash+totalCredit-totalCOGS-totalSpoilage===previous,
   'physical-inventory-economic-identity');
  // Core has posted only 31 authenticated credit accruals and 9 spoilages.
  // The difference to the physical stock balance is exactly 13 COGS (not
  // journalized), the source opening physical book and two cash receipts
  // (also not journalized). Never interpret this gap as an entity/payee.
  companyCoreStock=prior.remainingInventoryMinor;
  ensure(companyCoreStock===totalCredit-totalSpoilage,'core-previous-posting-drift');
  const projectedCorePhysicalDifferenceMinor=
    companyCoreStock-previous;
  ensure(projectedCorePhysicalDifferenceMinor===totalCOGS-openingPhysicalMinor-totalCash,
    'unfunded-source-cogs-gap');
  ensure(cashSourceIDs.size===2,'cash-po-cardinality-drift');
  ensure(prior.journal.every(j=>j.postings.every(p=>!p.account.endsWith(':cash'))),
    'unexpected-unverified-core-cash');
  const expectedCashShortfallMinor=openingPhysicalMinor+totalCash;
  ensure(expectedCashShortfallMinor>0,'missing-opening-and-cash-stock');
  return {
   status:'CONTRACT_COGS_FUNDING_GRAPH_ONLY',weeks,openingPhysicalMinor,
   totalCreditMinor:totalCredit,totalImmediateCashMinor:totalCash,
   totalCOGSMinor:totalCOGS,totalSpoilageMinor:totalSpoilage,
   closingPhysicalMinor:previous,currentPartialCoreInventoryMinor:companyCoreStock,
   partialCoreMinusPhysicalMinor:projectedCorePhysicalDifferenceMinor,
   missingOpeningAndImmediateCashStockMinor:expectedCashShortfallMinor,
   cogsRows:13,cashReceiptRows:2,previouslyPostedSourceRows:53,
   previouslyHeldSourceRows:96,stillHeldSourceRows:96,
   immediateCashPOs:[...cashSourceIDs].sort(), heldDependencies:held,
   blockers:['cash-payee-legal-entity-missing','original-opening-material-lot-core-book-not-committed',
    'per-lot-intraweek-consumption-not-authenticated',
    'cash-purchase-needs-two-verified-cash-entities-before-journal',
    '13-cogs-postings-must-not-be-inferred-from-category-aggregates'],
   warning:'This is a source-backed physical-financing dependency calculation, NOT additional vNext ledger postings or financial parity.'
  };
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)]};}
}
function runAuthenticated(observation){
 try{
  const previous=runSpoilage(observation);
  ensure(previous.status==='SOURCE_LEDGER_STOCK_LOSS_PARTIAL',
    'prior-authentication-'+(previous.reasons||[]).join(';'));
  const stock=proveStock(observation);
  ensure(stock.status==='SOURCE_STOCK_EVIDENCE_PARTIAL'&&stock.verifiedWeeks===13,
    'stock-authentication-'+(stock.reasons||[]).join(';'));
  const graph=verifySourceGraph(observation);
  ensure(graph.status==='SOURCE_GRAPH_PARTIAL','graph-authentication-'+(graph.reasons||[]).join(';'));
  const r=planCOGSFunding(observation,stock,graph,previous);
  ensure(r.status==='CONTRACT_COGS_FUNDING_GRAPH_ONLY',
    'company-source-'+(r.reasons||[]).join(';'));
  return {...r,status:'SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL',
   verifiedRealSource:true,canonicalLedgerUnchanged:true,
   note:'13/13 source COGS and two immediate cash purchase receipts verified; ZERO COGS or cash transactions newly posted to core.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)]};}
}
module.exports={planCOGSFunding,runAuthenticated};
