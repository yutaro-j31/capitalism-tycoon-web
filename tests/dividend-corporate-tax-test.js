'use strict';

// Issue #736 (P1-03): the base weekly accounting added the quarterly dividend to expenses before
// accumulating taxable profit, so paying a dividend lowered corporate tax (and raised the reported
// net income by the same amount once the tax fell). shareholder-returns.js tried to undo it by
// comparing one week's pretax profit with the quarter's tax, which never matched over a normal
// 13-week quarter (corporateTaxCorrection stayed 0). Dividends are equity distributions: corporate
// tax and net income must not depend on them. Runs against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

// A profitable listed company: four ramen stores plus a rented property, identical in every game.
function makePublicCompany() {
  const loaded = loadGame({ headless: true, random: lcg(736) });
  const { engine, finance } = loaded.modules;
  const e = new engine.TycoonEngine();
  e.configure({ playerName: 'Dividend', companyName: 'Dividend Co', difficulty: 'normal' });
  const s = e.g;
  s.companyCash = 500_000_000;
  s.publicCompany = true; s.sharesOut = 1_000_000; s.founderShares = 600_000; s.treasuryBuybackShares = 0;
  s.stockPrice = 100; s.ticker = 'CPTY';
  s.market = s.market.filter(x => x.id !== 'CPTY');
  s.market.push({ id: 'CPTY', name: s.companyName, sector: 'コングロマリット', price: 100, previous: 100, dividendYield: 0, volatility: 0, trend: 0, marketCap: 1e8, per: 20, pbr: 2, issuedShares: 1_000_000, dividendPerShare: 0, shareholders: {}, description: 'test', listingMarket: '東証グロース', priceHistory: [{ week: 1, price: 100 }] });
  s.finance = finance.defaultFinanceState(s);
  for (let i = 0; i < 4; i++) {
    const tenant = s.tenants.find(t => !t.occupiedBy);
    assert.equal(e.openStore({ tenantID: tenant.id, businessID: 'ramen', name: `${i + 1}号店`, operatingHours: 3 }), true);
  }
  const land = s.properties.find(p => !p.owner && p.price < 300_000_000);
  assert.equal(e.buyProperty(land.id, 'company'), true);
  land.rentIncome = 3_000_000; land.rentMultiplier = 1; land.vacancyRate = 0;
  return { e, finance };
}

const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
const taxExpense = (g, from, to) => g.finance.transactions.filter(t => t.category === 'taxExpense' && t.week > from && t.week <= to).reduce((a, t) => a + t.amount, 0);
const round2 = v => Math.round(v * 100) / 100;

const noDividend = makePublicCompany(), withDividend = makePublicCompany();
// Quarter 1 (weeks 1..13) lets the stores open; quarter 2 (weeks 14..26) is measured.
while (noDividend.e.g.week < 13) { noDividend.e.advanceWeek(false); withDividend.e.advanceWeek(false); }
assert.equal(withDividend.e.setDividend(20), true);
const cashA = noDividend.e.g.companyCash, cashB = withDividend.e.g.companyCash;
while (noDividend.e.g.week < 26) {
  assert.notEqual(noDividend.e.advanceWeek(false), false);
  assert.notEqual(withDividend.e.advanceWeek(false), false);
}
const quarter = g => g.reports.filter(r => r.week > 13 && r.week <= 26);
const qa = quarter(noDividend.e.g), qb = quarter(withDividend.e.g);
assert.equal(qa.length, 13); assert.equal(qb.length, 13);
const paid = sum(qb, 'dividend');
assert.equal(paid, 20_000_000, 'fixture: the full declared dividend is paid');
assert.ok(sum(qa, 'tax') > 0, 'fixture: the quarter is profitable and taxed');

assert.equal(round2(sum(qb, 'tax')), round2(sum(qa, 'tax')), 'corporate tax (report) is unchanged by the dividend');
assert.equal(round2(taxExpense(withDividend.e.g, 13, 26)), round2(taxExpense(noDividend.e.g, 13, 26)), 'corporate tax (ledger) is unchanged by the dividend');
assert.equal(round2(sum(qb, 'profit')), round2(sum(qa, 'profit')), 'net income is unchanged by the dividend');
assert.equal(round2((noDividend.e.g.companyCash - cashA) - (withDividend.e.g.companyCash - cashB)), round2(paid), 'cash differs by exactly the dividend paid');
const payment = withDividend.e.g.finance.transactions.find(t => t.category === 'dividend' && t.week === 26);
assert.ok(payment && payment.cashEffect === -paid && payment.profitEffect === 0, 'the dividend is a financing cash outflow with no P&L effect');
for (const [label, x] of [['no dividend', noDividend], ['with dividend', withDividend]]) {
  const v = x.finance.validate(x.e.g);
  assert.equal(v.ok, true, `${label}: ${v.errors.join(' / ')}`);
}

console.log('dividend corporate tax tests passed');
