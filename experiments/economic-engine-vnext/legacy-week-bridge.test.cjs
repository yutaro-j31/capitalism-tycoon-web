'use strict';
const assert=require('node:assert/strict');
const reference=require('./fixtures/legacy-real-13week-summary.json');
const bridge=require('./legacy-week-bridge.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
let passed=0;function test(label,fn){fn();passed++;console.log('PASS '+label);}
const C=reference.categories;
function row(week,kind,amountMinor,sequence){
 const storeID=reference.provenance.storeId,businessID=reference.provenance.businessId;
 const amount=amountMinor/100,base={week,storeID,businessID,
  category:kind==='inventoryReceiptCash'||kind==='inventoryReceiptCredit'?'workingCapitalIncrease':kind,
  amount,cashEffect:0,profitEffect:0,
  assetEffect:0,liabilityEffect:0,payableAmount:0,inventoryAmount:0};
 if(['revenue','costOfSales','rent','payroll','maintenance','depreciation'].includes(kind)){
  const suffix=kind==='costOfSales'?'cogs':kind;
  base.operationID='week-'+week+'-store-'+storeID+'-'+suffix;
  base.sourceType=kind==='depreciation'?'depreciation':'weekly-store-'+suffix;
  base.sourceID=kind==='depreciation'?'store-'+storeID:storeID;
  base.profitEffect=(kind==='revenue'?amount:-amount);
  base.cashEffect=kind==='costOfSales'||kind==='depreciation'?0:base.profitEffect;
  if(kind==='costOfSales')base.inventoryAmount=-amount;
  if(kind==='depreciation'){
   base.assetEffect=-amount;
   base.fixedAssetID='store-'+storeID;
   base.fixedAssetLifecycle='depreciation';
   base.fixedAssetEvidence={bookBefore:2000000,bookAfter:2000000-amount,accumulatedBefore:100000,accumulatedAfter:100000+amount};
  }
 }else if(kind==='inventoryReceiptCash'||kind==='inventoryReceiptCredit'){
  const suffix=kind==='inventoryReceiptCash'?'cash':'ap';
  base.sourceType=kind==='inventoryReceiptCash'?'emergency-receipt-cash':'inventory-receipt-ap';
  base.sourceID='po-'+week+'-'+sequence;
  base.operationID=base.sourceID+'-receipt-'+suffix+'-seq';
  base.assetEffect=amount;base.inventoryAmount=amount;
  if(kind==='inventoryReceiptCredit'){base.payableAmount=amount;base.liabilityEffect=amount;}
  else base.cashEffect=-amount;
 }else if(kind==='accountsPayablePayment'){
  base.sourceType='ap-payment';base.sourceID='po-'+(week-1)+'-'+sequence;
  base.operationID=base.sourceID+'-ap-pay-'+week;base.cashEffect=-amount;
 }else throw Error('unknown mock kind');
 base.idempotencyKey=base.operationID;
 return base;
}
function fabricate(){
 const rows=[],weekly=[];
 for(const numbers of reference.weeks){
  const week=numbers[0];
  for(let k=0;k<9;k++){
   const kind=C[k],amountMinor=numbers[k+1],count=k<6?1:(k===6?numbers[10]:k===7?numbers[11]:numbers[12]);
   if(count===0){assert.equal(amountMinor,0);continue;}
   const q=Math.floor(amountMinor/count);
   for(let i=0;i<count;i++)rows.push(row(week,kind,q+(i===count-1?amountMinor-q*count:0),i));
  }
  weekly.push({week,step:week-4,postedCashEffectJPY:numbers[13]/100,
   cashDeltaJPY:numbers[13]/100,storeFinanceRows:0,nonStoreFinanceRows:0});
 }
 return {seed:reference.provenance.simulationSeed,hostSeed:reference.provenance.hostSeed,
  observedStore:{id:reference.provenance.storeId,businessID:reference.provenance.businessId},
  observedWeeks:[...reference.provenance.gameWeeks],storeWeeklyRows:rows,weeklyEvidence:weekly,
  companyCashJPY:{opening:reference.provenance.openingCompanyCashJPY,closing:reference.provenance.closingCompanyCashJPY},
  legacyEvidenceClassification:{status:'UNSUPPORTED',nonStoreFinanceRows:reference.totals.nonStoreRows}};
}
function accepted(){const r=bridge.verifyObservation(fabricate());assert.equal(r.status,'SOURCE_ALIGNED_PARTIAL',JSON.stringify(r));return r;}
test('source-registered 13-week fixture has all nine signed categories',()=>{
 assert.deepEqual(C,['revenue','costOfSales','rent','payroll','maintenance','depreciation','inventoryReceiptCash','inventoryReceiptCredit','accountsPayablePayment']);
 assert.equal(reference.weeks.length,13);
});
test('synthetic replica of source-accounting summaries passes PARTIAL, never FULL',()=>{
 const r=accepted();assert.equal(r.weeks,13);assert.equal(r.storeRows,138);
 assert.ok(r.blockers.includes('unresolved-external-counterparties'));
});
test('13-week cash-profit bridge reconciles every week with accrual changes',()=>{
 const r=accepted();for(const w of r.perWeek){
  assert.equal(w.cashMinor-w.profitMinor,
   -w.inventoryDeltaMinor+w.payableDeltaMinor+w.depreciationMinor);
 }
});
test('period source cash and earnings exactly match reference',()=>{
 const r=accepted();
 assert.equal(r.sourceCashMinor,522267468);
 assert.equal(r.sourceProfitMinor,525860493);
 assert.equal(r.companyCashDeltaMinor,404726272);
});
test('source observation tracks all 33 inventory receipts and 27 AP payments',()=>{
 const r=accepted();
 assert.equal(r.categoryCounts.inventoryReceiptCash,2);
 assert.equal(r.categoryCounts.inventoryReceiptCredit,31);
 assert.equal(r.categoryCounts.accountsPayablePayment,27);
 assert.equal(r.categoryCounts.depreciation,13);
});
test('cash does not automatically equal profit',()=>{
 const r=accepted();assert.notEqual(r.sourceCashMinor,r.sourceProfitMinor);
 assert.notEqual(r.sourceCashMinor,r.companyCashDeltaMinor);
});
test('duplicate transaction receipt rejected even if categories match',()=>{
 const o=fabricate(),a=o.storeWeeklyRows[0],b=o.storeWeeklyRows[1];
 b.operationID=a.operationID;b.idempotencyKey=a.operationID;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('single-cent cash distortion fails source reference',()=>{
 const o=fabricate();o.storeWeeklyRows[0].cashEffect+=0.01;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('one-cent P&L manipulation is not tolerated',()=>{
 const o=fabricate();o.storeWeeklyRows[0].profitEffect+=0.01;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('source operation belongs to correct weekly store',()=>{
 const o=fabricate();o.storeWeeklyRows[0].storeID='store-unauthorized';
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('different seeded demand history rejected',()=>{
 const o=fabricate();o.seed++;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('noncash inventory COGS must change source inventory',()=>{
 const o=fabricate();const c=o.storeWeeklyRows.find(x=>x.category==='costOfSales');c.inventoryAmount=0;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('credit receipt requires a real matching AP liability event',()=>{
 const o=fabricate();const c=o.storeWeeklyRows.find(x=>x.sourceType==='inventory-receipt-ap');c.liabilityEffect=0;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('depreciation source must contain book before/after evidence',()=>{
 const o=fabricate();const d=o.storeWeeklyRows.find(x=>x.category==='depreciation');delete d.fixedAssetEvidence;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('missing week row fails closed',()=>{
 const o=fabricate();o.storeWeeklyRows.pop();
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('opening company cash drift fails closed',()=>{
 const o=fabricate();o.companyCashJPY.opening+=100;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('closed asset-book float amount remains exactly cents',()=>{
 const o=fabricate();const d=o.storeWeeklyRows.find(x=>x.category==='depreciation');d.fixedAssetEvidence.bookAfter+=0.001;
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('unmodeled new finance category rejected rather than counted as revenue',()=>{
 const o=fabricate();o.storeWeeklyRows[0].category='taxExpense';
 assert.equal(bridge.verifyObservation(o).status,'EVIDENCE_BLOCKED');
});
test('nonstore finance rows remain explicitly out of accounting-parity scope',()=>{
 assert.ok(accepted().blockers.includes('non-store-finance-outside-store-scope'));
});
console.log('SPIKE-6 13-week source-pinned cash-profit inventory/AP bridge: '+passed+' tests PASS; synthetic replicas only. Actual real-game receipt verification is a separate CI job.');
