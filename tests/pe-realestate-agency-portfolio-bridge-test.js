'use strict';
// PE realEstateAgency bridge (engine layer only -- see founding-route-verification-log.md for the
// pre-implementation investigation). Follows the gym/conveni bridge precedent
// (js/pe-portfolio-operations.js:calculateGymPortfolioOperatingWeek/calculateConveniPortfolioOperatingWeek,
// js/management-context.js:previewPEPortfolioGymWeekForState/previewPEPortfolioConveniWeekForState),
// but real-estate-agency-pipeline.js's processStore() has a materially different dependency shape
// than gym/conveni: it references only g.week/g.seed/g.realEstateCycle (never g.stores or
// g.businesses), and its capacityFor() depends only on business.efficiency and siteMultiplier --
// never on sibling store counts. So unlike conveni, no synthetic sibling-store array is needed;
// unlike both gym and conveni, the only real leak vector is whether the `store` object passed in
// (the sole write target -- processStore() writes only to store.brokeragePipeline) is a freshly
// constructed detached object or a live reference to a real self-company store. This is why
// js/management-context.js's buildPEPortfolioRealEstateAgencyOperatingInputForState() always
// constructs a brand-new store object (never state.stores.find(...)), and
// previewPEPortfolioRealEstateAgencyWeekForState() additionally clones it before calling
// processStore() -- see tests/pe-realestate-agency-bridge-negative-test.js for proof both layers
// matter.
//
// This file's most important test is the accounting-integrity case in section 1: with a REAL
// self-company realEstateAgency store open and producing real store.brokeragePipeline records,
// simulating a PE realEstateAgency portfolio company in the same week must leave the self-company's
// own store record completely untouched, and companyCash must move only from the self-company's own
// weekly settlement (never from the PE deal, which settles into deal.portfolioCompany.cash only).
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function tryOpenBusiness(engine, businessID) {
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
  if (!tenant) return null;
  const business = engine.business(businessID);
  const cost = business.storeCost + tenant.deposit;
  const shortfall = cost - engine.g.companyCash;
  if (shortfall > 0) {
    const room = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt);
    const amount = Math.min(shortfall, Math.max(0, room));
    if (amount > 0) engine.borrow(amount, 'company');
  }
  const opened = engine.openStore({ tenantID: tenant.id, businessID, operatingHours: 3 });
  if (!opened) return null;
  return engine.g.stores.find(s => s.tenantID === tenant.id && s.businessID === businessID);
}
function buildEngineWithSelfRealEstateAgencyStore(seed) {
  const { engineModule, modules } = loadGame({ random: lcg(seed), isolatedLegacyIndex: true });
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: 'Isolation Test', companyName: 'Self RE Agency Co', difficulty: 'normal' });
  engine.g.companyCash = 9_000_000_000;
  engine.g.personalCash = 12_000_000_000;
  const store = tryOpenBusiness(engine, 'realEstateAgency');
  assert(store, 'self-company realEstateAgency store must open for this fixture to be meaningful');
  while (store.status !== 'open') engine.advanceWeek(false);
  return { engine, modules, store };
}
const plain = value => JSON.parse(JSON.stringify(value));

