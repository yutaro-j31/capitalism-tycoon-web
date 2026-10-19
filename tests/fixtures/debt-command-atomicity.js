'use strict';
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./stock-split-atomicity');
const AMOUNT=100000;
const VARIANTS=['company-borrow','personal-borrow','company-repay','personal-repay','founder-loan','founder-repay'];
async function fixture(variant){
 const s=await scenario('own');
 if(variant==='company-repay')assert.equal(s.game.borrow(AMOUNT*2,'company'),true);
 if(variant==='personal-repay')assert.equal(s.game.borrow(AMOUNT*2,'personal'),true);
 if(variant==='founder-repay')assert.equal(s.game.foundersLoanToCompany(AMOUNT*2),true);
 assert.equal(s.modules.finance.validate(s.game.g).ok,true);
 assert.equal(s.game.save(),true);await s.backend.flush();
 return {...s,variant};
}
function command(s){
 switch(s.variant){
 case 'company-borrow':return s.game.borrow(AMOUNT,'company');
 case 'personal-borrow':return s.game.borrow(AMOUNT,'personal');
 case 'company-repay':case 'founder-repay':return s.game.repay(AMOUNT,'company');
 case 'personal-repay':return s.game.repay(AMOUNT,'personal');
 case 'founder-loan':return s.game.foundersLoanToCompany(AMOUNT);
 default:throw new Error('Unknown debt fixture '+s.variant);
 }
}
function expectSuccess(before,after,s){
 const borrowing=s.variant.endsWith('borrow')||s.variant==='founder-loan';
 const personal=s.variant.startsWith('personal-'),delta=borrowing?AMOUNT:-AMOUNT;
 assert.equal(after[personal?'personalDebt':'companyDebt'],before[personal?'personalDebt':'companyDebt']+delta);
 assert.equal(after[personal?'personalCash':'companyCash'],before[personal?'personalCash':'companyCash']+delta);
 if(s.variant==='founder-loan')assert.equal(after.personalCash,before.personalCash-AMOUNT);
 else if(s.variant==='founder-repay')assert.equal(after.personalCash,before.personalCash+AMOUNT);
 else assert.equal(after[personal?'companyCash':'personalCash'],before[personal?'companyCash':'personalCash']);
 assert.equal(after[personal?'companyDebt':'personalDebt'],before[personal?'companyDebt':'personalDebt']);
 if(!personal){
  const beforeLoans=before.finance.loans.reduce((n,l)=>n+l.outstandingPrincipal,0);
  assert.equal(after.finance.loans.reduce((n,l)=>n+l.outstandingPrincipal,0),beforeLoans+delta);
  const added=after.finance.transactions.slice(before.finance.transactions.length);
  assert.equal(added.length,1,'one principal ledger row');
  assert.equal(added[0].liabilityEffect,delta);assert.equal(added[0].cashEffect,delta);assert.equal(added[0].profitEffect,0);
 }else assert.deepEqual(after.finance,before.finance,'personal commands do not post to company finance');
 assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(s.game.g))).ok,true,'successful company books valid');
}
module.exports={AMOUNT,VARIANTS,fixture,command,expectSuccess,economic,snapshot};
