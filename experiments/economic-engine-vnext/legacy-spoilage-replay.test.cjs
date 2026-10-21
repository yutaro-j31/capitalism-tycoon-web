'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {planSpoilageProof,runAuthenticated}=require('./legacy-spoilage-replay.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const hash=(tag,s)=>tag+'-'+createHash('sha256').update(s).digest('hex').slice(0,32);
const spoils=new Map([[8,6247752],[9,1333209],[10,5871552],[11,205862],[12,5407595],
 [14,1881756],[15,5291677],[16,4351276],[17,1200910]]);
function prior(){
 const assetID='legacy-store-store-s2',book=168234614,events=[];
 let seq=1;
 const opening={sequence:seq++,operationId:hash('as','opening-asset'),type:'journal',
  postings:[{account:'company:fixed-asset:'+assetID,deltaMinor:book},
    {account:'company:opening-equity',deltaMinor:-book}]};
 const receiptAmount=ref.totals.creditPurchaseMinor;
 let allocated=0;
 for(let i=1;i<=31;i++){
  const amt=i===31?receiptAmount-allocated:10000000;
  allocated+=amt;
  const operation='po-'+i+'-receipt-ap-2.5';
  events.push({week:6,id:hash('leg',operation),sourceOperationID:operation,kind:'inventory-receipt-credit',
   postings:[{account:'company:inventory:store-s2',deltaMinor:amt},
    {account:'company:payable:po-'+i,deltaMinor:-amt}]});
 }
 for(let week=5;week<=17;week++){
  const operation='week-'+week+'-'+assetID+'-depreciation';
  events.push({week,id:hash('as',operation),sourceOperationID:operation,kind:'depreciation',
   postings:[{account:'company:expense:store-s2-depreciation',deltaMinor:588462},
    {account:'company:fixed-asset:'+assetID,deltaMinor:-588462}]});
 }
 events.sort((a,b)=>a.week-b.week||a.sourceOperationID.localeCompare(b.sourceOperationID));
 const journal=[opening,...events.map(x=>({
  sequence:seq++,operationId:x.id,type:'journal',postings:x.postings
 }))];
 return {status:'SOURCE_LEDGER_FIXED_ASSET_PARTIAL',canonicalJournalCount:45,
  assetID,openingAssetBookMinor:book,journal,sourceToCore:events};
}
function inputs(){
 const source={snapshots:Array.from({length:14},(_,i)=>({
  week:i+4,inventoryScope:[{storeID:'store-s2'}]
 })),nonStoreWeeklyRows:[]};
 for(const [week,amt]of spoils){
  const id='week-'+week+'-spoilage',amount=amt/100;
  source.nonStoreWeeklyRows.push({week,operationID:id,idempotencyKey:id,
   sourceType:'spoilage',category:'otherOperating',sourceID:'week-'+week,
   amount,cashEffect:0,profitEffect:-amount,assetEffect:-amount,inventoryAmount:-amount,
   liabilityEffect:0,payableAmount:0});
 }
 source.nonStoreWeeklyRows.push({week:5,operationID:'other-corporate-a',sourceType:'otherFinance'});
 source.nonStoreWeeklyRows.push({week:6,operationID:'other-corporate-b',sourceType:'otherFinance'});
 const stock={status:'SOURCE_STOCK_EVIDENCE_PARTIAL',verifiedWeeks:13,blockedWeeks:0,
  weeks:Array.from({length:13},(_,i)=>({week:i+5,status:'SOURCE_STOCK_WEEK_MATCH',
   nonStoreSpoliageMinor:spoils.get(i+5)||0}))};
 return {source,previous:prior(),stock};
}
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
function ok(x=inputs()){
 const r=planSpoilageProof(x.source,x.previous,x.stock);
 assert.equal(r.status,'CONTRACT_STOCK_LOSS_SIMULATION',JSON.stringify(r));return r;
}
function rejects(mutate){
 const input=inputs();mutate(input);
 const r=planSpoilageProof(input.source,input.previous,input.stock);
 assert.equal(r.status,'EVIDENCE_BLOCKED',JSON.stringify(r));return r;
}
test('9 verified company spoilage rows add to prior 44 into one real core',()=>{
 const r=ok();
 assert.equal(r.canonicalJournalCount,54);
 assert.equal(r.postedSourceRows,53);
 assert.equal(r.heldSourceRows,96);
 assert.equal(r.postedNonStoreRows,9);
 assert.equal(r.heldNonStoreRows,2);
});
test('store count and company nonstore source count remain explicit',()=>{
 const r=ok();assert.equal(r.observedStoreRows,138);
 assert.equal(r.observedNonStoreRows,11);
 assert.equal(r.postedStoreRows,44);assert.equal(r.heldStoreRows,94);
});
test('spoilage debits expense and credits physical inventory in company only',()=>{
 const r=ok();
 for(const item of r.sourceToCore){
  assert.equal(item.postings.length,2);
  assert.equal(item.postings[0].deltaMinor,-item.postings[1].deltaMinor);
  assert.equal(item.postings[0].account,'company:expense:store-s2-spoilage');
  assert.equal(item.postings[1].account,'company:inventory:store-s2');
 }
});
test('no imaginary cash counterparty or manual external-cash movement',()=>{
 assert.ok(ok().journal.every(j=>j.postings.every(p=>p.account.startsWith('company:')&&!p.account.endsWith(':cash'))));
});
test('stock losses preserve nonnegative company credit inventory in every journal',()=>{
 const r=ok();assert.ok(r.remainingInventoryMinor>0);
 assert.equal(r.remainingInventoryMinor,r.creditInventoryMinor-r.periodSpoilageMinor);
});
test('sorted source journal is deterministic independent of input row order',()=>{
 const a=ok(),b=inputs();b.source.nonStoreWeeklyRows.reverse();
 assert.deepEqual(a.journal,ok(b).journal);
});
test('spoiled company source IDs map to collision-resistant canonical journal IDs',()=>{
 const r=ok();
 for(const row of r.sourceToCore)assert.equal(row.id,hash('sp',row.sourceOperationID));
});
test('mock planner never asserts real authenticated financial parity',()=>{
 assert.equal(ok().status,'CONTRACT_STOCK_LOSS_SIMULATION');
 assert.equal(runAuthenticated({}).status,'EVIDENCE_BLOCKED');
});
test('missing nonstore finance row must block',()=>rejects(({source})=>{source.nonStoreWeeklyRows.pop()}));
test('duplicate corporate operation ID cannot be counted twice',()=>rejects(({source})=>{
 source.nonStoreWeeklyRows[1].operationID=source.nonStoreWeeklyRows[0].operationID;
}));
test('spoilage cash outflow must fail',()=>rejects(({source})=>{source.nonStoreWeeklyRows[0].cashEffect=-1;}));
test('spoilage profit sign must be expense',()=>rejects(({source})=>{source.nonStoreWeeklyRows[0].profitEffect=2;}));
test('spoilage inventory change must be negative actual amount',()=>rejects(({source})=>{
 source.nonStoreWeeklyRows[0].inventoryAmount=0;
}));
test('spoilage asset book must decrease',()=>rejects(({source})=>{
 source.nonStoreWeeklyRows[0].assetEffect=0;
}));
test('spoilage must not mint arbitrary AP liability',()=>rejects(({source})=>{
 source.nonStoreWeeklyRows[0].liabilityEffect=1;
}));
test('week 8 material lot amount cannot be substituted by week 9 loss',()=>rejects(({source})=>{
 source.nonStoreWeeklyRows[0].amount=source.nonStoreWeeklyRows[1].amount;
}));
test('cross-store inventory destroys attribution proof',()=>rejects(({source})=>{
 source.snapshots[4].inventoryScope.push({storeID:'store-s3'});
}));
test('source beginning stock must contain only scoped store',()=>rejects(({source})=>{
 source.snapshots[0].inventoryScope=[{storeID:'store-s3'}];
}));
test('spoilage source ID must be exact finance operation sequence',()=>rejects(({source})=>{
 source.nonStoreWeeklyRows[0].operationID='week-8-maybe-spoilage';
}));
test('spoilage must preserve nonstore company attribution',()=>rejects(({source})=>{
 source.nonStoreWeeklyRows[0].storeID='store-s2';
}));
test('tampering with physical stock proof blocks replay',()=>rejects(({stock})=>{
 stock.weeks[3].nonStoreSpoliageMinor+=1;
}));
test('a single blocked stock week stops authenticated further posting',()=>rejects(({stock})=>{
 stock.verifiedWeeks=12;stock.blockedWeeks=1;
}));
test('prior fixed asset replay must be fully source-verified',()=>rejects(({previous})=>{
 previous.status='CONTRACT_ASSET_SIMULATION';
}));
test('prior source credit receipt count must be complete',()=>rejects(({previous})=>{
 previous.sourceToCore.pop();
}));
test('duplicate prior canonical operation ID must be rejected',()=>rejects(({previous})=>{
 previous.sourceToCore[2].id=previous.sourceToCore[1].id;
}));
test('forged opening asset source cost rejected',()=>rejects(({previous})=>{
 previous.journal[0].postings[0].deltaMinor+=1;
}));
test('all test input objects are immutable under planning',()=>{
 const x=inputs(),before=JSON.stringify(x);
 planSpoilageProof(x.source,x.previous,x.stock);assert.equal(JSON.stringify(x),before);
});
console.log('SPIKE-8D company-only original spoilage core replay: '+passed+' PASS; mocks never authenticate original game.');
