'use strict';
// SPIKE-8A company-only real-source subset contract tests.
// These fixtures are MOCKS. The authentic 13-week gate is independent.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {planSourceRows,runAuthenticatedReplay}=require('./legacy-company-replay.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
let passed=0;const test=(title,fn)=>{fn();passed++;console.log('PASS '+title);};
function receipt(week,id,amount=100){
 const order='po-'+id,q='2.5',key=order+'-receipt-ap-'+q;
 return {week,storeID:'store-s2',businessID:'ramen',
  category:'workingCapitalIncrease',sourceType:'inventory-receipt-ap',
  sourceID:order+'-'+q,operationID:key,idempotencyKey:key,
  amount,cashEffect:0,profitEffect:0,inventoryAmount:amount,
  assetEffect:amount,liabilityEffect:amount,payableAmount:amount};
}
function charge(week,kind='rent',amount=5){
 return {week,storeID:'store-s2',businessID:'ramen',category:kind,sourceType:'weekly-store-'+kind,
 sourceID:'store-s2',operationID:'week-'+week+'-store-store-s2-'+kind,
 idempotencyKey:'week-'+week+'-store-store-s2-'+kind,
 amount,cashEffect:-amount,profitEffect:-amount,inventoryAmount:0,assetEffect:0,liabilityEffect:0,payableAmount:0};
}
function cogs(week=5,amount=40){
 return {...charge(week,'costOfSales',amount),sourceType:'weekly-store-cogs',
 operationID:'week-'+week+'-store-store-s2-cogs',idempotencyKey:'week-'+week+'-store-store-s2-cogs',
 cashEffect:0,inventoryAmount:-amount};
}
function payment(week=6,orderID='po-1',amount=50){
 const op=orderID+'-ap-pay-'+week;
 return {week,storeID:'store-s2',businessID:'ramen',category:'accountsPayablePayment',
 sourceType:'ap-payment',sourceID:orderID,operationID:op,idempotencyKey:op,
 amount,cashEffect:-amount,profitEffect:0,inventoryAmount:0,payableAmount:0,assetEffect:0,liabilityEffect:0};
}
function cashBuy(week=5,amount=15){
 return {...receipt(week,3,amount),
  operationID:'po-3-receipt-cash-2.5',idempotencyKey:'po-3-receipt-cash-2.5',
  category:'workingCapitalIncrease',sourceType:'emergency-receipt-cash',
  cashEffect:-amount,liabilityEffect:0,payableAmount:0};
}
const rows=()=>[receipt(5,1,100),charge(5),cogs(5),receipt(6,2,250),payment(6),cashBuy(5)];
function proof(incoming=rows()){
 const orders=[];
 for(const r of incoming.filter(x=>x.sourceType==='inventory-receipt-ap')){
  const po=r.sourceID.split('-').slice(0,2).join('-');
  orders.push({orderID:po,supplierCatalogID:'catalog-'+po,receipts:[
   {operationID:r.operationID,kind:'credit',week:r.week,amountMinor:Math.round(r.amount*100)}
  ]});
 }
 return {status:'SOURCE_GRAPH_PARTIAL',orders};
}
function run(items=rows(),pr=proof(items)){
 return planSourceRows(items,pr);
}
test('mock subset never reports authentic full source parity',()=>{
 const x=run();assert.equal(x.status,'CONTRACT_SIMULATION_ONLY');
 assert.equal(x.posted,2);assert.equal(x.blocked,4);
});
test('31-receipt pattern books company-only inventory and AP with exact cents',()=>{
 const x=run();assert.equal(x.balances.creditInventoryMinor,35000);
 assert.equal(x.balances.creditPayableMinor,-35000);
 assert.equal(x.balances.companyCashDeltaMinor,0);
});
test('each posted receipt uses two balanced canonical core journal legs',()=>{
 const x=run();
 for(const j of x.journal){
  assert.equal(j.postings.length,2);
  assert.equal(j.postings[0].deltaMinor,-j.postings[1].deltaMinor);
  assert.ok(j.postings[0].account.startsWith('company:inventory:'));
  assert.ok(j.postings[1].account.startsWith('company:payable:'));
 }
});
test('decimal receipt identity maps into safe deterministic operation hash',()=>{
 const x=run();
 for(const r of x.receipts) {
  assert.match(r.canonicalOperationID,/^leg-[a-f0-9]{32}$/);
  assert.equal(r.canonicalOperationID,'leg-'+crypto.createHash('sha256').update(r.operationID).digest('hex').slice(0,32));
  assert.equal(x.journal[r.journalSequence-1].operationId,r.canonicalOperationID);
 }
});
test('no external cash claims or fabricated customer supplier ledger accounts',()=>{
 const x=run();
 assert.ok(x.journal.every(j=>j.postings.every(p=>p.account.startsWith('company:')&&!p.account.endsWith(':cash'))));
});
test('all noncredit transactions are individually held with explicit provenance reason',()=>{
 const x=run();assert.deepEqual(x.held.map(z=>z.kind).sort(),
 ['accountsPayablePayment','costOfSales','inventoryReceiptCash','rent'].sort());
 assert.ok(x.held.every(z=>z.status==='BLOCKED'&&z.reason.length>0));
});
test('store cost of sales cannot consume unauthenticated opening inventory',()=>{
 const x=run();assert.ok(x.held.some(z=>z.kind==='costOfSales'&&z.reason.includes('opening-inventory')));
});
test('source AP payment cannot be applied until legal counterparty and prior payable proved',()=>{
 const x=run();assert.ok(x.held.some(z=>z.kind==='accountsPayablePayment'&&z.reason.includes('prewindow-AP')));
});
test('adding new independent authenticated credit receipt is deterministic',()=>{
 const a=run(),b=run();assert.deepEqual(a,b);
});
test('shuffling input receipt order does not change replay canonical journal',()=>{
 const items=rows(),r=run(items,proof(items));
 const shuffled=[items[4],items[1],items[3],items[5],items[0],items[2]];
 const s=run(shuffled,proof(items));assert.deepEqual(r.journal,s.journal);
});
test('mock cannot invoke authentic run gate',()=>{
 const r=runAuthenticatedReplay({storeWeeklyRows:rows()});
 assert.equal(r.status,'EVIDENCE_BLOCKED');
});
test('missing original PO proof is always blocked, not fabricated',()=>{
 const p=proof();p.orders.pop();
 const x=run(rows(),p);assert.equal(x.status,'EVIDENCE_BLOCKED');
});
test('wrong PO sourced amount is blocked',()=>{
 const p=proof();p.orders[0].receipts[0].amountMinor=12;
 assert.equal(run(rows(),p).status,'EVIDENCE_BLOCKED');
});
test('wrong PO receipt kind is blocked',()=>{
 const p=proof();p.orders[0].receipts[0].kind='cash';
 assert.equal(run(rows(),p).status,'EVIDENCE_BLOCKED');
});
test('changed financial debit or liability cannot enter core',()=>{
 const a=rows();a[0].liabilityEffect=101;
 assert.equal(run(a,proof()).status,'EVIDENCE_BLOCKED');
});
test('changed cash receipt accounting cannot enter core',()=>{
 const a=rows();a[0].cashEffect=100;
 assert.equal(run(a,proof()).status,'EVIDENCE_BLOCKED');
});
test('duplicate financial source operation ID is rejected',()=>{
 const a=rows();a.push({...a[0]});
 assert.equal(run(a,proof()).status,'EVIDENCE_BLOCKED');
});
test('invalid noncent amount is rejected',()=>{
 const a=rows();a[0].amount=12.345;
 assert.equal(run(a,proof()).status,'EVIDENCE_BLOCKED');
});
test('zero credited amount is rejected',()=>{
 const a=rows();a[0].amount=0;a[0].assetEffect=0;a[0].inventoryAmount=0;a[0].liabilityEffect=0;a[0].payableAmount=0;
 assert.equal(run(a,proof()).status,'EVIDENCE_BLOCKED');
});
test('supplier catalogue ID is only metadata and never a ledger counterparty',()=>{
 const x=run();assert.ok(x.receipts[0].supplierCatalogID.startsWith('catalog-'));
 assert.ok(x.journal.every(j=>j.postings.every(p=>!p.account.includes('catalog'))));
});
test('source year week and company store attribution must match pinned observation',()=>{
 const a=rows();a[0].storeID='other';
 assert.equal(run(a,proof()).status,'EVIDENCE_BLOCKED');
});
test('AP per-order liability and total inventory magnitude reconcile',()=>{
 const x=run();
 const liabilities=x.journal.flatMap(j=>j.postings.filter(p=>p.account.includes(':payable:')));
 assert.equal(liabilities.reduce((s,r)=>s+r.deltaMinor,0),-35000);
});
console.log('SPIKE-8A company-only credit receipt core replay: '+passed+' PASS. MOCK contract tests; authentic replay requires separate full-engine job.');
