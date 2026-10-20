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
function capture13Weeks(engine, options={}) {
  if(!engine||typeof engine.advanceWeek!=='function'||!engine.g||!engine.g.finance||!Array.isArray(engine.g.finance.transactions))throw Error('invalid-legacy-runtime');
  if(!options||typeof options!=='object'||!options.storeID||!options.businessID)throw Error('missing-store-selection');
  if(!Array.isArray(engine.g.stores)||!engine.g.stores.some(s=>s.id===options.storeID&&s.businessID===options.businessID&&s.status==='open'))throw Error('store-not-open');
  const before=engine.g;
  const startingWeek=requireInteger(before.week,'starting-week');
  const openingCash=finite(before.companyCash,'opening-company-cash');
  const firstSequence=before.finance.transactions.length;
  const records=[];
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
    records};
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
