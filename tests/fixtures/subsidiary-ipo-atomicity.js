'use strict';
// P3-4 W-SUB-IPO: a VC subsidiary built with production writers only (investStartup -> makeSubsidiary), taken through
// the production staged IPO preparation (start -> advance x3 with installed weeks) to the ready state, with the offer
// term chosen through the installed selector. The listing itself is the command under test.
const assert = require('node:assert/strict');
const { boot, advance, liveGame, snapshot, economic } = require('./subsidiary-quarter-close');

// Each variant chooses a different installed offer term, so the primary raise and lock-up differ.
const TERMS = Object.freeze({ balanced: 'balanced', growth: 'growth' });
const states = {};
function readyState(variant) {
  if (states[variant]) return states[variant];
  const c = liveGame('vc', 1, { largest: true }), g = c.game.g, id = c.subsidiaryID, sub = () => g.subsidiaries.find(x => x.id === id);
  assert.equal(c.game.startSubsidiaryIPOPreparation(id), true, 'production IPO preparation');
  while (!c.game.subsidiaryIPOPreparationSnapshot(id).ready && g.week < 40) {
    advance(c.game);
    if (c.game.subsidiaryIPOPreparationSnapshot(id).canAdvance) assert.equal(c.game.advanceSubsidiaryIPOPreparation(id), true);
  }
  assert.equal(c.game.subsidiaryIPOPreparationSnapshot(id).ready, true, 'preparation complete');
  assert.equal(c.game.selectSubsidiaryIPOOfferTerm(id, TERMS[variant]), true, 'installed offer term');
  assert.equal(sub().publicCompany, false);
  return (states[variant] = JSON.stringify(g));
}
async function fixture(variant = 'balanced') {
  assert.ok(Object.hasOwn(TERMS, variant), 'known IPO variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(readyState(variant)));
  const sub = game.g.subsidiaries.find(x => x.ipoPreparation && !x.publicCompany);
  assert.ok(sub && game.subsidiaryIPOPreparationSnapshot(sub.id).ready, 'reloaded ready subsidiary');
  assert.equal(sub.ipoPreparation.offerTermID, TERMS[variant]);
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, subsidiaryID: sub.id };
}
// The prepared-IPO alias is the UI's entry point; it delegates to the installed ipoSubsidiary wrapper.
const command = ctx => ctx.game.executePreparedSubsidiaryIPO(ctx.subsidiaryID);
module.exports = { fixture, command, snapshot, economic, TERMS };
