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
// A loan that defaults after eight missed payments stays reserved from generic repay, so the
// specialist writer must settle it once cash is restored (Codex P1, #1015).
{
  const d=new engineModule.TycoonEngine(JSON.parse(JSON.stringify(g))),dg=d.g;
  const target=dg.realEstateMarket.loans.find(l=>l.id===loan.id);
  dg.personalCash=0;
  for(let w=11;w<=18;w++){dg.week=w;modules.realEstateCompleteCycle.processLoans(dg);}
  assert.equal(target.status,'defaulted','eight missed payments default the loan');
  const balance=target.balance,debt=dg.personalDebt;
  dg.personalCash=60_000_000;
  const defaulted=JSON.stringify(dg);
  assert.equal(d.repay(1_000_000,'personal'),false,'a defaulted secured loan stays reserved from generic repay');
  assert.equal(JSON.stringify(dg),defaulted);
  const save=d.save;d.save=()=>false;
  try{assert.equal(d.prepayRealEstateLoan(target.id,1_000_000),false,'save failure must refuse the settlement');}finally{d.save=save;}
  assert.equal(JSON.stringify(dg),defaulted,'save failure must roll the settlement back');
  assert.equal(d.prepayRealEstateLoan(target.id,1_000_000),true,'specialist prepayment settles part of a defaulted loan');
  const live=dg.realEstateMarket.loans.find(l=>l.id===loan.id);
  assert.equal(live.balance,balance-1_000_000);
  assert.equal(live.status,'defaulted','a partial payment does not cure the default');
  assert.equal(dg.personalDebt,debt-1_000_000);
  assert.equal(dg.personalCash,59_000_000);
  assert.equal(d.prepayRealEstateLoan(target.id,balance),true,'the remaining balance is settled through the same writer');
  const settled=dg.realEstateMarket.loans.find(l=>l.id===loan.id);
  assert.equal(settled.balance,0);
  assert.equal(settled.status,'paid');
  assert.equal(dg.personalDebt,debt-balance);
  assert.equal(dg.personalDebt,dg.realEstateMarket.loans.filter(l=>l.owner==='personal'&&l.accountingTracked===true&&l.balance>0).reduce((s,l)=>s+l.balance,0),'personalDebt matches the remaining tracked loans');
  assert.equal(JSON.stringify({cash:dg.companyCash,debt:dg.companyDebt}),JSON.stringify({cash:g.companyCash,debt:g.companyDebt}),'no company effects');
  const reloaded=new engineModule.TycoonEngine(JSON.parse(JSON.stringify(dg)));
  assert.equal(reloaded.g.realEstateMarket.loans.find(l=>l.id===loan.id).status,'paid','settlement persists across reload');
  assert.equal(reloaded.g.personalDebt,dg.personalDebt);
}
// A pre-#849 loan was never part of personalDebt, so settling it (active or defaulted) must not
// move the aggregate or touch the company side; only the loan row and the paying cash change.
{
  const u=new engineModule.TycoonEngine(JSON.parse(JSON.stringify(g))),ug=u.g;
  ug.realEstateMarket.loans.push({id:'RELOAN-2-90',propertyID:'P4-004-B',owner:'personal',originalPrincipal:8_000_000,balance:8_000_000,
   rate:.04,spread:.025,rateType:'fixed',termWeeks:260,weeksRemaining:200,weeklyPayment:40_000,status:'defaulted',delinquentWeeks:8,createdWeek:2});
  ug.personalCash=20_000_000;
  const debt=ug.personalDebt,company=JSON.stringify({cash:ug.companyCash,debt:ug.companyDebt,finance:ug.finance});
  assert.equal(u.prepayRealEstateLoan('RELOAN-2-90',3_000_000),true,'an untracked defaulted loan is settleable');
  assert.equal(ug.personalDebt,debt,'partial settlement of an untracked loan leaves personalDebt unchanged');
  assert.equal(ug.personalCash,17_000_000);
  assert.equal(u.prepayRealEstateLoan('RELOAN-2-90',5_000_000),true);
  const legacyLoan=ug.realEstateMarket.loans.find(l=>l.id==='RELOAN-2-90');
  assert.equal(legacyLoan.balance,0);assert.equal(legacyLoan.status,'paid');
  assert.equal(ug.personalDebt,debt,'full settlement of an untracked loan leaves personalDebt unchanged');
  assert.equal(JSON.stringify({cash:ug.companyCash,debt:ug.companyDebt,finance:ug.finance}),company,'no company effects');
}
// The dashboard keeps its last-five window but always lists defaulted loans, so an older default
// still has its settle button.
{
  const L=loadGame({random:()=>0.5}),ctx=L.ctx,live=ctx.__ct_engine;
  ctx.document.querySelector('[data-screen]').setAttribute('data-screen','assets');
  L.modules.realEstateCompleteCycle.ensure(live.g);
  for(let i=1;i<=7;i++)live.g.realEstateMarket.loans.push({id:`RELOAN-1-${i}`,propertyID:'P',owner:'personal',balance:1_000_000*i,rate:.03,weeklyPayment:1,status:i===1?'defaulted':'active',accountingTracked:true});
  const created=[],createElement=ctx.document.createElement;
  ctx.document.createElement=function(tag){const el=createElement.call(this,tag);created.push(el);return el;};
  try{L.modules.realEstateCompleteCycleUI.render();}finally{ctx.document.createElement=createElement;}
  const box=created.find(el=>el.dataset&&el.dataset.realEstateCompleteCycle==='');
  assert(box,'dashboard rendered');
  const ids=[...String(box.innerHTML).matchAll(/data-re-prepay="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids,['RELOAN-1-7','RELOAN-1-6','RELOAN-1-5','RELOAN-1-4','RELOAN-1-3','RELOAN-1-1'],'last five plus the older defaulted loan, newest first, no duplicates');
}
console.log('P4-AUD-004 personal secured-principal guard and save/reload PASS');
