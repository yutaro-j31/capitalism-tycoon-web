'use strict';

// Issue #733 (P0-08): company property tax corrupted the books and could be charged twice.
// - real-estate-development.js posted taxExpense WITH a cash effect: finance.js treats
//   taxExpense as "accrued tax +" and leaves it out of the weekly CF snapshot, so the balance
//   sheet and the cash flow drifted by the tax every week.
// - selecting a regime in real-estate-property-taxes.js added a second, unregistered accrual.
// - with negative cash, Math.min(cash, tax) went negative and lifted cash to zero.
// There is now one weekly tax (taxExpense + taxPayment); a regime only selects its rate.
// Runs against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newGame(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Tax', companyName: 'Tax Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = 2_000_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  const land = engine.g.properties.find(p => !p.owner && p.kind === '土地' && p.price < 300_000_000);
  assert.ok(land, 'fixture needs an unowned plot of land');
  return { engine, finance, modules: loaded.modules, land };
}

function assertValid(finance, g, label) {
  const v = finance.validate(g);
  assert.equal(v.ok, true, `${label}: ${v.errors.join(' / ')}`);
}

function taxRows(g, propertyID, week) {
  return g.finance.transactions.filter(t => t.week === week && t.sourceID === propertyID && /tax/i.test(`${t.sourceType} ${t.category}`));
}

// 1. Company property, no regime: one expense + one payment per week, books stay balanced.
{
  const { engine, finance, modules, land } = newGame(733);
  const dev = modules.realEstateDevelopment;
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  assertValid(finance, engine.g, 'after purchase');
  const accruedBefore = engine.g.finance.balances.accruedTaxes;
  for (let i = 0; i < 4; i++) {
    assert.notEqual(engine.advanceWeek(false), false);
    const week = engine.g.week;
    const expected = dev.weeklyPropertyTax(land);
    assert.ok(expected > 0);
    const rows = taxRows(engine.g, land.id, week);
    assert.equal(JSON.stringify(rows.map(t => t.category).sort()), JSON.stringify(['taxExpense', 'taxPayment']), `week ${week}: exactly one tax obligation`);
    const expense = rows.find(t => t.category === 'taxExpense'), payment = rows.find(t => t.category === 'taxPayment');
    assert.equal(expense.amount, expected);
    assert.equal(expense.cashEffect, 0);
    assert.equal(payment.amount, expected);
    assert.equal(payment.cashEffect, -expected);
    assert.equal(engine.g.finance.balances.accruedTaxes, accruedBefore, `week ${week}: accrued tax rolls forward to zero net`);
    assertValid(finance, engine.g, `week ${week}`);
  }
  assert.equal(dev.propertyTaxRate(land), dev.DEFAULT_PROPERTY_TAX_RATE);
}

// 2. A selected regime replaces the rate; no second accrual; UI and dashboard show the real tax.
{
  const { engine, finance, modules, land } = newGame(734);
  const dev = modules.realEstateDevelopment;
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  // Market value above book: the tax is levied on the book basis, and every displayed figure
  // must follow the tax actually charged rather than a market-value estimate.
  land.marketValue = Math.round(dev.propertyTaxBasis(land) * 1.5);
  assert.equal(engine.setPropertyTaxRegime(land.id, 'urban'), true);
  assert.notEqual(engine.advanceWeek(false), false);
  const week = engine.g.week;
  const urban = modules.realEstatePropertyTaxes.REGIMES.urban.annualRate;
  const expected = Math.round(dev.propertyTaxBasis(land) * urban / 52 * 100) / 100;
  const rows = taxRows(engine.g, land.id, week);
  assert.equal(JSON.stringify(rows.map(t => t.category).sort()), JSON.stringify(['taxExpense', 'taxPayment']), 'regime must not add a second tax');
  assert.equal(rows.find(t => t.category === 'taxPayment').amount, expected);
  assert.equal(land.propertyTaxAccrued, 0, 'no second accrual');
  assert.equal(engine.g.finance.transactions.some(t => t.sourceType === 'property-tax-accrual'), false);
  assertValid(finance, engine.g, 'regime week');

  const shown = engine.getPropertyTaxRegimes(land.id).find(r => r.id === 'urban');
  assert.equal(shown.weeklyAccrual, expected, 'regime button shows the tax actually charged');
  // The dashboard's NOI subtracts the annual tax; switching regime must move NOI by exactly the
  // change in the tax actually charged (basis x regime rate), not by a market-value estimate.
  const noiOf = () => engine.getRealEstatePortfolio({ owner: 'company', sort: 'value' }).rows.find(r => r.propertyID === land.id).noi;
  const urbanTax = dev.annualPropertyTax(land), urbanNoi = noiOf();
  assert.equal(urbanTax, Math.round(dev.propertyTaxBasis(land) * urban * 100) / 100);
  assert.equal(engine.setPropertyTaxRegime(land.id, 'standard'), true);
  const standardTax = dev.annualPropertyTax(land), standardNoi = noiOf();
  assert.equal(Math.round((standardNoi - urbanNoi) * 100) / 100, Math.round((urbanTax - standardTax) * 100) / 100, 'dashboard NOI uses the real tax');
  land.propertyTaxRegimeID = '';
  const defaultTax = dev.annualPropertyTax(land), defaultNoi = noiOf();
  assert.equal(defaultTax, Math.round(dev.propertyTaxBasis(land) * dev.DEFAULT_PROPERTY_TAX_RATE * 100) / 100);
  assert.equal(Math.round((defaultNoi - standardNoi) * 100) / 100, Math.round((standardTax - defaultTax) * 100) / 100, 'no regime: dashboard uses the 1.2% actually charged');
}

