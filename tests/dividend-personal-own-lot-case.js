'use strict';
// G10: own-company shares the founder bought personally (personalStocks[ticker]) receive the dividend with the
// original founder shares; before this fix their share of the gross went to the external leg. Required by
// phase2-dividend-reconciliation-test.js. Pins are literal, not derived from the receipt under test.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function week(lot) {
  let x = 5;
  const s = loadGame({ headless: true, random: () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; } });
  const e = new s.engineModule.TycoonEngine();
  e.configure({ playerName: 'T', companyName: 'Co', difficulty: 'normal', scenario: 'free', simulationSeed: 9 });
  const g = e.g;
  Object.assign(g, { publicCompany: true, sharesOut: 100000, treasuryBuybackShares: 0, founderShares: 60000, dividendPerShare: 10, personalCash: 1e9 });
  e.updateOwnershipRatios();
  if (lot !== undefined) g.personalStocks[g.ticker] = lot;
  while (g.week % 13 !== 12) g.week++;
  const cash = g.personalCash, held = JSON.stringify(g.personalStocks[g.ticker] ?? null);
  e.advanceWeek(false);
  const row = g.finance.transactions.filter(t => t.category === 'dividend').at(-1).dividendDistribution;
  return { delta: g.personalCash - cash, founderRatio: row.founderRatio, gross: row.gross, net: row.personalNet, external: row.externalGross,
    voting: g.founderOwnershipRatio, valid: s.modules.finance.validate(g).ok, heldAfter: JSON.stringify(g.personalStocks[g.ticker] ?? null), held };
}

function run() {
  // Gross ¥1,000,000 = ¥10 × 100,000 outstanding; net = ceil(gross share × 0.797).
  const base = week(undefined);
  assert.deepEqual([base.gross, base.founderRatio, base.net, base.external, base.delta], [1000000, .6, 478200, 400000, 478200]);
  const bought = week({ qty: 10000, avg: 100 });
  assert.deepEqual([bought.gross, bought.founderRatio, bought.net, bought.external, bought.delta], [1000000, .7, 557900, 300000, 557900],
    'the 10,000 bought shares receive their ¥100,000 gross (¥79,700 net) instead of the external leg');
  assert.equal(bought.voting, .6, 'governance ratio (founderShares only) unchanged');
  assert.equal(bought.heldAfter, bought.held, 'the lot itself is not moved');
  assert.ok(base.valid && bought.valid, 'books and dividend receipt reconcile');
  // Malformed or empty lots contribute nothing.
  for (const lot of [{ qty: 0, avg: 1 }, { qty: -5, avg: 1 }, { qty: NaN, avg: 1 }, { qty: '100', avg: 1 }]) {
    const r = week(lot);
    assert.deepEqual([r.founderRatio, r.net, r.external], [.6, 478200, 400000], `ignored lot ${JSON.stringify(lot)}`);
  }
  // The entitlement never exceeds the outstanding count.
  const over = week({ qty: 50000, avg: 100 });
  assert.deepEqual([over.founderRatio, over.net, over.external], [1, 797000, 0]);
  assert.equal(over.valid, true);
}
module.exports = { run };
