'use strict';
// Long-run companion to tests/pe-realestate-agency-portfolio-bridge-test.js's single-week
// accounting-isolation check. A single week is enough to prove the mechanism (a freshly constructed
// detached store, never a reference to the real self-company store) is structurally sound, but
// store.brokeragePipeline.totals accumulate forever across weeks -- a leak that only shows up after
// many weeks of compounding would not necessarily be visible after one week. This test runs 208
// weeks of concurrent self-company realEstateAgency store operation and PE realEstateAgency
// portfolio company simulation and checks accounting isolation holds at both a week100 checkpoint
// and the final week208 state.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const WEEKS = 208;
const CHECKPOINT_WEEK = 100;

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function tryOpenRealEstateAgency(engine) {
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
  if (!tenant) return false;
  return engine.openStore({ tenantID: tenant.id, businessID: 'realEstateAgency', operatingHours: 3 });
}
function checkIsolation(engine, deal, store, expectedInquiries, label) {
  const pipeline = engine.g.stores.find(s => s.id === store.id).brokeragePipeline;
  assert.equal(pipeline.totals.inquiries, expectedInquiries, `${label}: self-company store's cumulative totals must reflect exactly its own weekly processing, never a doubled/contaminated increment from the concurrently-simulated PE deal`);
  assert.equal(engine.g.stores.length, 1, `${label}: no synthetic PE store may ever be pushed into the real g.stores array`);
  assert(!engine.g.stores.some(s => String(s.id).startsWith(`pe-realestate-${deal.id}`)), `${label}: no synthetic PE realEstateAgency store ever appears in the real store list`);
}

const { engineModule, modules } = loadGame({ random: lcg(190826041 + 51), isolatedLegacyIndex: true });
const engine = new engineModule.TycoonEngine();
engine.configure({ playerName: '208-Week Isolation', companyName: 'Self RE Agency Co', difficulty: 'normal' });
engine.g.companyCash = 30_000_000_000;
engine.g.personalCash = 20_000_000_000;
assert(tryOpenRealEstateAgency(engine), 'self-company realEstateAgency store opens');
const store = engine.g.stores.find(s => s.businessID === 'realEstateAgency');
while (store.status !== 'open') engine.advanceWeek(false);

const pf = modules.peFund, ops = modules.pePortfolioOperations;
pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'realEstateAgency', enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
assert(deal && deal.portfolioCompany.productionSite, 'PE realEstateAgency deal acquired');
deal.portfolioCompany.priceMultiplier = 1.8; // deliberately far from the self-company's neutral price throughout

let cumulativeInquiries = store.brokeragePipeline.totals.inquiries;
for (let w = 1; w <= WEEKS && !engine.g.gameOver; w++) {
  engine.advanceWeek(false);
  cumulativeInquiries += store.brokeragePipeline.lastWeek.inquiries;
  if (engine.g.week === CHECKPOINT_WEEK) checkIsolation(engine, deal, store, cumulativeInquiries, `week${CHECKPOINT_WEEK} checkpoint`);
}
assert(!engine.g.gameOver, 'self-company must not go bankrupt during this accounting-isolation run');
checkIsolation(engine, deal, store, cumulativeInquiries, `week${WEEKS} final`);

assert(Number.isFinite(deal.portfolioCompany.cash), 'PE deal cash remains finite through 208 weeks of concurrent simulation');
console.log(`PE realEstateAgency bridge 208-week isolation regression ok (self totals.inquiries=${store.brokeragePipeline.totals.inquiries}, PE dealCash=${Math.round(deal.portfolioCompany.cash)}, week=${engine.g.week})`);
