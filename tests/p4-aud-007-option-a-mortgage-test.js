'use strict';
// P4-AUD-007 Option A: a company property mortgage originated from a zero balance is on book. It is one
// finance.loans row per property plus companyDebt, every principal movement posts its liability effect, and
// the books validate after every step. A legacy off-book mortgage (no flag) keeps its old behaviour.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const snap = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const UNRELATED = 50_000_000;
const LOAN_ID = 'property-mortgage-P1';

function setup({ cash = 400_000_000, legacy = 0 } = {}) {
  const s = loadGame({ headless: true });
  const { finance } = s.modules;
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: 20, companyCash: cash, personalCash: 10_000_000, companyDebt: 0, personalDebt: 0 });
  const base = g.properties[0];
  g.properties = [
    { ...base, id: 'P1', name: 'Mortgage One', owner: 'company', value: 300_000_000, marketValue: 300_000_000, purchasePrice: 300_000_000,
      realEstate: { ...(base.realEstate || {}), landBookValue: 100_000_000, buildingBookValue: 150_000_000 } }
  ];
  Object.assign(g.properties[0], legacy
    ? { mortgageBalance: legacy, mortgageProductID: 'fixed', mortgageRemainingWeeks: 520 }
    : { mortgageBalance: 0, mortgageProductID: '', mortgageRemainingWeeks: 0 });
  g.finance = finance.defaultFinanceState(g);
  const e = new s.engineModule.TycoonEngine(g);
  return { ...s, e, g: e.g, finance };
}
const p1 = s => s.g.properties.find(p => p.id === 'P1');
const row = s => s.g.finance.loans.find(l => l.loanID === LOAN_ID);
const loanSum = g => g.finance.loans.filter(l => l.status === 'active').reduce((a, l) => a + Number(l.outstandingPrincipal || 0), 0);
function assertBooks(s, label) {
  const v = s.finance.validate(s.g), d = s.finance.debtRollforwardStatus(s.g);
  assert.equal(v.ok, true, `${label}: finance.validate ${v.errors.join(' | ')}`);
  assert.deepEqual(snap(d.checks.filter(c => !c.ok).map(c => c.code)), [], `${label}: debt rollforward`);
  assert.equal(Math.round(loanSum(s.g) * 100), Math.round(s.g.companyDebt * 100), `${label}: companyDebt equals finance.loans`);
}
function assertMirrors(s, label) {
  const p = p1(s), r = row(s);
  assert.ok(r, `${label}: mortgage row exists`);
  assert.equal(r.outstandingPrincipal, p.mortgageBalance, `${label}: row mirrors the property balance`);
  assert.equal(r.sourceType, 'propertyMortgage');
  assert.equal(r.propertyID, 'P1');
}

// 1. Origination: cash +net, debt +gross, fee expensed; the books validate.
{
  const s = setup(), before = { cash: s.g.companyCash, ledger: s.g.finance.transactions.length };
  const res = s.e.refinancePropertyMortgage('P1', 'fixed');
  assert.ok(res, 'origination accepted');
  const gross = res.newBalance, fee = res.fee;
  assert.equal(p1(s).mortgageAccountingTracked, true, 'new company mortgage is on book');
  assert.equal(s.g.companyDebt, gross, 'companyDebt carries the gross principal');
  assert.equal(s.g.companyCash - before.cash, res.netProceeds, 'cash rises by the net proceeds');
  assertMirrors(s, 'origination');
  assert.equal(row(s).principal, gross);
  assert.equal(row(s).weeklyPrincipalPayment, Math.round(gross / 520 * 100) / 100, 'scheduled principal recorded');
  const rows = s.g.finance.transactions.slice(before.ledger);
  const borrowing = rows.find(r => r.category === 'debtBorrowing');
  assert.equal(borrowing.liabilityEffect, gross, 'borrowing row recognises the gross liability');
  assert.equal(rows.reduce((a, r) => a + r.cashEffect, 0), res.netProceeds, 'ledger cash equals cash movement');
  assert.equal(rows.reduce((a, r) => a + (r.profitEffect || 0), 0), -fee, 'only the fee hits profit');
  assertBooks(s, 'origination');
}

