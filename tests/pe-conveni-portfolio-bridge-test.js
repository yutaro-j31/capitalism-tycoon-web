'use strict';
// PE conveni bridge (Founding Route Rebalance, PE conveni bridge PR). Follows the gym bridge
// precedent (js/pe-portfolio-operations.js:calculateGymPortfolioOperatingWeek /
// js/management-context.js:previewPEPortfolioGymWeekForState -- see
// founding-route-verification-log.md Entry 26/27 for the investigation that identified conveni's
// two gym-absent obstacles): js/convenience-merchandising.js's processStore() reads/writes a
// SINGLE company-wide g.conveniMerchandising bucket and scans the real g.stores for cluster/chain
// sibling counts. The bridge in js/management-context.js never hands processStore() the real
// simulation state -- it builds a throwaway runtime object carrying only a clone of the PE deal's
// own deal.portfolioCompany.conveniOperatingState and a synthetic sibling-store array derived from
// pc.storeCount, so js/convenience-merchandising.js itself needed zero changes.
//
// This file's single most important test is the accounting-integrity case in section 1: with a
// REAL self-company conveni store open and producing real g.conveniMerchandising records,
// simulating a PE conveni portfolio company in the same week must leave the self-company's own
// g.conveniMerchandising bucket showing no trace of the PE deal (no PE store key, and cluster/
// chain counts derived only from the self-company's own real store count, never the PE deal's
// abstract storeCount).
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
// Opening a conveni store (storeCost 4.3M, below the 7M threshold) starts it in status:'preparing'
// with a 3-week build-out (see js/engine.js openStore()); it only starts producing weekly
// conveniMerchandising records once status flips to 'open' at week>=openingWeek.
function buildEngineWithSelfConveniStore(seed) {
  const { engineModule, modules } = loadGame({ random: lcg(seed), isolatedLegacyIndex: true });
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: 'Isolation Test', companyName: 'Self Conveni Co', difficulty: 'normal' });
  engine.g.companyCash = 9_000_000_000;
  engine.g.personalCash = 12_000_000_000;
  const store = tryOpenBusiness(engine, 'conveni');
  assert(store, 'self-company conveni store must open for this fixture to be meaningful');
  while (store.status !== 'open') engine.advanceWeek(false);
  return { engine, modules, store };
}
const plain = value => JSON.parse(JSON.stringify(value));

// ---- Section 1: accounting-integrity negative test (the most important test in this file) -----
{
  const SEED = 190826041 + 11;
  // A single engine, not a control-vs-PE diff across two separate runs: PE deal setup
  // (recordExit/createFund/acquirePillarCompany) is not guaranteed RNG-free, so two independently
  // seeded engines could diverge in their event/competitor RNG stream for reasons unrelated to the
  // conveni bridge and produce a flaky false failure. Asserting directly on the exact leak
  // vectors (store keys, cluster/chain counts, store list membership) is both stronger proof of
  // isolation than a coincidental byte-diff match and immune to that divergence risk.
  const { engine, modules, store } = buildEngineWithSelfConveniStore(SEED);
  const storesBefore = engine.g.stores.length;
  const pf = modules.peFund, ops = modules.pePortfolioOperations;
  pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'conveni', enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
  assert(deal && deal.portfolioCompany.productionSite, 'PE conveni deal acquired with a production site');
  // A PE portfolio company with 6 stores set against a self-company with exactly 1 conveni store:
  // if pc.storeCount ever leaked into the self-company's own cluster/chain calculation, the
  // self-company record's clusterCount/chainStoreCount would show 5, not the true 0.
  deal.portfolioCompany.storeCount = 6;
  deal.portfolioCompany.priceMultiplier = 1.3;

  engine.advanceWeek(false); // self-company store processes AND the PE deal auto-processes (pe-portfolio-operations.js install() hook)
  const merch = plain(engine.g.conveniMerchandising);

  assert.equal(Object.keys(merch.lastWeekByStoreID).length, 1, 'self-company conveniMerchandising must contain only the self-company store');
  assert(Object.hasOwn(merch.lastWeekByStoreID, store.id), 'self-company store record is present and keyed by the real store id');
  assert(!Object.hasOwn(merch.lastWeekByStoreID, `pe-conveni-${deal.id}`), 'the PE deal detached store record must never appear in the self-company bucket');
  const selfRecord = merch.lastWeekByStoreID[store.id];
  assert.equal(selfRecord.clusterCount, 0, 'self-company (1 real conveni store) clusterCount must not be contaminated by the PE deal storeCount=6 proxy');
  assert.equal(selfRecord.chainStoreCount, 0, 'self-company chainStoreCount must not be contaminated by the PE deal storeCount=6 proxy');
  assert.equal(selfRecord.clusterDemandBonus, 0);
  assert.equal(selfRecord.chainScaleDiscount, 0);
  assert.equal(engine.g.stores.length, storesBefore, 'PE synthetic sibling stores must never be pushed into the real g.stores array');
  assert(!engine.g.stores.some(s => String(s.id).startsWith(`pe-conveni-${deal.id}`)), 'no synthetic PE conveni store/sibling ever appears in the real store list');

  // The PE deal gets its own, separately-keyed record.
  assert(deal.portfolioCompany.conveniOperatingState, 'PE deal settles its own conveniOperatingState');
  const peRecord = deal.portfolioCompany.conveniOperatingState.lastWeekByStoreID[`pe-conveni-${deal.id}`];
  assert(peRecord, 'PE deal detached store record is keyed by its own synthetic id');
  assert.equal(peRecord.clusterCount, 5, 'PE deal own record correctly reflects its own storeCount=6 proxy (5 siblings)');
  assert.equal(Object.keys(deal.portfolioCompany.conveniOperatingState.lastWeekByStoreID).length, 1, 'PE deal operating state contains only its own detached store, never the self-company store or its own siblings');
}

