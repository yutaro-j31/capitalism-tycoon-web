'use strict';
// Negative/mutation counterpart to tests/pe-realestate-agency-portfolio-bridge-test.js and
// tests/pe-realestate-agency-bridge-208week-regression-test.js. Proves those tests actually detect
// the accounting leak they claim to guard against.
//
// Unlike conveni (whose leak vector is runtime.stores being the real g.stores array, scanned by
// clusterCountFor/chainStoreCountFor), real-estate-agency-pipeline.js's processStore() never reads
// g.stores or g.businesses at all -- its only write target is store.brokeragePipeline, on whichever
// `store` object is handed to it directly. So the real detachment guarantee here is entirely about
// object identity: js/management-context.js's buildPEPortfolioRealEstateAgencyOperatingInputForState()
// always constructs a brand-new store object rather than looking one up from state.stores, and
// previewPEPortfolioRealEstateAgencyWeekForState() additionally clones it before calling
// processStore(). This test reverts BOTH in an in-memory copy of js/management-context.js
// (js/real-estate-agency-pipeline.js itself is never touched -- the real file on disk is never
// touched either): the naive shape a "just reuse an existing store of this business type" bridge
// without proper detachment would have -- and confirms this reproduces a real leak: the PE deal's
// weekly calculation directly mutates the self-company's own real store.brokeragePipeline. If this
// test ever starts passing (i.e. the reverted code stops corrupting state), the positive isolation
// tests next to it have silently stopped being a meaningful guard and both need to be re-examined.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGameFromHtml, readIndex } = require('./harness');

const ROOT = path.join(__dirname, '..');
const MANAGEMENT_CONTEXT_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'management-context.js'), 'utf8');
const MANAGEMENT_CONTEXT_TAG = '<script src="./js/management-context.js"></script>';

// Fix 1: build() always constructs a fresh detached store, never looks one up from state.stores.
const FIXED_BUILD_STORE = "const detachedStore={id:`pe-realestate-${dealID}`,businessID:REAL_ESTATE_AGENCY_BUSINESS_ID,status:'open',brokeragePipeline:clone(normalizedOperatingState)};";
const BUGGY_BUILD_STORE = "const detachedStore=(state?.stores||[]).find(row=>row?.businessID===REAL_ESTATE_AGENCY_BUSINESS_ID)||{id:`pe-realestate-${dealID}`,businessID:REAL_ESTATE_AGENCY_BUSINESS_ID,status:'open',brokeragePipeline:clone(normalizedOperatingState)};";
assert(MANAGEMENT_CONTEXT_SOURCE.includes(FIXED_BUILD_STORE), 'expected the fresh detached-store construction in buildPEPortfolioRealEstateAgencyOperatingInputForState(); has it been refactored?');
assert.equal(MANAGEMENT_CONTEXT_SOURCE.split(FIXED_BUILD_STORE).length - 1, 1, 'expected exactly one occurrence');

// Fix 2: preview() clones store/business before calling processStore(), so even a live reference
// from build() cannot reach the real state. Anchored on the unique preceding comment because the
// clone() line text itself also appears in the gym/conveni preview functions above it.
const FIXED_PREVIEW_ANCHOR = "  // real-estate-agency-pipeline.js's processStore() therefore cannot reach or mutate the player's\n  // self-company records (confirmed by reading it in full: it references only g.week/g.seed/\n  // g.realEstateCycle and writes only store.brokeragePipeline).\n  const runtime={week:input.week,seed:finite(state?.seed,1),realEstateCycle:finite(state?.realEstateCycle,1)};";
assert(MANAGEMENT_CONTEXT_SOURCE.includes(FIXED_PREVIEW_ANCHOR), 'expected the realEstateAgency preview anchor block; has it been refactored?');
const FIXED_PREVIEW_STORE = 'const store=clone(input.store),business=clone(input.business);\n  // The detached runtime never aliases the real state: week/seed/realEstateCycle are copied';
const BUGGY_PREVIEW_STORE = 'const store=input.store,business=input.business;\n  // The detached runtime never aliases the real state: week/seed/realEstateCycle are copied';
const previewBlockStart = MANAGEMENT_CONTEXT_SOURCE.indexOf(FIXED_PREVIEW_STORE, MANAGEMENT_CONTEXT_SOURCE.indexOf('function previewPEPortfolioRealEstateAgencyWeekForState'));
assert(previewBlockStart >= 0, 'expected the clone() line inside previewPEPortfolioRealEstateAgencyWeekForState(); has it been refactored?');

let revertedSource = MANAGEMENT_CONTEXT_SOURCE.slice(0, previewBlockStart) + BUGGY_PREVIEW_STORE + MANAGEMENT_CONTEXT_SOURCE.slice(previewBlockStart + FIXED_PREVIEW_STORE.length);
revertedSource = revertedSource.replace(FIXED_BUILD_STORE, BUGGY_BUILD_STORE);
const html = readIndex().replace(MANAGEMENT_CONTEXT_TAG, `<script>${revertedSource}</script>`);

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function tryOpenRealEstateAgency(engine) {
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
  if (!tenant) return false;
  return engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', operatingHours: 3 });
}
const plain = value => JSON.parse(JSON.stringify(value));

const { ctx, modules } = loadGameFromHtml(html, { random: lcg(190826041 + 61) });
const engine = ctx.__ct_engine;
engine.configure({ playerName: 'Negative Test', companyName: 'Reverted RE Isolation', difficulty: 'normal' });
engine.g.companyCash = 9_000_000_000;
engine.g.personalCash = 12_000_000_000;
assert(tryOpenRealEstateAgency(engine), 'self-company realEstateAgency store opens');
const store = engine.g.stores.find(s => s.businessID === 'realEstateAgency');
while (store.status !== 'open') engine.advanceWeek(false);

const pf = modules.peFund, ops = modules.pePortfolioOperations, context = modules.managementContext;
pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'realEstateAgency', enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
assert(deal && deal.portfolioCompany.productionSite, 'PE realEstateAgency deal acquired');
deal.portfolioCompany.priceMultiplier = 1.7;

// A pure preview call (no settlement at all) is enough to prove the leak with the reverted code:
// it must never mutate any part of engine.g, matching the contract already proven for the fixed
// code in tests/pe-realestate-agency-portfolio-bridge-test.js.
const before = plain(store.brokeragePipeline);
const preview = context.previewPEPortfolioRealEstateAgencyWeekForState(engine.g, fund.id, deal.id, { week: engine.g.week + 1 });
assert.equal(preview.ok, true);
const after = plain(store.brokeragePipeline);
console.log(JSON.stringify({ before: before.totals, after: after.totals, lastWeekBefore: before.lastWeek, lastWeekAfter: after.lastWeek }));

// The reverted (pre-detachment) code must reproduce the leak: since a real self-company
// realEstateAgency store exists, build() picks it up via state.stores.find(), and preview() no
// longer clones it before calling processStore() -- so the PE deal's own preview calculation
// mutates the self-company's real store.brokeragePipeline in place.
assert.notDeepEqual(after, before, 'expected the reverted (pre-fix) code to mutate the self-company store\'s real brokeragePipeline via the PE deal\'s preview call, but it stayed unchanged -- the leak did not reproduce');

console.log('PE realEstateAgency bridge negative test ok (reverted code still reproduces the accounting leak, confirming the isolation tests have real detection power)');
