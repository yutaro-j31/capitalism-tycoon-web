'use strict';
// P4-AUD-007/008: Node characterization only. PASS here means a preexisting P1 was reproduced.
// This audit oracle is not a GREEN acceptance gate for mortgage correctness or Phase 4 Entry.
const assert=require('node:assert/strict');
const {loadGame}=require('../tests/harness');
function fixture(owner='company'){
 const s=loadGame({headless:true});
 const e=new s.engineModule.TycoonEngine(s.engineModule.createInitialState({configured:true}));
 Object.assign(e.g,{configured:true,week:10,companyCash:100_000_000,personalCash:100_000_000,companyDebt:0,personalDebt:0});
 e.g.properties=[{...e.g.properties[0],id:'AUD-007-008-P',name:'Mortgage Audit Building',owner,marketValue:300_000_000,value:300_000_000,purchasePrice:300_000_000,realEstate:{monthlyRent:4_000_000,occupancyRate:1,expenseRatio:.2}}];
 s.modules.realEstate.ensure(e.g);
 e.g.finance=s.modules.finance.defaultFinanceState(e.g);
 s.modules.finance.ensureFinance(e.g);
 s.modules.simulationRng.reseed(e.g,83951617);
 e.normalize();
 assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(e.g))).ok,true);
 return {...s,e};
}
{
 const s=fixture('company'),e=s.e,p=e.g.properties[0],before=e.g.companyCash;
 const result=e.refinancePropertyMortgage(p.id,'fixed'),valid=s.modules.finance.validate(JSON.parse(JSON.stringify(e.g)));
 const row={id:'P4-AUD-007',mortgagePrincipal:p.mortgageBalance,companyDebt:e.g.companyDebt,financeLoanTotal:e.g.finance.loans.reduce((a,x)=>a+Number(x.outstandingPrincipal||0),0),netCashProceeds:e.g.companyCash-before,companyBooksValid:valid.ok,issues:valid.errors};
 console.log(JSON.stringify(row));
 assert.equal(row.mortgagePrincipal,195_000_000);
 assert.equal(row.companyDebt,0);
 assert.equal(row.financeLoanTotal,0);
 assert.equal(row.companyBooksValid,false);
 const reloaded=s.engineModule.TycoonEngine.load().g;
 assert.equal(reloaded.properties.find(x=>x.id===p.id).mortgageBalance,195_000_000,'production reload retains unbooked liability');
}
{
 const s=fixture('personal'),e=s.e,p=e.g.properties[0],transactions=[];
 function action(product){
   const cash=e.g.personalCash,principal=p.mortgageBalance||0;
   const r=e.refinancePropertyMortgage(p.id,product);
   assert.ok(r,'refinancing accepted');
   const out={week:e.g.week,product,cashDelta:Math.round((e.g.personalCash-cash)*100)/100,oldPrincipal:principal,newPrincipal:p.mortgageBalance};
   transactions.push(out);return out;
 }
 action('variable');
 for(let i=0;i<2;i++){
   assert.notEqual(e.advanceWeek(false),false,'actual week advance');
   const low=action('conservative');
   assert.ok(low.newPrincipal<low.oldPrincipal,'loan principal declines when LTV is reduced');
   assert.equal(low.cashDelta,0,'decline occurs without cash repayment');
   assert.notEqual(e.advanceWeek(false),false,'second actual week advance');
   const high=action('variable');
   assert.ok(high.cashDelta>0,'same collateral pays a new net mortgage draw');
 }
 const repeated=transactions.filter(x=>x.product==='variable').slice(1);
 const cashGains=repeated.reduce((a,x)=>a+x.cashDelta,0);
 console.log(JSON.stringify({id:'P4-AUD-008',transactions,repeatedBorrowingCashProceeds:Math.round(cashGains*100)/100,personalDebt:e.g.personalDebt}));
 assert.equal(repeated.length,2);
 assert.ok(cashGains>100_000_000,'two non-repaying LTV cycles create repeat cash proceeds');
}
console.log('P4-AUD-007/008 current-main Node AUDIT ORACLE: defects reproduced; product NOT GREEN');