// ---- Section 2: storeCount drives the cluster/chain proxy through the same capped formula -------
{
  const { engineModule, modules } = loadGame({ random: lcg(190826041 + 12), isolatedLegacyIndex: true });
  const pf = modules.peFund, ops = modules.pePortfolioOperations, context = modules.managementContext;
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: 'Cluster Test', companyName: 'PE Conveni Cluster', difficulty: 'normal' });
  engine.g.companyCash = 9_000_000_000; engine.g.personalCash = 12_000_000_000;
  pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'conveni', enterpriseValue: 2_000_000_000, useCoinvest: false, week: 1 });
  const merch = modules.convenienceMerchandising;

  function recordFor(storeCount) {
    deal.portfolioCompany.storeCount = storeCount;
    const preview = context.previewPEPortfolioConveniWeekForState(engine.g, fund.id, deal.id, { week: 5 });
    assert.equal(preview.ok, true);
    return preview.storeRecord;
  }

  const single = recordFor(1);
  assert.equal(single.clusterCount, 0, 'storeCount=1 (no siblings) yields clusterCount 0');
  assert.equal(single.chainStoreCount, 0);
  assert.equal(single.clusterDemandBonus, 0);
  assert.equal(single.chainScaleDiscount, 0);

  // js/convenience-merchandising.js keeps CLUSTER_DEMAND_BONUS_PER_STORE(.02)/MAX(.10) and
  // CLUSTER_WASTE_REDUCTION_PER_STORE(.10)/MAX(.45) module-private (not exported); mirrored here
  // from the source read directly, same as CHAIN_SCALE_DISCOUNT_PER_STORE/MAX which are exported.
  const CLUSTER_DEMAND_BONUS_PER_STORE = .02, CLUSTER_DEMAND_BONUS_MAX = .10;
  const CLUSTER_WASTE_REDUCTION_PER_STORE = .10, CLUSTER_WASTE_REDUCTION_MAX = .45;
  assert.equal(merch.CHAIN_SCALE_DISCOUNT_PER_STORE, .006);
  assert.equal(merch.CHAIN_SCALE_DISCOUNT_MAX, .12);

  const six = recordFor(6);
  assert.equal(six.clusterCount, 5, 'storeCount=6 proxies to 5 siblings for both cluster and chain counts');
  assert.equal(six.chainStoreCount, 5, 'cluster and chain-wide proxy counts are identical -- the PE abstraction has no real store geography to tell them apart with');
  assert.equal(six.clusterDemandBonus, Math.min(CLUSTER_DEMAND_BONUS_MAX, 5 * CLUSTER_DEMAND_BONUS_PER_STORE), 'cluster demand bonus follows the unmodified processStore() formula for the proxy count');
  assert.equal(six.clusterWasteReduction, Math.min(CLUSTER_WASTE_REDUCTION_MAX, 5 * CLUSTER_WASTE_REDUCTION_PER_STORE));
  assert.equal(six.chainScaleDiscount, Math.min(merch.CHAIN_SCALE_DISCOUNT_MAX, 5 * merch.CHAIN_SCALE_DISCOUNT_PER_STORE));
  assert(six.clusterDemandBonus > single.clusterDemandBonus, 'more proxy siblings raise the cluster demand bonus versus the storeCount=1 baseline');
  assert(six.chainScaleDiscount > single.chainScaleDiscount, 'more proxy siblings raise the chain-scale procurement discount versus the storeCount=1 baseline');

  // Large storeCount must saturate at the same caps processStore() already enforces -- the proxy
  // sibling array grows without bound, but the reused formula inside processStore() still clamps.
  const huge = recordFor(500);
  assert.equal(huge.clusterCount, 499);
  assert.equal(huge.clusterDemandBonus, CLUSTER_DEMAND_BONUS_MAX, 'cluster demand bonus saturates at the existing cap for a large proxy store count');
  assert.equal(huge.clusterWasteReduction, CLUSTER_WASTE_REDUCTION_MAX, 'cluster waste reduction saturates at the existing cap');
  assert.equal(huge.chainScaleDiscount, merch.CHAIN_SCALE_DISCOUNT_MAX, 'chain-scale discount saturates at the existing cap');
}
console.log('PE conveni portfolio bridge tests passed');
