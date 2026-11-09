'use strict';
// G10: own-company shares the founder bought personally (personalStocks[ticker]) receive the dividend with the
// original founder shares. The entitlement is the P3-2 founder beneficial quantity from
// economicReadModel.ownershipReconciliation, so the dividend and the read model never disagree (review F2). When the
// reconciliation rejects the evidence, the founder leg stays at the pre-G10 founderOwnershipRatio and the quarter is
// still paid (review F1, Owner decision 2026-11-04, Option C). Required by phase2-dividend-reconciliation-test.js.
// Pins are literal. The reload check below is a JSON round-trip into TycoonEngine only; real v9 persistence,
// IndexedDB and fresh browser hydration are covered by the existing dividend-payment atomicity suites, not here.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function boot() {
  let x = 5;
  return loadGame({ headless: true, random: () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; } });
}
function synthetic(lot, extra = {}) {
  const s = boot(), e = new s.engineModule.TycoonEngine();
  e.configure({ playerName: 'T', companyName: 'Co', difficulty: 'normal', scenario: 'free', simulationSeed: 9 });
  const g = e.g;
  Object.assign(g, { publicCompany: true, sharesOut: 100000, treasuryBuybackShares: 0, founderShares: 60000, dividendPerShare: 10, personalCash: 1e9, ...extra });
  e.updateOwnershipRatios();
  if (lot !== undefined) g.personalStocks[g.ticker] = lot;
  return { s, e, g };
}
function payWeek({ s, e, g }) {
  while (g.week % 13 !== 12) g.week++;
  const cash = g.personalCash, held = JSON.stringify(g.personalStocks[g.ticker] ?? null), founderShares = g.founderShares;
  e.advanceWeek(false);
  const row = g.finance.transactions.filter(t => t.category === 'dividend').at(-1).dividendDistribution;
  assert.equal(JSON.stringify(g.personalStocks[g.ticker] ?? null), held, 'the lot is not moved by the payment');
  assert.equal(g.founderShares, founderShares, 'founder shares are not moved by the payment');
  return { delta: g.personalCash - cash, founderRatio: row.founderRatio, gross: row.gross, net: row.personalNet, external: row.externalGross,
    voting: g.founderOwnershipRatio, valid: s.modules.finance.validate(g).ok };
}

function syntheticCases() {
  // Gross ¥1,000,000 = ¥10 × 100,000 outstanding; founder net = ceil(founder gross × 0.797).
  const base = payWeek(synthetic(undefined));
  assert.deepEqual([base.gross, base.founderRatio, base.net, base.external, base.delta], [1000000, .6, 478200, 400000, 478200]);
  const bought = payWeek(synthetic({ qty: 10000, avg: 100 }));
  assert.deepEqual([bought.gross, bought.founderRatio, bought.net, bought.external, bought.delta], [1000000, .7, 557900, 300000, 557900],
    'the 10,000 bought shares receive their ¥100,000 gross (¥79,700 net) instead of the external leg');
  assert.equal(bought.voting, .6, 'governance ratio (founderShares only) unchanged');
  assert.ok(base.valid && bought.valid, 'books and dividend receipt reconcile');
  // Treasury shares are outside the entitlement denominator: 70,000 / 95,000 of a ¥950,000 gross.
  const treasury = payWeek(synthetic({ qty: 10000, avg: 100 }, { treasuryBuybackShares: 5000 }));
  assert.deepEqual([treasury.gross, treasury.founderRatio, treasury.net, treasury.external], [950000, 70000 / 95000, 557900, 250000]);
  assert.equal(treasury.valid, true);
  // An empty lot is a valid zero; the reconciliation accepts it.
  const zero = payWeek(synthetic({ qty: 0, avg: 0 }));
  assert.deepEqual([zero.founderRatio, zero.net, zero.external], [.6, 478200, 400000]);
  // Evidence the P3-2 reconciliation rejects never creates an entitlement: over-allocation (110,000 of 100,000),
  // and malformed lots (string, empty string, NaN, negative, array). The founder leg stays at the pre-G10 ratio.
  for (const lot of [{ qty: 50000, avg: 100 }, { qty: '100', avg: 1 }, { qty: '', avg: 1 }, { qty: NaN, avg: 1 }, { qty: -5, avg: 1 }, []]) {
    const ctx = synthetic(lot);
    assert.equal(ctx.s.modules.economicReadModel.ownershipReconciliation(ctx.g).ok, false, `reconciliation rejects ${JSON.stringify(lot)}`);
    const r = payWeek(ctx);
    assert.deepEqual([r.founderRatio, r.net, r.external], [.6, 478200, 400000], `no inferred entitlement for ${JSON.stringify(lot)}`);
    assert.equal(r.valid, true);
  }
}

