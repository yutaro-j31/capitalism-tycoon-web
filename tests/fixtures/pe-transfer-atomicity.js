'use strict';
// P3-4 W-PE-TRANSFER: a personal PE deal and a company PE deal formed with the installed createPEDeal, either fresh or
// after installed weeks. Transferring the personal deal to the company (transferPEDealToCompany, behind the installed
// pending-initiative guard) is the command under test. The only hand-set inputs are cash buffers and the investment
// department unlock, as in the other P3-4 fixtures.
const assert = require('node:assert/strict');
const { boot, advance, snapshot, economic } = require('./subsidiary-quarter-close');

const VARIANTS = Object.freeze({ fresh: { weeks: 0 }, aged: { weeks: 3 } });
const states = {};
function stageState(weeks) {
  if (states[weeks]) return states[weeks];
  const ctx = boot(), game = new ctx.engineModule.TycoonEngine();
  game.configure({ playerName: 'T', companyName: 'Transfer', difficulty: 'normal', scenario: 'free', simulationSeed: 971 });
  game.g.companyCash = 3_000_000_000; game.g.personalCash = 1_000_000_000; game.g.departments.investment = true;
  game.g.finance = ctx.modules.finance.defaultFinanceState(game.g);
  assert.equal(game.createPEDeal('テック', 120_000_000, 'personal'), true, 'production personal PE deal');
  assert.equal(game.createPEDeal('物流', 80_000_000, 'company'), true, 'production company PE deal');
  for (let n = 0; n < weeks; n++) advance(game);
  const [personal, company] = game.g.peDeals;
  assert.ok(personal.status === 'active' && personal.ownerAccount === 'personal' && !personal.pendingInitiative, 'personal deal active');
  assert.ok(company.status === 'active' && company.ownerAccount === 'company', 'company deal active');
  return (states[weeks] = JSON.stringify(game.g));
}
async function fixture(variant = 'fresh') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known PE transfer variant');
  const pinned = VARIANTS[variant];
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(stageState(pinned.weeks)));
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, ...pinned, dealID: game.g.peDeals[0].id, companyDealID: game.g.peDeals[1].id };
}
const command = ctx => ctx.game.transferPEDealToCompany(ctx.dealID);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
