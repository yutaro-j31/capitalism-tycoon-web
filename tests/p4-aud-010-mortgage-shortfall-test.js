'use strict';
// #1079: turn #1011's personal underpayment/past-maturity probe into a GREEN regression.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const clone = x => JSON.parse(JSON.stringify(x));
function fixture(owner = 'personal', legacy = false) {
  let seed = 0x10790001;
  const s = loadGame({ headless: true, random: () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296) });
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: 10, companyCash: 400000000, personalCash: 400000000, companyDebt: 0, personalDebt: 7000000 });
  g.properties = [{ ...g.properties[0], id: 'SHORTFALL', owner, marketValue: 300000000, value: 300000000, purchasePrice: 300000000,
    mortgageBalance: legacy ? 195000000 : 0, mortgageProductID: legacy ? 'fixed' : '', mortgageRemainingWeeks: legacy ? 520 : 0,
    realEstate: { landBookValue: 100000000, buildingBookValue: 200000000, landValue: 100000000, buildingValue: 200000000 } }];
  g.finance = s.modules.finance.defaultFinanceState(g);
  const e = new s.engineModule.TycoonEngine(g);
  const p = () => e.g.properties.find(p => p.id === 'SHORTFALL');
  if (!legacy) assert.ok(e.refinancePropertyMortgage('SHORTFALL', 'fixed'));
  return { ...s, e, p, owner, legacy };
}
function budget(s, amount) {
  const g=s.e.g,key=s.owner==='company'?'companyCash':'personalCash',delta=amount-g[key];
  if(s.owner==='company'&&delta) s.modules.finance.event(g,'otherOperating',Math.abs(delta),{cashEffect:delta,profitEffect:delta,sourceType:'shortfall-fixture',sourceID:'budget-'+g.week});
  g[key]=amount;
}
function tick(s, cash) {
  s.e.g.week++; budget(s,cash);
  const rows=s.modules.realEstateMortgageRefinancing.processWeek(s.e);
  assert.equal(rows.length,1);return rows[0];
}
function books(s) {
  if(s.owner==='company'&&s.legacy)return; // legacy debt remains off book; S1/S2 is tested below.
  const v=s.modules.finance.validate(s.e.g);assert.equal(v.ok,true,v.errors.join(' / '));
  const d=s.modules.finance.debtRollforwardStatus(s.e.g);assert.equal(d.ok,true,JSON.stringify(d));
}
// The three exact modes from #1011/#1079, plus company tracking and legacy separation.
for(const owner of ['personal','company'])for(const legacy of owner==='company'?[false,true]:[false])for(const cash of [120000,307500,0]){
  const s=fixture(owner,legacy),p=s.p(),before={principal:p.mortgageBalance,remaining:p.mortgageRemainingWeeks,debt:s.e.g.personalDebt,companyDebt:s.e.g.companyDebt};
  const companyBefore=clone(s.e.g.finance),row=tick(s,cash);
  assert.equal(p.mortgageRemainingWeeks,before.remaining,'short payment does not consume an instalment');
  assert.equal(p.mortgageDelinquentWeeks,1,'shortfall is explicit for every owner');
  assert.equal(row.principal,cash===307500?187500:0);
  const unpaidInterest=cash===0?120000:0;
  if(owner==='company'&&!legacy){
    assert.equal(p.mortgageBalance,before.principal-row.principal+unpaidInterest);
    assert.equal(s.e.g.companyDebt,before.companyDebt-row.principal+unpaidInterest);
    const mirror=s.e.g.finance.loans.find(l=>l.sourceType==='propertyMortgage');assert.equal(mirror.outstandingPrincipal,p.mortgageBalance);assert.equal(mirror.remainingWeeks,before.remaining);
  }else{
    assert.equal(p.mortgageBalance,before.principal-row.principal);
    assert.equal(p.mortgageUnpaidInterest,unpaidInterest,'untracked unpaid interest is retained without compounding');
    assert.equal(s.e.g.personalDebt,before.debt,'unrelated personal debt is never consumed');
    if(owner==='personal')assert.deepEqual(clone(s.e.g.finance),companyBefore,'personal service leaves company books unchanged');
    else assert.equal(s.e.g.companyDebt,0,'legacy company principal stays off book');
  }
  const same=JSON.stringify(s.e.g);assert.equal(s.modules.realEstateMortgageRefinancing.processWeek(s.e).length,0);assert.equal(JSON.stringify(s.e.g),same);
  books(s);
}
// After 520 missed payments, principal and the exact simple-interest arrears remain recoverable.
{
  const s=fixture();for(let i=0;i<520;i++)tick(s,0);
  assert.equal(s.p().mortgageRemainingWeeks,520);assert.equal(s.p().mortgageBalance,195000000);
  assert.equal(s.p().mortgageUnpaidInterest,62400000);assert.equal(s.p().mortgageDelinquentWeeks,520);
  assert.equal(s.modules.realEstateMortgageRefinancing.outstandingBalance(s.p()),257400000);
  const row=tick(s,1000000000);assert.equal(row.interest,62520000);assert.equal(row.principal,375000);
  assert.equal(s.p().mortgageUnpaidInterest,0);assert.equal(s.p().mortgageDelinquentWeeks,0);assert.equal(s.p().mortgageRemainingWeeks,519);
}
// Legacy saves already past nominal maturity remain payable, not active with a zero schedule.
{
  const s=fixture();s.p().mortgageRemainingWeeks=0;s.p().mortgageBalance=10001.5;
  const row=tick(s,1);assert.equal(row.interest,1);assert.equal(row.principal,0);
  assert.equal(s.p().mortgageRemainingWeeks,1);assert.ok(s.p().mortgageUnpaidInterest>0);
  const due=s.p().mortgageBalance+s.p().mortgageUnpaidInterest+s.modules.economicOperation.ceilYen(s.p().mortgageBalance*.032/52);
  tick(s,due);assert.equal(s.p().mortgageBalance,0);assert.equal(s.p().mortgageUnpaidInterest,0);assert.equal(s.p().mortgageRemainingWeeks,0);
}
// Prepay, refinance, sale and shared-collateral quotes must all consume/count the same unpaid charge.
for(const owner of ['personal','company'])for(const legacy of owner==='company'?[false,true]:[false])for(const action of ['prepay','refinance','sale','quote']){
  const s=fixture(owner,legacy);
  if(legacy){s.e.g.companyCash+=s.p().mortgageBalance;s.modules.finance.event(s.e.g,'propertyMortgageProceeds',s.p().mortgageBalance,{cashEffect:s.p().mortgageBalance,profitEffect:0,liabilityEffect:0,sourceType:'property-mortgage',sourceID:'historical-borrowing'});}
  tick(s,0);s.modules.finance.validate(s.e.g);const g=s.e.g,p=s.p(),arrears=p.mortgageUnpaidInterest,B=p.mortgageBalance,unrelated=g.personalDebt,key=owner==='company'?'companyCash':'personalCash';
  g.week++;budget(s,400000000);
  if(action==='prepay'){
    assert.equal(s.e.prepayPropertyMortgage(p.id,arrears+1234.3),arrears+1235);
    assert.equal(p.mortgageUnpaidInterest,0);assert.equal(p.mortgageBalance,B-1235);assert.equal(p.mortgageInterestPaid,arrears);
  }else if(action==='refinance'){
    const before=g[key],r=s.e.refinancePropertyMortgage(p.id,'variable');assert.ok(r);
    assert.equal(r.oldBalance,B+arrears);assert.equal(g[key]-before,r.newBalance-B-arrears-r.fee);assert.equal(p.mortgageUnpaidInterest,0);
  }else if(action==='sale'){
    const before=g[key];const r=s.e.settlePropertyDisposition({propertyID:p.id,grossSalePrice:300000000,idempotencyKey:'shortfall-sale'});assert.ok(r);
    assert.equal(before+300000000-B-arrears,g[key]);assert.equal(r.mortgage,B+arrears);
  }else assert.equal(s.e.getRealEstateFinanceQuote(p.id,1).existingDebt,B+arrears);
  assert.equal(g.personalDebt,unrelated);books(s);
  if(legacy){
    const diff=s.modules.finance.buildStatements(g,'52').balanceSheet.balanceDifference;
    assert.equal(diff,action==='sale'?0:p.mortgageBalance,'settling interest preserves the legacy principal-only S1 gap');
    if(action!=='quote')assert.equal(g.finance.transactions.filter(r=>r.category==='interestExpense'&&['property-mortgage-prepayment-interest','property-mortgage-interest-settled','property-disposition-interest'].includes(r.sourceType)).reduce((sum,r)=>sum+r.amount,0),arrears);
  }
}
// A legacy company's S1 disposal classification uses principal, while arrears are expensed only when paid.
{
  const s=fixture('company',true),g=s.e.g;
  // S1: create the pre-existing off-book borrowing gap explicitly before the shortfall.
  g.companyCash+=s.p().mortgageBalance;
  s.modules.finance.event(g,'propertyMortgageProceeds',s.p().mortgageBalance,{cashEffect:s.p().mortgageBalance,profitEffect:0,liabilityEffect:0,sourceType:'property-mortgage',sourceID:'historical-borrowing'});
  const before=s.modules.finance.buildStatements(g,'52').balanceSheet.balanceDifference;
  tick(s,0);assert.equal(s.modules.finance.buildStatements(g,'52').balanceSheet.balanceDifference,before);
  g.week++;const r=s.e.settlePropertyDisposition({propertyID:s.p().id,grossSalePrice:300000000,idempotencyKey:'legacy-shortfall-sale'});assert.ok(r);
  assert.equal(s.modules.finance.validate(g).ok,true,JSON.stringify(s.modules.finance.validate(g)));
  assert.equal(g.companyDebt,0);assert.equal(g.personalDebt,7000000);
  assert.equal(g.finance.transactions.find(r=>r.sourceType==='property-disposition-interest').amount,120000);
}
// Service within the installed transaction rolls back schedule, arrears, ledger and storage on every save fault.
for(const owner of ['personal','company'])for(const fault of ['save-false','save-throw','post-save-throw']){
  const s=fixture(owner);s.e.g.week++;budget(s,0);assert.equal(s.e.save(),true);
  const before=JSON.stringify(s.e.g),key=s.engineModule.SAVE_KEY,mirror=s.ctx.__localStorageData.get(key),save=s.e.save;
  s.e.save=function(...args){if(fault==='save-false')return false;if(fault==='save-throw')throw Error('injected mortgage save');save.apply(this,args);throw Error('injected mortgage save');};
  const call=()=>s.e.runTransaction(()=>{s.modules.realEstateMortgageRefinancing.processWeek(s.e);return true;});
  if(fault==='save-false')assert.equal(call(),false);else assert.throws(call,/injected/);
  s.e.save=save;assert.equal(JSON.stringify(s.e.g),before);assert.equal(s.ctx.__localStorageData.get(key),mirror);
  assert.equal(call(),true);assert.equal(s.p().mortgageDelinquentWeeks,1);
  const reloaded=new s.engineModule.TycoonEngine(clone(s.e.g));assert.equal(reloaded.g.properties[0].mortgageUnpaidInterest,s.p().mortgageUnpaidInterest);assert.equal(reloaded.g.properties[0].mortgageRemainingWeeks,s.p().mortgageRemainingWeeks);
}
{
  const replay=()=>{const s=fixture('company');for(const cash of [0,120000,307500,1000000]){tick(s,cash);books(s);}delete s.e.g.lastSaveDate;return JSON.stringify(s.e.g);};
  assert.equal(replay(),replay(),'seeded shortfall replay is deterministic');
}
console.log('PASS #1079 mortgage shortfall: schedule, interest liability, owners, payoff, maturity, rollback and reload');
