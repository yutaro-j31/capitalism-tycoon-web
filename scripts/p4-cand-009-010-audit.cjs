'use strict';
// P4-CAND-009/010 installed-engine characterization. Reproduction PASS means a DEFECT exists.
// Not a production regression GREEN; Phase 4 Entry stays blocked until root cause is repaired.
const assert=require('node:assert/strict');
const {loadGame}=require('../tests/harness');
const round=v=>Math.round(v*100)/100;
function fixture(owner='company'){
 const s=loadGame({headless:true});
 const e=new s.engineModule.TycoonEngine(s.engineModule.createInitialState({configured:true}));
 Object.assign(e.g,{configured:true,week:10,companyCash:100_000_000,personalCash:100_000_000,companyDebt:0,personalDebt:0});
 e.g.properties=[{...e.g.properties[0],id:'P4-SHARED',name:'Shared Collateral Building',owner,marketValue:300_000_000,value:300_000_000,purchasePrice:300_000_000,realEstate:{monthlyRent:8_000_000,occupancyRate:1,expenseRatio:.2}}];
 s.modules.realEstate.ensure(e.g);
 e.g.finance=s.modules.finance.defaultFinanceState(e.g);
 s.modules.finance.ensureFinance(e.g);
 s.modules.simulationRng.reseed(e.g,83951617);
 e.normalize();
 assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(e.g))).ok,true,'opening company books valid');
 return {...s,e,p:e.g.properties[0]};
}
function collateral(owner,reverse){
 const {e,p}=fixture(owner), value=300_000_000;
 const quote=e.getRealEstateFinanceQuote(p.id,40_000_000,{rateType:'fixed',termWeeks:260});
 const specialty=()=>e.borrowAgainstProperty(p.id,40_000_000,{rateType:'fixed',termWeeks:260});
 const independent=()=>e.refinancePropertyMortgage(p.id,'fixed');
 let specialist,mortgage;
 if(reverse){mortgage=independent();specialist=specialty();}
 else{specialist=specialty();mortgage=independent();}
 const market=e.g.realEstateMarket.loans.filter(x=>x.propertyID===p.id&&x.balance>0).reduce((a,x)=>a+x.balance,0);
 const prop=Number(p.mortgageBalance||0);
 const combined=round((market+prop)/value);
 const actual={case:'CAND-P4-009',owner,order:reverse?'mortgage-first':'specialist-first',quote,specialistAccepted:Boolean(specialist),mortgageAccepted:Boolean(mortgage),marketLoanPrincipal:market,mortgagePrincipal:prop,combinedLTV:combined,maxSpecialistLTV:owner==='personal'?.70:.75,maxMortgageLTV:.65};
 console.log(JSON.stringify(actual));
 assert.equal(Boolean(specialist),true,'specialist loan must be operationally available');
 assert.equal(Boolean(mortgage),true,'mortgage writer must be operationally available');
 assert.ok(combined>actual.maxSpecialistLTV,'combined LTV exceeds specialist cap');
 assert.ok(combined>actual.maxMortgageLTV,'combined LTV exceeds mortgage cap');
}
function underpayment(mode){
 const {e,p,modules}=fixture('personal');
 const opened=e.refinancePropertyMortgage(p.id,'fixed');
 assert.ok(opened,'mortgage origination');
 const balance=p.mortgageBalance,remaining=p.mortgageRemainingWeeks,rate=modules.realEstateMortgageRefinancing.PRODUCTS.fixed.annualRate;
 const interest=round(balance*rate/52),principal=round(Math.min(balance,balance/remaining)),due=round(interest+principal);
 const budget=mode==='interest-only'?interest:mode==='partial-principal'?round(interest+principal/2):0;
 e.g.personalCash=budget;
 e.g.week+=1;
 const rows=modules.realEstateMortgageRefinancing.processWeek(e),row=rows.find(x=>x.propertyID===p.id);
 assert.ok(row,'weekly service recorded');
 const res={case:'CAND-P4-010',mode,openingPrincipal:balance,closingPrincipal:p.mortgageBalance,scheduledInterest:interest,scheduledPrincipal:principal,amountDue:due,amountPaid:round(budget-e.g.personalCash),recordedUnpaid:row.unpaid,oldRemainingWeeks:remaining,newRemainingWeeks:p.mortgageRemainingWeeks,unpaidInterestCarried:('mortgageUnpaidInterest' in p)?p.mortgageUnpaidInterest:null,delinquentWeeks:('mortgageDelinquentWeeks' in p)?p.mortgageDelinquentWeeks:null};
 console.log(JSON.stringify(res));
 assert.equal(res.newRemainingWeeks,remaining-1,'term decreases even with shortfall');
 assert.ok(row.unpaid>0,'payment is short');
 if(mode==='interest-only')assert.equal(p.mortgageBalance,balance,'no principal amortized');
 if(mode==='none')assert.equal(p.mortgageBalance,balance,'no principal amortized without cash');
 assert.equal(res.unpaidInterestCarried,null,'no explicit accrued-interest liability');
}
function pastMaturity(){
 const {e,p,modules}=fixture('personal');
 assert.ok(e.refinancePropertyMortgage(p.id,'fixed'));
 const before=p.mortgageBalance;
 e.g.personalCash=0;
 for(let i=0;i<modules.realEstateMortgageRefinancing.PRODUCTS.fixed.termWeeks;i++){e.g.week+=1;modules.realEstateMortgageRefinancing.processWeek(e);}
 const rec={case:'CAND-P4-010',mode:'maturity-no-cash',openingPrincipal:before,closingPrincipal:p.mortgageBalance,remainingWeeks:p.mortgageRemainingWeeks,recordedUnpaidRows:e.g.propertyMortgageHistory.filter(x=>x.type==='mortgage-payment').length,delinquentWeeks:('mortgageDelinquentWeeks' in p)?p.mortgageDelinquentWeeks:null};
 console.log(JSON.stringify(rec));
 assert.equal(p.mortgageRemainingWeeks,0);
 assert.equal(p.mortgageBalance,before,'outstanding debt survives nominal maturity');
}
for(const owner of ['company','personal'])for(const reverse of [false,true])collateral(owner,reverse);
for(const mode of ['interest-only','partial-principal','none'])underpayment(mode);
pastMaturity();
console.log('P4 CAND-009/010 Node AUDIT ORACLE: REPRODUCED defects; NOT PRODUCT GREEN');
