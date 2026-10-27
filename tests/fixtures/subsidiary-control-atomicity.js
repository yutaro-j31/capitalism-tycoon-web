'use strict';
// P3-4 W-SUB-CONTROL: a subsidiary listed through the production prepared IPO (the W-SUB-IPO fixture, 55% parent
// stake). `tob` raises the stake to 90% with the installed tender offer; `squeeze` starts from the state after that
// installed tender offer and buys out the remaining 10%, delisting the subsidiary. The control action is the command.
const assert = require('node:assert/strict');
const { boot, snapshot, economic } = require('./subsidiary-quarter-close');
const ipo = require('./subsidiary-ipo-atomicity');

const VARIANTS = Object.freeze({ tob: 'launchListedSubsidiaryTenderOffer', squeeze: 'squeezeOutListedSubsidiary' });
const states = {};
async function startState(variant) {
  if (states[variant]) return states[variant];
  const s = await ipo.fixture('balanced');
  assert.equal(ipo.command(s), true, 'production prepared IPO');
  if (variant === 'squeeze') assert.equal(s.game.launchListedSubsidiaryTenderOffer(s.subsidiaryID), true, 'production tender offer');
  return (states[variant] = JSON.stringify(s.game.g));
}
async function fixture(variant = 'tob') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known control variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(await startState(variant)));
  const sub = game.g.subsidiaries.find(x => x.publicCompany);
  assert.ok(sub, 'listed subsidiary');
  const view = game.listedSubsidiaryControlPreview(sub.id);
  assert.equal(variant === 'tob' ? view.canTender : view.canSqueezeOut, true, 'the control action is available');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, subsidiaryID: sub.id };
}
const command = ctx => ctx.game[VARIANTS[ctx.variant]](ctx.subsidiaryID);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