// 2. Weekly service, generic interest suppression, and the 13-week forecast.
{
  const s = setup();
  assert.equal(s.e.borrow(UNRELATED, 'company'), true, 'unrelated bank loan');
  s.e.refinancePropertyMortgage('P1', 'fixed');
  const serviced = s.finance.individuallyServicedPrincipal ? s.finance.individuallyServicedPrincipal(s.g) : null;
  if (serviced !== null) assert.equal(serviced >= p1(s).mortgageBalance, true, 'mortgage is individually serviced');
  // The forecast reserves a principal payment in every one of the 13 weeks, as processWeek will charge it.
  const forecast = s.finance.buildStatements(s.g, '13').forecast.rows;
  assert.equal(forecast.length, 13);
  for (const [i, w] of forecast.entries()) assert.ok(w.debtRepayment >= p1(s).mortgageBalance / 520 - 1, `forecast week ${i + 1} carries mortgage principal`);
  for (let i = 0; i < 4; i++) {
    const balance = p1(s).mortgageBalance, debt = s.g.companyDebt;
    assert.notEqual(s.e.advanceWeek(false), false, `week ${i + 1}`);
    const paid = Math.round((balance - p1(s).mortgageBalance) * 100) / 100;
    assert.ok(paid > 0, 'principal amortises');
    assert.equal(Math.round((debt - s.g.companyDebt) * 100) / 100 >= paid - 0.01, true, 'companyDebt falls with the mortgage');
    assertMirrors(s, `week ${i + 1}`);
    assertBooks(s, `week ${i + 1}`);
  }
  assert.ok(s.g.companyDebt >= UNRELATED - 1, 'unrelated loan untouched by mortgage service');
  assert.equal(p1(s).mortgageDelinquentWeeks, 0);
}

// 3. Prepayment and generic repayment both move the mortgage, its row and companyDebt together.
{
  const s = setup();
  s.e.refinancePropertyMortgage('P1', 'fixed');
  s.g.week++;
  const before = p1(s).mortgageBalance, debt = s.g.companyDebt;
  assert.equal(s.e.prepayPropertyMortgage('P1', 10_000_000), 10_000_000);
  assert.equal(p1(s).mortgageBalance, before - 10_000_000);
  assert.equal(s.g.companyDebt, debt - 10_000_000);
  assertMirrors(s, 'prepayment');
  assertBooks(s, 'prepayment');
  // Generic repayment (#990 hook): the mortgage is the only company loan, so it absorbs the repayment.
  const b2 = p1(s).mortgageBalance;
  assert.equal(s.e.repay(5_000_000, 'company'), true, 'generic repayment');
  assert.equal(p1(s).mortgageBalance, b2 - 5_000_000, 'generic repayment reaches the property balance');
  assertMirrors(s, 'generic repayment');
  assertBooks(s, 'generic repayment');
  assert.notEqual(s.e.advanceWeek(false), false);
  assertMirrors(s, 'after generic repayment week');
  assertBooks(s, 'after generic repayment week');
}

