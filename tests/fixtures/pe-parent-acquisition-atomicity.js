'use strict';
// P3-4 W-PE-PARENT: a PE fund portfolio company closed with the installed deal-room flow (prepareAcceptedPE ->
// closeMADeal), with or without co-investors. Acquiring it into the player's group (acquirePEPortfolioCompany, directly or
// through the PE UI adapter) is the command under test. As in the PE portfolio exit evidence, the 156-week maturity and
// the improvement score are a controlled eligibility witness, not natural play.
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { prepareAcceptedPE, makeRandom } = require('./pe-fund-acquisition-atomicity');
const { boot, snapshot, economic } = require('./subsidiary-quarter-close');

const VARIANTS = Object.freeze({
  coinvest: { coinvest: true, route: 'engine' },
  adapter: { coinvest: true, route: 'adapter' },
  plain: { coinvest: false, route: 'engine' }
});
const states = {};
function stageState(coinvest) {
  if (states[coinvest]) return states[coinvest];
  const s = loadGame({ headless: true, random: makeRandom() }), p = prepareAcceptedPE(s.modules, coinvest);
  assert.equal(p.e.closeMADeal(p.dealID), true, 'production PE acquisition closes');
  const fund = p.e.g.peFirm.funds.find(x => x.id === p.fundID), deal = fund.deals.at(-1);
  assert.ok(deal.portfolioCompany && deal.status === 'active', 'active portfolio company');
  p.e.g.week = deal.acquiredWeek + 156; deal.portfolioCompany.improvementScore = 67;
  assert.equal(p.e.previewPEParentAcquisition(fund.id, deal.id).ok, true, 'eligible parent acquisition');
  return (states[coinvest] = JSON.stringify({ g: p.e.g, fundID: fund.id, portfolioID: deal.id }));
}
async function fixture(variant = 'coinvest') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known PE parent acquisition variant');
  const pinned = VARIANTS[variant], staged = JSON.parse(stageState(pinned.coinvest));
  const ctx = boot(); await ctx.backend.hydrate();
  // The production load normalises the witness week jump (for example the due-diligence slot period) before the command.
  assert.equal(new ctx.engineModule.TycoonEngine(staged.g).save(), true); await ctx.backend.flush();
  const game = ctx.engineModule.TycoonEngine.load();
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, ...pinned, fundID: staged.fundID, portfolioID: staged.portfolioID };
}
function command(ctx) {
  // TycoonEngine.load() binds the loaded engine to the bridge, and the harness reloads between attempts, so the adapter
  // route rebinds the command's engine first, as the app's single engine always is.
  if (ctx.route === 'adapter') ctx.modules.playerEngineBridge.bindEngine(ctx.game);
  if (ctx.route === 'adapter') return ctx.modules.peUIAdapter.performPortfolio('acquireIntoGroup', { fundID: ctx.fundID, dealID: ctx.portfolioID });
  return ctx.game.acquirePEPortfolioCompany(ctx.fundID, ctx.portfolioID);
}
module.exports = { fixture, command, snapshot, economic, VARIANTS };
