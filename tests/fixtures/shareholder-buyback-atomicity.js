'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { indexedDBFor } = require('./pe-fund-acquisition-faults');
const { snapshot, economic } = require('./stock-split-atomicity');
// The price is an estimate; settlement is whole yen. With a ¥1,000,050 budget:
// floor(1,000,050 / 100.01) = 9,999; ceil(9,999 * 100.01) = ¥1,000,000.
// Limited outside float is 100,000 - 94,993 - 5,000 = 7 shares, costing ¥701.
const PINS = Object.freeze({
  ordinary: Object.freeze({ founder: 60000, quantity: 9999, cost: 1000000, remaining: 25001 }),
  capped: Object.freeze({ founder: 94993, quantity: 7, cost: 701, remaining: 0 })
});
const REQUEST = 1000050;
async function fixture(variant = 'ordinary') {
  assert.ok(Object.hasOwn(PINS, variant), 'known buyback variant');
  let seed = 7; const host = { draws: 0 }, durable = new Map(), control = { attempts: [] };
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control), random: () => {
    host.draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32;
  } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate();
  const state = s.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 12, companyCash: 100000000, companyDebt: 0, personalCash: 10000000,
    publicCompany: true, sharesOut: 100000, founderShares: PINS[variant].founder,
    treasuryBuybackShares: 0, competitorOwnedRatio: 0, stockPrice: 100.01, ticker: 'CPTY' });
  state.companyStocks = {}; state.personalStocks = { CPTY: { qty: 5000, avg: 80 } };
  state.market = state.market.filter(row => row.id !== 'CPTY');
  state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100.01,
    previous: 100.01, issuedShares: 100000, marketCap: 10001000, dividendYield: 0,
    volatility: 0, trend: 0, dividendPerShare: 0, priceHistory: [{ week: 12, price: 100.01 }] });
  state.finance = s.modules.finance.defaultFinanceState(state);
  const game = new s.engineModule.TycoonEngine(state); game.updateOwnershipRatios();
  // Existing installed preflight computes a derived statement cache before its TX.
  // Snapshot the same explicit preview state, as the prior conservation test does.
  assert.equal(game.shareholderReturnCapacity().safeAmount, 95000000);
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  return { ...s, game, backend, key, durable, control, host, variant, settlement: PINS[variant] };
}
module.exports = { fixture, snapshot, economic, PINS, REQUEST };
