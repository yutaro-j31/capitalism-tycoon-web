'use strict';
// G5 (docs/economic-engine/PHASE_3_P3_4_ACTIVATION_READINESS.md, step 4), run by tests/ma-share-swap-ownership-ratios-test.js: every external issuance dilutes the founder and
// a competitor stake by the same rule as engine.issueSharesToExternalHolders. Their share counts stay fixed and the new
// shares are external. Before this, W-INVESTOR, W-SPONSOR, W-TURNAROUND-ACCEPT and W-TURNAROUND-RATCHET raised sharesOut
// without rescaling competitorOwnedRatio, so the competitor's implied share count grew with each issuance.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const sponsorFixture = require('./fixtures/sponsor-injection-atomicity').fixture;
const acceptFixture = require('./fixtures/turnaround-fund-accept-atomicity').fixture;
function lcg(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const EPS = 1e-6;
const outstanding = g => g.sharesOut - g.treasuryBuybackShares;
const counts = g => ({ issued: g.sharesOut, founder: g.founderShares, competitor: g.competitorOwnedRatio * outstanding(g),
  external: g.externalShareholderRatio * outstanding(g) });
// A consistent pre-issuance cap table: founder 70%, competitor 20%, external 10% of the outstanding shares.
function withCompetitor(game) {
  const g = game.g;
  g.founderShares = Math.round(outstanding(g) * .7); g.competitorOwnedRatio = .2; game.updateOwnershipRatios();
  assert.ok(g.externalShareholderRatio > 0, 'pre-issuance external float exists');
  return counts(g);
}
function check(label, game, before, finance) {
  const g = game.g, after = counts(g), issued = after.issued - before.issued;
  assert.ok(issued > 0, `${label}: shares issued`);
  assert.equal(after.founder, before.founder, `${label}: founder count unchanged`);
  assert.ok(Math.abs(after.competitor - before.competitor) < EPS, `${label}: competitor count unchanged (${before.competitor} → ${after.competitor})`);
  assert.ok(Math.abs(after.external - (before.external + issued)) < EPS, `${label}: the new shares are external`);
  assert.ok(Math.abs(g.founderOwnershipRatio + g.competitorOwnedRatio + g.externalShareholderRatio - 1) < EPS, `${label}: ratios sum to 1`);
  assert.equal(finance.validate(JSON.parse(JSON.stringify(g))).ok, true, `${label}: accounting valid`);
  console.log(`${label}: founder and competitor diluted, new shares external PASS`);
}

(async () => {
  // W-INVESTOR: a private company accepts an investor offer.
  {
    const loaded = loadGame({ headless: true, random: lcg(11) }), game = new loaded.engineModule.TycoonEngine();
    game.g.configured = true; game.save = () => true;
    const office = game.g.rentalOffices.reduce((a, b) => a.deposit < b.deposit ? a : b);
    assert.equal(game.contractOffice(office.id), true); assert.equal(game.refreshInvestorOffers(), true);
    const before = withCompetitor(game);
    assert.equal(game.acceptInvestorOffer(game.g.investorOffers[0].id), true);
    check('W-INVESTOR', game, before, loaded.modules.finance);
  }
  // W-SPONSOR: a distressed company takes a sponsor injection.
  {
    const s = await sponsorFixture(), before = withCompetitor(s.game);
    assert.notEqual(s.game.requestSponsorInjection(), false);
    check('W-SPONSOR', s.game, before, s.modules.finance);
  }
  // W-TURNAROUND-ACCEPT: a distressed company accepts the turnaround fund.
  {
    const s = await acceptFixture(), before = withCompetitor(s.game);
    assert.notEqual(s.game.acceptTurnaroundFund(), false);
    check('W-TURNAROUND-ACCEPT', s.game, before, s.modules.finance);
  }
  // W-TURNAROUND-RATCHET: the fund's plan fails and the installed week ratchets (fixture of
  // tests/turnaround-ratchet-listed-mirror-test.js).
  {
    const loaded = loadGame({ random: lcg(7), headless: true });
    const { engine, finance, playerCrisis, playerTurnaroundPlan } = loaded.modules;
    const state = engine.createInitialState({ configured: true });
    state.week = 2; state.companyCash = -3_000_000; state.companyCredit = 80;
    const property = state.properties[0];
    property.owner = 'company'; property.purchasePrice = property.price = property.value = 100_000_000;
    state.finance = finance.defaultFinanceState(state);
    playerCrisis.evaluate(state);
    const game = new engine.TycoonEngine(state);
    assert.notEqual(game.acceptTurnaroundFund(), false); game.save = () => true;
    playerTurnaroundPlan.ensure(game.g).status = 'failed';
    const before = withCompetitor(game);
    assert.notEqual(game.advanceWeek(false), false);
    assert.equal(game.turnaroundFundSnapshot().status, 'ratcheted');
    check('W-TURNAROUND-RATCHET', game, before, finance);
  }
  console.log('issuance competitor dilution PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
