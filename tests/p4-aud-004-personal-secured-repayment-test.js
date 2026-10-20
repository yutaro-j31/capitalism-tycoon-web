'use strict';
/* P4-AUD-004 RED→GREEN: Generic personal repayment cannot settle specialist property
 * principal without updating the loan record. No mortgage authority/schema migration. */
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {engineModule,modules}=loadGame({headless:true});
const e=new engineModule.TycoonEngine(),g=e.g;
g.configured=true;g.week=10;g.companyCash=100_000_000;g.companyDebt=0;
g.personalCash=80_000_000;g.personalDebt=0;
g.properties=[
 {id:'P4-004-A',name:'Personal Income Tower',owner:'personal',value:300_000_000,marketValue:300_000_000,purchasePrice:300_000_000,
  realEstate:{monthlyRent:4_000_000,occupancyRate:1,expenseRatio:.2}},
 {id:'P4-004-B',name:'Second Income Tower',owner:'personal',value:250_000_000,marketValue:250_000_000,purchasePrice:250_000_000,
  realEstate:{monthlyRent:3_000_000,occupancyRate:1,expenseRatio:.2}}
];
g.finance=modules.finance.defaultFinanceState(g);
// A normal installed transaction initializes the finance reconciliation metadata.
// Do so before the baseline to compare genuine company-account invariants, not lazy setup.
modules.finance.ensureFinance(g);
assert(modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,'normalized initial company books must be valid');
const companyBefore=JSON.stringify({cash:g.companyCash,debt:g.companyDebt,finance:g.finance});
const loan=e.borrowAgainstProperty('P4-004-A',30_000_000,{rateType:'fixed',termWeeks:260});
assert(loan&&loan.accountingTracked===true);
assert.equal(g.personalDebt,30_000_000);
assert.equal(loan.balance,30_000_000);
const second=e.borrowAgainstProperty('P4-004-B',10_000_000,{rateType:'fixed',termWeeks:260});
assert(second);
assert.equal(g.personalDebt,40_000_000);
const baseline=JSON.stringify(g);
let saves=0;const originalSave=e.save;
e.save=function(){saves++;return originalSave.call(this)};
assert.equal(e.repay(30_000_000,'personal'),false,'RED: must refuse settlement of specialist principal through generic personal repay');
assert.equal(JSON.stringify(g),baseline,'refusal must not mutate live economic state or RNG');
assert.equal(saves,0,'refusal must not save');
assert.equal(g.personalDebt,40_000_000);
assert.equal(loan.balance,30_000_000);
assert.equal(second.balance,10_000_000);
assert.equal(e.borrow(6_000_000,'personal'),true,'generic personal borrowing remains enabled');
assert.equal(g.personalDebt,46_000_000);
const mixed=JSON.stringify(g),beforeSaves=saves;
assert.equal(e.repay(7_000_000,'personal'),false,'reject mixed request exceeding the unsecured amount, not partial charge');
assert.equal(JSON.stringify(g),mixed);
assert.equal(saves,beforeSaves);
assert.equal(e.repay(6_000_000,'personal'),true,'unsecured personal principal remains repayable through generic UI');
assert.equal(g.personalDebt,40_000_000);
assert.equal(loan.balance,30_000_000);
assert.equal(second.balance,10_000_000);
const afterGeneric=JSON.stringify(g);
assert.equal(e.repay(1_000_000,'personal'),false,'generic repay no longer touches specialist principal');
assert.equal(JSON.stringify(g),afterGeneric);
assert.equal(e.prepayRealEstateLoan(loan.id,5_000_000),true,'specialist principal is repaid through specialist writer');
assert.equal(g.personalDebt,35_000_000);
assert.equal(loan.balance,25_000_000);
assert.equal(second.balance,10_000_000);
assert.equal(e.prepayRealEstateLoan(second.id,10_000_000),true);
assert.equal(g.personalDebt,25_000_000);
assert.equal(second.balance,0);
assert.equal(second.status,'paid');
assert.equal(JSON.stringify({cash:g.companyCash,debt:g.companyDebt,finance:g.finance}),companyBefore,'no company/PE cash or finance effects');
assert(modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,'company accounting remains valid');
const rehydrated=new engineModule.TycoonEngine(JSON.parse(JSON.stringify(g)));
const previous=JSON.stringify(rehydrated.g);
assert.equal(rehydrated.repay(1_000_000,'personal'),false,'reloaded save retains specialist allocation');
assert.equal(JSON.stringify(rehydrated.g),previous);
assert.equal(rehydrated.g.personalDebt,rehydrated.g.realEstateMarket.loans.filter(l=>l.owner==='personal'&&l.accountingTracked===true&&l.balance>0).reduce((s,l)=>s+l.balance,0));
// Authentic legacy save: a personal RELOAN created before #849 has no accountingTracked
// field and its origination never raised personalDebt. It must not block generic debt.
const legacy=new engineModule.TycoonEngine(JSON.parse(JSON.stringify(g)));
legacy.g.realEstateMarket.loans=legacy.g.realEstateMarket.loans.filter(l=>l.owner!=='personal');
legacy.g.personalDebt=0;
legacy.g.realEstateMarket.loans.push({id:'RELOAN-3-9',propertyID:'P4-004-A',owner:'personal',originalPrincipal:30_000_000,balance:30_000_000,
 rate:.04,spread:.025,rateType:'fixed',termWeeks:260,weeksRemaining:250,weeklyPayment:130_000,status:'active',delinquentWeeks:0,createdWeek:3});
assert.equal(legacy.borrow(10_000_000,'personal'),true);
assert.equal(legacy.g.personalDebt,10_000_000);
assert.equal(legacy.repay(10_000_000,'personal'),true,'legacy untracked loan is outside personalDebt and must not reserve it');
assert.equal(legacy.g.personalDebt,0);
assert.equal(legacy.g.realEstateMarket.loans.find(l=>l.id==='RELOAN-3-9').balance,30_000_000,'legacy specialist loan is untouched');
console.log('P4-AUD-004 personal secured-principal guard and save/reload PASS');