// 3. Overdrawn company: the tax is not paid and cash is not lifted.
{
  const { engine, finance, modules, land } = newGame(735);
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  const drain = engine.g.companyCash + 1_000_000;
  engine.g.companyCash -= drain;
  finance.event(engine.g, 'otherOperating', drain, { cashEffect: -drain, profitEffect: -drain, sourceType: 'test', sourceID: 'overdraw' });
  const before = engine.g.companyCash;
  modules.realEstateDevelopment.processWeek(engine);
  assert.equal(engine.g.companyCash, before, 'negative cash must stay where it was');
  assert.equal(taxRows(engine.g, land.id, engine.g.week).length, 0);
  assertValid(finance, engine.g, 'overdrawn week');
}

// 4. Personal property: personal cash pays, company books untouched.
{
  const { engine, finance, modules, land } = newGame(736);
  engine.g.personalCash = 500_000_000;
  assert.equal(engine.buyProperty(land.id, 'personal'), true);
  const personal = engine.g.personalCash, txCount = engine.g.finance.transactions.filter(t => t.sourceID === land.id).length;
  modules.realEstateDevelopment.processWeek(engine);
  assert.equal(Math.round((personal - engine.g.personalCash) * 100) / 100, modules.realEstateDevelopment.weeklyPropertyTax(land));
  assert.equal(engine.g.finance.transactions.filter(t => t.sourceID === land.id).length, txCount, 'personal tax never reaches the company ledger');
  assertValid(finance, engine.g, 'personal property');
}

// 5. A balance accrued by an older build is still payable and the books close after paying it.
{
  const { engine, finance, land } = newGame(737);
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  // Old-build accrual: expense with no liability (this is what older saves carry).
  land.propertyTaxAccrued = 5000;
  finance.event(engine.g, 'otherOperating', 5000, { cashEffect: 0, profitEffect: -5000, sourceType: 'property-tax-accrual', sourceID: land.id, idempotencyKey: `legacy-accrual-${land.id}` });
  const cash = engine.g.companyCash;
  assert.equal(engine.payPropertyTax(land.id), 5000);
  assert.equal(engine.g.companyCash, cash - 5000);
  assert.equal(land.propertyTaxAccrued, 0);
  assertValid(finance, engine.g, 'legacy balance paid');
}

// 6. Disposal settles without the removed propertyTaxPayable term and records tax:0.
{
  const { engine, land } = newGame(738);
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  const method = engine.getPropertyDisposalMethods(land.id)[0];
  assert.ok(method && !('propertyTaxPayable' in method));
  assert.equal(method.expectedNet, Math.round((method.expectedPrice - method.expectedFee - Number(land.mortgageBalance || 0)) * 100) / 100);
  assert.ok(engine.listPropertyForDisposal(land.id, method.id));
  for (let i = 0; i < 60 && engine.g.properties.some(p => p.id === land.id); i++) assert.notEqual(engine.advanceWeek(false), false);
  const disposed = engine.g.realEstateDevelopment ? JSON.stringify(engine.g).match(/"type":"property-disposed"[^}]*"tax":(\d+)/) : null;
  assert.ok(disposed, 'property must have been disposed');
  assert.equal(Number(disposed[1]), 0);
}

console.log('real estate property tax ledger tests passed');
