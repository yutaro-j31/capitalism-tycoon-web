'use strict';
const assert = require('node:assert/strict');
const { fixture: listedFixture, snapshot, economic } = require('./shareholder-buyback-atomicity');
const PINS = Object.freeze({
  declare: Object.freeze({ perShare: 1.25, plannedTotal: 123750 }),
  cancel: Object.freeze({ perShare: 0, plannedTotal: 0 })
});
async function fixture(variant = 'declare') {
  assert.ok(Object.hasOwn(PINS, variant), 'known dividend declaration variant');
  const s = await listedFixture('ordinary');
  // Use actual installed commands to establish nonzero treasury and a live policy.
  // 1,000 treasury shares cost ¥100,010; only 99,000 shares receive a dividend.
  assert.equal(s.game.buybackOwnShares(100010), true);
  assert.equal(s.game.setDividend(2.5), true);
  const g = s.game.g;
  assert.equal(g.sharesOut, 100000); assert.equal(g.treasuryBuybackShares, 1000);
  assert.equal(g.companyCash, 99899990); assert.equal(g.stockPrice, 100.01 * 1.008);
  assert.equal(g.dividendPerShare, 2.5);
  assert.equal(s.game.shareholderReturnCapacity().safeAmount, 94899990);
  assert.equal(s.modules.finance.validate(snapshot(s.game)).ok, true);
  assert.equal(s.game.save(), true); await s.backend.flush();
  return { ...s, variant, settlement: PINS[variant] };
}
module.exports = { fixture, snapshot, economic, PINS };
