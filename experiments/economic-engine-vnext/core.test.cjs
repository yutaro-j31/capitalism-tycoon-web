'use strict';
const assert = require('node:assert/strict');
const {createInitialState,validateState,planOperation,admitOperation} = require('./core.cjs');
const seed=()=>createInitialState({bank:100000,company:10000,founder:2000});
const borrow={id:'borrow-1',type:'borrow',borrower:'company',lender:'bank',loanId:'loan-a',amountMinor:4000};
let passed=0;
function test(label,run){run();passed++;console.log('PASS',label);}
function rejected(before,op,reason,save=()=>true){
  const snapshot=JSON.stringify(before),r=admitOperation(before,op,save);
  assert.equal(r.ok,false);assert.equal(r.reason,reason);
  assert.equal(JSON.stringify(before),snapshot);
  assert.deepEqual(r.state,before);
}
test('balanced genesis',()=>assert.equal(validateState(seed()),true));
test('entity cash isolation / no input mutation',()=>{
  const a=seed(),b=admitOperation(a,{id:'transfer-1',type:'transfer',from:'founder',to:'company',amountMinor:500},()=>true);
  assert.equal(b.ok,true);assert.equal(b.state.balances['company:cash'],10500);assert.equal(b.state.balances['founder:cash'],1500);assert.equal(a.balances['company:cash'],10000);
});
test('borrow posts four conserved legs and a matched liability',()=>{
  const b=admitOperation(seed(),borrow,()=>true);
  assert.equal(b.ok,true);assert.equal(b.state.journal[0].postings.length,4);
  assert.equal(b.state.balances['company:cash'],14000);assert.equal(b.state.balances['company:loan:loan-a'],-4000);
  assert.equal(b.state.balances['bank:receivable:loan-a'],4000);assert.equal(b.state.balances['bank:cash'],96000);
  assert.equal(validateState(b.state),true);
});
test('repayment reduces both principal legs exactly once',()=>{
  const b=admitOperation(seed(),borrow,()=>true);
  const r=admitOperation(b.state,{id:'repay-1',type:'repay',loanId:'loan-a',amountMinor:1500},()=>true);
  assert.equal(r.ok,true);assert.equal(r.state.loans['loan-a'].outstandingMinor,2500);
  assert.equal(r.state.balances['company:loan:loan-a'],-2500);
  assert.equal(r.state.balances['bank:receivable:loan-a'],2500);
  assert.equal(validateState(r.state),true);
});
test('duplicate operation id rejected',()=>{
  const b=admitOperation(seed(),borrow,()=>true);
  rejected(b.state,borrow,'duplicate-operation');
});
test('overpayment rejected',()=>{
  const b=admitOperation(seed(),borrow,()=>true);
  rejected(b.state,{id:'repay-extra',type:'repay',loanId:'loan-a',amountMinor:5000},'overpayment');
});
test('insufficient founder cash rejected',()=>rejected(seed(),{id:'send-too-much',type:'transfer',from:'founder',to:'company',amountMinor:3000},'negative-cash'));
test('insufficient bank cash rejected',()=>rejected(seed(),{id:'borrow-too-much',type:'borrow',borrower:'company',lender:'bank',loanId:'loan-big',amountMinor:100001},'negative-cash'));
test('save false leaves original state intact',()=>rejected(seed(),borrow,'persistence-rejected',()=>false));
test('save throws leaves original state intact',()=>rejected(seed(),borrow,'persistence-threw',()=>{throw Error('save unavailable');}));
test('persistence callback required',()=>{const a=seed(),r=admitOperation(a,borrow);assert.equal(r.ok,false);assert.equal(r.reason,'persistence-required');assert.deepEqual(r.state,a);});
test('invalid/non-finite/unsafe/fractional money rejected',()=>{
  for(const value of [NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1,-1,0]){
    rejected(seed(),{id:'invalid-money',type:'transfer',from:'founder',to:'company',amountMinor:value},'invalid-amount');
  }
});
test('deterministic replay',()=>{
  const a=admitOperation(seed(),borrow,()=>true);
  const b=admitOperation(seed(),borrow,()=>true);
  assert.deepEqual(a.state,b.state);
});
test('persist callback cannot mutate returned candidate',()=>{
  const a=admitOperation(seed(),borrow,state=>{state.balances['company:cash']=42;return true;});
  assert.equal(a.ok,true);assert.equal(a.state.balances['company:cash'],14000);
});
test('pure plan can be inspected without admission',()=>{
  const a=seed(),proposal=planOperation(a,borrow);
  assert.equal(proposal.ok,true);assert.equal(a.journal.length,0);
  assert.equal(proposal.state.journal.length,1);
});
console.log('VNext SPIKE-0: '+passed+' tests passed. No IDB/WebKit/old-save claim.');
