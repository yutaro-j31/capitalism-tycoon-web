'use strict';
// P3-4 W-INTERNAL-VENTURE (spin-off): two internal ventures proposed and approved with the installed engine writers
// (proposeInternalVenture -> approveInternalVenture) and developed with installed weeks until both are commercialised.
// Spinning one out into a wholly owned subsidiary is the command under test. The only hand-set inputs are a cash
// buffer and the department unlocks (investment, as in the subsidiary fixtures, and product, which proposals need).
const assert = require('node:assert/strict');
const { boot, advance, snapshot, economic } = require('./subsidiary-quarter-close');

const VARIANTS = Object.freeze({ first: 0, second: 1 });
let readyState = null;
function developedState() {
  if (readyState) return readyState;
  const ctx = boot(), game = new ctx.engineModule.TycoonEngine();
  game.configure({ playerName: 'T', companyName: 'Venture', difficulty: 'normal', scenario: 'free', simulationSeed: 971 });
  game.g.companyCash = 3_000_000_000; game.g.departments.investment = true; game.g.departments.product = true;
  game.g.finance = ctx.modules.finance.defaultFinanceState(game.g);
  for (let n = 0; n < 2; n++) {
    assert.equal(game.proposeInternalVenture(), true, 'production venture proposal');
    assert.equal(game.approveInternalVenture(game.g.internalVentureProposals.at(-1).id), true, 'production venture approval');
  }
  while (game.g.internalVentures.some(v => v.status === 'developing') && game.g.week < 80) advance(game);
  assert.ok(game.g.internalVentures.length === 2 && game.g.internalVentures.every(v => v.status === 'active'), 'both ventures commercialised');
  return (readyState = JSON.stringify(game.g));
}
async function fixture(variant = 'first') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known spin-off variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(developedState()));
  const venture = game.g.internalVentures[VARIANTS[variant]];
  assert.equal(venture.status, 'active'); assert.ok(!game.g.subsidiaries.some(s => s.internalVentureID === venture.id), 'not yet spun off');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, ventureID: venture.id, subsidiaryID: `internal-sub-${venture.id}` };
}
const command = ctx => ctx.game.spinOffInternalVenture(ctx.ventureID);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
