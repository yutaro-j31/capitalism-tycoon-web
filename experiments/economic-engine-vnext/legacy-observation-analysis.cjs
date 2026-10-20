'use strict';
// SPIKE-3.8: source-backed classification for actual legacy observations.
// Read-only: no synthetic fixture can establish production parity.
const crosswalk=require('./legacy-crosswalk.cjs');
const BASE=new Set(['revenue','costOfSales','rent','payroll','maintenance']);
const KNOWN=new Set(['workingCapitalIncrease','accountsPayablePayment','depreciation']);
function ensure(value,reason){if(!value)throw Error(reason);}
const cent=(n,k)=>crosswalk.signedMinorFromYen(n,k);
const money=(n,k)=>crosswalk.minorFromYen(n,k);
function measuredCashDelta(n,label){
 // The real game's companyCash is a binary floating Number. Do not silently
 // assume that subtraction of two >500M-JPY balances is cent-exact.
 ensure(typeof n==='number'&&Number.isFinite(n),'invalid-'+label);
 const scaled=n*100,rounded=Math.round(scaled);
 ensure(Number.isSafeInteger(rounded),'invalid-'+label);
 return {minor:rounded,residualJPY:n-rounded/100};
}
function inspectIdentity(x,w,s,b){
 ensure(x&&typeof x==='object','invalid-row');
 ensure(x.week===w&&x.storeID===s&&x.businessID===b,'row-source-mismatch');
 ensure(typeof x.operationID==='string'&&x.operationID.length>0&&x.operationID===x.idempotencyKey,'row-idempotency-mismatch');
 ensure(typeof x.sourceID==='string'&&x.sourceID.length>0&&typeof x.sourceType==='string','row-missing-source');
}
function classifyExtra(x){
 ensure(KNOWN.has(x.category),'unknown-store-category-'+String(x.category));
 const amount=money(x.amount,'amount'),cash=cent(x.cashEffect,'cash-effect'),profit=cent(x.profitEffect,'profit-effect');
 const inventory=cent(x.inventoryAmount,'inventory'),payable=money(x.payableAmount||0,'payables');
 if(x.category==='workingCapitalIncrease'){
  ensure(x.operationID.startsWith('po-')&&x.sourceID.startsWith('po-')&&inventory===amount&&profit===0,'inventory-receipt-mismatch');
  if(x.sourceType==='inventory-receipt-ap'){
   ensure(x.operationID.includes('-receipt-ap-')&&cash===0&&payable===amount,'inventory-ap-mismatch');
   return 'inventory-accrual-receipt';
  }
  if(x.sourceType==='emergency-receipt-cash'){
   ensure(x.operationID.includes('-receipt-cash-')&&cash===-amount&&payable===0,'inventory-cash-mismatch');
   return 'inventory-cash-receipt';
  }
  throw Error('unrecognized-inventory-source-'+x.sourceType);
 }
 if(x.category==='accountsPayablePayment'){
  ensure(x.sourceType==='ap-payment'&&x.sourceID.startsWith('po-')&&x.operationID===x.sourceID+'-ap-pay-'+x.week,'ap-provenance');
  ensure(cash===-amount&&profit===0&&inventory===0&&payable===0,'ap-finance-mismatch');
  return 'accounts-payable-settlement';
 }
 if(x.category==='depreciation'){
  ensure(x.sourceType==='depreciation'&&x.operationID==='week-'+x.week+'-store-'+x.storeID+'-depreciation','depreciation-provenance');
  ensure(cash===0&&profit===-amount&&inventory===0&&payable===0,'depreciation-finance-mismatch');
  return 'noncash-depreciation';
 }
 throw Error('unknown-category');
}
function analyze(capture){
 try{
  ensure(capture&&Array.isArray(capture.records)&&capture.records.length===13,'capture-thirteen-weeks-required');
  ensure(typeof capture.storeID==='string'&&typeof capture.businessID==='string','capture-identity');
  const baseline=[],ids=new Set(),reasons=new Set(),categoryCounts={};
  let company=0n,finance=0n,storeCash=0n,storeProfit=0n,storeRows=0,maxCashResidualJPY=0;
  let nonStoreFinanceRows=0;
  for(let i=0;i<13;i++){
   const w=capture.records[i],expected=capture.records[0].week+i;
   ensure(w&&w.step===i+1&&w.week===expected&&Number.isSafeInteger(expected),'week-sequence');
   ensure(Array.isArray(w.storeRows)&&Array.isArray(w.otherRows),'missing-weekly-finance-rows');
   const observed=measuredCashDelta(w.cashDeltaJPY,'company-week-cash');
   const recognized=cent(w.observedFinanceCashEffectJPY,'finance-week-cash');
   // A sub-cent rounding residual is permitted only in observed companyCash
   // subtraction. Individual financial journal rows still require exact cents.
   const floatResidual=Math.abs(w.cashDeltaJPY-w.observedFinanceCashEffectJPY);
   ensure(floatResidual<=0.0050001,'material-week-company-cash-unexplained-'+w.week);
   maxCashResidualJPY=Math.max(maxCashResidualJPY,floatResidual);
   ensure(Math.abs(observed.minor-recognized)<=1,'week-cash-integer-mismatch-'+w.week);
   company+=BigInt(recognized);finance+=BigInt(recognized);
   nonStoreFinanceRows+=w.otherRows.length;
   for(const x of w.storeRows){
    inspectIdentity(x,w.week,capture.storeID,capture.businessID);
    ensure(!ids.has(x.operationID),'duplicate-store-operation-'+x.operationID);ids.add(x.operationID);
    storeRows++;categoryCounts[x.category]=(categoryCounts[x.category]||0)+1;
    storeCash+=BigInt(cent(x.cashEffect,'store-cash'));
    storeProfit+=BigInt(cent(x.profitEffect,'store-profit'));
    if(BASE.has(x.category))baseline.push(x);
    else reasons.add(classifyExtra(x));
   }
  }
  const parsed=crosswalk.extractLegacyWeeks(baseline,{
   storeID:capture.storeID,businessID:capture.businessID,startWeek:capture.records[0].week,weekCount:13
  });
  for(const w of parsed){
   if(w.isNoncashCOGS)reasons.add('noncash-inventory-cogs');
   if(w.rentMinor>0)reasons.add('rent-not-modeled');
   if(w.maintenanceMinor>0)reasons.add('maintenance-not-modeled');
  }
  ensure(company===finance,'total-company-cash-unexplained');
  const closingDelta=measuredCashDelta(capture.closingCashJPY-capture.openingCashJPY,'company-period-cash');
  ensure(Math.abs(closingDelta.minor-Number(company))<=1,'opening-closing-cash-mismatch');
  ensure([storeCash,storeProfit,company].every(v=>v<=BigInt(Number.MAX_SAFE_INTEGER)&&v>=BigInt(-Number.MAX_SAFE_INTEGER)),'money-overflow');
  return {status:reasons.size?'UNSUPPORTED':'OBSERVED_NOT_PARITY_TESTED',reasons:[...reasons].sort(),
   observedWeeks:[capture.records[0].week,capture.records[12].week],weeks:13,storeRows,nonStoreFinanceRows,
   maxCompanyFloatResidualJPY:maxCashResidualJPY,
   categoryCounts:Object.fromEntries(Object.entries(categoryCounts).sort(([a],[b])=>a.localeCompare(b))),
   companyCashDeltaMinor:Number(company),storeCashDeltaMinor:Number(storeCash),storeProfitMinor:Number(storeProfit),
   warning:'Actual legacy engine observed. No source-matched vNext full production parity proof.'};
 }catch(e){return {status:'EVIDENCE_BLOCKED',reasons:[String(e&&e.message||e)],
  warning:'Unknown/incomplete/invalid legacy accounting evidence. Fail closed.'};}
}
module.exports={analyze};
