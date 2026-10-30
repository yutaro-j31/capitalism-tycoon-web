'use strict';
// P3-4 W-INTERNAL-VENTURE (business): two internal ventures proposed and approved with the installed engine writers
// (proposeInternalVenture -> approveInternalVenture), pinned either two installed weeks into development or after
// installed weeks have commercialised both. Funding, selling or withdrawing one venture is the command under test. The
// only hand-set inputs are a cash buffer and the department unlocks, as in the W-INTERNAL-VENTURE spin-off fixture.
const assert = require('node:assert/strict');
const { boot, advance, snapshot, economic } = require('./subsidiary-quarter-close');

const VARIANTS = Object.freeze({
  fundDeveloping: { stage: 'developing', index: 0, action: 'fund', amount: 25_000_000 },
  fundActive: { stage: 'active', index: 0, action: 'fund', amount: 10_000_000 },
  sellActive: { stage: 'active', index: 1, action: 'sell' },
  sellDeveloping: { stage: 'developing', index: 0, action: 'sell' },
  withdraw: { stage: 'developing', index: 1, action: 'withdraw' }
});
const states = {};
function stageState(stage) {
  if (states[stage]) return states[stage];
  const ctx = boot(), game = new ctx.engineModule.TycoonEngine();
  game.configure({ playerName: 'T', companyName: 'Venture', difficulty: 'normal', scenario: 'free', simulationSeed: 971 });
  game.g.companyCash = 3_000_000_000; game.g.departments.investment = true; game.g.departments.product = true;
  game.g.finance = ctx.modules.finance.defaultFinanceState(game.g);
  for (let n = 0; n < 2; n++) {
    assert.equal(game.proposeInternalVenture(), true, 'production venture proposal');
    assert.equal(game.approveInternalVenture(game.g.internalVentureProposals.at(-1).id), true, 'production venture approval');
  }
  if (stage === 'developing') for (let n = 0; n < 2; n++) advance(game);
  else while (game.g.internalVentures.some(v => v.status === 'developing') && game.g.week < 80) advance(game);
  assert.ok(game.g.internalVentures.length === 2 && game.g.internalVentures.every(v => v.status === stage), `both ventures ${stage}`);
  return (states[stage] = JSON.stringify(game.g));
}
async function fixture(variant = 'fundDeveloping') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known internal-venture business variant');
  const pinned = VARIANTS[variant];
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(stageState(pinned.stage)));
  const venture = game.g.internalVentures[pinned.index];
  assert.equal(venture.status, pinned.stage, 'pinned venture stage');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, ...pinned, ventureID: venture.id };
}
function command(ctx) {
  if (ctx.action === 'fund') return ctx.game.fundInternalVenture(ctx.ventureID, ctx.amount);
  if (ctx.action === 'sell') return ctx.game.sellInternalVenture(ctx.ventureID);
  return ctx.game.withdrawInternalVenture(ctx.ventureID);
}
module.exports = { fixture, command, snapshot, economic, VARIANTS };
