'use strict';
const assert=require('node:assert/strict');
const {planCOGSFunding,runAuthenticated}=require('./legacy-cogs-funding.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const spoil=new Map([[8,6247752],[9,1333209],[10,5871552],[11,205862],[12,5407595],
 [14,1881756],[15,5291677],[16,4351276],[17,1200910]]);
let passed=0;function test(title,run){run();passed++;console.log('PASS '+title);}
function inputs(){
 const store='store-s2',business='ramen',rows=[],orders=[],stockWeeks=[];
 let seq=1,opening=13483;
 const add=(week,kind,minorAmount)=>{
  const amount=minorAmount/100;
  if(kind==='costOfSales'){
   const operationID='week-'+week+'-store-'+store+'-cogs';
   rows.push({week,category:'costOfSales',sourceType:'weekly-store-cogs',
    sourceID:store,storeID:store,businessID:business,operationID,idempotencyKey:operationID,
    amount,cashEffect:0,profitEffect:-amount,inventoryAmount:-amount,assetEffect:-amount});
  }else{
   const id='po-'+seq++,cash=kind==='inventoryReceiptCash',operationID=id+'-receipt-'+(cash?'cash':'ap')+'-1';
   rows.push({week,category:'workingCapitalIncrease',sourceType:cash?'emergency-receipt-cash':'inventory-receipt-ap',
    storeID:store,businessID:business,sourceID:id+'-1',operationID,idempotencyKey:operationID,amount,
    cashEffect:cash?-amount:0,profitEffect:0,inventoryAmount:amount,assetEffect:amount,
    payableAmount:cash?0:amount,liabilityEffect:cash?0:amount});
   orders.push({orderID:id,supplierCatalogID:'wholesale-'+id,receipts:[
    {operationID,week,kind:cash?'cash':'credit',amountMinor:minorAmount}]});
  }
 };
 for(let i=0;i<13;i++){
  const week=5+i,fixture=ref.weeks[i],cogs=fixture[2],credit=fixture[8],
    ccount=fixture[11],cash=fixture[7],cashCount=fixture[10];
  add(week,'costOfSales',cogs);
  if(ccount){
   const per=Math.floor(credit/ccount);
   for(let j=0;j<ccount;j++)add(week,'inventoryReceiptCredit',
    j===ccount-1?credit-per*(ccount-1):per);
  }
  if(cashCount){
   const per=Math.floor(cash/cashCount);
   for(let j=0;j<cashCount;j++)add(week,'inventoryReceiptCash',
    j===cashCount-1?cash-per*(cashCount-1):per);
  }
  const spoiled=spoil.get(week)||0;
  const closing=opening+credit+cash-cogs-spoiled;
  stockWeeks.push({week,status:'SOURCE_STOCK_WEEK_MATCH',openingStoreBookMinor:opening,
   closingStoreBookMinor:closing,nonStoreSpoliageMinor:spoiled,residualMinor:0});
  opening=closing;
 }
 const obs={storeWeeklyRows:rows};
 const physical={status:'SOURCE_STOCK_EVIDENCE_PARTIAL',verifiedWeeks:13,blockedWeeks:0,
  opening:{storeBookMinor:13483},weeks:stockWeeks};
 const graph={status:'SOURCE_GRAPH_PARTIAL',orders};
 const prev={status:'SOURCE_LEDGER_STOCK_LOSS_PARTIAL',postedSourceRows:53,heldSourceRows:96,
  canonicalJournalCount:54,periodSpoilageMinor:31791589,
  remainingInventoryMinor:585379167,
  journal:Array.from({length:54},(_,i)=>({operationId:'existing-'+i,postings:[
   {account:'company:inventory:store-s2',deltaMinor:1},
   {account:'company:payable:po-1',deltaMinor:-1}]}))};
 return {obs,physical,graph,prev};
}
function run(x=inputs()){
 return planCOGSFunding(x.obs,x.physical,x.graph,x.prev);
}
function good(){
 const r=run();assert.equal(r.status,'CONTRACT_COGS_FUNDING_GRAPH_ONLY',JSON.stringify(r));return r;
}
function blocked(edit){
 const x=inputs();edit(x);
 const r=run(x);assert.equal(r.status,'EVIDENCE_BLOCKED',JSON.stringify(r));return r;
}
test('13 real-shaped COGS and two cash finance receipts are source classified',()=>{
 const r=good();assert.equal(r.cogsRows,13);assert.equal(r.cashReceiptRows,2);
 assert.equal(r.heldDependencies.length,15);
});
test('source-cash additions and source-book opening exactly reconcile week 17',()=>{
 const r=good();assert.equal(r.openingPhysicalMinor,13483);
 assert.equal(r.totalImmediateCashMinor,26351317);
 assert.equal(r.closingPhysicalMinor,99645966);
});
test('exact credit total and nine spoilage expense mirror existing canonical postings',()=>{
 const r=good();assert.equal(r.totalCreditMinor,617170756);
 assert.equal(r.totalSpoilageMinor,31791589);
 assert.equal(r.currentPartialCoreInventoryMinor,585379167);
});
test('COGS equals genuinely observed 13-week physical stock reduction',()=>{
 const r=good();assert.equal(r.totalCOGSMinor,512098001);
 assert.equal(r.weeks.reduce((n,w)=>n+w.costOfSalesMinor,0),512098001);
});
test('core-versus-physical gap is not a new bank account or supplier',()=>{
 const r=good();assert.equal(r.partialCoreMinusPhysicalMinor,485733201);
 assert.equal(r.missingOpeningAndImmediateCashStockMinor,26364800);
 assert.equal(r.partialCoreMinusPhysicalMinor,r.totalCOGSMinor-r.missingOpeningAndImmediateCashStockMinor);
});
test('every week has zero physical rollforward residual',()=>{
 const r=good();assert.equal(r.weeks.length,13);
 assert.ok(r.weeks.every(w=>w.financeGapMinor===0));
});
test('every COGS remains blocked even with physical 13-week arithmetic match',()=>{
 const r=good();assert.equal(r.heldDependencies.filter(r=>r.kind==='costOfSales').length,13);
 assert.ok(r.weeks.every(w=>w.coreCOGSPosted===false));
});
test('cash receipt cannot be recognized as legal supplier counterparty',()=>{
 const r=good();const a=r.heldDependencies.filter(x=>x.kind==='inventoryReceiptCash');
 assert.equal(a.length,2);assert.equal(a.reduce((n,x)=>n+x.amountMinor,0),26351317);
 assert.ok(a.every(x=>x.reasons.some(s=>s.includes('counterparty'))));
});
test('source invoice IDs preserve real purchase order ancestry',()=>{
 const r=good();assert.equal(r.immediateCashPOs.length,2);
 assert.ok(r.immediateCashPOs.every(x=>/^po-[0-9]+$/.test(x)));
});
test('all 53 prior postings are unchanged and the 96 held remain held',()=>{
 const x=inputs(),before=JSON.stringify(x.prev);
 const r=run(x);
 assert.equal(r.previouslyPostedSourceRows,53);assert.equal(r.stillHeldSourceRows,96);
 assert.equal(JSON.stringify(x.prev),before);
});
test('mock-only plan cannot declare real source authentication',()=>{
 assert.equal(good().status,'CONTRACT_COGS_FUNDING_GRAPH_ONLY');
 assert.equal(runAuthenticated({storeWeeklyRows:[]}).status,'EVIDENCE_BLOCKED');
});
test('opening inventory of zero is rejected by real source weekly opening',()=>{
 blocked(x=>{x.physical.opening.storeBookMinor=0;});
});
test('missing physical week proof fails closed',()=>{
 blocked(x=>{x.physical.weeks.pop();});
});
test('missing original credit receipt is detected',()=>{
 blocked(x=>{x.obs.storeWeeklyRows=x.obs.storeWeeklyRows.filter(r=>r.sourceType!=='inventory-receipt-ap').slice(0,2);});
});
test('altered COGS amount fails week source digest/category match',()=>{
 blocked(x=>{x.obs.storeWeeklyRows.find(r=>r.category==='costOfSales').amount+=1;});
});
test('cash inventory receipt with wrong supplier order reference fails',()=>{
 blocked(x=>{x.obs.storeWeeklyRows.find(r=>r.sourceType==='emergency-receipt-cash').sourceID='po-999-1';});
});
test('wrong source PO amount is not legitimate evidence',()=>{
 blocked(x=>{
  const cash=x.graph.orders.find(o=>o.receipts[0].kind==='cash');
  cash.receipts[0].amountMinor+=100;
 });
});
test('cash received source cannot be turned into creditor accrual',()=>{
 blocked(x=>{
  const row=x.obs.storeWeeklyRows.find(r=>r.sourceType==='emergency-receipt-cash');
  row.cashEffect=0;row.liabilityEffect=row.amount;
 });
});
test('missing cash receipt cannot be netted into COGS',()=>{
 blocked(x=>{x.obs.storeWeeklyRows=x.obs.storeWeeklyRows.filter(r=>r.sourceType!=='emergency-receipt-cash');});
});
test('reordered weekly physical book is not a successful reconciliation',()=>{
 blocked(x=>{x.physical.weeks[2].closingStoreBookMinor+=1;});
});
test('unattributed company spoilage value must not be invented',()=>{
 blocked(x=>{x.physical.weeks[3].nonStoreSpoliageMinor+=100;});
});
test('financial source duplicate operation ID detected',()=>{
 blocked(x=>{
  const cogs=x.obs.storeWeeklyRows.find(r=>r.category==='costOfSales');
  x.obs.storeWeeklyRows.push({...cogs});
 });
});
test('source weekly inventory may never become negative',()=>{
 blocked(x=>{x.physical.weeks[0].closingStoreBookMinor=-1;});
});
test('existing canonical core cash leg blocks external cash assumption',()=>{
 blocked(x=>{x.prev.journal[0].postings[0].account='company:cash';});
});
test('previous 54 core journals are mandatory',()=>{
 blocked(x=>{x.prev.journal.pop();});
});
test('previous source-spoilage amount must equal validated stock source',()=>{
 blocked(x=>{x.prev.periodSpoilageMinor+=1;});
});
test('fake prior proof cannot unlock cash-side COGS',()=>{
 blocked(x=>{x.prev.status='CONTRACT_STOCK_LOSS_SIMULATION';});
});
test('mutated customer/PO is never accepted as inventory origin',()=>{
 blocked(x=>{x.graph.orders[0].receipts[0].kind='invalid-kind';});
});
console.log('SPIKE-8E COGS cash-financing dependency graph: '+passed+' PASS (synthetic mocks only).');
