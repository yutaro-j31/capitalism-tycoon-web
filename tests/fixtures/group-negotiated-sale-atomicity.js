'use strict';
// P3-4 W-GROUP-NEGOTIATED: a subsidiary sale negotiated with a buyer through the installed group-restructuring
// progress writers (startSubsidiarySaleNegotiation -> actOnSubsidiarySaleNegotiation 'accept'), advanced with installed
// weeks to the agreed close week. Closing the negotiated sale (closeNegotiatedSubsidiarySale) is the command under test.
// `partial` sells a VC subsidiary held at 70% (the W-SUB quarter fixture) to a competitor for cash; `whole` sells a
// subsidiary taken private and wholly owned (the W-SUB-CONTROL squeeze-out) to its management with an earnout; `listed`
// sells a listed subsidiary down to the 10% floor after its lock-up (the W-SUB-SECONDARY fixture) to a strategic buyer.
const assert = require('node:assert/strict');
const { boot, snapshot, economic, advance, quarterEve } = require('./subsidiary-quarter-close');
const control = require('./subsidiary-control-atomicity');
const secondary = require('./subsidiary-secondary-sale-atomicity');

const VARIANTS = Object.freeze({ partial: 'competitor', whole: 'mbo', listed: 'strategic' });
const sources = {
  partial: async () => (await quarterEve('vc')).game.g,
  whole: async () => { const s = await control.fixture('squeeze'); assert.equal(control.command(s), true, 'production squeeze-out'); return s.game.g; },
  listed: async () => (await secondary.fixture('ten')).game.g
};
const states = {};
async function closeState(variant) {
  if (states[variant]) return states[variant];
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(JSON.stringify(await sources[variant]())));
  const listed = variant === 'listed';
  const sub = game.g.subsidiaries.find(x => String(x.status || 'active') === 'active' && Boolean(x.publicCompany) === listed);
  assert.ok(sub, 'pinned subsidiary');
  assert.equal(game.startSubsidiarySaleNegotiation(sub.id, VARIANTS[variant]), true, 'production negotiation start');
  const negotiation = game.g.saleNegotiations.at(-1);
  assert.equal(game.actOnSubsidiarySaleNegotiation(negotiation.id, 'accept'), true, 'production agreement');
  while (game.g.week < negotiation.closeWeek) advance(game);
  return (states[variant] = { state: JSON.stringify(game.g), subsidiaryID: sub.id, negotiationID: negotiation.id });
}
async function fixture(variant = 'partial') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known negotiated-sale variant');
  const pinned = await closeState(variant);
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(pinned.state));
  const n = game.g.saleNegotiations.find(x => x.id === pinned.negotiationID);
  assert.ok(n && n.status === 'active' && n.agreementAccepted && game.g.week >= n.closeWeek, 'agreed negotiation at its close week');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, subsidiaryID: pinned.subsidiaryID, negotiationID: pinned.negotiationID };
}
const command = ctx => ctx.game.closeNegotiatedSubsidiarySale(ctx.negotiationID);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