// F3/F5: the installed writers keep founderShares and the bought lot disjoint, and the entitlement follows them.
function lifecycle() {
  const s = boot(), state = s.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 12, companyCash: 100000000, companyDebt: 0, personalCash: 100000000, publicCompany: true, sharesOut: 100000,
    founderShares: 60000, treasuryBuybackShares: 0, competitorOwnedRatio: 0, stockPrice: 100, ticker: 'CPTY', dividendPerShare: 1 });
  state.companyStocks = {}; state.personalStocks = {};
  state.market = state.market.filter(row => row.id !== 'CPTY');
  state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100, previous: 100, issuedShares: 100000,
    marketCap: 10000000, dividendYield: .04, volatility: 0, trend: 0, dividendPerShare: 1, priceHistory: [{ week: 12, price: 100 }] });
  state.finance = s.modules.finance.defaultFinanceState(state);
  const e = new s.engineModule.TycoonEngine(state), g = e.g; e.updateOwnershipRatios();
  const expected = () => (g.founderShares + (g.personalStocks.CPTY?.qty || 0)) / (g.sharesOut - g.treasuryBuybackShares);
  const quarter = label => {
    const want = expected(), r = payWeek({ s, e, g });
    assert.equal(r.founderRatio, want, `${label}: entitlement = (founder + bought) / outstanding`);
    assert.equal(r.valid, true, `${label}: books valid`);
    // JSON round-trip (not real persistence) keeps the same entitlement source.
    const reloaded = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(g)));
    const view = s.modules.economicReadModel.ownershipReconciliation(reloaded.g);
    assert.equal(view.ok, true); assert.equal(view.beneficialHoldings[0].quantity, g.founderShares + (g.personalStocks.CPTY?.qty || 0));
  };
  assert.equal(e.buyStock('CPTY', 2000, 'personal'), true, 'installed own-share purchase');
  assert.equal(g.founderShares, 60000, 'buying does not touch founderShares'); assert.equal(g.personalStocks.CPTY.qty, 2000);
  quarter('after buy');
  assert.equal(e.sellStock('CPTY', 500, 'personal'), true, 'installed own-share sale');
  assert.equal(g.founderShares, 60000, 'selling the bought lot does not touch founderShares'); assert.equal(g.personalStocks.CPTY.qty, 1500);
  quarter('after sell');
  assert.equal(e.sellFounderShares(1000), true, 'installed founder share sale');
  assert.equal(g.founderShares, 59000); assert.equal(g.personalStocks.CPTY.qty, 1500, 'founder sale does not touch the bought lot');
  quarter('after founder sale');
  assert.equal(e.buybackOwnShares(200000), true, 'installed buyback');
  assert.ok(g.treasuryBuybackShares > 0); assert.equal(g.personalStocks.CPTY.qty, 1500); assert.equal(g.founderShares, 59000);
  quarter('after buyback');
  assert.equal(e.stockSplit('CPTY', 2), true, 'installed split');
  assert.equal(g.founderShares, 118000); assert.equal(g.personalStocks.CPTY.qty, 3000, 'split scales both buckets');
  quarter('after split');
}

function run() { syntheticCases(); lifecycle(); }
module.exports = { run };
