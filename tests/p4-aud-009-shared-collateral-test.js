'use strict';
// P4-AUD-009 (#1078): a property must not back a specialist loan and a mortgage beyond the combined LTV cap.
// Specialist loans (real-estate-complete-cycle.js) count the mortgage balance toward their LTV, and a mortgage
// (real-estate-mortgage-refinancing.js), which draws to its product's full LTV, is refused while a specialist
// loan is outstanding on the same property. Both owners, both orders; a refused request changes nothing.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function fixture(owner) {
  const s = loadGame({ headless: true, random: lcg(83951617) });
  const e = new s.engineModule.TycoonEngine(s.engineModule.createInitialState({ configured: true }));
  Object.assign(e.g, { configured: true, week: 10, companyCash: 100_000_000, personalCash: 100_000_000, companyDebt: 0, personalDebt: 0 });
  e.g.properties = [{ ...e.g.properties[0], id: 'P4-SHARED', name: 'Shared Collateral Building', owner, marketValue: 300_000_000, value: 300_000_000, purchasePrice: 300_000_000, realEstate: { monthlyRent: 8_000_000, occupancyRate: 1, expenseRatio: .2 } }];
  s.modules.realEstate.ensure(e.g);
  e.g.finance = s.modules.finance.defaultFinanceState(e.g);
  s.modules.finance.ensureFinance(e.g);
  s.modules.simulationRng.reseed(e.g, 83951617);
  e.normalize();
  return { e, p: e.g.properties[0], finance: s.modules.finance };
}
const snapshot = g => JSON.stringify({ companyCash: g.companyCash, personalCash: g.personalCash, companyDebt: g.companyDebt, personalDebt: g.personalDebt, loans: g.realEstateMarket.loans, mortgage: g.properties[0].mortgageBalance, rows: g.finance.transactions.length });
const marketDebt = (g, id) => g.realEstateMarket.loans.filter(l => l.propertyID === id && l.status === 'active').reduce((a, l) => a + l.balance, 0);

for (const owner of ['company', 'personal']) {
  const maxSpecialistLTV = owner === 'personal' ? .7 : .75;

  // Mortgage first: the specialist quote sees the mortgage and the loan is refused.
  {
    const { e, p, finance } = fixture(owner);
    assert.ok(e.refinancePropertyMortgage(p.id, 'fixed'), `${owner}: mortgage on unencumbered property`);
    assert.equal(p.mortgageBalance, 195_000_000);
    const quote = e.getRealEstateFinanceQuote(p.id, 40_000_000, { rateType: 'fixed', termWeeks: 260 });
    assert.equal(quote.existingDebt, 195_000_000, `${owner}: quote counts the mortgage`);
    assert.equal(quote.approved, false, `${owner}: combined LTV ${quote.ltv} exceeds ${maxSpecialistLTV}`);
    const before = snapshot(e.g);
    assert.equal(Boolean(e.borrowAgainstProperty(p.id, 40_000_000, { rateType: 'fixed', termWeeks: 260 })), false);
    assert.equal(snapshot(e.g), before, `${owner}: refused specialist loan changes nothing`);
    // A loan that still fits under the cap with the mortgage is approved.
    const room = Math.floor(300_000_000 * maxSpecialistLTV - 195_000_000);
    const fits = e.getRealEstateFinanceQuote(p.id, room, { rateType: 'fixed', termWeeks: 260 });
    assert.ok(fits.ltv <= maxSpecialistLTV, `${owner}: ${room} fits under the combined cap`);
    if (owner === 'company') assert.ok(finance.validate(JSON.parse(JSON.stringify(e.g))).ok);
  }

  // Specialist first: the mortgage is refused while the loan is outstanding, and allowed again once it is repaid.
  {
    const { e, p } = fixture(owner);
    assert.ok(e.borrowAgainstProperty(p.id, 40_000_000, { rateType: 'fixed', termWeeks: 260 }), `${owner}: specialist loan`);
    const products = e.getPropertyMortgageProducts(p.id);
    assert.ok(products.every(x => x.refinanceEligible === false && /不動産担保融資/.test(x.refinanceReason)), `${owner}: products explain the refusal`);
    const before = snapshot(e.g);
    assert.equal(e.refinancePropertyMortgage(p.id, 'fixed'), false, `${owner}: mortgage refused on shared collateral`);
    assert.equal(snapshot(e.g), before, `${owner}: refused mortgage changes nothing`);
    const combined = (marketDebt(e.g, p.id) + (p.mortgageBalance || 0)) / 300_000_000;
    assert.ok(combined <= maxSpecialistLTV, `${owner}: combined LTV ${combined} stays within the cap`);
    const loan = e.g.realEstateMarket.loans.find(l => l.propertyID === p.id && l.status === 'active');
    assert.ok(e.prepayRealEstateLoan(loan.id, loan.balance), `${owner}: repay the specialist loan`);
    e.g.week += 1;
    assert.ok(e.refinancePropertyMortgage(p.id, 'fixed'), `${owner}: mortgage allowed once the collateral is free`);
  }
}
console.log('P4-AUD-009 shared collateral combined LTV tests passed');