// 4. Unpaid interest is capitalised, never dropped, and delinquency is counted (Q6).
{
  const s = setup();
  s.e.refinancePropertyMortgage('P1', 'fixed');
  // The shortfall is staged by emptying cash outside the ledger, so the balance-sheet difference that this
  // creates must be exactly unchanged by the capitalisation, and the debt rollforward must stay clean.
  s.g.companyCash = 0;
  const bsDiff = () => s.finance.buildStatements(s.g, '52').balanceSheet.balanceDifference;
  const balance = p1(s).mortgageBalance, debt = s.g.companyDebt, interest = Math.round(balance * 0.032 / 52 * 100) / 100;
  s.e.g.week++;
  const diffBefore = bsDiff(), ledger = s.g.finance.transactions.length;
  s.modules.realEstateMortgageRefinancing.processWeek(s.e);
  assert.equal(p1(s).mortgageBalance, Math.round((balance + interest) * 100) / 100, 'unpaid interest joins principal');
  assert.equal(s.g.companyDebt, Math.round((debt + interest) * 100) / 100, 'companyDebt carries the capitalised interest');
  assert.equal(p1(s).mortgageDelinquentWeeks, 1, 'delinquency counted');
  assert.equal(Math.round(bsDiff() * 100), Math.round(diffBefore * 100), 'capitalisation keeps the balance sheet balanced');
  const rows = s.g.finance.transactions.slice(ledger);
  assert.equal(rows.reduce((a, r) => a + r.cashEffect, 0), 0, 'no cash moves');
  assert.equal(rows.reduce((a, r) => a + (r.profitEffect || 0), 0), -interest, 'the unpaid interest is expensed');
  assert.equal(rows.reduce((a, r) => a + (r.liabilityEffect || 0), 0), interest, 'and recognised as debt');
  assertMirrors(s, 'capitalised interest');
  const d = s.finance.debtRollforwardStatus(s.g);
  assert.deepEqual(snap(d.checks.filter(c => !c.ok).map(c => c.code)), [], 'debt rollforward after capitalisation');
}

// 5. Sale settles the on-book mortgage once and keeps an unrelated loan's debt.
{
  const s = setup();
  assert.equal(s.e.borrow(UNRELATED, 'company'), true);
  s.e.refinancePropertyMortgage('P1', 'fixed');
  const mortgage = p1(s).mortgageBalance, cashBefore = s.g.companyCash, gross = Math.round(300_000_000 * 0.97 * 100) / 100;
  assert.equal(s.e.sellProperty('P1'), true, 'sale accepted');
  assert.equal(s.g.companyCash - cashBefore, gross - mortgage, 'cash: proceeds less the payoff');
  assert.equal(row(s).status, 'repaid');
  assert.equal(p1(s).mortgageBalance, 0);
  assert.equal(p1(s).mortgageAccountingTracked, undefined, 'flag cleared with the payoff');
  assert.equal(Math.round(s.g.companyDebt), UNRELATED, 'only the unrelated loan remains');
  assertBooks(s, 'sale');
}

// 6. A legacy off-book mortgage keeps its old behaviour: no row, no companyDebt, no flag after refinancing.
{
  const s = setup({ legacy: 150_000_000 });
  s.g.finance = s.finance.defaultFinanceState(s.g); // S2-like legacy ledger
  const res = s.e.refinancePropertyMortgage('P1', 'fixed');
  assert.ok(res, 'legacy refinance still accepted');
  assert.equal(p1(s).mortgageAccountingTracked, undefined, 'legacy mortgage stays off book');
  assert.equal(row(s), undefined, 'no finance row for a legacy mortgage');
  assert.equal(s.g.companyDebt, 0);
}

// 7. Determinism and save round trip.
{
  const run = () => { const s = setup(); s.e.refinancePropertyMortgage('P1', 'fixed'); for (let i = 0; i < 3; i++) s.e.advanceWeek(false); return s; };
  const a = run(), b = run();
  assert.deepEqual(snap(row(a)), snap(row(b)), 'same inputs, same mortgage row');
  assert.equal(a.g.companyDebt, b.g.companyDebt);
  const reloaded = JSON.parse(JSON.stringify(a.g));
  const e2 = new a.engineModule.TycoonEngine(reloaded);
  assert.equal(e2.g.properties.find(p => p.id === 'P1').mortgageAccountingTracked, true, 'flag survives a reload');
  assert.equal(e2.g.saveVersion, 9);
  assert.deepEqual(snap(e2.g.finance.loans.find(l => l.loanID === LOAN_ID)), snap(row(a)));
}

console.log('PASS P4-AUD-007 Option A: on-book company mortgage origination, service, prepayment, generic repayment, capitalised interest, sale, legacy and reload');
