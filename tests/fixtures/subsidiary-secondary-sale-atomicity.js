'use strict';
// P3-4 W-SUB-SECONDARY: a subsidiary listed through the production prepared IPO (the W-SUB-IPO fixture), advanced with
// installed weeks until its lock-up has ended. The parent's secondary sale of listed shares is the command under test.
const assert = require('node:assert/strict');
const { boot, advance, snapshot, economic } = require('./subsidiary-quarter-close');
const ipo = require('./subsidiary-ipo-atomicity');

// The installed sale ratios: 10% and 25% of the subsidiary. (50% would leave the parent below its 10% minimum from
// the post-IPO 55% stake and is refused; the test covers that refusal separately.)
const RATIOS = Object.freeze({ ten: .10, quarter: .25 });
let listedState = null;
async function stateAfterLockup() {
  if (listedState) return listedState;
  const s = await ipo.fixture('balanced');
  assert.equal(ipo.command(s), true, 'production prepared IPO');
  const sub = () => s.game.g.subsidiaries.find(x => x.id === s.subsidiaryID);
  while (s.game.g.week < sub().ipoOfferTerms.lockupUntilWeek) advance(s.game);
  assert.equal(s.game.subsidiaryIPOSecondarySalePreview(s.subsidiaryID, .10).lockupRemaining, 0, 'lock-up over');
  return (listedState = JSON.stringify(s.game.g));
}
async function fixture(variant = 'ten') {
  assert.ok(Object.hasOwn(RATIOS, variant), 'known secondary-sale variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(await stateAfterLockup()));
  const sub = game.g.subsidiaries.find(x => x.publicCompany);
  assert.ok(sub, 'listed subsidiary');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, ratio: RATIOS[variant], subsidiaryID: sub.id };
}
const command = ctx => ctx.game.sellSubsidiaryIPOStake(ctx.subsidiaryID, ctx.ratio);
module.exports = { fixture, command, snapshot, economic, RATIOS };
