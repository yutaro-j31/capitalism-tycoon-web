'use strict';
// P3-4 W-WEEK-COMPETITOR: a listed player company whose next installed canonical week (advanceWeek -> updateCompetitors
// -> buyCompetitorStake) has a competitor buy player-company shares from the external float. The weekly purchase is a
// 0.5% draw per competitor, so the simulation RNG is reseeded to a pinned seed whose next week makes exactly one
// purchase. The listing is hand-set (no company own-ticker alias, which would make the float unknown).
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { indexedDBFor } = require('./pe-fund-acquisition-faults');
const { snapshot, economic } = require('./stock-split-atomicity');
// fresh: no competitor stake yet. held: competitors already hold 20% (the buyer's named holding included).
const PINS = Object.freeze({
  fresh: Object.freeze({ seed: 60, founderShares: 600000, ratio: 0 }),
  held: Object.freeze({ seed: 109, founderShares: 500000, ratio: 0.2 })
});
function listed(s, pin) {
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: 30, publicCompany: true, sharesOut: 1000000, founderShares: pin.founderShares, treasuryBuybackShares: 0,
    stockPrice: 1000, ticker: 'CPTY', companyCash: 300000000, competitorOwnedRatio: pin.ratio });
  g.market = g.market.filter(x => x.id !== 'CPTY');
  g.market.push({ id: 'CPTY', name: 'Own', sector: 'コングロマリット', price: 1000, previous: 1000, issuedShares: 1000000, marketCap: 1e9,
    dividendYield: 0, volatility: 0, trend: 0, per: 20, pbr: 2, dividendPerShare: 0, shareholders: {}, description: 'fixture',
    listingMarket: '東証グロース', priceHistory: [{ week: 30, price: 1000 }] });
  // The aggregate ratio is the authority; spread the pinned holding over the competitors' named holdings.
  const each = Math.floor(pin.ratio * 1000000 / g.competitors.length);
  for (const c of g.competitors) c.ownedPlayerShares = each;
  g.finance = s.modules.finance.defaultFinanceState(g);
  const game = new s.engineModule.TycoonEngine(g);
  game.updateOwnershipRatios(); s.modules.simulationRng.reseed(game.g, pin.seed);
  return game;
}
async function fixture(variant = 'fresh') {
  assert.ok(Object.hasOwn(PINS, variant), 'known competitor-stake week variant');
  const pin = PINS[variant], durable = new Map(), control = { attempts: [] }, host = { draws: 0 };
  let seed = 23;
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control), random: () => {
    host.draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32;
  } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY; await backend.hydrate();
  const game = listed(s, pin);
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  const result = { ...s, game, backend, key, durable, control, host, variant, pin, buys: [] };
  // A delegating observer requires the actual installed purchase inside the week transaction.
  const buy = game.buyCompetitorStake;
  game.buyCompetitorStake = function (c, ...args) {
    const price = this.g.stockPrice, filled = buy.call(this, c, ...args);
    if (filled > 0 && this.inTransaction()) result.buys.push({ id: c.id, filled, price });
    return filled;
  };
  return result;
}
// The same seed and state with the purchase disabled: every other weekly effect is identical, because the purchase
// draws no RNG. It isolates what the purchase alone changes.
function withoutPurchase(variant) {
  const s = loadGame({ headless: true }), game = listed(s, PINS[variant]);
  game.save = () => true; game.buyCompetitorStake = () => 0;
  assert.equal(game.advanceWeek(false), true);
  return JSON.parse(JSON.stringify(game.g));
}
function week(s) {
  const hits = s.buys.length;
  try { return s.game.advanceWeek(false); }
  finally { assert.ok(s.buys.length > hits, 'actual installed week buys a competitor stake inside a transaction'); }
}
module.exports = { fixture, snapshot, economic, PINS, week, withoutPurchase };
