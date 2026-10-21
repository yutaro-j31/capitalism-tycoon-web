'use strict';
// SPIKE-3.7: capture only observations from a disposable legacy engine instance.
// This module never opens the user's saved game, writes files, or mutates the
// economic engine implementation. The caller is responsible for a fresh harness.
const crosswalk=require('./legacy-crosswalk.cjs');
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function snapshot(value){return JSON.parse(JSON.stringify(value));}
function finite(v,label) {
  if(typeof v!=='number'||!Number.isFinite(v))throw Error('invalid-'+label);
  return v;
}
function requireInteger(v,label) {
  if(!Number.isSafeInteger(v))throw Error('invalid-'+label);
  return v;
}
// Snapshot legacy supply sources separately from finance postings. Catalog
// supplierID is NOT an authenticated vNext legal entity or payable counterparty.
function sourceSnapshot(game,storeID){
 const orders=Array.isArray(game.purchaseOrders)?
  game.purchaseOrders.filter(p=>p&&p.storeID===storeID).map(p=>({
   orderID:p.orderID,storeID:p.storeID,businessID:p.businessID,
   supplierID:p.supplierID,materialID:p.materialID,
   orderWeek:p.orderWeek,receivedCost:p.receivedCost,paidAmount:p.paidAmount,
   receivedQuantity:p.receivedQuantity,unitCost:p.unitCost,
   paymentDueWeek:p.paymentDueWeek,orderStatus:p.orderStatus,paymentStatus:p.paymentStatus
  })).sort((a,b)=>String(a.orderID).localeCompare(String(b.orderID))):null;
 const inv=game.inventoryByStoreID?.[storeID];
 const lots=inv?.materials?Object.entries(inv.materials).flatMap(([materialID,m])=>(m.lots||[]).map(l=>({
  lotID:l.lotID,materialID:l.materialID||materialID,purchaseOrderID:l.purchaseOrderID??null,
  supplierContractID:l.supplierContractID??null,quality:l.quality,
  status:l.status,bookValue:l.bookValue,quantity:l.quantity,originalQuantity:l.originalQuantity,
  unitCost:l.unitCost,receivedWeek:l.receivedWeek,expiryWeek:l.expiryWeek
 }))):null;
 const fixedAssets=Array.isArray(game.finance?.fixedAssets)?
  game.finance.fixedAssets.filter(a=>a&&a.storeID===storeID).map(a=>({
   assetID:a.assetID,assetType:a.assetType,storeID:a.storeID,businessID:a.businessID,
   status:a.status,acquisitionWeek:a.acquisitionWeek,acquisitionCost:a.acquisitionCost,
   salvageValue:a.salvageValue,usefulLifeWeeks:a.usefulLifeWeeks,
   accumulatedDepreciation:a.accumulatedDepreciation,bookValue:a.bookValue,
   lifecycleOrigin:a.p2Lifecycle?.origin??null,
   lifecycleAdoptedWeek:a.p2Lifecycle?.adoptedWeek??null
  })).sort((a,b)=>String(a.assetID).localeCompare(String(b.assetID))):null;
 const inventoryScope=Object.entries(game.inventoryByStoreID||{}).map(([id,book])=>({
  storeID:id,businessID:book?.businessID||null,
  availableBookValueJPY:Object.values(book?.materials||{}).flatMap(m=>(m.lots||[]))
   .filter(l=>l.status==='available'&&Number(l.quantity)>0)
   .reduce((sum,l)=>sum+Number(l.bookValue||0),0)
 })).sort((a,b)=>a.storeID.localeCompare(b.storeID));
 const supplierContracts=Array.isArray(game.supplierContracts)?
  game.supplierContracts.filter(c=>c&&c.storeID===storeID).map(c=>({
   contractID:c.contractID,storeID:c.storeID,businessID:c.businessID,supplierID:c.supplierID,
   active:c.active,status:c.status,startedWeek:c.startedWeek,terminatedWeek:c.terminatedWeek??null
  })).sort((a,b)=>String(a.contractID).localeCompare(String(b.contractID))):null;
 return snapshot({week:game.week,orders,lots,inventoryScope,fixedAssets,supplierContracts,
  inventoryAuthoritySource:{
   supplyMigrationV6Applied:game.supplyMigrationV6Applied===true,
   openingAPBaselineJPY:game.supplyAccountsPayableOpeningBaseline??null,
   financeOpeningAssetsJPY:game.finance?.openingAssets??null,
   financeOpeningEquityJPY:game.finance?.openingEquity??null,
   financeOpeningRetainedEarningsJPY:game.finance?.openingRetainedEarnings??null
  },
  companyAccountsPayableJPY:game.supplyAccountsPayableBalance??null,
  financeInventoryJPY:game.finance?.balances?.inventory??null});
}
function capture13Weeks(engine, options={}) {
  if(!engine||typeof engine.advanceWeek!=='function'||!engine.g||!engine.g.finance||!Array.isArray(engine.g.finance.transactions))throw Error('invalid-legacy-runtime');
  if(!options||typeof options!=='object'||!options.storeID||!options.businessID)throw Error('missing-store-selection');
  if(!Array.isArray(engine.g.stores)||!engine.g.stores.some(s=>s.id===options.storeID&&s.businessID===options.businessID&&s.status==='open'))throw Error('store-not-open');
  const before=engine.g;
  const startingWeek=requireInteger(before.week,'starting-week');
  const openingCash=finite(before.companyCash,'opening-company-cash');
  const firstSequence=before.finance.transactions.length;
  const openingSource=sourceSnapshot(engine.g,options.storeID);
  const records=[];
  const weeklySources=[];
  const forWeek=week=>engine.g.finance.transactions.filter(r=>r&&r.week===week).map(row=>snapshot(row));
  for(let step=1;step<=13;step++) {
    const prevWeek=engine.g.week,preCash=finite(engine.g.companyCash,'opening-company-cash');
    if(engine.g.gameOver)throw Error('game-over-before-week-'+step);
    if(engine.advanceWeek(false)!==true)throw Error('advance-week-failed-'+step);
    const actual=engine.g.week;
    if(actual!==prevWeek+1)throw Error('week-step-mismatch');
    const weekly=forWeek(actual);
    const storeRows=weekly.filter(r=>r.storeID===options.storeID);
    const otherRows=weekly.filter(r=>r.storeID!==options.storeID);
    const endingCash=finite(engine.g.companyCash,'ending-company-cash');
    const recordedCash=weekly.reduce((a,r)=>a+finite(r.cashEffect,'finance-cash-effect'),0);
    const financeState=engine.g.finance;
    const lastValidation=financeState.lastValidation?.ok;
    if(lastValidation===false)throw Error('legacy-finance-validation-failed-week-'+actual);
    weeklySources.push(sourceSnapshot(engine.g,options.storeID));
    records.push({
      step,week:actual,
      beforeCashJPY:preCash,afterCashJPY:endingCash,cashDeltaJPY:endingCash-preCash,
      observedFinanceCashEffectJPY:recordedCash,
      unassignedCompanyCashDeltaJPY:endingCash-preCash-recordedCash,
      storeRows,otherRows,
      storeFinanceCategoryCounts:Object.fromEntries(
        [...new Set(storeRows.map(r=>r.category))].sort().map(category=>[category,storeRows.filter(r=>r.category===category).length])
      ),
      inventoryBookJPY:financeState.balances&&typeof financeState.balances.inventory==='number'?finite(financeState.balances.inventory,'inventory-book'):null
    });
  }
  return {startingWeek,endingWeek:engine.g.week,openingCashJPY:openingCash,closingCashJPY:engine.g.companyCash,
    storeID:options.storeID,businessID:options.businessID,startingFinanceTransactionCount:firstSequence,
    records,sourceGraphEvidence:{opening:openingSource,weekly:weeklySources}};
}
function evaluateCapture(capture,reference) {
  if(!capture||!Array.isArray(capture.records)||capture.records.length!==13)throw Error('invalid-capture');
  const all=capture.records.flatMap(r=>r.storeRows);
  try {
    const extracted=crosswalk.extractLegacyWeeks(all,{
      storeID:capture.storeID,businessID:capture.businessID,
      startWeek:capture.records[0].week,weekCount:13
    });
    const relative=extracted.map((row,i)=>({...row,week:i+1}));
    const result=crosswalk.compare13WeekFixture(relative,reference);
    return {status:result.status,reasons:result.reasons||[],differences:result.differences||[],
      observedAbsoluteWeeks:extracted.map(r=>r.week),
      note:'The synthetic fixture is not an actual matching legacy demand/seed scenario; MATCH is only structural arithmetic, not full game parity.'};
  } catch(err) {
    return {status:'EVIDENCE_BLOCKED',reasons:[String(err&&err.message||err)],differences:[],
      note:'Missing/unsupported/invalid legacy finance evidence must not be treated as a financial match.'};
  }
}
module.exports={capture13Weeks,evaluateCapture};
