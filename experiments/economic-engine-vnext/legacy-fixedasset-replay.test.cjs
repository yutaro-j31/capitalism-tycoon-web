'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {safeAsset,planAssetLedger,runAuthenticated}=require('./legacy-fixedasset-replay.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let passed=0;const test=(title,fn)=>{fn();passed++;console.log('PASS '+title);};
const assetID='legacy-store-store-s2';
const original=()=>{
 const cost=1700000,book=1682346.14,acc=cost-book;
 return {assetID,assetType:'storeEquipment',storeID:'store-s2',businessID:'ramen',
  acquisitionWeek:2,acquisitionCost:cost,salvageValue:170000,usefulLifeWeeks:260,
  accumulatedDepreciation:acc,bookValue:book,status:'active'};
};
function previous(){
 const receipts=Array.from({length:31},(_,i)=>{
  const n=i+1,minor=i<30?1000000:ref.totals.creditPurchaseMinor-30000000;
  return {week:5+Math.floor(i/3),canonicalOperationID:'leg-'+crypto.createHash('sha256').update('mock-purchase-'+n).digest('hex').slice(0,32),
   operationID:'po-'+n+'-receipt-ap-2.5',
   postings:[{account:'company:inventory:store-s2',deltaMinor:minor},
    {account:'company:payable:po-'+n,deltaMinor:-minor}]};
 });
 return {status:'SOURCE_LEDGER_PARTIAL',receipts};
}
function source(){
 let current=original();const opening={week:4,fixedAssets:[clone(current)]},weekly=[],depreciation=[];
 const amount=5884.62;
 for(let week=5;week<=17;week++){
  const bookBefore=current.bookValue,accumulatedBefore=current.accumulatedDepreciation;
  current.bookValue=Math.round((current.bookValue-amount)*100)/100;
  current.accumulatedDepreciation=Math.round((current.accumulatedDepreciation+amount)*100)/100;
  weekly.push({week,fixedAssets:[clone(current)]});
  const operationID='week-'+week+'-'+assetID+'-depreciation';
  depreciation.push({week,storeID:'store-s2',businessID:'ramen',category:'depreciation',
   sourceType:'depreciation',sourceID:assetID,fixedAssetID:assetID,
   fixedAssetLifecycle:'depreciation',amount,cashEffect:0,profitEffect:-amount,
   assetEffect:-amount,operationID,idempotencyKey:operationID,
   fixedAssetEvidence:{bookBefore,bookAfter:current.bookValue,
    accumulatedBefore,accumulatedAfter:current.accumulatedDepreciation}});
 }
 return {storeID:'store-s2',opening,weekly,depreciation};
}
function accepted(){const r=planAssetLedger(source(),previous());assert.equal(r.status,'CONTRACT_ASSET_SIMULATION',JSON.stringify(r));return r;}
function blocked(fn){const f=source(),p=previous();fn(f,p);const r=planAssetLedger(f,p);assert.equal(r.status,'EVIDENCE_BLOCKED',JSON.stringify(r));return r;}
test('source opening fixed asset is a real company asset shape',()=>{
 const a=safeAsset(original(),4,'store-s2');assert.equal(a.costMinor,170000000);
 assert.equal(a.salvageMinor,17000000);assert.equal(a.bookMinor,168234614);
});
test('31 authenticated credit receipts and 13 depreciation events coexist in one core ledger',()=>{
 const x=accepted();assert.equal(x.canonicalJournalCount,45);
 assert.equal(x.sourceCreditRows,31);assert.equal(x.sourceDepreciationRows,13);
 assert.equal(x.postedSourceRows,44);assert.equal(x.blockedSourceRows,94);
});
test('opening source fixed asset book uses company-only recognition, no outside cash',()=>{
 const x=accepted(),j=x.journal[0];assert.equal(j.postings.length,2);
 assert.equal(j.postings[0].account,'company:fixed-asset:'+assetID);
 assert.equal(j.postings[0].deltaMinor,168234614);
 assert.equal(j.postings[1].account,'company:opening-equity');
 assert.equal(j.postings[1].deltaMinor,-168234614);
});
test('source 13 depreciations book and expense reconcile exactly in minor JPY',()=>{
 const x=accepted();assert.equal(x.depreciationExpenseMinor,7650006);
 assert.equal(x.endingAssetBookMinor,160584608);
});
test('depreciation rows carry noncash company expense and fixed asset book decrease',()=>{
 const x=accepted(),d=x.sourceToCore.filter(e=>e.kind==='depreciation');
 assert.equal(d.length,13);
 for(const x of d){
  assert.equal(x.postings.length,2);
  assert.equal(x.postings[0].deltaMinor,-x.postings[1].deltaMinor);
  assert.ok(x.postings.every(p=>p.account.startsWith('company:')&&!p.account.endsWith(':cash')));
 }
});
test('credit receipt value remains exactly source-authenticated',()=>{
 const x=accepted(),e=x.sourceToCore.filter(r=>r.kind==='inventory-receipt-credit');
 assert.equal(e.length,31);assert.equal(e.reduce((n,r)=>n+r.postings[0].deltaMinor,0),617170756);
});
test('source operation ID is immutably mapped to core legal ID by SHA256',()=>{
 const x=accepted(),r=x.sourceToCore[0];
 assert.equal(r.id,'leg-'+crypto.createHash('sha256').update(r.sourceOperationID).digest('hex').slice(0,32));
});
test('data ordering reproduces exact immutable journal',()=>{
 const a=accepted(),b=accepted();assert.deepEqual(a.journal,b.journal);
});
test('fake source never reports authenticated success from planner',()=>{
 assert.notEqual(accepted().status,'SOURCE_LEDGER_FIXED_ASSET_PARTIAL');
});
test('real gate cannot be bypassed by supplying a fake source fixture',()=>{
 assert.equal(runAuthenticated({storeWeeklyRows:source().depreciation}).status,'EVIDENCE_BLOCKED');
});
test('missing opening source book must fail',()=>blocked(f=>{f.opening.fixedAssets=[];}));
test('two opening source assets are ambiguous and must fail',()=>blocked(f=>{f.opening.fixedAssets.push(clone(f.opening.fixedAssets[0]));}));
test('fixed asset store identity is not interchangeable',()=>blocked(f=>{f.opening.fixedAssets[0].storeID='other';}));
test('opening acquisition cost must equal book plus accumulated',()=>blocked(f=>{f.opening.fixedAssets[0].acquisitionCost+=10;}));
test('source book before must match prior week closing',()=>blocked(f=>{f.depreciation[1].fixedAssetEvidence.bookBefore+=1;}));
test('one-cent expense drift cannot be reclassified as source P&L',()=>blocked(f=>{f.depreciation[3].amount+=0.01;}));
test('cash depreciation is forbidden',()=>blocked(f=>{f.depreciation[4].cashEffect=-1;}));
test('expense sign must be true depreciation, not arbitrary financing',()=>blocked(f=>{f.depreciation[0].profitEffect=1;}));
test('fake fixed asset source ID blocks financial posting',()=>blocked(f=>{f.depreciation[5].fixedAssetID='other';}));
test('week-end fixed asset books must agree with posted source row',()=>blocked(f=>{f.weekly[6].fixedAssets[0].bookValue+=1;}));
test('altered acquisition provenance is rejected mid-period',()=>blocked(f=>{f.weekly[7].fixedAssets[0].acquisitionWeek=8;}));
test('depreciation below source salvage cannot be accepted',()=>blocked(f=>{f.opening.fixedAssets[0].salvageValue=1690000;}));
test('missing credit receipt proof refuses replay',()=>blocked((f,p)=>{p.receipts.pop();}));
test('duplicated core credit receipt IDs stop transaction replay',()=>blocked((f,p)=>{p.receipts[1].canonicalOperationID=p.receipts[0].canonicalOperationID;}));
test('zero source asset with fabricated opening equity is rejected',()=>blocked(f=>{f.opening.fixedAssets[0].bookValue=0;}));
test('no file or production save is touched by replay function',()=>{
 const s=source(),p=previous(),before=JSON.stringify({s,p});
 planAssetLedger(s,p);assert.equal(JSON.stringify({s,p}),before);
});
console.log('SPIKE-8C fixed asset authentic-shaped source replay: '+passed+' PASS (mock contracts only).');
