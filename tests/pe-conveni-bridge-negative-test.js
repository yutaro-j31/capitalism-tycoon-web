'use strict';
// Negative/mutation counterpart to tests/pe-conveni-portfolio-bridge-test.js and
// tests/pe-conveni-bridge-208week-regression-test.js. Proves those tests actually detect the
// accounting leak they claim to guard against: this test reverts the state-detachment fix in an
// in-memory copy of js/management-context.js (js/convenience-merchandising.js itself is never
// touched -- the real file on disk is never touched either) so that
// previewPEPortfolioConveniWeekForState() hands convenience-merchandising.js's processStore() the
// REAL simulation state instead of a detached runtime, and confirms this naive (pre-fix-shaped)
// version DOES corrupt the self-company's g.conveniMerchandising bucket with a stray PE-deal key.
// If this test ever starts passing (i.e. the reverted code stops corrupting state), the positive
// isolation tests next to it have silently stopped being a meaningful guard and both need to be
// re-examined.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGameFromHtml, readIndex } = require('./harness');

const ROOT = path.join(__dirname, '..');
const MANAGEMENT_CONTEXT_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'management-context.js'), 'utf8');
const MANAGEMENT_CONTEXT_TAG = '<script src="./js/management-context.js"></script>';
const FIXED_RUNTIME = 'const runtime={week:input.week,conveniMerchandising:clone(input.operatingState),stores:input.siblingStores};';
// The naive pre-fix shape: hand processStore() the real simulation state directly, exactly what a
// gym-style "just pass state through" bridge without the detachment step would do.
const BUGGY_RUNTIME = 'const runtime=state;';

assert(MANAGEMENT_CONTEXT_SOURCE.includes(FIXED_RUNTIME), 'expected the detached-runtime construction in js/management-context.js; has it been refactored?');
assert.equal(MANAGEMENT_CONTEXT_SOURCE.split(FIXED_RUNTIME).length - 1, 1, 'expected exactly one occurrence of the fixed detached-runtime construction');

const revertedSource = MANAGEMENT_CONTEXT_SOURCE.replace(FIXED_RUNTIME, BUGGY_RUNTIME);
const html = readIndex().replace(MANAGEMENT_CONTEXT_TAG, `<script>${revertedSource}</script>`);

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function tryOpenConveni(engine) {
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
  if (!tenant) return false;
  return engine.openStore({ tenantID: tenant.id, businessID: 'conveni', operatingHours: 3 });
}

const { ctx, modules } = loadGameFromHtml(html, { random: lcg(190826041 + 31) });
const engine = ctx.__ct_engine;
engine.configure({ playerName: 'Negative Test', companyName: 'Reverted Isolation', difficulty: 'normal' });
engine.g.companyCash = 9_000_000_000;
engine.g.personalCash = 12_000_000_000;
assert(tryOpenConveni(engine), 'self-company conveni store opens');
const store = engine.g.stores.find(s => s.businessID === 'conveni');
while (store.status !== 'open') engine.advanceWeek(false);

const pf = modules.peFund, ops = modules.pePortfolioOperations;
pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'conveni', enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
assert(deal && deal.portfolioCompany.productionSite, 'PE conveni deal acquired');
deal.portfolioCompany.storeCount = 6;
deal.portfolioCompany.priceMultiplier = 1.3;

engine.advanceWeek(false);
const merch = engine.g.conveniMerchandising;
const peKey = `pe-conveni-${deal.id}`;
console.log(JSON.stringify({ selfStoreKeys: Object.keys(merch.lastWeekByStoreID), hasPEKey: Object.hasOwn(merch.lastWeekByStoreID, peKey), selfClusterCount: merch.lastWeekByStoreID[store.id]?.clusterCount }));

// The reverted (pre-detachment) code must reproduce the leak: the PE deal's synthetic store id
// bleeds into the self-company's own conveniMerchandising bucket, and/or the self-company's own
// record picks up the PE deal's clusterCount proxy contamination via the shared g.stores scan
// (clusterCountFor(state,store) now scans the real g.stores, which the reverted code never
// isolated the PE deal's synthetic siblings from -- they were pushed nowhere, but the store
// object itself was processed against the real g, so its own record's totals now double up
// against the self-company's own bucket instead of a separate one).
assert(
  Object.hasOwn(merch.lastWeekByStoreID, peKey) || Object.keys(merch.lastWeekByStoreID).length !== 1,
  `expected the reverted (pre-fix) code to leak the PE deal into the self-company conveniMerchandising bucket, got: ${JSON.stringify(merch.lastWeekByStoreID)}`
);

console.log('PE conveni bridge negative test ok (reverted code still reproduces the accounting leak, confirming the isolation tests have real detection power)');
