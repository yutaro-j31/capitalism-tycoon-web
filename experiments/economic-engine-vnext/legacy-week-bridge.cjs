'use strict';
// SPIKE-6 — source-pinned 13-week ACCOUNTING BRIDGE, not full ledger parity.
// All observed rows come from a disposable REAL legacy game, not vNext fiction.
// Never fill unknown legacy counterparties, opening inventory or prior AP with guesses.
const reference=require('./fixtures/legacy-real-13week-summary.json');
const asMinor=(x,label)=>{
 if(typeof x!=='number'||!Number.isFinite(x))throw Error('invalid-'+label);
 const q=x*100,rounded=Math.round(q);
 if(!Number.isSafeInteger(rounded)||Math.abs(q-rounded)>1e-7)throw Error('non-cent-'+label);
 return rounded;
};
const ensure=(x,msg)=>{if(!x)throw Error(msg)};
const observedMinor=(x,label)=>{
 if(typeof x!=='number'||!Number.isFinite(x))throw Error('invalid-'+label);
 const rounded=Math.round(x*100);
 // Only opening/closing float-derived company cash may have sub-cent numerical noise.
 if(!Number.isSafeInteger(rounded)||Math.abs(x-rounded/100)>0.00001)throw Error('material-float-drift-'+label);
 return rounded;
};
const categories=reference.categories;
const oneWeek=['revenue','costOfSales','rent','payroll','maintenance','depreciation'];
const toKind=x=>{
 if(x.category==='workingCapitalIncrease')return x.sourceType==='emergency-receipt-cash'?'inventoryReceiptCash':x.sourceType==='inventory-receipt-ap'?'inventoryReceiptCredit':'UNKNOWN';
 if(x.category==='accountsPayablePayment')return x.sourceType==='ap-payment'?'accountsPayablePayment':'UNKNOWN';
 return categories.includes(x.category)?x.category:'UNKNOWN';
};
function validateRow(r,week,store,business){
 ensure(r&&typeof r==='object'&&r.week===week&&r.storeID===store&&r.businessID===business,'source-identity');
 ensure(typeof r.operationID==='string'&&r.operationID.length>0&&r.operationID===r.idempotencyKey,'source-idempotency');
 ensure(typeof r.sourceID==='string'&&r.sourceID.length>0,'missing-source-id');
 const kind=toKind(r);
 ensure(kind!=='UNKNOWN','unknown-finance-category-'+r.category);
 const a=asMinor(r.amount,'amount'),cash=asMinor(r.cashEffect,'cash'),profit=asMinor(r.profitEffect,'profit');
 ensure(a>=0,'negative-amount');
 const inventory=asMinor(r.inventoryAmount||0,'inventory');
 const assets=asMinor(r.assetEffect||0,'asset');
 const liability=asMinor(r.liabilityEffect||0,'liability');
 const payable=asMinor(r.payableAmount||0,'payable');
 if(oneWeek.includes(kind)){
  const suffix=kind==='costOfSales'?'cogs':kind;
  ensure(r.operationID==='week-'+week+'-store-'+store+'-'+suffix,'weekly-operation-provenance');
  if(kind==='depreciation'){
   ensure(r.sourceType==='depreciation'&&r.fixedAssetLifecycle==='depreciation'&&r.fixedAssetID==='store-'+store,'depreciation-asset-evidence');
   const e=r.fixedAssetEvidence;
   ensure(e&&asMinor(e.bookBefore,'book-before')-asMinor(e.bookAfter,'book-after')===a,'asset-book-depreciation');
   ensure(asMinor(e.accumulatedAfter,'acc-after')-asMinor(e.accumulatedBefore,'acc-before')===a,'accumulated-depreciation');
   ensure(cash===0&&profit===-a&&assets===-a,'depreciation-legs');
  }else{
   ensure(r.sourceType==='weekly-store-'+suffix&&r.sourceID===store,'weekly-source-type');
   const expected=kind==='revenue'?a:-a;
   ensure(profit===expected,'weekly-profit-leg');
   ensure(cash===(kind==='costOfSales'?0:expected),'weekly-cash-leg');
   ensure(kind==='costOfSales'?inventory===-a:inventory===0,'weekly-inventory-leg');
  }
 }else if(kind==='inventoryReceiptCash'||kind==='inventoryReceiptCredit'){
  ensure(r.operationID.startsWith('po-')&&r.sourceID.startsWith('po-'),'purchase-order-provenance');
  ensure(inventory===a&&assets===a&&profit===0,'inventory-receipt-legs');
  if(kind==='inventoryReceiptCash')ensure(cash===-a&&payable===0&&liability===0,'cash-receipt-legs');
  else ensure(cash===0&&payable===a&&liability===a,'credit-receipt-legs');
 }else if(kind==='accountsPayablePayment'){
  ensure(r.sourceType==='ap-payment'&&r.sourceID.startsWith('po-')&&r.operationID===r.sourceID+'-ap-pay-'+week,'ap-payment-provenance');
  ensure(cash===-a&&profit===0&&inventory===0&&payable===0,'ap-cash-legs');
 }
 return {kind,amountMinor:a,cashMinor:cash,profitMinor:profit};
}
function emptyMetrics(){
 return {cashMinor:0,profitMinor:0,inventoryDeltaMinor:0,payableDeltaMinor:0,depreciationMinor:0,week:0,rows:0};
}
function verifyObservation(observation, pinned=reference){
 try{
  ensure(observation&&typeof observation==='object'&&pinned&&pinned.schemaVersion===1&&pinned.unit==='JPY-0.01','invalid-input');
  ensure(observation.seed===pinned.provenance.simulationSeed&&observation.hostSeed===pinned.provenance.hostSeed,'simulation-seed-drift');
  ensure(observation.observedStore?.id===pinned.provenance.storeId&&observation.observedStore?.businessID===pinned.provenance.businessId,'store-selection-drift');
  ensure(JSON.stringify(observation.observedWeeks)===JSON.stringify(pinned.provenance.gameWeeks),'observed-week-range');
  ensure(Array.isArray(observation.storeWeeklyRows)&&observation.storeWeeklyRows.length===pinned.totals.rows,'row-count-drift');
  ensure(Array.isArray(observation.weeklyEvidence)&&observation.weeklyEvidence.length===13,'weekly-evidence-length');
  ensure(observation.legacyEvidenceClassification?.status==='UNSUPPORTED','classification-gate');
  ensure(observation.legacyEvidenceClassification.nonStoreFinanceRows===pinned.totals.nonStoreRows,'non-store-coverage-drift');
  const cash=observation.companyCashJPY;
  ensure(asMinor(cash.opening,'opening-cash')===asMinor(pinned.provenance.openingCompanyCashJPY,'pinned-opening'),'opening-company-cash-drift');
  ensure(asMinor(cash.closing,'closing-cash')===asMinor(pinned.provenance.closingCompanyCashJPY,'pinned-closing'),'closing-company-cash-drift');
  const seen=new Set(),observed=[],total=emptyMetrics(),fullCounts={};
  for(let i=0;i<13;i++){
   const expected=pinned.weeks[i],week=expected[0],e=observation.weeklyEvidence[i];
   ensure(e&&e.week===week&&week===pinned.provenance.gameWeeks[0]+i,'week-sequence-drift');
   const rows=observation.storeWeeklyRows.filter(x=>x.week===week),metrics=emptyMetrics(),bucket={};
   metrics.week=week;metrics.rows=rows.length;
   for(const row of rows){
    const x=validateRow(row,week,pinned.provenance.storeId,pinned.provenance.businessId);
    ensure(!seen.has(row.operationID),'duplicate-source-receipt');
    seen.add(row.operationID);
    (bucket[x.kind]??={count:0,amount:0}).count++;
    bucket[x.kind].amount+=x.amountMinor;
    fullCounts[x.kind]=(fullCounts[x.kind]||0)+1;
    metrics.cashMinor+=x.cashMinor;
    metrics.profitMinor+=x.profitMinor;
    if(x.kind==='inventoryReceiptCash'||x.kind==='inventoryReceiptCredit')metrics.inventoryDeltaMinor+=x.amountMinor;
    if(x.kind==='costOfSales')metrics.inventoryDeltaMinor-=x.amountMinor;
    if(x.kind==='inventoryReceiptCredit')metrics.payableDeltaMinor+=x.amountMinor;
    if(x.kind==='accountsPayablePayment')metrics.payableDeltaMinor-=x.amountMinor;
    if(x.kind==='depreciation')metrics.depreciationMinor+=x.amountMinor;
   }
   for(let k=0;k<categories.length;k++){
    const kind=categories[k],slot=bucket[kind]||{count:0,amount:0};
    const amount=expected[k+1]??0, count=k<6?1:(k===6?expected[10]:k===7?expected[11]:expected[12]);
    const expectedAmount=k<6?expected[k+1]:expected[k===6?7:k===7?8:9];
    ensure(slot.count===count&&slot.amount===expectedAmount,'week-category-drift-'+week+'-'+kind);
   }
   const cashCalc=metrics.cashMinor,profitCalc=metrics.profitMinor;
   ensure(cashCalc===expected[13]&&profitCalc===expected[14],'week-cash-profit-drift-'+week);
   // Store CFO vs P&L, using inventory and AP working capital and noncash depreciation.
   ensure(cashCalc-profitCalc===-metrics.inventoryDeltaMinor+metrics.payableDeltaMinor+metrics.depreciationMinor,'week-cash-profit-bridge-'+week);
   ensure(asMinor(e.postedCashEffectJPY,'finance-week-cash')===expected[13] || e.nonStoreFinanceRows>0,'finance-observation-mismatch-'+week);
   for(const key of ['cashMinor','profitMinor','inventoryDeltaMinor','payableDeltaMinor','depreciationMinor','rows'])total[key]+=metrics[key];
   observed.push({week,cashMinor:metrics.cashMinor,profitMinor:metrics.profitMinor,
    inventoryDeltaMinor:metrics.inventoryDeltaMinor,payableDeltaMinor:metrics.payableDeltaMinor,
    depreciationMinor:metrics.depreciationMinor,transactionCount:rows.length});
  }
  ensure(total.cashMinor===pinned.totals.storeCashDeltaMinor,'aggregate-store-cash');
  ensure(total.profitMinor===pinned.totals.storeProfitMinor,'aggregate-store-profit');
  ensure(total.rows===pinned.totals.rows,'aggregate-row-count');
  ensure(total.depreciationMinor===pinned.totals.depreciationMinor,'aggregate-depreciation');
  const companyDelta=observedMinor(cash.closing-cash.opening,'company-delta');
  ensure(companyDelta===pinned.totals.companyCashDeltaMinor,'aggregate-company-cash');
  return {status:'SOURCE_ALIGNED_PARTIAL',weeks:13,storeRows:total.rows,
   sourceCashMinor:total.cashMinor,sourceProfitMinor:total.profitMinor,
   inventoryDeltaMinor:total.inventoryDeltaMinor,payableDeltaMinor:total.payableDeltaMinor,
   depreciationMinor:total.depreciationMinor,companyCashDeltaMinor:companyDelta,
   perWeek:observed,categoryCounts:fullCounts,
   blockers:['unresolved-external-counterparties','opening-inventory-and-payables-not-separately-authenticated','no-vnext-transaction-by-transaction-execution','non-store-finance-outside-store-scope','legacy-fixed-asset-acquisition-outside-observation-window','durable-storage-not-tested'],
   source:'Real legacy game observations; signed 13-week category and cash/profit working-capital bridge only; NOT full economic parity.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)],source:'Do not conclude parity from incomplete or altered evidence.'};}
}
module.exports={verifyObservation,validateRow};
