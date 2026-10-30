'use strict';
// The turnaround-fund ratchet (settle()) issues free shares after this week's updateMarket. A company that listed during
// the fund term must see its own market row mirror the issued quantity in the same week, as the share swap and the M&A
// equity raise do since #1204; otherwise the P3-4 planner refuses the listing (issued mirror mismatch) until the next
// market pass. An unlisted company has no own row and is unchanged. The ratchet's quantity, the fund record, the cash and
// the ledger are what they were before the mirror; no RNG is drawn by the mirror.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
function lcg(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

// The distressed company of tests/player-crisis-turnaround-ratchet-week-rollback-test.js accepts the fund; `listed`
// then hand-sets the listing an IPO during the term would leave, and the plan is marked failed so the next installed
// week ratchets.
function fixture(listed) {
  const loaded = loadGame({ random: lcg(7), headless: true });
  const { engine, finance, playerCrisis, playerTurnaroundPlan } = loaded.modules;
  const state = engine.createInitialState({ configured: true });
  state.week = 2; state.companyCash = -3_000_000; state.companyCredit = 80;
  const property = state.properties[0];
  property.owner = 'company'; property.purchasePrice = property.price = property.value = 100_000_000;
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  const game = new engine.TycoonEngine(state);
  assert.notEqual(game.acceptTurnaroundFund(), false, 'fund accepted');
  game.save = () => true;
  const g = game.g;
  if (listed) {
    Object.assign(g, { publicCompany: true, ticker: 'CPTY', stockPrice: 1000 });
    g.market = g.market.filter(row => row.id !== 'CPTY');
    g.market.push({ id: 'CPTY', name: 'Own', price: 1000, previous: 1000, issuedShares: g.sharesOut, marketCap: 1000 * g.sharesOut,
      volatility: 0, trend: 0, priceHistory: [{ week: g.week, price: 1000 }] });
  }
  playerTurnaroundPlan.ensure(g).status = 'failed';
  return { loaded, game, g };
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const listed of [true, false]) {
  const { loaded, game, g } = fixture(listed), label = listed ? 'listed' : 'unlisted';
  const before = g.sharesOut, ratchet = loaded.modules.playerCrisisTurnaroundFund.ratchetSharesFor(plain(g));
  assert.notEqual(game.advanceWeek(false), false, `${label}: week advances`);
  assert.equal(game.turnaroundFundSnapshot().status, 'ratcheted', `${label}: the fund ratchets`);
  assert.equal(g.sharesOut, before + ratchet, `${label}: the ratchet quantity is unchanged`);
  assert.equal(game.turnaroundFundSnapshot().ratchetShares, ratchet);
  if (listed) {
    const own = g.market.find(row => row.id === g.ticker);
    assert.equal(own.issuedShares, g.sharesOut, 'listed: own market row mirrors the issued quantity in the ratchet week');
    assert.equal(own.marketCap, own.price * g.sharesOut, 'listed: market cap follows the issued quantity');
    const scope = { family: 'player-common', issuerEntityId: 'entity:company:player', securityClassId: 'security:player-company:common', currentCompanySerial: 1 };
    assert.equal(loaded.modules.phase3OwnershipPlanner.inspectOwnershipAuthority(g, scope).status, 'OBSERVED', 'listed: the planner observes the listing');
  } else assert.equal(g.market.some(row => row.id === g.ticker), false, 'unlisted: no own row is created');
  assert.equal(loaded.modules.finance.validate(plain(g)).ok, true, `${label}: accounting valid`);
  console.log(`turnaround ratchet ${label}: issued mirror and ratchet quantity PASS`);
}
console.log('turnaround ratchet listed mirror PASS');
