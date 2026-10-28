'use strict';
// P3-4 W-INTERNAL-VENTURE (subsidiary funding): a parent capital injection into, or an external round raised by, an
// unlisted subsidiary (fundSubsidiaryFromParent, raiseSubsidiaryExternalRound). `spun` is the wholly owned subsidiary
// spun out of a developed internal venture (the W-INTERNAL-VENTURE spin-off fixture); `vc` is a VC subsidiary held at
// 70% (investStartup -> makeSubsidiary, advanced to week 12: the W-SUB quarter fixture). Both come from production
// writers only.
const assert = require('node:assert/strict');
const { boot, snapshot, economic, quarterEve } = require('./subsidiary-quarter-close');
const spinoff = require('./internal-venture-spinoff-atomicity');

const VARIANTS = Object.freeze({
  parentSpun: { source: 'spun', side: 'parent', amount: 10_000_000 },
  parentVc: { source: 'vc', side: 'parent', amount: 50_000_000 },
  externalSpun: { source: 'spun', side: 'external', amount: 10_000_000 },
  externalVc: { source: 'vc', side: 'external', amount: 25_000_000 }
});
const states = {};
async function sourceState(source) {
  if (states[source]) return states[source];
  if (source === 'vc') {
    const s = await quarterEve('vc');
    const sub = s.game.g.subsidiaries.find(x => String(x.status || 'active') === 'active' && !x.publicCompany);
    return (states[source] = { state: JSON.stringify(s.game.g), subsidiaryID: sub.id });
  }
  const s = await spinoff.fixture('first');
  assert.equal(spinoff.command(s), true, 'production spin-off');
  return (states[source] = { state: JSON.stringify(s.game.g), subsidiaryID: s.subsidiaryID });
}
async function fixture(variant = 'parentSpun') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known subsidiary-funding variant');
  const pinned = VARIANTS[variant], source = await sourceState(pinned.source);
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(source.state));
  const sub = game.g.subsidiaries.find(x => x.id === source.subsidiaryID);
  assert.ok(sub && sub.status === 'active' && !sub.publicCompany && sub.ownership === (pinned.source === 'vc' ? .7 : 1), 'pinned unlisted subsidiary');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, ...pinned, subsidiaryID: sub.id };
}
const command = ctx => ctx.side === 'parent' ? ctx.game.fundSubsidiaryFromParent(ctx.subsidiaryID, ctx.amount)
  : ctx.game.raiseSubsidiaryExternalRound(ctx.subsidiaryID, ctx.amount);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
