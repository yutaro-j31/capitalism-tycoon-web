'use strict';
// P3-4 W-GROUP-DISPOSAL (sale): an unlisted subsidiary sold whole through the installed group-restructuring sale.
// `partial` is a VC subsidiary held at 70% (investStartup -> makeSubsidiary, advanced to week 12: the W-SUB quarter
// fixture); `whole` is a subsidiary taken private and wholly owned through the production prepared IPO, tender offer
// and squeeze-out (the W-SUB-CONTROL fixture). The group-restructuring sale is the command under test.
const assert = require('node:assert/strict');
const { boot, snapshot, economic, quarterEve } = require('./subsidiary-quarter-close');
const control = require('./subsidiary-control-atomicity');

const VARIANTS = Object.freeze(['partial', 'whole']);
const states = {};
async function startState(variant) {
  if (states[variant]) return states[variant];
  if (variant === 'partial') return (states[variant] = JSON.stringify((await quarterEve('vc')).game.g));
  const s = await control.fixture('squeeze');
  assert.equal(control.command(s), true, 'production squeeze-out');
  return (states[variant] = JSON.stringify(s.game.g));
}
async function fixture(variant = 'partial') {
  assert.ok(VARIANTS.includes(variant), 'known group-sale variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(await startState(variant)));
  const sub = game.g.subsidiaries.find(x => String(x.status || 'active') === 'active' && !x.publicCompany);
  assert.ok(sub && sub.ownership === (variant === 'whole' ? 1 : .7), 'pinned unlisted subsidiary');
  assert.equal(game.groupRestructuringSalePreview(sub.id).canExecute, true, 'sale available');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, subsidiaryID: sub.id };
}
const command = ctx => ctx.game.executeGroupRestructuringSale(ctx.subsidiaryID);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
