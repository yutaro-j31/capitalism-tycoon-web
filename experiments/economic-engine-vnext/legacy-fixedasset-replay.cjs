'use strict';
// SPIKE-8C: authenticate 13 noncash store depreciation postings to source
// opening fixed asset book + 13 weekly finance asset snapshots.
// Returns partial period ledger, NEVER full company parity or past cash proof.
const {createHash}=require('node:crypto');
const core=require('./core.cjs');
const {runAuthenticatedReplay}=require('./legacy-company-replay.cjs');
const {proof:physicalStockProof}=require('./legacy-inventory-rollforward.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const requireTrue=(condition,msg)=>{if(!condition)throw Error(msg)};
const money=(value,label)=>{
 requireTrue(typeof value==='number'&&Number.isFinite(value),'nonfinite-'+label);
 const minor=Math.round(value*100);
 requireTrue(Number.isSafeInteger(minor)&&Math.abs(value*100-minor)<1e-7,'noncent-'+label);
 return minor;
};
const canonical=(value)=>'as-'+createHash('sha256').update(value,'utf8').digest('hex').slice(0,32);
function safeAsset(a,week,storeId){
 requireTrue(a&&typeof a.assetID==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(a.assetID),'missing-asset-id');
 requireTrue(a.storeID===storeId&&a.businessID===ref.provenance.businessId,'asset-ownership-mismatch');
 requireTrue(a.status==='active','source-asset-not-active');
 requireTrue(Number.isSafeInteger(a.acquisitionWeek)&&a.acquisitionWeek<=week,'asset-acquisition-week');
 requireTrue(Number.isSafeInteger(a.usefulLifeWeeks)&&a.usefulLifeWeeks>=1,'asset-useful-life');
 const cost=money(a.acquisitionCost,'acquisition-cost'),salvage=money(a.salvageValue,'salvage');
 const book=money(a.bookValue,'source-asset-book'),acc=money(a.accumulatedDepreciation,'source-asset-acc');
 requireTrue(cost>0&&salvage>=0&&salvage<=cost&&book>=salvage&&acc>=0,'asset-book-shape');
 requireTrue(cost===book+acc,'fixed-asset-gross-reconciliation');
 return {assetID:a.assetID,storeID:a.storeID,costMinor:cost,bookMinor:book,salvageMinor:salvage,
  accumulatedMinor:acc,lifeWeeks:a.usefulLifeWeeks,acquisitionWeek:a.acquisitionWeek};
}
function planAssetLedger(source,previousCreditProof){
 try{
  requireTrue(source&&source.opening&&Array.isArray(source.weekly)&&source.weekly.length===13,'missing-fixed-asset-source');
  requireTrue(source.storeID===ref.provenance.storeId,'invalid-target-store');
  requireTrue(Array.isArray(source.depreciation)&&source.depreciation.length===13,'missing-13-source-depreciations');
  requireTrue(previousCreditProof&&previousCreditProof.status==='SOURCE_LEDGER_PARTIAL'
   &&Array.isArray(previousCreditProof.receipts)&&previousCreditProof.receipts.length===31,'missing-prior-company-ledger');
  requireTrue(source.opening.week===ref.provenance.gameWeeks[0]-1,'asset-opening-week');
  requireTrue(Array.isArray(source.opening.fixedAssets)&&source.opening.fixedAssets.length===1,'asset-opening-cardinality');
  const original=safeAsset(source.opening.fixedAssets[0],source.opening.week,source.storeID);
  const baselineID=original.assetID;
  const company='company',assetKey='company:fixed-asset:'+baselineID;
  let state=core.createInitialState({'audit-slot':0,company:0});
  const openingID=canonical('opening-asset-'+baselineID+'-week-'+source.opening.week);
  const opening=core.planOperation(state,{id:openingID,type:'journal',postings:[
   {account:assetKey,deltaMinor:original.bookMinor},
   {account:'company:opening-equity',deltaMinor:-original.bookMinor}
  ]});
  requireTrue(opening.ok,'opening-asset-journal-'+opening.reason);
  state=opening.state;
  let book=original.bookMinor,acc=original.accumulatedMinor,depreciationMinor=0;
  const used=new Set([openingID]);
  const credited=previousCreditProof.receipts.map(r=>({
   week:r.week,id:r.canonicalOperationID,postings:r.postings,kind:'inventory-receipt-credit',
   sourceOperationID:r.operationID
  }));
  requireTrue(credited.every(r=>Number.isSafeInteger(r.week)&&r.postings?.length===2
   &&/^leg-[a-f0-9]{32}$/.test(r.id)),'invalid-company-credit-provenance');
  const rows=source.depreciation.map((row,i)=>{
   const week=ref.provenance.gameWeeks[0]+i;
   requireTrue(row&&row.week===week&&row.category==='depreciation'
    &&row.sourceType==='depreciation'&&row.fixedAssetLifecycle==='depreciation'
    &&row.fixedAssetID===baselineID&&row.sourceID===baselineID,'asset-source-identity-'+week);
   requireTrue(row.operationID==='week-'+week+'-'+baselineID+'-depreciation'
    &&row.idempotencyKey===row.operationID,'asset-receipt-identity-'+week);
   const snap=source.weekly[i];
   requireTrue(snap&&snap.week===week&&Array.isArray(snap.fixedAssets)&&snap.fixedAssets.length===1,'asset-week-snapshot-'+week);
   const current=safeAsset(snap.fixedAssets[0],week,source.storeID);
   requireTrue(current.assetID===baselineID&&current.acquisitionWeek===original.acquisitionWeek
    &&current.costMinor===original.costMinor&&current.salvageMinor===original.salvageMinor
    &&current.lifeWeeks===original.lifeWeeks,'source-fixed-asset-mutated-'+week);
   const entry=money(row.amount,'depreciation-amount'),e=row.fixedAssetEvidence;
   requireTrue(e&&entry>0
    &&money(row.cashEffect,'depreciation-cash')===0
    &&money(row.profitEffect,'depreciation-profit')===-entry
    &&money(row.assetEffect,'depreciation-asset')===-entry,'noncash-depreciation-source-'+week);
   requireTrue(money(e.bookBefore,'before-book')===book
    &&money(e.accumulatedBefore,'before-acc')===acc
    &&money(e.bookAfter,'after-book')===book-entry
    &&money(e.accumulatedAfter,'after-acc')===acc+entry
    &&current.bookMinor===book-entry&&current.accumulatedMinor===acc+entry,'depreciation-asset-ledger-drift-'+week);
   requireTrue(book-entry>=original.salvageMinor,'asset-depreciated-below-salvage');
   book-=entry;acc+=entry;depreciationMinor+=entry;
   const id=canonical(row.operationID);
   return {week,id,kind:'depreciation',sourceOperationID:row.operationID,amountMinor:entry,
    postings:[{account:'company:expense:'+source.storeID+'-depreciation',deltaMinor:entry},
      {account:assetKey,deltaMinor:-entry}]};
  });
  requireTrue(depreciationMinor===ref.totals.depreciationMinor,'13-week-depreciation-source-drift');
  const journalEvents=[...credited,...rows].sort((a,b)=>a.week-b.week
   ||a.sourceOperationID.localeCompare(b.sourceOperationID));
  requireTrue(journalEvents.length===44,'source-ledger-count-mismatch');
  const receipts=[];
  for(const item of journalEvents){
   requireTrue(!used.has(item.id),'source-operation-hash-collision');
   used.add(item.id);
   const r=core.planOperation(state,{id:item.id,type:'journal',postings:item.postings});
   requireTrue(r.ok,'canonical-core-posting-'+item.id+'-'+r.reason);
   state=r.state;
   receipts.push({...item,sequence:r.receipt.sequence});
  }
  core.validateState(state);
  requireTrue(state.journal.length===45,'canonical-journal-count');
  requireTrue(state.balances[assetKey]===book,'final-asset-book-core-mismatch');
  requireTrue(state.balances['company:expense:'+source.storeID+'-depreciation']===depreciationMinor,'expense-core-mismatch');
  requireTrue(state.balances['company:inventory:'+source.storeID]===ref.totals.creditPurchaseMinor,'source-inventory-receipts-core-mismatch');
  requireTrue(state.balances['company:cash']===0&&state.balances['audit-slot:cash']===0,'unproven-cash-posting');
  requireTrue(receipts.every(r=>r.postings.every(p=>p.account.startsWith('company:')&&!p.account.endsWith(':cash'))),'unverified-legal-entity-posting');
  return {status:'CONTRACT_ASSET_SIMULATION',originalStoreRows:138,postedSourceRows:44,blockedSourceRows:94,
   openingAssetJournalCount:1,sourceCreditRows:31,sourceDepreciationRows:13,
   openingAssetBookMinor:original.bookMinor,openingAssetGrossMinor:original.costMinor,
   openingAssetAccumulatedMinor:original.accumulatedMinor,endingAssetBookMinor:book,
   depreciationExpenseMinor:depreciationMinor,canonicalJournalCount:state.journal.length,
   assetID:baselineID,sourceToCore:receipts,journal:state.journal,
   warning:'Input source/creditProof not authenticated here. No external cash or full company opening equity claim.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e&&e.message||e)]};}
}
function runAuthenticated(observation){
 try{
  const prior=runAuthenticatedReplay(observation);
  requireTrue(prior.status==='SOURCE_LEDGER_PARTIAL','original-source-ledger-'+(prior.reasons||[]).join(';'));
  const stock=physicalStockProof(observation);
  requireTrue(stock.status==='SOURCE_STOCK_EVIDENCE_PARTIAL'&&stock.verifiedWeeks===13
   &&stock.blockedWeeks===0,'physical-stock-not-reconciled');
  const src=observation.sourceGraphEvidence;
  requireTrue(src&&Array.isArray(src.weekly)&&Array.isArray(observation.storeWeeklyRows),'source-fixed-asset-evidence-missing');
  const fixture={opening:src.opening,weekly:src.weekly,
   storeID:observation.observedStore?.id,
   depreciation:observation.storeWeeklyRows.filter(r=>r.category==='depreciation')};
  const result=planAssetLedger(fixture,prior);
  requireTrue(result.status==='CONTRACT_ASSET_SIMULATION','asset-ledger-'+(result.reasons||[]).join(';'));
  return {...result,status:'SOURCE_LEDGER_FIXED_ASSET_PARTIAL',
   validatedRealSource:true,stockVerifiedWeeks:stock.verifiedWeeks,
   blockedCategories:'94 original rows remain blocked: cash sales, COGS, cash purchases, rent, payroll, maintenance, AP settlements',
   limitations:['source-opening-asset-offset-is-scoped-only-not-whole-company-equity',
    'asset-acquisition-and-original-vendor-cash-not-proved','external-legal-counterparties-unverified',
    'opening-cash-not-reconstructed','other-corporate-finance-unreplayed',
    'no-full-138-row-equality-or-durable-IDB-save-proof']};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e&&e.message||e)]};}
}
module.exports={safeAsset,planAssetLedger,runAuthenticated};
