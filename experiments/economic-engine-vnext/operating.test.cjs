'use strict';
const assert=require('node:assert/strict');
const core=require('./core.cjs');
const unified=require('./unified.cjs');
const inventory=require('./inventory-ap.cjs');
const operating=require('./operating.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>operating.openingState(inventory.openingState(unified.createUnifiedState(
 core.createInitialState({company:40000,founder:20000,landlord:1000,contractor:1000,vendor:5000,supplier:10000,customer:100000,employee:0}),
 [{issuer:'company',classId:'ordinary',authorizedShares:100,votesPerShare:1}]
)));
const asset={id:'buy-oven',type:'acquire-equipment',company:'company',storeId:'ramen',assetId:'oven',vendor:'vendor',amountMinor:12000,salvageMinor:2000,usefulLifeWeeks:5};
const rent={id:'rent-w1',type:'pay-rent',company:'company',storeId:'ramen',counterparty:'landlord',week:1,amountMinor:1500};
const maintenance={id:'repair-w1',type:'pay-maintenance',company:'company',storeId:'ramen',counterparty:'contractor',week:1,amountMinor:500};
const depreciation={id:'dep-w1',type:'depreciate-equipment',company:'company',storeId:'ramen',assetId:'oven',week:1};
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name);};
function admit(s,op){const r=operating.admit(s,op,()=>true);assert.equal(r.ok,true,r.reason);return r.state;}
function setup(){return admit(initial(),asset);}
function all(){return admit(admit(admit(setup(),rent),maintenance),depreciation);}
function reject(s,op,expected,persist=()=>true){
 const before=JSON.stringify(s),r=operating.admit(s,op,persist);
 assert.equal(r.ok,false,expected+': '+r.reason);assert.equal(r.reason,expected);
 assert.strictEqual(r.state,s);assert.equal(JSON.stringify(s),before);
}
const balance=(s,k)=>s.supply.unified.core.balances[k];
const summary=s=>operating.snapshot(s,'company','ramen');
test('empty financial wrapper passes at genesis',()=>assert.equal(operating.validateState(initial()),true));
test('fixed asset acquisition debits book value and pays vendor',()=>{
 const s=setup(),b=s.supply.unified.core.balances;
 assert.equal(b['company:fixed-asset:oven'],12000);
 assert.equal(b['company:cash'],28000);
 assert.equal(b['vendor:cash'],17000);
 assert.equal(b['vendor:revenue:ramen-equipment'],-12000);
 assert.equal(s.supply.unified.core.journal[0].postings.length,4);
});
test('fixed asset acquisition is capitalized, not immediate operating expense',()=>{
 const s=setup();
 assert.equal(balance(s,'company:expense:ramen-depreciation'),undefined);
 assert.equal(summary(s).assets[0].bookMinor,'12000');
});
test('rent has balanced company/landlord cash and expense entries',()=>{
 const s=admit(setup(),rent);
 assert.equal(balance(s,'company:cash'),26500);
 assert.equal(balance(s,'company:expense:ramen-rent'),1500);
 assert.equal(balance(s,'landlord:cash'),2500);
 assert.equal(balance(s,'landlord:revenue:ramen-rent'),-1500);
});
test('maintenance has balanced company/contractor cash and expense entries',()=>{
 const s=admit(setup(),maintenance);
 assert.equal(balance(s,'company:cash'),27500);
 assert.equal(balance(s,'company:expense:ramen-maintenance'),500);
 assert.equal(balance(s,'contractor:cash'),1500);
});
test('rent and maintenance costs are in the same core journal',()=>{
 const s=all();assert.equal(s.supply.unified.core.journal.length,4);
 assert.equal(s.supply.unified.core.receipts['rent-w1'],2);
 assert.equal(s.supply.unified.core.receipts['repair-w1'],3);
 assert.equal(s.supply.unified.core.receipts['dep-w1'],4);
});
test('depreciation has no cash postings',()=>{
 const s=all(),j=s.supply.unified.core.journal[3];
 assert.equal(j.postings.length,2);
 assert.ok(j.postings.every(x=>!x.account.endsWith(':cash')));
});
test('depreciation expense equals fixed asset book reduction',()=>{
 const s=all();
 assert.equal(balance(s,'company:expense:ramen-depreciation'),2000);
 assert.equal(balance(s,'company:fixed-asset:oven'),10000);
});
test('operating snapshot reads fixed asset, charges and depreciation',()=>{
 assert.deepEqual(summary(all()),{
  company:'company',storeId:'ramen',
  assets:[{assetId:'oven',grossMinor:'12000',salvageMinor:'2000',accumulatedDepreciationMinor:'2000',bookMinor:'10000',remainingWeeks:4}],
  rentExpenseMinor:'1500',maintenanceExpenseMinor:'500',depreciationExpenseMinor:'2000'
 });
});
test('full five-week depreciation never falls below salvage',()=>{
 let s=setup();
 for(let week=1;week<=5;week++)s=admit(s,{...depreciation,id:'depr-'+week,week});
 assert.equal(balance(s,'company:fixed-asset:oven'),2000);
 assert.equal(balance(s,'company:expense:ramen-depreciation'),10000);
 assert.equal(summary(s).assets[0].remainingWeeks,0);
});
test('final-week residual allocates remainder rather than minting value',()=>{
 let s=admit(initial(),{...asset,id:'buy-pump',assetId:'pump',amountMinor:1001,salvageMinor:100,usefulLifeWeeks:4});
 for(let week=1;week<=4;week++)s=admit(s,{...depreciation,id:'pump-'+week,assetId:'pump',week});
 assert.equal(balance(s,'company:fixed-asset:pump'),100);
 assert.equal(balance(s,'company:expense:ramen-depreciation'),901);
});
test('duplicate rent of same store and week forbidden',()=>reject(admit(setup(),rent),{...rent,id:'rent-other'},'duplicate-weekly-charge'));
test('duplicate maintenance of same store and week forbidden',()=>reject(admit(setup(),maintenance),{...maintenance,id:'repair-other'},'duplicate-weekly-charge'));
test('same week rent and maintenance are separate charges',()=>{
 const s=admit(admit(setup(),rent),maintenance);
 assert.equal(summary(s).rentExpenseMinor,'1500');assert.equal(summary(s).maintenanceExpenseMinor,'500');
});
test('duplicate asset purchase ID forbidden',()=>reject(setup(),{...asset,id:'buy-oven-other'},'duplicate-asset'));
test('depreciation requires a source-backed asset',()=>reject(initial(),depreciation,'unknown-asset'));
test('cannot depreciate same asset in same week twice',()=>reject(admit(setup(),depreciation),{...depreciation,id:'dep-again'},'nonmonotonic-depreciation-week'));
test('cannot depreciate asset after useful life',()=>{
 let s=setup();for(let i=1;i<=5;i++)s=admit(s,{...depreciation,id:'d'+i,week:i});
 reject(s,{...depreciation,id:'d6',week:6},'asset-fully-depreciated');
});
test('overstated depreciation rejected',()=>reject(setup(),{...depreciation,amountMinor:3000},'depreciation-schedule-mismatch'));
test('salvage greater than cost rejected',()=>reject(initial(),{...asset,salvageMinor:12000},'invalid-depreciation-schedule'));
test('too many depreciation weeks for tiny depreciable amount rejected',()=>reject(initial(),{...asset,amountMinor:103,salvageMinor:100,usefulLifeWeeks:5},'invalid-depreciation-schedule'));
test('insufficient company cash prevents equipment purchase',()=>reject(initial(),{...asset,amountMinor:40001},'negative-cash'));
test('negative or fractional amount rejected',()=>{
 reject(initial(),{...asset,amountMinor:-100},'invalid-amount');
 reject(initial(),{...asset,amountMinor:12.3},'invalid-amount');
});
test('unknown rent landlord or contractor rejected',()=>reject(setup(),{...rent,counterparty:'ghost'},'unknown-counterparty'));
test('no self-payment to own legal entity',()=>reject(setup(),{...rent,counterparty:'company'},'self-counterparty'));
test('wrong asset ID cannot redirect depreciation to another store',()=>reject(setup(),{...depreciation,storeId:'other'},'unknown-asset'));
test('tampering asset book value without journal is detected',()=>{
 const s=setup();s.supply.unified.core.balances['company:fixed-asset:oven']++;
 assert.throws(()=>operating.validateState(s),/unbalanced-state|balance-journal-mismatch/);
});
test('tampering depreciation receipt amount is detected',()=>{
 const s=all();s.events[3].amountMinor++;
 assert.throws(()=>operating.validateState(s),/operating-journal-mismatch/);
});
test('forged capital expenditure from generic core cannot bypass domain writer',()=>{
 const s=setup();
 const r=core.planOperation(s.supply.unified.core,{id:'forged-asset',type:'journal',postings:[
  {account:'company:fixed-asset:oven',deltaMinor:100},
  {account:'company:expense:ramen-maintenance',deltaMinor:-100}
 ]});
 assert.equal(r.ok,true,r.reason);
 s.supply.unified.core=r.state;
 assert.throws(()=>operating.validateState(s),/fixed-asset-reconciliation|unauthorized-fixed-asset-writer/);
});
test('failed durable-admission callback false leaves entire state unchanged',()=>reject(setup(),rent,'persistence-rejected',()=>false));
test('throwing persistence callback leaves entire state unchanged',()=>reject(setup(),depreciation,'persistence-threw',()=>{throw Error('injected');}));
test('missing persistence callback fails closed',()=>{
 const s=setup(),r=operating.admit(s,rent);
 assert.equal(r.ok,false);assert.equal(r.reason,'persistence-required');assert.strictEqual(r.state,s);
});
test('persistence callback receives detached candidate state',()=>{
 const s=setup(),r=operating.admit(s,rent,x=>{x.supply.unified.core.balances['company:cash']=-99;return true;});
 assert.equal(r.ok,true);assert.equal(balance(r.state,'company:cash'),26500);
});
test('deterministic replay from identical inputs yields same full ledger',()=>assert.deepEqual(all(),all()));
test('inventory, AP, rent, depreciation and equity coexist in one canonical core',()=>{
 const issued=unified.admitIssue(initial().supply.unified,{type:'issue-shares',id:'issue1',issuer:'company',subscriber:'founder',classId:'ordinary',shares:5,priceMinor:200},()=>true);
 assert.equal(issued.ok,true,issued.reason);
 let s=operating.openingState(inventory.openingState(issued.state));
 s=admit(s,asset);
 const po={id:'po-entry',type:'receive-inventory-credit',company:'company',supplier:'supplier',storeId:'ramen',orderId:'po-1',amountMinor:2000};
 const received=inventory.admitSupply(s.supply,po,()=>true);assert.equal(received.ok,true,received.reason);
 s=clone(s);s.supply=received.state;assert.equal(operating.validateState(s),true);
 s=admit(admit(s,rent),depreciation);
 const b=s.supply.unified.core.balances;
 assert.equal(b['company:paid-in:company-ordinary'],-1000);
 assert.equal(b['company:inventory:ramen'],2000);
 assert.equal(b['company:payable:po-1'],-2000);
 assert.equal(b['company:fixed-asset:oven'],10000);
 assert.equal(operating.validateState(s),true);
});
test('all legal entities remain individually balanced after expenses',()=>{
 const s=all(),c=s.supply.unified.core,totals=Object.fromEntries(c.entities.map(id=>[id,0n]));
 for(const [k,v]of Object.entries(c.balances))totals[k.split(':')[0]]+=BigInt(v);
 for(const v of Object.values(totals))assert.equal(v,0n);
});
test('all entity cash balances conserve money across equipment sale and rent',()=>{
 const s=all(),c=s.supply.unified.core;
 const observed=c.entities.reduce((sum,id)=>sum+BigInt(c.balances[id+':cash']),0n);
 assert.equal(observed,177000n);
});
console.log('SPIKE-5 rent, maintenance, source-backed equipment and depreciation: '+count+' PASS. No save-v9 or durable IDB claim.');
