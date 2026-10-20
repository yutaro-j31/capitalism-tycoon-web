'use strict';
const assert=require('node:assert/strict');
const {fixture,check}=require('./fixtures/property-debt-principal-sync');
for(const amount of [1_000_000,60_000_000]){const s=fixture(),before=s.game.g.companyCash;assert.equal(s.game.repay(amount,'company'),true);const l=check(s);assert.equal(l.balance,60_000_000-amount);assert.equal(s.game.g.companyCash,before-amount);s.game.g.week++;s.modules.realEstateCompleteCycle.processLoans(s.game.g);check(s);assert.equal(s.engineModule.TycoonEngine.load().g.realEstateMarket.loans[0].balance,60_000_000-amount,'repayment persists');console.log('generic repayment '+amount+' then property service PASS');}
console.log('Property debt principal synchronization PASS');

for(const writer of ['voluntary','maturity']){const s=fixture(),g=s.game.g,before=g.companyDebt;
 if(writer==='voluntary')assert.equal(s.game.prepayCompanyDebtVoluntarily(1_000_000),true);
 else {const r=s.modules.playerDebtService.refinancingState(s.game);r.nextMaturityWeek=g.week;s.game.runTransaction(()=>{s.modules.playerDebtService.processDebtMaturity(s.game);return true;});}
 assert.ok(g.companyDebt<before);check(s);g.week++;s.modules.realEstateCompleteCycle.processLoans(g);check(s);console.log(writer+' repayment then property service PASS');}
for(const fault of ['save-false','save-throw']){const s=fixture(),before=JSON.stringify(s.game.g),save=s.game.save;
 s.game.save=()=>{if(fault==='save-false')return false;throw Error('save threw');};
 if(fault==='save-false')assert.equal(s.game.prepayCompanyDebtVoluntarily(1_000_000),false);
 else assert.throws(()=>s.game.prepayCompanyDebtVoluntarily(1_000_000),/save threw/);
 s.game.save=save;assert.equal(JSON.stringify(s.game.g),before,'mirror rolls back with finance/cash/ledger');assert.equal(s.game.prepayCompanyDebtVoluntarily(1_000_000),true);check(s);}

for(const specialist of ['prepay','refinance']){const s=fixture();s.game.repay(1_000_000,'company');const id=s.game.g.realEstateMarket.loans[0].id;
 assert.ok(specialist==='prepay'?s.game.prepayRealEstateLoan(id,1_000_000):s.game.refinanceRealEstateLoan(id,{rateType:'fixed',termWeeks:260}));check(s);s.game.g.week++;s.modules.realEstateCompleteCycle.processLoans(s.game.g);check(s);console.log('generic then '+specialist+' then service PASS');}
{const s=fixture(),g=s.game.g;g.realEstateMarket.loans.push({...g.realEstateMarket.loans[0],id:'personal-unrelated',owner:'personal',balance:1_234_567});
 const before=g.realEstateMarket.loans[1].balance;s.game.repay(1_000_000,'company');assert.equal(g.realEstateMarket.loans[1].balance,before,'personal property is untouched');check(s);}
console.log('All property repayment writer closures PASS');
