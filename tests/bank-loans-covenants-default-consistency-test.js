'use strict';
// Regression test for the companyDebt/bankDebt vs. defaulted-loan inconsistency
// discovered during founding-route rebalance work: js/bank-loans-covenants.js's
// service() sets a loan to status='defaulted' after 3 covenant breaches but never
// decrements companyDebt, while js/finance.js's validate() and
// js/bank-loans-covenants.js's activeFinanceLoans()/bankLoanBalance() used to sum
// only status==='active' loans. That made companyDebt/bankDebt understate a
// defaulted loan's still-owed balance -- finance.validate() failed with a
// companyDebt/loan-total mismatch, and bankDebt (which feeds corporate bond credit
// rating) perversely improved after a default. Both filters now use
// status!=='repaid' so a defaulted loan still counts as outstanding debt.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
class Engine{constructor(g){this.g=g;}normalize(){}runTransaction(fn){return fn();}fail(){return false;}notify(){}}
const context={console,setTimeout,queueMicrotask,globalThis:null};
context.globalThis=context;
const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null},deterministicEconomicFoundation:{ensure:s=>s}};
context.__capitalismTycoonModules=modules;
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/finance.js'),'utf8'),context);
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/bank-loans-covenants.js'),'utf8'),context);
const finance=modules.finance,mod=modules.bankLoansCovenants;

const g={week:10,companyCash:5000000,cash:5000000,totalAssets:5000000,personalCash:300000,cumulativeProfit:100000,economicFoundation:{indicators:{policyRate:1.5,stress:.2}}};
finance.ensureFinance(g);
const borrowed=mod.borrow(g,1000000,52);
assert(borrowed,'借入が成立すること');
assert.strictEqual(g.companyDebt,1000000);
assert.strictEqual(finance.validate(g).ok,true,'借入直後はvalidateがOKであること');

// Starve cash so service() breaches the covenant on every call until the loan defaults (3 breaches).
let defaulted=false;
for(let i=0;i<10&&!defaulted;i++){
  g.week++;
  g.companyCash=0;
  mod.service(g);
  const loan=finance.ensureFinance(g).loans.find(l=>l.sourceType==='bankLoansCovenants');
  if(loan&&loan.status==='defaulted')defaulted=true;
}
assert(defaulted,'テスト前提: 通常の借入がコベナンツ違反3回でdefaultedに到達すること');

const loan=finance.ensureFinance(g).loans.find(l=>l.sourceType==='bankLoansCovenants');
assert.strictEqual(loan.status,'defaulted');
assert(loan.outstandingPrincipal>0,'defaulted後も残高が残っていること(前提)');

// companyDebt should still count the defaulted loan's remaining balance.
assert.strictEqual(g.companyDebt,loan.outstandingPrincipal,'companyDebtはdefaulted後も残高を保持すること');

// bankDebt (feeds corporate bond credit rating) must not drop to 0 on default.
assert.strictEqual(g.bankDebt,loan.outstandingPrincipal,'bankDebtはdefaultedローンの残高を除外しないこと');
assert(g.bankDebt>0,'defaultは信用格付けを見かけ上改善させてはならない');

// finance.validate() must not report a companyDebt/loan-total mismatch for a defaulted loan.
const validation=finance.validate(g);
assert(!validation.errors.some(e=>e.includes('companyDebtとローン残高が不一致')),'defaulted後もcompanyDebtとローン残高が一致すること: '+JSON.stringify(validation.errors));

// A fully repaid loan must still be excluded (status==='repaid' loans are genuinely gone).
const repaidState={week:10,companyCash:5000000,cash:5000000,totalAssets:5000000,economicFoundation:{indicators:{policyRate:1.5,stress:.2}}};
finance.ensureFinance(repaidState);
mod.borrow(repaidState,50000,4); // quote() clamps term to a 12-week minimum regardless of the requested weeks
for(let i=0;i<13;i++){repaidState.week++;mod.service(repaidState);}
const repaidLoan=finance.ensureFinance(repaidState).loans.find(l=>l.sourceType==='bankLoansCovenants');
assert.strictEqual(repaidLoan.status,'repaid','テスト前提: 短期ローンが完済されること');
assert.strictEqual(repaidState.companyDebt,0,'完済後はcompanyDebtが0であること');
assert.strictEqual(repaidState.bankDebt,0,'完済後はbankDebtが0であること(repaidは除外され続けること)');

console.log('bank-loans-covenants default consistency tests passed');
