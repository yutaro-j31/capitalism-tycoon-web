'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function releasedProduct(policy) {
  return {
    id: 'recall-reachability-product', name: 'Reachability Cloud', status: 'released', origin: 'office',
    quality: 82, brand: 76, revenue: 0, profit: 0, users: 28000, paidUsers: 4200,
    price: 4800, serverCost: 90000, serverCapacity: 80000, market: 4_000_000,
    valuation: 180_000_000, maintenancePolicy: policy, technicalDebt: 0,
    lifecycleAgeWeeks: 0, lifecycleStage: 'active', lifecycleIncidents: 0
  };
}

function simulate({ policy, seed, respond }) {
  const loaded = loadGame({ headless: true, random: rng(seed) });
  assert(loaded.modules.productLifecycle?.__installed, 'product lifecycle module must be loaded');
  const engine = new loaded.engineModule.TycoonEngine();
  engine.g.productVentures = [releasedProduct(policy)];
  engine.normalize();
  engine.g.configured = true;
  let firstRecallWeek = null;
  let responseWeek = null;
  let minCash = engine.g.companyCash;
  let profitableWeeks = 0;
  let observedWeeks = 0;
  for (let i = 0; i < 207; i++) {
    assert.notEqual(engine.advanceWeek(false), false);
    const product = engine.g.productVentures[0];
    if (Number(product?.profit) > 0) profitableWeeks++;
    observedWeeks++;
    minCash = Math.min(minCash, Number(engine.g.companyCash));
    const starts = engine.g.productRecallHistory.filter(row => row.type === 'started');
    if (starts.length && firstRecallWeek === null) firstRecallWeek = starts.at(-1).week;
    if (respond && engine.g.activeProductRecall?.responseStatus === 'pending') {
      assert.equal(engine.executeProductRecallResponse(), true, 'normal response API must be executable');
      responseWeek = engine.g.week;
    }
  }
  const starts = engine.g.productRecallHistory.filter(row => row.type === 'started');
  const resolved = engine.g.productRecallHistory.filter(row => row.type === 'resolved');
  const cumulativeLostRevenue = resolved.reduce((sum, row) => sum + Number(row.cumulativeLostRevenue || 0), 0)
    + Number(engine.g.activeProductRecall?.cumulativeLostRevenue || 0);
  const financeValidation = loaded.modules.finance.validate(engine.g);
  assert.equal(financeValidation.ok, true, JSON.stringify(financeValidation));
  const lifecycleValidation = loaded.modules.productLifecycle.validate(engine.g);
  assert.equal(lifecycleValidation.ok, true, lifecycleValidation.errors.join('\n'));
  return {
    policy, seed, respond,
    firstRecallWeek,
    responseWeek,
    recallCount: starts.length,
    cumulativeLostRevenue: Math.round(cumulativeLostRevenue),
    finalCash: Math.round(engine.g.companyCash),
    minCash: Math.round(minCash),
    companyReputation: Number(engine.g.companyReputation.toFixed(4)),
    finalTechnicalDebt: Number(engine.g.productVentures[0].technicalDebt.toFixed(4)),
    finalRevenue: Math.round(engine.g.productVentures[0].revenue),
    finalProfit: Math.round(engine.g.productVentures[0].profit),
    profitableRatio: Number((profitableWeeks / Math.max(1, observedWeeks)).toFixed(4)),
    riskHistory: engine.g.productRecallRiskHistory.length,
    finalWeek: engine.g.week
  };
}

const seed = 0x8f300101;
const ignoredA = simulate({ policy: 'lean', seed, respond: false });
const ignoredB = simulate({ policy: 'lean', seed, respond: false });
assert.deepEqual(ignoredA, ignoredB, 'same-seed ignored recall path is deterministic');
assert(ignoredA.firstRecallWeek !== null && ignoredA.firstRecallWeek <= 208, JSON.stringify(ignoredA));
assert(ignoredA.recallCount >= 1, JSON.stringify(ignoredA));

const respondedA = simulate({ policy: 'lean', seed, respond: true });
const respondedB = simulate({ policy: 'lean', seed, respond: true });
assert.deepEqual(respondedA, respondedB, 'same-seed response path is deterministic');
assert(respondedA.firstRecallWeek !== null, JSON.stringify(respondedA));
assert(respondedA.responseWeek !== null, JSON.stringify(respondedA));
assert(respondedA.cumulativeLostRevenue < ignoredA.cumulativeLostRevenue, JSON.stringify({ ignoredA, respondedA }));

const healthyA = simulate({ policy: 'standard', seed, respond: false });
const healthyB = simulate({ policy: 'standard', seed, respond: false });
assert.deepEqual(healthyA, healthyB, 'same-seed standard-maintenance path is deterministic');
assert.equal(healthyA.recallCount, 0, JSON.stringify(healthyA));
assert(healthyA.profitableRatio >= 0.8, `healthy control must actually be profitable: ${JSON.stringify(healthyA)}`);
assert(healthyA.finalProfit > 0, `healthy control final product must be profitable: ${JSON.stringify(healthyA)}`);

console.log(`PRODUCT_RECALL_REACHABILITY ${JSON.stringify({ ignored: ignoredA, responded: respondedA, healthy: healthyA })}`);
console.log('product recall 208-week reachability passed');