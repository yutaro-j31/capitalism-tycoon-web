'use strict';
const assert=require('node:assert/strict');
const {analyze}=require('./legacy-observation-analysis.cjs');
let passed=0;
const test=(name,fun)=>{fun();passed++;console.log('PASS '+name);};
function scenario(){
 const storeID='store-s2',businessID='ramen',opening=1_000_000,records=[];
 let cash=opening;
 for(let week=5;week<=17;week++){
  const make=(category,suffix,amount,cashEffect,profitEffect)=>({
   week,storeID,businessID,category,amount,cashEffect,profitEffect,
   inventoryAmount:0,payableAmount:0,sourceID:storeID,
   sourceType:'weekly-store-'+suffix,
   operationID:'week-'+week+'-store-'+storeID+'-'+suffix,
   idempotencyKey:'week-'+week+'-store-'+storeID+'-'+suffix
  });
  const rows=[
   make('revenue','revenue',100,100,100),
   make('costOfSales','cogs',30,0,-30),
   make('rent','rent',10,-10,-10),
   make('payroll','payroll',20,-20,-20),
   make('maintenance','maintenance',5,-5,-5)
  ];
  if(week===5){
   rows.push({...make('workingCapitalIncrease','receipt-ap',40,0,0),
    sourceType:'inventory-receipt-ap',sourceID:'po-9-v',
    operationID:'po-9-receipt-ap-v',idempotencyKey:'po-9-receipt-ap-v',
    inventoryAmount:40,payableAmount:40});
   rows.push({...make('accountsPayablePayment','ap-pay',20,-20,0),
    sourceType:'ap-payment',sourceID:'po-8',
    operationID:'po-8-ap-pay-5',idempotencyKey:'po-8-ap-pay-5'});
   rows.push({...make('depreciation','depreciation',2,0,-2),
    sourceType:'depreciation',sourceID:'store-'+storeID});
  }
  const finance=rows.reduce((s,x)=>s+x.cashEffect,0);
  const before=cash;cash+=finance;
  records.push({step:week-4,week,storeRows:rows,otherRows:[],
   cashDeltaJPY:finance,observedFinanceCashEffectJPY:finance,
   beforeCashJPY:before,afterCashJPY:cash});
 }
 return {storeID,businessID,openingCashJPY:opening,closingCashJPY:cash,records};
}
test('real-format inventory, AP, depreciation classes are UNSUPPORTED not evidence-blocked',()=>{
 const x=analyze(scenario());
 assert.equal(x.status,'UNSUPPORTED',JSON.stringify(x));
 for(const label of ['inventory-accrual-receipt','accounts-payable-settlement','noncash-depreciation','rent-not-modeled','noncash-inventory-cogs','maintenance-not-modeled'])assert.ok(x.reasons.includes(label),label);
});
test('capture covers 13 actual absolute game weeks',()=>{
 const x=analyze(scenario());assert.deepEqual(x.observedWeeks,[5,17]);assert.equal(x.weeks,13);
});
test('category counts retain all real store entries',()=>{
 const x=analyze(scenario());assert.equal(x.storeRows,68);
 assert.equal(x.categoryCounts.revenue,13);assert.equal(x.categoryCounts.workingCapitalIncrease,1);
 assert.equal(x.categoryCounts.accountsPayablePayment,1);assert.equal(x.categoryCounts.depreciation,1);
});
test('company and finance cash reconcile in minor units',()=>{
 const x=analyze(scenario());assert.equal(x.companyCashDeltaMinor,x.storeCashDeltaMinor);
});
test('output contains exact store profit independently of cash',()=>{
 const x=analyze(scenario());assert.notEqual(x.storeProfitMinor,x.storeCashDeltaMinor);
});
test('unexpected store category causes EVIDENCE_BLOCKED, not a false match',()=>{
 const s=scenario();s.records[0].storeRows[0].category='unknownRevenue';
 const x=analyze(s);assert.equal(x.status,'EVIDENCE_BLOCKED');
});
test('missing one of five mandatory weekly records blocks',()=>{
 const s=scenario();s.records[0].storeRows=s.records[0].storeRows.filter(r=>r.category!=='revenue');
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('duplicated operationID blocks',()=>{
 const s=scenario();s.records[0].storeRows.push({...s.records[0].storeRows[0]});
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('unknown inventory procurement source blocks',()=>{
 const s=scenario();s.records[0].storeRows.find(r=>r.category==='workingCapitalIncrease').sourceType='unknown-cash';
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('inventory payable receipt cannot debit cash and AP together',()=>{
 const s=scenario();s.records[0].storeRows.find(r=>r.category==='workingCapitalIncrease').cashEffect=-40;
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('depreciation must have exactly zero cash',()=>{
 const s=scenario();s.records[0].storeRows.find(r=>r.category==='depreciation').cashEffect=-2;
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('AP payment must have stable PO source identity',()=>{
 const s=scenario();s.records[0].storeRows.find(r=>r.category==='accountsPayablePayment').operationID='rogue-payment';
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('material unexplained company cash delta is rejected',()=>{
 const s=scenario();s.records[1].cashDeltaJPY+=10;
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('subcent legacy game cash residual allowed but explicitly reported',()=>{
 const s=scenario();s.records[0].cashDeltaJPY+=0.0047599;
 const x=analyze(s);assert.equal(x.status,'UNSUPPORTED',JSON.stringify(x));
 assert.ok(x.maxCompanyFloatResidualJPY>0.0047&&x.maxCompanyFloatResidualJPY<0.005);
});
test('above-half-cent unexplained delta blocks even if visually small',()=>{
 const s=scenario();s.records[0].cashDeltaJPY+=0.011;
 assert.equal(analyze(s).status,'EVIDENCE_BLOCKED');
});
test('cannot claim actual production MATCH from a structurally balanced synthetic capture',()=>{
 const x=analyze(scenario());assert.notEqual(x.status,'MATCH');assert.ok(x.warning.includes('No source-matched'));
});
console.log('SPIKE-3.8 authentic-category contract: '+passed+' tests PASS. Source format mocks, not production replay.');
