'use strict';
// SPIKE-3.6 READ-ONLY contract bridge for legacy finance.recordWeekly rows.
// This is not the legacy game's simulator and MUST NOT write a production save.
const EXPECTED = Object.freeze([
  ['revenue','revenue'],
  ['costOfSales','cogs'],
  ['rent','rent'],
  ['payroll','payroll'],
  ['maintenance','maintenance']
]);
const ALLOWED = new Map(EXPECTED);
const has=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
function fail(reason){throw Error(reason);}
function identifier(v,name) {
  if(typeof v!=='string'||v.length<1||v.length>100||! /^[a-zA-Z0-9-]+$/.test(v))fail('invalid-'+name);
  return v;
}
function minorFromYen(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0)fail('invalid-'+label);
  const scaled=v*100,rounded=Math.round(scaled);
  if(!Number.isSafeInteger(rounded)||Math.abs(scaled-rounded)>1e-7)fail('non-cent-'+label);
  return rounded;
}
function signedMinorFromYen(v,label){
  if(typeof v!=='number'||!Number.isFinite(v))fail('invalid-'+label);
  const scaled=v*100,rounded=Math.round(scaled);
  if(!Number.isSafeInteger(rounded)||Math.abs(scaled-rounded)>1e-7)fail('non-cent-'+label);
  return rounded;
}
function finiteWeek(v){
  if(!Number.isSafeInteger(v)||v<1||v>1000000)fail('invalid-week');
  return v;
}
function extractLegacyWeeks(transactions,query) {
  if(!Array.isArray(transactions)||!query||typeof query!=='object')fail('invalid-input');
  const storeId=identifier(query.storeID,'store'),businessID=identifier(query.businessID,'business');
  const from=finiteWeek(query.startWeek),weeks=finiteWeek(query.weekCount);
  if(weeks!==13)fail('expected-thirteen-weeks');
  const last=from+weeks-1;if(!Number.isSafeInteger(last))fail('week-overflow');
  const relevant=transactions.filter(x=>x&&x.storeID===storeId&&x.week>=from&&x.week<=last);
  // A store-associated extra ledger row can affect P&L and must not be ignored.
  const groups=new Map();
  for(const row of relevant){
    if(!Number.isSafeInteger(row.week))fail('legacy-malformed-week');
    if(row.businessID!==businessID)fail('legacy-business-mismatch');
    if(!ALLOWED.has(row.category))fail('legacy-unsupported-category-'+String(row.category));
    const suffix=ALLOWED.get(row.category),key='week-'+row.week+'-store-'+storeId;
    if(row.operationID!==key+'-'+suffix||row.idempotencyKey!==key+'-'+suffix||row.sourceID!==storeId||row.sourceType!=='weekly-store-'+suffix||row.storeID!==storeId)fail('legacy-row-provenance');
    if(!groups.has(row.week))groups.set(row.week,new Map());
    const g=groups.get(row.week);
    if(g.has(row.category))fail('legacy-duplicate-category');
    const amount=minorFromYen(row.amount,'amount'),cash=signedMinorFromYen(row.cashEffect,'cash'),profit=signedMinorFromYen(row.profitEffect,'profit');
    const sign=row.category==='revenue'?1:-1;
    if(profit!==sign*amount)fail('legacy-profit-posting');
    if(row.category!=='costOfSales'&&cash!==sign*amount)fail('legacy-cash-posting');
    if(row.category==='costOfSales'&&cash!==0&&cash!==-amount)fail('legacy-cost-cash-mode');
    g.set(row.category,{amount,cash,profit});
  }
  const result=[];
  for(let week=from;week<=last;week++){
    const g=groups.get(week);
    if(!g||g.size!==5||EXPECTED.some(([category])=>!g.has(category)))fail('legacy-week-coverage-'+week);
    const sales=g.get('revenue'),cogs=g.get('costOfSales'),rent=g.get('rent'),payroll=g.get('payroll'),repair=g.get('maintenance');
    const profit=sales.profit+cogs.profit+rent.profit+payroll.profit+repair.profit;
    const cash=sales.cash+cogs.cash+rent.cash+payroll.cash+repair.cash;
    if(![profit,cash].every(Number.isSafeInteger))fail('legacy-total-overflow');
    result.push(Object.freeze({
      week,salesMinor:sales.amount,costOfSalesMinor:cogs.amount,rentMinor:rent.amount,
      payrollMinor:payroll.amount,maintenanceMinor:repair.amount,
      cogsCashMinor:cogs.cash,operatingProfitMinor:profit,storeCashDeltaMinor:cash,
      isNoncashCOGS:cogs.amount>0&&cogs.cash===0
    }));
  }
  return Object.freeze(result);
}
function compare13WeekFixture(legacyRows,fixture) {
  if(!Array.isArray(legacyRows)||legacyRows.length!==13||!fixture||!Array.isArray(fixture.weeks)||fixture.weeks.length!==13)fail('invalid-comparison-input');
  const unsupported=new Set(),differences=[];
  for(let i=0;i<13;i++){
    const a=legacyRows[i],b=fixture.weeks[i];
    if(!a||!b||a.week!==b.week)fail('mismatched-weeks');
    if(a.rentMinor!==0)unsupported.add('rent-not-modeled');
    if(a.maintenanceMinor!==0)unsupported.add('maintenance-not-modeled');
    if(a.isNoncashCOGS)unsupported.add('inventory-cogs-not-cash');
    if(a.cogsCashMinor!==-a.costOfSalesMinor)unsupported.add('material-expense-cash-mismatch');
    // A vNext cash-basis operation cannot represent a noncash COGS even if the final cash happens to match.
    if(a.salesMinor!==b.salesMinor)differences.push({week:a.week,metric:'sales',legacy:a.salesMinor,vnext:b.salesMinor});
    if(a.costOfSalesMinor!==b.materialsMinor)differences.push({week:a.week,metric:'materials',legacy:a.costOfSalesMinor,vnext:b.materialsMinor});
    if(a.payrollMinor!==b.wagesMinor)differences.push({week:a.week,metric:'wages',legacy:a.payrollMinor,vnext:b.wagesMinor});
    if(a.operatingProfitMinor!==b.profitMinor)differences.push({week:a.week,metric:'profit',legacy:a.operatingProfitMinor,vnext:b.profitMinor});
  }
  // Unsupported accounting categories block parity assessment entirely: differences are only diagnostic.
  if(unsupported.size)return Object.freeze({status:'UNSUPPORTED',reasons:[...unsupported].sort(),differences,weekCount:13});
  return Object.freeze({status:differences.length?'MISMATCH':'MATCH',reasons:[],differences,weekCount:13});
}
function compareLegacyTransactions(transactions,query,fixture){
  return compare13WeekFixture(extractLegacyWeeks(transactions,query),fixture);
}
module.exports={minorFromYen,signedMinorFromYen,extractLegacyWeeks,compare13WeekFixture,compareLegacyTransactions};
