'use strict';
const assert=require('node:assert/strict');
const bridge=require('./legacy-crosswalk.cjs');
const fixture=require('./fixtures/13-week-retail.json');
let n=0;
function test(name,fn){fn();n++;console.log('PASS '+name);}
function mockLegacy(opts={}){
 const rows=[];
 const types=[
  ['revenue','revenue','salesMinor',1],
  ['costOfSales','cogs','materialsMinor',-1],
  ['rent','rent',null,-1],
  ['payroll','payroll','wagesMinor',-1],
  ['maintenance','maintenance',null,-1]
 ];
 for(const week of fixture.weeks){
  for(const [category,suffix,key,sign] of types){
   const amount=(key?week[key]:category==='rent'?(opts.rentMinor||0):(opts.maintenanceMinor||0))/100;
   const defaultCash=sign*amount;
   const cash=(opts.noncashCOGS&&category==='costOfSales')?0:defaultCash;
   const operationID='week-'+week.week+'-store-ramen-'+suffix;
   rows.push({week:week.week,storeID:'ramen',businessID:'ramen',category,sourceType:'weekly-store-'+suffix,
    sourceID:'ramen',operationID,idempotencyKey:operationID,amount,cashEffect:cash,profitEffect:sign*amount});
  }
 }
 return rows;
}
function take(rows=mockLegacy()){
 return bridge.extractLegacyWeeks(rows,{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13});
}
const unchanged=(fn,rows)=>{const before=JSON.stringify(rows);fn();assert.equal(JSON.stringify(rows),before);};
test('converts positive yen to 0.01 yen integers',()=>assert.equal(bridge.minorFromYen(12.34,'amount'),1234));
test('accepts tiny cent-valued floats within numerical tolerance',()=>assert.equal(bridge.signedMinorFromYen(-12.34,'money'),-1234));
test('rejects third decimal for legacy monetary amount',()=>assert.throws(()=>bridge.minorFromYen(1.005,'money'),/non-cent-money/));
test('rejects nonfinite monetary value',()=>assert.throws(()=>bridge.minorFromYen(Infinity,'money'),/invalid-money/));
test('rejects oversized monetary value',()=>assert.throws(()=>bridge.minorFromYen(Number.MAX_SAFE_INTEGER,'money'),/non-cent-money/));
test('13 weeks require exactly five categories each',()=>{const rows=take();assert.equal(rows.length,13);assert.equal(rows[0].week,1);assert.equal(rows[12].week,13);});
test('known cash-only synthetic legacy records map to fixture',()=>{
 const result=bridge.compareLegacyTransactions(mockLegacy(),{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13},fixture);
 assert.equal(result.status,'MATCH');assert.equal(result.differences.length,0);assert.equal(result.weekCount,13);
});
test('legacy report cash delta equals profit in deliberately cash-only fixture',()=>{for(const row of take())assert.equal(row.storeCashDeltaMinor,row.operatingProfitMinor);});
test('cash-only ledger preserves synthetic week eight operating loss',()=>{assert.equal(take()[7].operatingProfitMinor,-14000);});
test('supplier inventory COGS noncash blocks fake economic parity',()=>{
 const result=bridge.compareLegacyTransactions(mockLegacy({noncashCOGS:true}),{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13},fixture);
 assert.equal(result.status,'UNSUPPORTED');assert.ok(result.reasons.includes('inventory-cogs-not-cash'));
 assert.ok(result.reasons.includes('material-expense-cash-mismatch'));
});
test('weekly rent outside vNext model blocks parity',()=>{
 const result=bridge.compareLegacyTransactions(mockLegacy({rentMinor:1200}),{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13},fixture);
 assert.equal(result.status,'UNSUPPORTED');assert.ok(result.reasons.includes('rent-not-modeled'));
});
test('weekly maintenance outside vNext model blocks parity',()=>{
 const result=bridge.compareLegacyTransactions(mockLegacy({maintenanceMinor:100}),{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13},fixture);
 assert.equal(result.status,'UNSUPPORTED');assert.ok(result.reasons.includes('maintenance-not-modeled'));
});
test('rent and noncash cogs flagged together, not silently offset',()=>{
 const result=bridge.compareLegacyTransactions(mockLegacy({rentMinor:1000,noncashCOGS:true}),{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13},fixture);
 assert.equal(result.status,'UNSUPPORTED');assert.ok(result.reasons.length>=2);
});
test('different store sales gives a MISMATCH, not a false pass',()=>{
 const rows=mockLegacy(),r=rows.find(v=>v.week===5&&v.category==='revenue');
 r.amount+=1;r.profitEffect+=1;r.cashEffect+=1;
 const result=bridge.compareLegacyTransactions(rows,{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13},fixture);
 assert.equal(result.status,'MISMATCH');assert.ok(result.differences.some(x=>x.week===5&&x.metric==='sales'));
});
test('does not mutate source transaction records',()=>{
 const rows=mockLegacy();
 unchanged(()=>bridge.compareLegacyTransactions(rows,{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13},fixture),rows);
});
test('ignores unrelated store or weeks',()=>{
 const rows=mockLegacy();
 rows.push({...rows[0],week:50,storeID:'other'});
 rows.push({...rows[0],storeID:'other'});
 assert.equal(take(rows).length,13);
});
test('rejects missing store row rather than treating it as zero',()=>{
 const rows=mockLegacy().filter(x=>!(x.week===8&&x.category==='rent'));
 assert.throws(()=>take(rows),/legacy-week-coverage-8/);
});
test('rejects duplicated category in one week',()=>{
 const rows=mockLegacy();rows.push({...rows[0],amount:rows[0].amount});
 assert.throws(()=>take(rows),/legacy-duplicate-category/);
});
test('rejects unrecognized store-associated finance expense (e.g. depreciation)',()=>{
 const rows=mockLegacy();rows.push({...rows[0],category:'depreciation'});
 assert.throws(()=>take(rows),/legacy-unsupported-category-depreciation/);
});
test('rejects incorrect source ID to prevent reattributing event',()=>{
 const rows=mockLegacy();rows[0].sourceID='another';
 assert.throws(()=>take(rows),/legacy-row-provenance/);
});
test('rejects wrong stable operation receipt',()=>{
 const rows=mockLegacy();rows[0].operationID='new-txn';
 assert.throws(()=>take(rows),/legacy-row-provenance/);
});
test('rejects wrong idempotency key',()=>{
 const rows=mockLegacy();rows[0].idempotencyKey='oops';
 assert.throws(()=>take(rows),/legacy-row-provenance/);
});
test('rejects altered business identity',()=>{
 const rows=mockLegacy();rows[0].businessID='conveni';
 assert.throws(()=>take(rows),/legacy-business-mismatch/);
});
test('rejects profit that does not match category amount',()=>{
 const rows=mockLegacy();rows[0].profitEffect+=100;
 assert.throws(()=>take(rows),/legacy-profit-posting/);
});
test('rejects revenue cash that mismatches posted revenue',()=>{
 const rows=mockLegacy();rows[0].cashEffect-=10;
 assert.throws(()=>take(rows),/legacy-cash-posting/);
});
test('rejects COGS cash other than 0 or minus expense',()=>{
 const rows=mockLegacy();const row=rows.find(x=>x.category==='costOfSales');row.cashEffect=100;
 assert.throws(()=>take(rows),/legacy-cost-cash-mode/);
});
test('rejects fractional cent accounting drift',()=>{
 const rows=mockLegacy();rows[0].amount+=0.001;
 assert.throws(()=>take(rows),/non-cent-amount/);
});
test('rejects any negative revenue amount',()=>{
 const rows=mockLegacy();rows[0].amount=-1;
 assert.throws(()=>take(rows),/invalid-amount/);
});
test('rejects invalid week count',()=>assert.throws(()=>bridge.extractLegacyWeeks(mockLegacy(),{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:12}),/expected-thirteen-weeks/));
test('no actual production parity evidence without real rows',()=>{
 assert.throws(()=>bridge.extractLegacyWeeks([],{storeID:'ramen',businessID:'ramen',startWeek:1,weekCount:13}),/legacy-week-coverage-1/);
});
console.log('VNext legacy crosswalk: '+n+' contract tests PASS. Mock legacy rows, NOT production parity.');
