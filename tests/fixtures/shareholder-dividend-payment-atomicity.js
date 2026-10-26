'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { indexedDBFor } = require('./pe-fund-acquisition-faults');
const { snapshot, economic } = require('./stock-split-atomicity');
const PINS = Object.freeze({
  normal: Object.freeze({ cash: 100000000, capacity: 95000000, gross: 122223, net: 59038, withholding: 15036.55, external: 48148.45 }),
  capped: Object.freeze({ cash: 5050000, capacity: 50000, gross: 50000, net: 24152, withholding: 6151.03, external: 19696.97 })
});
const PER_SHARE = 1.23456789;
async function fixture(variant = 'normal') {
  assert.ok(Object.hasOwn(PINS, variant), 'known payment variant');
  const durable = new Map(), control = { attempts: [] }, host = { draws: 0 };
  let seed = 7;
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control), random: () => {
    host.draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32;
  } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY; await backend.hydrate();
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: 12, publicCompany: true, companyCash: PINS[variant].cash, companyDebt: 0, personalCash: 10000000,
    sharesOut: 100000, founderShares: 60000, treasuryBuybackShares: 1000, competitorOwnedRatio: 0, stockPrice: 100.01,
    ticker: 'CPTY', dividendPerShare: PER_SHARE, companyStocks: {}, personalStocks: {} });
  g.market = g.market.filter(row => row.id !== 'CPTY');
  g.market.push({ id: 'CPTY', name: g.companyName, price: 100.01, previous: 100.01, issuedShares: 100000,
    marketCap: 10001000, dividendPerShare: PER_SHARE, dividendYield: PER_SHARE * 4 / 100.01, volatility: 0, trend: 0,
    priceHistory: [{ week: 12, price: 100.01 }] });
  g.finance = s.modules.finance.defaultFinanceState(g);
  // Previously declared policy is an opening input, not a new unsafe declaration.
  g.finance.shareholderReturns = s.modules.shareholderReturns.normalizedState({ lastDeclaredDividend: PER_SHARE });
  const game = new s.engineModule.TycoonEngine(g); game.updateOwnershipRatios();
  assert.equal(game.g.sharesOut - game.g.treasuryBuybackShares, 99000);
  assert.equal(game.g.founderOwnershipRatio, 60000 / 99000);
  assert.equal(game.shareholderReturnCapacity().safeAmount, PINS[variant].capacity);
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  const result = { ...s, game, backend, key, durable, control, host, variant, settlement: PINS[variant], paymentHits: 0 };
  const observe = s.modules.finance.observeDividendDistribution;
  s.modules.finance.observeDividendDistribution = function (state, distribution) {
    if (state === game.g && game.inTransaction()) {
      assert.equal(state.week, 13); assert.equal(distribution.gross, PINS[variant].gross);
      assert.equal(distribution.personalCashAfter - distribution.personalCashBefore, PINS[variant].net);
      result.paymentHits++;
    }
    return observe.apply(this, arguments);
  };
  return result;
}
function week(s) {
  const hits = s.paymentHits;
  try { return s.game.advanceWeek(false); }
  finally { assert.ok(s.paymentHits > hits, 'actual installed week reaches the pinned payment inside a transaction'); }
}
module.exports = { fixture, snapshot, economic, PINS, PER_SHARE, week };
