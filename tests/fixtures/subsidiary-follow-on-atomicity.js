'use strict';
// P3-4 W-SUB-FOLLOWON: a subsidiary listed through the production prepared IPO (the W-SUB-IPO fixture, 55% parent
// stake), advanced with installed weeks until the 26-week capital-policy cooldown after listing has ended. The
// follow-on offering with one installed option is the command under test.
const assert = require('node:assert/strict');
const { boot, advance, snapshot, economic } = require('./subsidiary-quarter-close');
const ipo = require('./subsidiary-ipo-atomicity');

// The installed options: primary only, parent secondary only, and both.
const OPTIONS = Object.freeze(['primary', 'secondary', 'balanced']);
let readyState = null;
async function stateAfterCooldown() {
  if (readyState) return readyState;
  const s = await ipo.fixture('balanced');
  assert.equal(ipo.command(s), true, 'production prepared IPO');
  const ready = () => OPTIONS.every(option => s.game.listedSubsidiaryFollowOnOfferingPreview(s.subsidiaryID, option).canExecute);
  while (!ready() && s.game.g.week < 80) advance(s.game);
  assert.equal(ready(), true, 'cooldown over');
  return (readyState = JSON.stringify(s.game.g));
}
async function fixture(variant = 'primary') {
  assert.ok(OPTIONS.includes(variant), 'known follow-on variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(await stateAfterCooldown()));
  const sub = game.g.subsidiaries.find(x => x.publicCompany);
  assert.ok(sub && game.listedSubsidiaryFollowOnOfferingPreview(sub.id, variant).canExecute, 'listed subsidiary ready for a follow-on');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, subsidiaryID: sub.id };
}
const command = ctx => ctx.game.executeListedSubsidiaryFollowOnOffering(ctx.subsidiaryID, ctx.variant);
module.exports = { fixture, command, snapshot, economic, OPTIONS };
