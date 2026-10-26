'use strict';
// #1079 foreclosure (Owner decision, 2026-10-27): on top of the arrears model (p4-aud-010-mortgage-shortfall-test.js),
// eight consecutive short weeks foreclose a founder or on-book company mortgage at 85% of the property's value. The
// sale settles unpaid interest, then principal; a surplus goes to the owner and a deficiency stays with the borrower
// (personalDebt for the founder, an on-book loan row for the company). A pre-P4-AUD-007 off-book company mortgage keeps
// counting delinquency without being foreclosed, as its sale is quarantined.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const BALANCE = 195_000_000, INTEREST = 120_000;

function fixture({ owner = 'personal', value = 300_000_000, legacy = false } = {}) {
  let seed = 0x10790101;
  const s = loadGame({ headless: true, random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) });
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: 10, companyCash: 400_000_000, personalCash: 0, companyDebt: 0, personalDebt: 7_000_000 });
  g.properties = [{ ...g.properties[0], id: 'FORECLOSE', name: 'Foreclose One', owner, marketValue: 300_000_000, value: 300_000_000, purchasePrice: 300_000_000,
    mortgageBalance: owner === 'personal' || legacy ? BALANCE : 0, mortgageProductID: owner === 'personal' || legacy ? 'fixed' : '', mortgageRemainingWeeks: owner === 'personal' || legacy ? 520 : 0,
    realEstate: { landBookValue: 100_000_000, buildingBookValue: 200_000_000, landValue: 100_000_000, buildingValue: 200_000_000 } }];
  g.finance = s.modules.finance.defaultFinanceState(g);
  const e = new s.engineModule.TycoonEngine(g);
  const p = () => e.g.properties.find(x => x.id === 'FORECLOSE');
  if (owner === 'company' && !legacy) assert.ok(e.refinancePropertyMortgage('FORECLOSE', 'fixed'), 'an on-book company mortgage');
  // A value change after origination: the 85% sale price follows the current value.
  Object.assign(p(), { marketValue: value, value });
  if (owner === 'company') {
    // Drain company cash through the ledger so the books still reconcile.
    const amount = e.g.companyCash;
    s.modules.finance.event(e.g, 'otherOperating', amount, { cashEffect: -amount, profitEffect: -amount, sourceType: 'foreclosure-fixture', sourceID: 'drain' });
    e.g.companyCash = 0;
  }
  s.modules.finance.rebuildDirtySnapshots(e.g);
  return { ...s, e, g: e.g, p, mortgage: s.modules.realEstateMortgageRefinancing };
}
// As in the game's week, the week's snapshot is closed at that week's balances before the next week starts.
const week = s => { s.g.week++; const rows = s.mortgage.processWeek(s.e); s.modules.finance.rebuildDirtySnapshots(s.g); return rows; };
function books(s, label) {
  const v = s.modules.finance.validate(s.g), d = s.modules.finance.debtRollforwardStatus(s.g);
  assert.equal(v.ok, true, `${label}: finance.validate ${v.errors.join(' | ')}`);
  assert.equal(d.ok, true, `${label}: debt rollforward ${JSON.stringify(Array.from(d.checks.filter(c => !c.ok), c => c.code))}`);
  const loans = s.g.finance.loans.filter(l => l.status === 'active').reduce((a, l) => a + Number(l.outstandingPrincipal || 0), 0);
  assert.equal(loans, s.g.companyDebt, `${label}: companyDebt equals finance.loans`);
}

assert.equal(fixture().mortgage.MAX_DELINQUENT_WEEKS, 8);
assert.equal(fixture().mortgage.FORECLOSURE_SALE_RATE, 0.85);

// 1. Founder mortgage, surplus: the sale settles arrears and principal; the rest is the founder's cash.
{
  const s = fixture();
  const notes = [];
  s.e.notify = (message, severity) => notes.push({ message, severity });
  for (let i = 1; i < 8; i++) {
    assert.equal(week(s).some(r => r.type === 'mortgage-foreclosure'), false, `week ${i}: not yet foreclosed`);
    assert.equal(s.p().owner, 'personal');
  }
  assert.equal(notes.filter(n => n.severity === 'warning').length, 1, 'one warning two weeks before foreclosure');
  assert.match(notes[0].message, /あと2週/);
  const owed = s.p().mortgageBalance + s.p().mortgageUnpaidInterest + INTEREST; // the 8th week adds one more charge
  const rows = week(s), foreclosure = rows.find(r => r.type === 'mortgage-foreclosure');
  assert.ok(foreclosure, 'the 8th consecutive short week forecloses');
  assert.equal(foreclosure.salePrice, 255_000_000, '85% of value');
  assert.equal(foreclosure.mortgagePaid, owed, 'principal plus unpaid interest');
  assert.equal(foreclosure.deficiency, 0);
  assert.equal(s.g.personalCash, 255_000_000 - owed, 'the surplus goes to the founder');
  assert.equal(s.g.personalDebt, 7_000_000, 'unrelated personal debt is untouched');
  assert.equal(s.p().owner, null);
  assert.equal(s.p().mortgageBalance, 0);
  assert.equal(s.p().mortgageUnpaidInterest, 0);
  assert.equal(s.g.companyCash, 400_000_000, 'company cash is untouched by a founder foreclosure');
  assert.equal(notes.filter(n => n.severity === 'error').length, 1, 'the foreclosure is notified');
  assert.equal(week(s).length, 0, 'a foreclosed property has no further mortgage service');
}

