'use strict';
// P3-4 W-INVESTOR-AUX: an unlisted company with a head office, as tests/investor-offer-test.js uses. The commands under
// test are the installed refreshInvestorOffers (two new offers drawn from the simulation RNG) and declineInvestorOffer
// (one of two pending offers produced by that same refresh). The only hand-set inputs are the head office and cash.
const assert = require('node:assert/strict');
const { boot, snapshot, economic } = require('./subsidiary-quarter-close');

const VARIANTS = Object.freeze({ refresh: { offers: false }, decline: { offers: true } });
const staged = {};
function companyState(variant) {
  if (staged[variant]) return staged[variant];
  const ctx = boot(), game = new ctx.engineModule.TycoonEngine();
  game.configure({ playerName: 'Founder', companyName: 'Offer Co.', difficulty: 'normal', scenario: 'free', simulationSeed: 971 });
  game.g.hasHeadOffice = true; game.g.companyCash = 80_000_000;
  game.g.finance = ctx.modules.finance.defaultFinanceState(game.g);
  if (VARIANTS[variant].offers) assert.equal(game.refreshInvestorOffers(), true, 'pending offers staged');
  return (staged[variant] = JSON.stringify(game.g));
}
async function fixture(variant = 'refresh') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known investor-offer auxiliary variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(companyState(variant)));
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  const offerID = VARIANTS[variant].offers ? game.g.investorOffers.find(o => o.status === 'pending')?.id : null;
  if (VARIANTS[variant].offers) assert.ok(offerID, 'a pending offer to decline');
  return { ...ctx, game, variant, offerID };
}
const command = ctx => ctx.variant === 'decline' ? ctx.game.declineInvestorOffer(ctx.offerID) : ctx.game.refreshInvestorOffers();
module.exports = { fixture, command, snapshot, economic, VARIANTS };
