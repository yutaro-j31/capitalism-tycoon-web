'use strict';
// SPIKE-8D: company-wide noncash spoilage source -> SAME core journal.
// Source spoofing is disallowed by runAuthenticated; plan is mock-only.
const {createHash}=require('node:crypto');
const core=require('./core.cjs');
const {runAuthenticated:runFixedAsset}=require('./legacy-fixedasset-replay.cjs');
const {proof:proveStock}=require('./legacy-inventory-rollforward.cjs');
const ref=require('./fixtures/legacy-real-13week-summary.json');
const check=(v,msg)=>{if(!v)throw Error(msg);};
function minor(v,label){
 check(typeof v==='number'&&Number.isFinite(v),'nonfinite-'+label);
 const n=Math.round(v*100);
 check(Number.isSafeInteger(n)&&Math.abs(v*100-n)<1e-7,'noncent-'+label);return n;
}
const ident=x=>'sp-'+createHash('sha256').update(x,'utf8').digest('hex').slice(0,32);
function planSpoilageProof(source,prior,stock){
 try{
  check(source&&Array.isArray(source.nonStoreWeeklyRows)&&source.nonStoreWeeklyRows.length===ref.totals.nonStoreRows,'nonstore-source-count');
  check(Array.isArray(source.snapshots)&&source.snapshots.length===14,'missing-14-stock-snapshots');
  check(prior?.status==='SOURCE_LEDGER_FIXED_ASSET_PARTIAL'&&prior.canonicalJournalCount===45&&Array.isArray(prior.journal)
   &&prior.journal.length===45&&Array.isArray(prior.sourceToCore)&&prior.sourceToCore.length===44,'prior-source-ledger-required');
  check(stock?.status==='SOURCE_STOCK_EVIDENCE_PARTIAL'&&stock.verifiedWeeks===13&&stock.blockedWeeks===0
   &&Array.isArray(stock.weeks)&&stock.weeks.length===13,'stock-reconciliation-required');
  const seen=new Set(),eligible=[],other=[];
  for(const row of source.nonStoreWeeklyRows){
   check(row&&typeof row.operationID==='string'&&row.operationID.length>0
    &&!seen.has(row.operationID),'duplicate-nonstore-operation');
   seen.add(row.operationID);
   check(Number.isSafeInteger(row.week)&&row.week>=ref.provenance.gameWeeks[0]&&row.week<=ref.provenance.gameWeeks[1],
    'unobserved-company-finance-week');
   if(row.sourceType!=='spoilage'){other.push({operationID:row.operationID,week:row.week,status:'BLOCKED',
    reason:'source-category-outside-selected-stock-loss-domain'});continue;}
   const snap=source.snapshots[row.week-ref.provenance.gameWeeks[0]+1];
   check(snap&&snap.week===row.week&&Array.isArray(snap.inventoryScope)&&snap.inventoryScope.length===1
     &&snap.inventoryScope[0].storeID===ref.provenance.storeId,'source-spoilage-not-store-attributable-'+row.week);
   const weekProof=stock.weeks[row.week-ref.provenance.gameWeeks[0]];
   check(weekProof?.status==='SOURCE_STOCK_WEEK_MATCH'&&weekProof.week===row.week,'source-week-stock-not-confirmed');
   check(row.operationID==='week-'+row.week+'-spoilage'&&row.idempotencyKey===row.operationID
      &&row.sourceID==='week-'+row.week&&row.category==='otherOperating','source-spoilage-identity-'+row.week);
   check(!row.storeID&&!row.businessID,'spoilage-row-must-be-uncategorized-company-scope');
   const amount=minor(row.amount,'spoilage'),cash=minor(row.cashEffect,'spoilage-cash');
   check(amount>0&&cash===0&&minor(row.profitEffect,'spoilage-profit')===-amount
    &&minor(row.inventoryAmount,'spoilage-inventory')===-amount
    &&minor(row.assetEffect,'spoilage-asset')===-amount
    &&minor(row.liabilityEffect||0,'spoilage-liability')===0
    &&minor(row.payableAmount||0,'spoilage-payable')===0,'spoilage-economic-legs');
   check(weekProof.nonStoreSpoliageMinor===amount,'not-source-backed-weekly-spoilage');
   eligible.push({week:row.week,kind:'spoilage',sourceOperationID:row.operationID,
    id:ident(row.operationID),amountMinor:amount,
    postings:[{account:'company:expense:'+ref.provenance.storeId+'-spoilage',deltaMinor:amount},
      {account:'company:inventory:'+ref.provenance.storeId,deltaMinor:-amount}]});
  }
  check(eligible.length===9&&other.length===2,'nonstore-category-coverage-drift');
  // Spoilage cannot be booked against any unproven store or an unrecorded receipt.
  for(const snap of source.snapshots){
   check(snap&&Array.isArray(snap.inventoryScope)&&snap.inventoryScope.length===1
    &&snap.inventoryScope[0].storeID===ref.provenance.storeId,'ambiguous-inventory-scope');
  }
  // This sole scoped opening asset was reconstructed by the authenticated
  // prior ledger. Preserve its operation, but not a fictional cash supplier.
  const opening=prior.journal[0];
  check(opening.type==='journal'&&opening.postings.length===2
   &&opening.postings[0].account==='company:fixed-asset:'+prior.assetID
   &&opening.postings[0].deltaMinor===prior.openingAssetBookMinor
   &&opening.postings[1].account==='company:opening-equity'
   &&opening.postings[1].deltaMinor===-prior.openingAssetBookMinor,'bad-opening-fixed-asset');
  const all=[...prior.sourceToCore.map(x=>({
    kind:x.kind,id:x.id,sourceOperationID:x.sourceOperationID,week:x.week,postings:x.postings
   })),...eligible].sort((a,b)=>a.week-b.week||a.sourceOperationID.localeCompare(b.sourceOperationID));
  check(all.length===53,'company-replay-source-event-count');
  let state=core.createInitialState({'audit-slot':0,company:0});
  const used=new Set(),ordered=[{id:opening.operationId,postings:opening.postings},...all];
  for(const e of ordered){
   check(!used.has(e.id),'canonical-source-id-collision');used.add(e.id);
   const p=core.planOperation(state,{type:'journal',id:e.id,postings:e.postings});
   check(p.ok,'canonical-core-journal-'+e.id+'-'+p.reason);
   state=p.state;
  }
  core.validateState(state);
  check(state.journal.length===54&&state.journal.every(j=>j.postings.every(p=>p.account.startsWith('company:')
   &&!p.account.endsWith(':cash'))),'unverified-company-external-cash');
  const spoiled=eligible.reduce((sum,e)=>sum+BigInt(e.amountMinor),0n);
  check(spoiled>0n&&spoiled<=BigInt(Number.MAX_SAFE_INTEGER),'invalid-source-spoilage-aggregate');
  check(state.balances['company:expense:'+ref.provenance.storeId+'-spoilage']===Number(spoiled),'spoilage-expense-not-reconciled');
  check(state.balances['company:inventory:'+ref.provenance.storeId]===ref.totals.creditPurchaseMinor-Number(spoiled),
   'company-posted-inventory-not-reconciled');
  check(state.balances['company:cash']===0&&state.balances['audit-slot:cash']===0,'unverified-cash-ledger-posting');
  return {status:'CONTRACT_STOCK_LOSS_SIMULATION',observedStoreRows:138,observedNonStoreRows:11,
   postedStoreRows:44,postedNonStoreRows:9,heldStoreRows:94,heldNonStoreRows:2,
   canonicalJournalCount:54,postedSourceRows:53,heldSourceRows:96,
   periodSpoilageMinor:Number(spoiled),creditInventoryMinor:ref.totals.creditPurchaseMinor,
   remainingInventoryMinor:ref.totals.creditPurchaseMinor-Number(spoiled),
   sourceToCore:eligible,heldNonStore:other,journal:state.journal,
   limitations:['cash-receipt-and-opening-inventory-unreplayed','no-actual-13-COGS-postings',
    'two-company-nonstore-finance-rows-unreplayed','no-full-legal-counterparty-identities']};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)]};}
}
function runAuthenticated(observation){
 try{
  const prior=runFixedAsset(observation);
  check(prior.status==='SOURCE_LEDGER_FIXED_ASSET_PARTIAL','asset-proof-'+(prior.reasons||[]).join(';'));
  const stock=proveStock(observation);
  check(stock.status==='SOURCE_STOCK_EVIDENCE_PARTIAL'&&stock.verifiedWeeks===13,'stock-proof-'+(stock.reasons||[]).join(';'));
  const src=observation.sourceGraphEvidence;
  check(src&&Array.isArray(src.weekly)&&src.weekly.length===13,'missing-original-stock-snapshots');
  const result=planSpoilageProof({nonStoreWeeklyRows:observation.nonStoreWeeklyRows,
   snapshots:[src.opening,...src.weekly]},prior,stock);
  check(result.status==='CONTRACT_STOCK_LOSS_SIMULATION','source-ledger-'+(result.reasons||[]).join(';'));
  return {...result,status:'SOURCE_LEDGER_STOCK_LOSS_PARTIAL',
   verifiedRealSource:true,sourceBridge:'prior 138 original store receipts; 11 non-store finance; 13/13 physical stock weeks',
   warning:'Scoped company-only delta ledger. Source COGS, cash vendor receipts, and full legal-entity balance sheet are NOT replayed.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e?.message||e)]};}
}
module.exports={planSpoilageProof,runAuthenticated};
