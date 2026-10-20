'use strict';
// SPIKE-3.5: scenario tests only, no changes to transaction engine or production.
// Fixture amounts are 0.01 JPY minor units, NOT whole yen.
const assert=require('node:assert/strict');
const core=require('./core.cjs');
const unified=require('./unified.cjs');
const store=require('./store.cjs');
const fixture=require('./fixtures/13-week-retail.json');
let passed=0;
const test=(name,cb)=>{cb();passed++;console.log('PASS '+name);};
const trueSave=()=>true;
const series=fixture.weeks;
const expected=fixture.expected;
const keys=Object.keys;
function initial(){
 const c=core.createInitialState(fixture.openingCashMinor);
 return unified.createUnifiedState(c,[{issuer:fixture.issuer,...fixture.shareClass}]);
}
function weeklyOp(row){
 return {type:'settle-store-week',...fixture.store,week:row.week,salesMinor:row.salesMinor,materialsMinor:row.materialsMinor,wagesMinor:row.wagesMinor};
}
function capitalized(){
 let s=initial();
 for(const subscription of fixture.subscriptions){
  const r=unified.admitIssue(s,subscription,trueSave);
  assert.equal(r.ok,true,r.reason);s=r.state;
 }
 return s;
}
function replay(endWeek=13){
 let s=capitalized();
 const states=[s];
 for(const row of series.slice(0,endWeek)){
  const r=unified.admitWeek(s,weeklyOp(row),trueSave);
  assert.equal(r.ok,true,r.reason);s=r.state;states.push(s);
 }
 return {state:s,states};
}
function sum(field){return series.reduce((total,row)=>total+row[field],0);}
function totalsByEntity(s){
 const sums=Object.fromEntries(s.core.entities.map(x=>[x,0n]));
 for(const [account,value] of Object.entries(s.core.balances))sums[account.split(':')[0]]+=BigInt(value);
 return sums;
}
function sortedBalances(s){return Object.entries(s.core.balances).sort(([a],[b])=>a.localeCompare(b));}
const full=replay();
test('13 fixed weeks, explicit units and consecutive IDs',()=>{
 assert.equal(fixture.unit,'JPY-0.01');
 assert.equal(series.length,13);
 for(let i=0;i<13;i++)assert.equal(series[i].week,i+1);
});
test('fixture math independently conserves sales, materials, wages, profit',()=>{
 assert.equal(sum('salesMinor'),expected.totalSalesMinor);
 assert.equal(sum('materialsMinor'),expected.totalMaterialsMinor);
 assert.equal(sum('wagesMinor'),expected.totalWagesMinor);
 assert.equal(sum('profitMinor'),expected.totalProfitMinor);
 assert.equal(expected.totalProfitMinor,expected.totalSalesMinor-expected.totalMaterialsMinor-expected.totalWagesMinor);
});
test('start with two separate real paid-in subscriptions',()=>{
 const s=capitalized();assert.equal(s.issues.length,2);
 assert.equal(s.core.journal.length,2);
 assert.equal(s.core.journal[0].postings.length,4);
 assert.equal(s.core.journal[1].postings.length,4);
});
test('13 store weeks plus 2 issues is 15 exact journal receipts',()=>{
 assert.equal(full.state.core.journal.length,expected.journalEntries);
 assert.equal(Object.keys(full.state.core.receipts).length,expected.journalEntries);
 assert.equal(full.state.core.nextSequence,16);
});
test('receipt indexes track issue identities and 13 unique weekly events',()=>{
 const s=full.state;
 assert.equal(s.core.receipts[fixture.subscriptions[0].id],1);
 assert.equal(s.core.receipts[fixture.subscriptions[1].id],2);
 for(const row of series)assert.equal(s.core.receipts['store-company-ramen-w'+row.week],row.week+2);
});
test('ending company cash matches standalone reference',()=>assert.equal(full.state.core.balances['company:cash'],expected.companyCashMinor));
test('customer cash equals initial cash minus total sales',()=>assert.equal(full.state.core.balances['customer:cash'],expected.customerCashMinor));
test('supplier cash equals material expenditure',()=>assert.equal(full.state.core.balances['supplier:cash'],expected.supplierCashMinor));
test('employee cash equals company payroll',()=>assert.equal(full.state.core.balances['employee:cash'],expected.employeeCashMinor));
test('founder and investor capital cash outflows are isolated',()=>{
 assert.equal(full.state.core.balances['founder:cash'],expected.founderCashMinor);
 assert.equal(full.state.core.balances['investor:cash'],expected.investorCashMinor);
});
test('one canonical ledger contains 3 financial capital accounts',()=>{
 const s=full.state;
 assert.equal(s.core.balances['company:paid-in:company-ordinary'],expected.companyPaidInMinor);
 assert.equal(s.core.balances['founder:investment:company-ordinary'],expected.founderInvestmentMinor);
 assert.equal(s.core.balances['investor:investment:company-ordinary'],expected.investorInvestmentMinor);
 assert.equal(Object.hasOwn(s,'equityBalances'),false);
});
test('aggregate store revenue and expense derived from journal, not cached P&L',()=>{
 const x=store.storeSnapshot(full.state.core,'company','ramen');
 assert.deepEqual(x,{company:'company',storeId:'ramen',weeks:13,
  revenueMinor:expected.totalSalesMinor,materialsMinor:expected.totalMaterialsMinor,
  wagesMinor:expected.totalWagesMinor,profitMinor:expected.totalProfitMinor,
  companyCashDeltaMinor:expected.totalProfitMinor});
});
test('issued shares and paid-in capital never change during operating weeks',()=>{
 for(const s of full.states){
  assert.equal(s.classes['company:ordinary'].issuedShares,expected.issuedShares);
  assert.equal(s.core.balances['company:paid-in:company-ordinary'],expected.companyPaidInMinor);
 }
});
test('shareholder ratios are unchanged after all 13 weeks',()=>{
 const before=unified.snapshot(capitalized(),'company');
 const after=unified.snapshot(full.state,'company');
 assert.deepEqual(after,before);
 assert.equal(after.totalShares,'500');
 assert.equal(after.holders.find(p=>p.holder==='founder').shareRatio.numerator,'300');
 assert.equal(after.holders.find(p=>p.holder==='investor').shareRatio.numerator,'200');
});
test('week 8 is explicitly loss-making without unbacked compensation',()=>{
 assert.equal(series[7].profitMinor,-14000);
 const a=full.states[7].core.balances['company:cash'];
 const b=full.states[8].core.balances['company:cash'];
 assert.equal(b-a,-14000);
});
test('each week cash delta equals independent declared weekly profit',()=>{
 for(let i=1;i<=13;i++){
  const prior=full.states[i-1].core.balances['company:cash'];
  const after=full.states[i].core.balances['company:cash'];
  assert.equal(after-prior,series[i-1].profitMinor);
 }
});
test('company never goes negative while paying for the stores',()=>{
 for(const s of full.states)assert.ok(s.core.balances['company:cash']>=0);
});
test('global cash amount is conserved over all journal operations',()=>{
 const initialCash=Object.values(fixture.openingCashMinor).reduce((a,b)=>a+BigInt(b),0n);
 for(const s of full.states){
  const cash=s.core.entities.reduce((a,e)=>a+BigInt(s.core.balances[e+':cash']),0n);
  assert.equal(cash,initialCash);
 }
});
test('every legal entity balances debit and credit at week 13',()=>{
 for(const total of Object.values(totalsByEntity(full.state)))assert.equal(total,0n);
});
test('full core and unified reconciliation succeeds after every week',()=>{
 for(const s of full.states){assert.equal(core.validateState(s.core),true);assert.equal(unified.validateUnifiedState(s),true);}
});
test('all journal legs are individually balanced by entity',()=>{
 for(const entry of full.state.core.journal){
  const perEntity=Object.fromEntries(full.state.core.entities.map(e=>[e,0n]));
  for(const p of entry.postings)perEntity[p.account.split(':')[0]]+=BigInt(p.deltaMinor);
  for(const total of Object.values(perEntity))assert.equal(total,0n);
 }
});
test('single clean replay produces precisely the same entire state',()=>assert.deepEqual(replay().state,full.state));
test('fresh replay from week 7 checkpoint matches 13 week reference',()=>{
 let s=replay(7).state;
 for(const row of series.slice(7)){
  const r=unified.admitWeek(s,weeklyOp(row),trueSave);assert.equal(r.ok,true,r.reason);s=r.state;
 }
 assert.deepEqual(s,full.state);
});
test('save-rejected week 8 changes neither cash nor shares nor receipt',()=>{
 const s=replay(7).state,before=JSON.stringify(s);
 const r=unified.admitWeek(s,weeklyOp(series[7]),()=>false);
 assert.equal(r.ok,false);assert.equal(r.reason,'persistence-rejected');
 assert.strictEqual(r.state,s);assert.equal(JSON.stringify(s),before);
 assert.equal(s.core.receipts['store-company-ramen-w8'],undefined);
});
test('save-throw week 8 similarly rejects atomically in memory',()=>{
 const s=replay(7).state,before=JSON.stringify(s);
 const r=unified.admitWeek(s,weeklyOp(series[7]),()=>{throw Error('fault');});
 assert.equal(r.ok,false);assert.equal(r.reason,'persistence-threw');
 assert.strictEqual(r.state,s);assert.equal(JSON.stringify(s),before);
});
test('failed week 8 retry produces the same reference',()=>{
 const s=replay(7).state,failed=unified.admitWeek(s,weeklyOp(series[7]),()=>false);
 assert.equal(failed.ok,false);
 const successful=unified.admitWeek(failed.state,weeklyOp(series[7]),trueSave);
 assert.equal(successful.ok,true,successful.reason);
 assert.deepEqual(successful.state,full.states[8]);
});
test('duplicate week 8 after 13 weeks cannot double revenue',()=>{
 const r=unified.admitWeek(full.state,weeklyOp(series[7]),trueSave);
 assert.equal(r.ok,false);assert.equal(r.reason,'duplicate-operation');assert.strictEqual(r.state,full.state);
});
test('duplicate founding share issuance cannot issue twice',()=>{
 const r=unified.admitIssue(full.state,fixture.subscriptions[0],trueSave);
 assert.equal(r.ok,false);assert.equal(r.reason,'duplicate-operation');assert.strictEqual(r.state,full.state);
});
test('zero-cost phantom revenue operation is rejected',()=>{
 const op={...weeklyOp(series[12]),week:14,salesMinor:0,materialsMinor:0,wagesMinor:0};
 const r=unified.admitWeek(full.state,op,trueSave);
 assert.equal(r.ok,false);assert.equal(r.reason,'empty-week');assert.strictEqual(r.state,full.state);
});
test('tampered end-of-period cash without journal fails validation',()=>{
 const s=JSON.parse(JSON.stringify(full.state));s.core.balances['company:cash']++;
 assert.throws(()=>unified.validateUnifiedState(s),/unbalanced-state|balance-journal-mismatch/);
});
test('tampered founder holding without share journal fails validation',()=>{
 const s=JSON.parse(JSON.stringify(full.state));s.classes['company:ordinary'].holders.founder.shares++;
 assert.throws(()=>unified.validateUnifiedState(s),/holder-position-mismatch|share-conservation/);
});
console.log('VNext 13-week fixture: '+passed+' tests passed; standalone experimental scenario only.');
