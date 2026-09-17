'use strict';
// Long-run companion to tests/pe-conveni-portfolio-bridge-test.js's single-week accounting-
// isolation check. A single week is enough to prove the mechanism (detached runtime, never the
// real state) is structurally sound, but g.conveniMerchandising.totals accumulate forever across
// weeks -- a leak that only shows up after many weeks of compounding (e.g. a subtle aliasing bug
// that only corrupts totals without touching lastWeekByStoreID keys) would not necessarily be
// visible after one week. This test runs 208 weeks of concurrent self-company conveni store
// growth (2 stores) and PE conveni portfolio company simulation and checks accounting isolation
// holds at both a week100 checkpoint and the final week208 state.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const WEEKS = 208;
const CHECKPOINT_WEEK = 100;

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function tryOpenConveni(engine) {
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
  if (!tenant) return false;
  return engine.openStore({ tenantID: tenant.id, businessID: 'conveni', operatingHours: 3 });
}
function selfConveniStoreIDs(engine) {
  return new Set(engine.g.stores.filter(s => s.businessID === 'conveni').map(s => s.id));
}
function checkIsolation(engine, deal, label) {
  const merch = engine.g.conveniMerchandising;
  const selfIDs = selfConveniStoreIDs(engine);
  if (merch) {
    for (const key of Object.keys(merch.lastWeekByStoreID)) {
      assert(selfIDs.has(key), `${label}: self-company conveniMerchandising must only contain real self-company store ids, found stray key ${key}`);
      assert(!key.startsWith('pe-conveni-'), `${label}: no PE-deal-derived key may ever appear in the self-company bucket`);
    }
  }
  if (deal.portfolioCompany.conveniOperatingState) {
    const peKeys = Object.keys(deal.portfolioCompany.conveniOperatingState.lastWeekByStoreID);
    assert.equal(peKeys.length, 1, `${label}: PE deal operating state must contain exactly its own detached store record`);
    assert.equal(peKeys[0], `pe-conveni-${deal.id}`, `${label}: PE deal record must be keyed by its own synthetic id`);
    for (const id of selfIDs) assert(!peKeys.includes(id), `${label}: PE deal operating state must never contain a self-company store id`);
  }
}

const { engineModule, modules } = loadGame({ random: lcg(190826041 + 21), isolatedLegacyIndex: true });
const engine = new engineModule.TycoonEngine();
engine.configure({ playerName: '208-Week Isolation', companyName: 'Self Conveni Chain', difficulty: 'normal' });
engine.g.companyCash = 30_000_000_000;
engine.g.personalCash = 20_000_000_000;
assert(tryOpenConveni(engine), 'first self-company conveni store opens');

const pf = modules.peFund, ops = modules.pePortfolioOperations;
pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'conveni', enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
assert(deal && deal.portfolioCompany.productionSite, 'PE conveni deal acquired');
deal.portfolioCompany.storeCount = 12; // deliberately far from the self-company's own store count throughout

let secondStoreOpened = false;
for (let w = 1; w <= WEEKS && !engine.g.gameOver; w++) {
  engine.advanceWeek(false);
  // Grow the self-company's own conveni chain partway through, so its real cluster/chain-scale
  // counts genuinely change over time -- and must keep tracking only its own real store count,
  // never drifting toward the PE deal's unrelated storeCount=12.
  if (!secondStoreOpened && engine.g.week >= 40 && engine.g.companyCash > 50_000_000) {
    if (tryOpenConveni(engine)) secondStoreOpened = true;
  }
  if (engine.g.week === CHECKPOINT_WEEK) checkIsolation(engine, deal, `week${CHECKPOINT_WEEK} checkpoint`);
}
assert(!engine.g.gameOver, 'self-company must not go bankrupt during this accounting-isolation run');
assert(secondStoreOpened, 'self-company conveni cluster must actually grow to 2 stores during the run for the cluster-count isolation check to be meaningful');
checkIsolation(engine, deal, `week${WEEKS} final`);

// The self-company's own real 2-store cluster bonus must be visible and untouched by the PE
// deal's storeCount=12 -- a genuine leak would show clusterCount influenced by the PE value.
const merch = engine.g.conveniMerchandising;
const selfRecords = Object.values(merch.lastWeekByStoreID);
assert(selfRecords.length === 2, 'both self-company conveni stores have their own record');
for (const record of selfRecords) assert.equal(record.clusterCount, 1, 'self-company clusterCount reflects its own 2-store cluster (1 sibling), never the PE deal storeCount=12');

assert(Number.isFinite(deal.portfolioCompany.cash), 'PE deal cash remains finite through 208 weeks of concurrent simulation');
assert.equal(Object.hasOwn(engine.g, 'conveniMerchandising'), true);
console.log(`PE conveni bridge 208-week isolation regression ok (self stores=${selfRecords.length}, PE dealCash=${Math.round(deal.portfolioCompany.cash)}, week=${engine.g.week})`);
