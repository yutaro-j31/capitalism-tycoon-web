'use strict';
// P3-4 W-SUB-MARKET: a subsidiary listed through the production prepared IPO and advanced with installed weeks to the
// end of its lock-up (the W-SUB-SECONDARY fixture). The parent's market sale or repurchase of listed shares is the
// command under test, at each installed trade size.
const assert = require('node:assert/strict');
const { boot, snapshot, economic } = require('./subsidiary-quarter-close');
const secondary = require('./subsidiary-secondary-sale-atomicity');

// Installed trade sizes: 5% and 10% of the subsidiary, sold to or bought from the market.
const VARIANTS = Object.freeze({ sell5: { side: 'sell', ratio: .05 }, sell10: { side: 'sell', ratio: .1 },
  buy5: { side: 'buy', ratio: .05 }, buy10: { side: 'buy', ratio: .1 } });
let listedState = null;
async function fixture(variant = 'sell5') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known market-trade variant');
  if (!listedState) listedState = JSON.stringify((await secondary.fixture('ten')).game.g);
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(listedState));
  const sub = game.g.subsidiaries.find(x => x.publicCompany);
  assert.ok(sub && game.g.week >= sub.ipoOfferTerms.lockupUntilWeek, 'listed subsidiary after its lock-up');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, ...VARIANTS[variant], subsidiaryID: sub.id };
}
const command = ctx => ctx.side === 'sell' ? ctx.game.sellListedSubsidiaryStake(ctx.subsidiaryID, ctx.ratio)
  : ctx.game.buyListedSubsidiaryStake(ctx.subsidiaryID, ctx.ratio);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
