'use strict';
// PE conveni UI connection (Founding Route Rebalance, feat/pe-conveni-ui-connection, built on top
// of PR #670's conveni production bridge). js/pe-ui-adapter.js's gymManagementDetails() was
// renamed to the business-agnostic portfolioManagementDetails() and js/pe-ui.js's manageView()
// guard was generalized from "!row.management.gym" to "!row.management?.actionsEnabled" (see
// founding-route-verification-log.md Entry 29-31 for the investigation that found the D UI
// manage screen was gym-hardcoded, and the independent pre-existing bug -- the legacy
// renderPePortfolio() verification screen being permanently overwritten once PE unlocks -- that
// was discovered and recorded separately from this UI-connection work).
//
// This file uses the REAL production modules (via tests/harness.js's loadGame(), the full
// index.html) rather than pe-ui-phase2-test.js's hand-rolled mock, so it exercises the actual
// resolvePortfolioManagementCapability()/portfolioManagementDetails() code paths end to end for
// every pillar business, not a stand-in.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

// ---- Section 1: js/pe-ui.js source-level guard contract ------------------------------------
// (mirrors the existing uiSource-regex convention in tests/pe-ui-phase2-test.js)
{
  const uiSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'pe-ui.js'), 'utf8');
  assert.match(uiSource, /function manageView\(model\)\{const row=model\.portfolio\?\.selected;if\(!row\|\|!row\.management\?\.actionsEnabled\)\{/, 'manageView() must gate on actionsEnabled only, not on row.management.gym truthiness');
  assert.doesNotMatch(uiSource, /!row\.management\.gym\)\{portfolioMode/, 'the old gym-only guard clause must be gone');
  const adapterSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'pe-ui-adapter.js'), 'utf8');
  assert.match(adapterSource, /function portfolioManagementDetails\(deal,pc\)\{/, 'gymManagementDetails() must be renamed to the business-agnostic portfolioManagementDetails()');
  assert.doesNotMatch(adapterSource, /function gymManagementDetails/, 'the old gym-only-named function must be gone (it was never exported, so no alias is needed -- confirmed in founding-route-verification-log.md before this rename)');
}

