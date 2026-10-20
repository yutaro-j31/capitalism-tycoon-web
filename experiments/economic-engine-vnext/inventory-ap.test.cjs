'use strict';
const assert=require('node:assert/strict');
const core=require('./core.cjs');
const unified=require('./unified.cjs');
const inventory=require('./inventory-ap.cjs');
const seed=()=>inventory.openingState(unified.createUnifiedState(core.createInitialState({
 company:15000,founder:30000,supplier:10000,customer:100000,employee:0
}),[{issuer:'company',classId:'ordinary',authorizedShares:1000,votesPerShare:1}]));
const receive={type:'receive-inventory-credit',id:'receipt-1',company:'company',supplier:'supplier',storeId:'ramen',orderId:'po-1',amountMinor:5000};
const cashReceive={...receive,type:'receive-inventory-cash',id:'receipt-2',orderId:'po-2',amountMinor:1000};
const pay={...receive,type:'pay-inventory-ap',id:'payment-1',amountMinor:2000};
const consume={type:'consume-inventory',id:'consumption-1',company:'company',storeId:'ramen',amountMinor:2500};
const copy=v=>JSON.parse(JSON.stringify(v));
let count=0;
function test(name,cb){cb();count++;console.log('PASS '+name);}
function execute(s,op){const r=inventory.admitSupply(s,op,()=>true);assert.equal(r.ok,true,r.reason);return r.state;}
function reject(s,op,reason,persist=()=>true){
 const original=JSON.stringify(s),r=inventory.admitSupply(s,op,persist);
 assert.equal(r.ok,false,reason+': '+r.reason);
 assert.equal(r.reason,reason);assert.strictEqual(r.state,s);assert.equal(JSON.stringify(s),original);
}
function started(){return execute(seed(),receive);}
function partiallyPaid(){return execute(started(),pay);}
function view(s){return inventory.snapshot(s,'company','ramen');}
test('new inventory authority is balanced at genesis',()=>assert.equal(inventory.validateSupplyState(seed()),true));
test('credit inventory receipt has 4 legs in one canonical journal',()=>{
 const s=started();assert.equal(s.unified.core.journal.length,1);
 assert.equal(s.unified.core.journal[0].postings.length,4);
 assert.equal(s.unified.core.balances['company:inventory:ramen'],5000);
 assert.equal(s.unified.core.balances['company:payable:po-1'],-5000);
 assert.equal(s.unified.core.balances['supplier:receivable:po-1'],5000);
 assert.equal(s.unified.core.balances['supplier:revenue:ramen'],-5000);
 assert.equal(s.unified.core.balances['company:cash'],15000);
});
test('credit receipt does not mint cash for supplier or company',()=>{
 const s=started();assert.equal(s.unified.core.balances['supplier:cash'],10000);assert.equal(s.unified.core.balances['company:cash'],15000);
});
test('AP partial cash payment extinguishes both entity books equally',()=>{
 const s=partiallyPaid(),b=s.unified.core.balances;
 assert.equal(b['company:payable:po-1'],-3000);assert.equal(b['supplier:receivable:po-1'],3000);
 assert.equal(b['company:cash'],13000);assert.equal(b['supplier:cash'],12000);
 assert.equal(view(s).outstandingPayableMinor,'3000');
});
test('complete AP payment leaves zero outstanding but keeps audited accounts',()=>{
 const s=execute(partiallyPaid(),{...pay,id:'payment-2',amountMinor:3000}),v=view(s);
 assert.equal(v.outstandingPayableMinor,'0');
 assert.equal(s.unified.core.balances['company:payable:po-1'],0);
 assert.equal(s.unified.core.balances['supplier:receivable:po-1'],0);
});
test('cash purchase increases inventory and moves cash, no payable created',()=>{
 const s=execute(seed(),cashReceive),b=s.unified.core.balances;
 assert.equal(b['company:inventory:ramen'],1000);
 assert.equal(b['company:cash'],14000);assert.equal(b['supplier:cash'],11000);
 assert.equal(Object.keys(b).filter(k=>k.includes(':payable:')).length,0);
});
test('noncash COGS draws inventory without touching supplier or cash',()=>{
 const s=execute(started(),consume),b=s.unified.core.balances;
 assert.equal(b['company:inventory:ramen'],2500);assert.equal(b['company:expense:ramen-cogs'],2500);
 assert.equal(b['company:cash'],15000);assert.equal(b['supplier:cash'],10000);
});
test('cost of goods recognized on consumption, not receipt or payment',()=>{
 const purchase=started(),payment=partiallyPaid(),usage=execute(payment,consume);
 assert.equal(purchase.unified.core.balances['company:expense:ramen-cogs'],undefined);
 assert.equal(payment.unified.core.balances['company:expense:ramen-cogs'],undefined);
 assert.equal(usage.unified.core.balances['company:expense:ramen-cogs'],2500);
});
test('multiple orders and partial consumption sum to one store inventory',()=>{
 const s=execute(execute(started(),cashReceive),consume);
 assert.equal(view(s).inventoryMinor,'3500');assert.equal(view(s).orders.length,2);
});
test('store sale, ownership and inventory coexist in one financial authority',()=>{
 const issuance=unified.admitIssue(seed().unified,{type:'issue-shares',id:'issue-1',issuer:'company',subscriber:'founder',classId:'ordinary',shares:10,priceMinor:100},()=>true);
 assert.equal(issuance.ok,true,issuance.reason);
 const s=inventory.openingState(issuance.state);
 const a=execute(s,receive);
 const sale=unified.admitWeek(a.unified,{type:'settle-store-week',company:'company',customer:'customer',supplier:'supplier',employee:'employee',storeId:'ramen',week:1,salesMinor:4000,materialsMinor:0,wagesMinor:1000},()=>true);
 assert.equal(sale.ok,true,sale.reason);const next=copy(a);next.unified=sale.state;
 assert.equal(inventory.validateSupplyState(next),true);
 assert.equal(next.unified.core.balances['company:paid-in:company-ordinary'],-1000);
 assert.equal(next.unified.core.balances['company:inventory:ramen'],5000);
 assert.equal(next.unified.core.balances['company:revenue:ramen'],-4000);
});
test('full source replay rejects forged inventory amount',()=>{
 const s=started();s.unified.core.balances['company:inventory:ramen']+=1;
 assert.throws(()=>inventory.validateSupplyState(s),/unbalanced-state|balance-journal-mismatch/);
});
test('full source replay rejects tampered receipt amount',()=>{
 const s=started();s.events[0].amountMinor+=1;
 assert.throws(()=>inventory.validateSupplyState(s),/supply-journal-mismatch/);
});
test('full source replay rejects misattributed supplier',()=>{
 const s=started();s.events[0].supplier='founder';
 assert.throws(()=>inventory.validateSupplyState(s),/supply-journal-mismatch/);
});
test('forged arbitrary core inventory journal is blocked',()=>{
 const s=started(),r=core.planOperation(s.unified.core,{type:'journal',id:'forgery',postings:[
  {account:'company:inventory:ramen',deltaMinor:100},{account:'company:expense:ramen-cogs',deltaMinor:-100}
 ]});
 assert.equal(r.ok,true,r.reason);
 s.unified.core=r.state;assert.throws(()=>inventory.validateSupplyState(s),/unauthorized-inventory-writer/);
});
test('duplicate receipt cannot acquire inventory twice',()=>reject(started(),receive,'duplicate-purchase-order'));
test('new purchase order ID cannot be reused in cash purchase',()=>reject(started(),{...cashReceive,orderId:'po-1'},'duplicate-purchase-order'));
test('AP cannot be overpaid',()=>reject(partiallyPaid(),{...pay,id:'payment-over',amountMinor:3001},'overpayment'));
test('unknown AP purchase order cannot be repaid',()=>reject(started(),{...pay,id:'payment-x',orderId:'po-missing'},'unknown-purchase-payable'));
test('cash order cannot be repaid',()=>reject(execute(seed(),cashReceive),{...pay,orderId:'po-2'},'unknown-purchase-payable'));
test('wrong supplier cannot receive AP settlement',()=>reject(started(),{...pay,supplier:'founder'},'unknown-purchase-payable'));
test('consume cannot exceed available inventory',()=>reject(started(),{...consume,amountMinor:5001},'insufficient-inventory'));
test('cannot consume before receipt',()=>reject(seed(),consume,'insufficient-inventory'));
test('negative and fractional purchase amount rejected',()=>{
 reject(seed(),{...receive,amountMinor:-1},'invalid-amount');
 reject(seed(),{...receive,amountMinor:1.25},'invalid-amount');
});
test('zero amount rejected',()=>reject(seed(),{...receive,amountMinor:0},'invalid-amount'));
test('unsafe money rejected before state change',()=>reject(seed(),{...receive,amountMinor:Number.MAX_SAFE_INTEGER+1},'invalid-amount'));
test('cash order cannot exceed company liquidity',()=>reject(seed(),{...cashReceive,amountMinor:15001},'negative-cash'));
test('AP payment cannot exceed company liquidity',()=>reject(started(),{...pay,amountMinor:15001},'overpayment'));
test('issuer self-purchase is rejected',()=>reject(seed(),{...receive,supplier:'company'},'self-supply'));
test('unknown supplier entity rejected',()=>reject(seed(),{...receive,supplier:'ghost'},'unknown-supplier'));
test('purchase order must be stable PO-prefixed ID',()=>reject(seed(),{...receive,orderId:'order-one'},'order-id-prefix-required'));
test('save callback false rolls back cash inventory and payable as one staged state',()=>reject(seed(),receive,'persistence-rejected',()=>false));
test('save callback throws, no live state mutation',()=>reject(seed(),receive,'persistence-threw',()=>{throw Error('failed-write');}));
test('missing persistence callback fails closed',()=>{
 const s=seed(),r=inventory.admitSupply(s,receive);
 assert.equal(r.ok,false);assert.equal(r.reason,'persistence-required');assert.strictEqual(r.state,s);
});
test('persistence callback cannot mutate accepted state',()=>{
 const r=inventory.admitSupply(seed(),receive,obj=>{obj.unified.core.balances['company:inventory:ramen']=999;return true;});
 assert.equal(r.ok,true);assert.equal(r.state.unified.core.balances['company:inventory:ramen'],5000);
});
test('same inputs produce deterministic identical ledger',()=>assert.deepEqual(started(),started()));
test('supply journal preserves balanced entries by each entity',()=>{
 const s=execute(execute(partiallyPaid(),consume),cashReceive);
 for(const j of s.unified.core.journal){const byEntity=Object.fromEntries(s.unified.core.entities.map(e=>[e,0n]));
  for(const p of j.postings)byEntity[p.account.split(':')[0]]+=BigInt(p.deltaMinor);
  for(const v of Object.values(byEntity))assert.equal(v,0n);
 }
});
test('global cash conservation after both credit and cash procurement',()=>{
 const s=execute(execute(partiallyPaid(),consume),cashReceive);
 const cash=s.unified.core.entities.reduce((total,e)=>total+BigInt(s.unified.core.balances[e+':cash']),0n);
 assert.equal(cash,165000n);
});
test('inventory balance and AP never silently diverge from source event history',()=>{
 const s=execute(partiallyPaid(),consume);
 assert.equal(inventory.validateSupplyState(s),true);
 assert.equal(view(s).inventoryMinor,'2500');
 assert.equal(view(s).outstandingPayableMinor,'3000');
});
console.log('SPIKE-4 inventory/AP canonical ledger: '+count+' cases PASS. No real IDB or production parity.');