// ---- Section 1: accounting-integrity test (the most important test in this file) ----------------
{
  const SEED = 190826041 + 41;
  const { engine, modules, store } = buildEngineWithSelfRealEstateAgencyStore(SEED);
  const storesBefore = engine.g.stores.length;
  const pf = modules.peFund, ops = modules.pePortfolioOperations, context = modules.managementContext;
  pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'realEstateAgency', enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
  assert(deal && deal.portfolioCompany.productionSite, 'PE realEstateAgency deal acquired with a production site');
  assert.equal(context.resolvePortfolioManagementCapability(deal).actionsEnabled, true, 'actionsEnabled is true once the detached realEstateAgency bridge is connected to the player-facing management UI');
  deal.portfolioCompany.priceMultiplier = 1.7; // deliberately far from neutral; must have zero effect on the model (see section 2) and zero effect on the self-company

  const selfPipelineBefore = plain(store.brokeragePipeline);
  engine.advanceWeek(false); // self-company store processes AND the PE deal auto-processes (pe-portfolio-operations.js install() hook)
  const selfPipelineAfterSelfWeek = plain(store.brokeragePipeline);

  // The self-company store's own pipeline must have advanced exactly once (its own week's worth of
  // inquiries/mandates), never twice -- a leak where the PE deal's calculation also touched this
  // same object would double the totals.
  assert.equal(selfPipelineAfterSelfWeek.totals.inquiries, selfPipelineBefore.totals.inquiries + selfPipelineAfterSelfWeek.lastWeek.inquiries, 'self-company totals must reflect exactly one week of its own processing, never a doubled/contaminated increment from the PE deal');
  assert.equal(selfPipelineAfterSelfWeek.lastWeek.week, engine.g.week, 'self-company pipeline lastWeek must reflect the real current week, not a PE-deal-triggered extra pass');

  // A pure preview call for the PE deal must never touch the self-company store or its cash.
  const beforePreview = plain({ store: store.brokeragePipeline, companyCash: engine.g.companyCash });
  const previewWeek = engine.g.week + 1;
  const preview = context.previewPEPortfolioRealEstateAgencyWeekForState(engine.g, fund.id, deal.id, { week: previewWeek });
  assert.equal(preview.ok, true);
  assert.deepEqual(plain({ store: store.brokeragePipeline, companyCash: engine.g.companyCash }), beforePreview, 'a PE realEstateAgency preview call must never mutate the self-company store or companyCash (pure calculation, matches the gym/conveni contract)');
  assert.equal(engine.g.stores.length, storesBefore, 'PE synthetic detached store must never be pushed into the real g.stores array');
  assert(!engine.g.stores.some(s => String(s.id).startsWith(`pe-realestate-${deal.id}`)), 'no synthetic PE realEstateAgency store ever appears in the real store list');

  // The PE deal's weekly settlement moves only deal.portfolioCompany.cash, never companyCash.
  // engine.advanceWeek(false) above already auto-processed the deal for its own current week (the
  // pe-portfolio-operations.js install() hook), so pc.cash may already be non-zero -- compare the
  // delta from this explicit settlement, not the absolute value.
  const calc = ops.resolvePortfolioOperatingCalculator(deal, engine.g);
  assert.equal(calc, ops.calculateRealEstateAgencyPortfolioOperatingWeek, 'production state dispatches the realEstateAgency calculator');
  const companyCashBeforeSettlement = engine.g.companyCash, pcCashBeforeSettlement = deal.portfolioCompany.cash;
  const result = calc(fund, deal, previewWeek, engine.g);
  assert.equal(ops.settlePortfolioOperatingWeek(deal, result), true);
  assert.equal(engine.g.companyCash, companyCashBeforeSettlement, 'settling the PE realEstateAgency deal must never move the self-company companyCash');
  assert(Math.abs((deal.portfolioCompany.cash - pcCashBeforeSettlement) - result.profit) < 1e-6, 'PE deal settlement moves only deal.portfolioCompany.cash, by exactly this week\'s profit');
  assert.deepEqual(plain(store.brokeragePipeline), selfPipelineAfterSelfWeek, 'settling the PE deal must never mutate the self-company store record');
}

// ---- Section 2: the raw price multiplier is mathematically inert for this business ----------------
// (js/real-estate-agency-pipeline.js's processStore() never reads business.price -- see the
// comment in js/management-context.js's buildPEPortfolioRealEstateAgencyOperatingInputForState().
// Player-facing UI/adapter code therefore blocks price changes; the underlying bridge test still\n// proves why that guard is necessary. Brokerage commission is a percentage of a negotiated transaction
// value, not a price-elastic demand model. Proven directly here rather than only by code reading.)
{
  const { engineModule, modules } = loadGame({ random: lcg(190826041 + 42), isolatedLegacyIndex: true });
  const pf = modules.peFund, ops = modules.pePortfolioOperations, context = modules.managementContext;
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: 'Price No-op Test', companyName: 'PE RE Agency Price', difficulty: 'normal' });
  engine.g.companyCash = 9_000_000_000; engine.g.personalCash = 12_000_000_000;
  pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'realEstateAgency', enterpriseValue: 2_000_000_000, useCoinvest: false, week: 1 });
  assert(deal, 'realEstateAgency deal acquired');

  function previewAt(priceMultiplier, week) {
    return context.previewPEPortfolioRealEstateAgencyWeekForState(engine.g, fund.id, deal.id, { week, priceMultiplierOverride: priceMultiplier });
  }
  for (const week of [2, 3, 10, 50]) {
    const cheap = previewAt(.5, week), neutral = previewAt(1, week), expensive = previewAt(2, week);
    assert.equal(cheap.ok && neutral.ok && expensive.ok, true);
    assert.equal(cheap.sales, neutral.sales, `week ${week}: priceMultiplier .5 vs 1.0 must produce byte-identical sales (price has no effect)`);
    assert.equal(expensive.sales, neutral.sales, `week ${week}: priceMultiplier 2.0 vs 1.0 must produce byte-identical sales`);
    assert.equal(cheap.variable, neutral.variable);
    assert.equal(expensive.variable, neutral.variable);
  }

  const calc = ops.calculateRealEstateAgencyPortfolioOperatingWeek(fund, deal, 5, engine.g);
  assert.equal(calc.components.realEstateAgencySalesFactor, 1, 'salesFactor is always exactly 1 for realEstateAgency');
  assert.equal(calc.components.realEstateAgencyContributionFactor, 1, 'contributionFactor is always exactly 1 for realEstateAgency');
  const generic = ops.calculateGenericPortfolioOperatingWeek(fund, deal, 5);
  assert.equal(calc.revenue, generic.revenue, 'with salesFactor pinned to 1, realEstateAgency revenue equals the calibrated generic baseline regardless of priceMultiplier');
  assert.equal(calc.profit, generic.profit, 'same for profit');
}
console.log('PE realEstateAgency portfolio bridge tests passed');