// 2. Founder mortgage, deficiency: what the sale does not cover becomes personal debt.
{
  const s = fixture({ value: 200_000_000 });
  for (let i = 0; i < 7; i++) week(s);
  const owed = s.p().mortgageBalance + s.p().mortgageUnpaidInterest + INTEREST;
  const foreclosure = week(s).find(r => r.type === 'mortgage-foreclosure');
  assert.ok(foreclosure);
  assert.equal(foreclosure.salePrice, 170_000_000);
  assert.equal(foreclosure.deficiency, owed - 170_000_000);
  assert.equal(s.g.personalDebt, 7_000_000 + foreclosure.deficiency, 'the deficiency follows the founder');
  assert.equal(s.g.personalCash, 0);
}

// 3. A full payment resets the count, so the clock restarts.
{
  const s = fixture();
  for (let i = 0; i < 7; i++) week(s);
  s.g.personalCash = 10_000_000;
  week(s);
  assert.equal(s.p().mortgageDelinquentWeeks, 0);
  s.g.personalCash = 0;
  for (let i = 0; i < 7; i++) week(s);
  assert.equal(s.p().owner, 'personal', 'seven new short weeks do not foreclose');
}

// 4. On-book company mortgage with a deficiency: carried as an active on-book loan; the books reconcile throughout.
{
  const s = fixture({ owner: 'company', value: 150_000_000 });
  books(s, 'start');
  let foreclosure = null;
  for (let i = 1; i <= 8 && !foreclosure; i++) {
    foreclosure = week(s).find(r => r.type === 'mortgage-foreclosure') || null;
    if (!foreclosure) books(s, `week ${i}`);
  }
  assert.ok(foreclosure, 'foreclosed after eight short weeks');
  assert.equal(foreclosure.salePrice, 127_500_000);
  assert.ok(foreclosure.deficiency > 0);
  const carried = s.g.finance.loans.find(l => l.sourceType === 'propertyMortgageDeficiency');
  assert.ok(carried && carried.status === 'active' && carried.outstandingPrincipal === foreclosure.deficiency, 'deficiency loan row');
  assert.equal(s.g.companyDebt, foreclosure.deficiency, 'only the deficiency remains as company debt');
  assert.equal(s.g.finance.loans.find(l => l.sourceType === 'propertyMortgage').status, 'repaid');
  assert.equal(s.p().owner, null);
  books(s, 'after foreclosure');
}

// 5. On-book company mortgage with a surplus.
{
  const s = fixture({ owner: 'company' });
  for (let i = 0; i < 7; i++) week(s);
  const foreclosure = week(s).find(r => r.type === 'mortgage-foreclosure');
  assert.ok(foreclosure);
  assert.equal(foreclosure.deficiency, 0);
  assert.equal(s.g.companyDebt, 0);
  assert.equal(s.g.companyCash, 255_000_000 - foreclosure.mortgagePaid);
  books(s, 'company surplus');
}

// 6. A pre-P4-AUD-007 off-book company mortgage is never foreclosed.
{
  const s = fixture({ owner: 'company', legacy: true });
  // S1: the historical off-book borrowing gap, in which a voluntary sale of this property would be allowed.
  s.g.companyCash += BALANCE;
  s.modules.finance.event(s.g, 'propertyMortgageProceeds', BALANCE, { cashEffect: BALANCE, profitEffect: 0, liabilityEffect: 0, sourceType: 'property-mortgage', sourceID: 'historical-borrowing' });
  s.modules.finance.rebuildDirtySnapshots(s.g);
  assert.equal(s.modules.realEstatePropertyDisposals.legacyMortgageDisposalBlock(s.g, s.p()), '', 'S1: the sale itself is not quarantined');
  s.g.companyCash -= BALANCE;
  s.modules.finance.event(s.g, 'otherOperating', BALANCE, { cashEffect: -BALANCE, profitEffect: -BALANCE, sourceType: 'foreclosure-fixture', sourceID: 'drain-legacy' });
  s.modules.finance.rebuildDirtySnapshots(s.g);
  for (let i = 0; i < 9; i++) assert.equal(week(s).some(r => r.type === 'mortgage-foreclosure'), false);
  assert.equal(s.p().owner, 'company');
  assert.equal(s.p().mortgageDelinquentWeeks, 9);
}

// 7. Determinism: the same seed forecloses identically.
{
  const run = () => { const s = fixture({ value: 200_000_000 }); for (let i = 0; i < 9; i++) week(s); delete s.g.lastSaveDate; return JSON.stringify(s.g); };
  assert.equal(run(), run());
}

console.log('PASS #1079 mortgage foreclosure: eight short weeks, surplus, deficiency, company books, legacy and determinism');