// ---- Section 2: real production capability data for every pillar business -------------------
// Uses the full production index.html (not isolatedLegacyIndex) and ctx.__ct_engine -- the
// engine instance TycoonEngine.load() itself creates and binds through
// js/player-engine-bridge.js's bindEngine() -- because modules.peUIAdapter.getPEUIData() reads
// the engine via modules.playerEngineBridge.getEngine(), which only resolves to an engine created
// through the patched EngineClass.load(), not a bare `new engineModule.TycoonEngine()` (that
// pattern is fine for the other PE tests, which call context/ops functions directly and never
// touch the adapter/bridge layer).
{
  const { ctx, modules } = loadGame({ random: lcg(190826041 + 51) });
  const engine = ctx.__ct_engine;
  engine.configure({ playerName: 'UI Connection Test', companyName: 'UI Connection Co', difficulty: 'normal' });
  engine.g.companyCash = 9_000_000_000; engine.g.personalCash = 12_000_000_000;
  const pf = modules.peFund, ops = modules.pePortfolioOperations, context = modules.managementContext;
  pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });

  const deals = {};
  for (const businessID of ['gym', 'conveni', 'ramen', 'realEstateAgency', 'productVentures']) {
    deals[businessID] = ops.acquirePillarCompany(engine.g, fund.id, { businessID, enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
    assert(deals[businessID], `${businessID} PE deal acquired`);
  }
  deals.gym.portfolioCompany.priceMultiplier = 1.15;
  deals.gym.portfolioCompany.gymOperatingState = { gymMembership: { membershipStrategy: 'premium' } };
  deals.conveni.portfolioCompany.priceMultiplier = 1.3;

  // resolvePortfolioManagementCapability() directly (no UI involved) -- the source of truth the
  // manage screen's guard depends on.
  assert.equal(context.resolvePortfolioManagementCapability(deals.gym).actionsEnabled, true, 'gym keeps its detached bridge');
  assert.equal(context.resolvePortfolioManagementCapability(deals.conveni).actionsEnabled, true, 'conveni keeps its detached bridge');
  assert.equal(context.resolvePortfolioManagementCapability(deals.ramen).actionsEnabled, true, 'ramen now has its detached market bridge');
  assert.equal(context.resolvePortfolioManagementCapability(deals.productVentures).actionsEnabled, true, 'productVentures now has its detached production bridge connected to player-facing management');
  assert.equal(context.resolvePortfolioManagementCapability(deals.realEstateAgency).actionsEnabled, true, 'realEstateAgency now has its detached production bridge connected to player-facing management');

  // portfolioManagementDetails() indirectly, via the real adapter.getPEUIData() -- the exact data
  // manageView() consumes to decide what to render.
  for (const businessID of ['gym', 'conveni', 'ramen', 'realEstateAgency', 'productVentures']) {
    const model = modules.peUIAdapter.getPEUIData({ portfolioDealId: deals[businessID].id });
    const holding = model.portfolio.holdings.find(h => h.dealID === deals[businessID].id);
    assert(holding, `${businessID} holding present in the real portfolio model`);
    assert(Number.isFinite(holding.management.gym?.priceMultiplier), `${businessID} always gets at least a business-agnostic priceMultiplier`);
    if (businessID === 'gym') {
      assert.equal(holding.management.gym.priceMultiplier, 1.15);
      assert.equal(holding.management.gym.membershipStrategy, 'premium', 'gym keeps its membership-strategy lever unchanged');
      assert(Array.isArray(holding.management.gym.strategies) && holding.management.gym.strategies.length === 3, 'gym keeps its 3-strategy list unchanged');
    } else {
      assert.equal(Object.keys(holding.management.gym).length, 1, `${businessID} gets price only, no membership-strategy fields`);
      assert.equal(holding.management.gym.membershipStrategy, undefined);
      assert.equal(holding.management.gym.strategies, undefined);
      if (businessID === 'conveni') assert.equal(holding.management.gym.priceMultiplier, 1.3);
    }
    // actionsEnabled is what manageView()'s guard actually checks -- confirm it matches the
    // capability check above, independent of whatever portfolioManagementDetails() returned.
    const expectedEnabled = ['gym','conveni','ramen','productVentures','realEstateAgency'].includes(businessID);
    assert.equal(holding.management.actionsEnabled, expectedEnabled, `${businessID} actionsEnabled must match resolvePortfolioManagementCapability()`);\n    assert.equal(holding.management.priceEnabled, businessID !== 'realEstateAgency', `${businessID} price availability must match the production model`);
  }

  // The 6 generic PE levers (already confirmed business-agnostic in tests/pe-portfolio-weekly-settlement-test.js)
  // must keep working identically for conveni through the real adapter.performPortfolio() path used
  // by the D UI's price slider (setGymPriceMultiplier is the wired action id; its underlying call is
  // the generic portfolio.setPriceMultiplier(), already business-agnostic -- this just proves the
  // adapter's own actionsEnabled re-check (defense in depth) now passes for conveni too).
  const before = { conveniPrice: deals.conveni.portfolioCompany.priceMultiplier, ramenPrice: deals.ramen.portfolioCompany.priceMultiplier };
  assert.equal(modules.peUIAdapter.performPortfolio('setGymPriceMultiplier', { fundID: fund.id, dealID: deals.conveni.id, value: 1.6 }), true, 'the generic price action succeeds for a conveni deal (actionsEnabled:true)');
  assert.equal(deals.conveni.portfolioCompany.priceMultiplier, 1.6);
  assert.notEqual(deals.conveni.portfolioCompany.priceMultiplier, before.conveniPrice);
  assert.equal(modules.peUIAdapter.performPortfolio('setGymPriceMultiplier', { fundID: fund.id, dealID: deals.ramen.id, value: 1.6 }), true, 'the generic price action now succeeds for a ramen deal (actionsEnabled:true)');
  assert.equal(deals.ramen.portfolioCompany.priceMultiplier, 1.6, 'ramen price action mutates only the PE portfolio-company price multiplier');
  assert.notEqual(deals.ramen.portfolioCompany.priceMultiplier, before.ramenPrice);
  assert.equal(modules.peUIAdapter.performPortfolio('setGymMembershipStrategy', { fundID: fund.id, dealID: deals.conveni.id, strategyID: 'premium' }), false, 'conveni has no membership-strategy lever, so this gym-only action must still refuse it even though actionsEnabled is true');
  assert.equal(modules.peUIAdapter.performPortfolio('setGymMembershipStrategy', { fundID: fund.id, dealID: deals.ramen.id, strategyID: 'premium' }), false, 'ramen has no membership-strategy lever, so this gym-only action must still refuse it even though actionsEnabled is true');
}

console.log('PE conveni UI connection tests passed');
