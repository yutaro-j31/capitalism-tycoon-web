'use strict';
// P3-7 §14: PE fund evidence produced by the installed writers, not hand-built deals. Required (and awaited) by
// phase3-pe-fund-interests-test.js.
// - Fund acquisition (deal-room close, with and without co-investors): one current proceeds participation whose
//   fraction is exactly fundPortion / investedAmount; co-invest capital is never attributed to the fund.
// - Parent acquisition (acquirePEPortfolioCompany): the fund participation ends, the reciprocal conversion is a source
//   link only, and the new group subsidiary stays an unresolved PE alias, so the company is never counted twice.
// Also: state and RNG purity, and the same projections after a v9 save/load.
const assert = require('node:assert/strict');
const interests = require('../js/phase3-pe-fund-interests.js');
const copy = x => JSON.parse(JSON.stringify(x));

async function variant(name) {
  const fx = require('./fixtures/pe-parent-acquisition-atomicity');
  const ctx = await fx.fixture(name), g = ctx.game.g, read = ctx.modules.economicReadModel;
  const fund = g.peFirm.funds.find(f => f.id === ctx.fundID), deal = fund.deals.find(d => d.id === ctx.portfolioID);
  const stateBefore = JSON.stringify(g), rngBefore = JSON.stringify(g.simulationRng);

  // After the installed fund acquisition.
  let r = interests.projectPEFundInterests(copy(g));
  assert.equal(r.issues.length, 0);
  const live = r.portfolioParticipations.filter(p => p.current);
  assert.equal(live.length, 1, 'one current participation');
  assert.equal(live[0].assetRole, 'proceeds-participation');
  assert.equal(live[0].fundProceedsFraction, deal.fundPortion / deal.investedAmount, 'exact source ratio, no normalisation');
  assert.equal(deal.fundPortion + deal.coinvestPortion, deal.investedAmount);
  if (ctx.coinvest) assert.ok(deal.coinvestPortion > 0 && live[0].fundProceedsFraction < 1, 'co-invest stays external');
  else assert.equal(live[0].fundProceedsFraction, 1);
  assert.equal(r.fundInterests.find(x => x.current).contributionRatio, fund.gpCommit / fund.size);
  assert.equal(JSON.stringify(g), stateBefore); assert.equal(JSON.stringify(g.simulationRng), rngBefore);

  // After the installed parent acquisition.
  assert.equal(fx.command(ctx), true, 'installed parent acquisition');
  // Results from the game realm are normalised into this realm before deep comparison.
  const h = ctx.game.g, after = state => copy({
    participations: interests.projectPEFundInterests(copy(state)).portfolioParticipations.map(p => [p.current, p.fundProceedsFraction, p.assetRole]),
    conversions: interests.projectFundParentConversions(copy(state)).conversions.map(c => [c.dealId, c.status, c.assetRole, c.fundHoldingCurrent, c.legalEquityFraction, c.votingFraction, c.wealthValue]),
    relationships: read.projectSubsidiaryRelationships(state).relationships.map(x => [x.status, x.economicFraction.value, x.canonicalFamily, x.childEntityId]),
    positions: read.projectPEOwnership(state).positions.length
  });
  const view = after(h);
  assert.deepEqual(view.participations, [[false, null, 'unresolved']], 'the fund holding ended');
  assert.deepEqual(view.conversions, [[ctx.portfolioID, 'source-observed', 'lifecycle-source-link', false, null, null, null]]);
assert.deepEqual(view.relationships, [['unresolved', null, 'pe', null]], 'group subsidiary is a PE alias, not a second asset');
  assert.equal(view.positions, 0);
  const sub = h.subsidiaries.find(s => s.sourcePEDealID === ctx.portfolioID);
  assert.ok(sub && sub.sourcePEFundID === ctx.fundID, 'writer keeps the reciprocal provenance');
  const committed = JSON.stringify(h); after(h); assert.equal(JSON.stringify(h), committed, 'projections are pure');

  assert.equal(ctx.game.save(), true); await ctx.backend.flush();
  const loaded = ctx.engineModule.TycoonEngine.load();
  assert.equal(loaded.g.saveVersion, 9);
  assert.deepEqual(after(loaded.g), view, 'v9 reload keeps the PE evidence');
}

async function run() {
  await variant('coinvest');
  await variant('plain');
}
module.exports = { run };
