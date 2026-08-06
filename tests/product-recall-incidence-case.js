'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const style = String(process.argv[2] || '');
const seed = Number(process.argv[3]);
const STYLES = new Set(['neglected-lean', 'timely-quality', 'healthy-standard']);
assert(STYLES.has(style), `unknown product recall style: ${style}`);
assert(Number.isFinite(seed), `invalid product recall seed: ${process.argv[3]}`);

function rng(value) {
  let x = value >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function product(policy) {
  return {
    id: 'recall-incidence-product', name: 'Incidence Cloud', status: 'released', origin: 'office',
    category: 'SaaS', risk: .08,
    quality: 82, brand: 76, revenue: 0, profit: 0, users: 28000, paidUsers: 4200,
    price: 4800, serverCost: 90000, serverCapacity: 80000, market: 4_000_000,
    valuation: 180_000_000, maintenancePolicy: policy, technicalDebt: 0,
    lifecycleAgeWeeks: 0, lifecycleStage: 'active', lifecycleIncidents: 0
  };
}

function simulate() {
  const loaded = loadGame({ headless: true, random: rng(seed) });
  assert(loaded.modules.productLifecycle?.__installed, 'product lifecycle module must be loaded');
  const engine = new loaded.engineModule.TycoonEngine();
  const initialPolicy = style === 'healthy-standard' ? 'standard' : 'lean';
  engine.g.productVentures = [product(initialPolicy)];
  engine.normalize();
  engine.g.configured = true;

  let maintenanceChangeWeek = null;
  let firstRecallWeek = null;
  let maxTechnicalDebt = 0;
  let minCash = Number(engine.g.companyCash);
  let profitableWeeks = 0;
  let observedWeeks = 0;
  let maxActiveRecalls = 0;

  for (let i = 0; i < 207; i++) {
    const current = engine.g.productVentures[0];
    if (style === 'timely-quality' && maintenanceChangeWeek === null && Number(current.technicalDebt) >= 70) {
      assert.equal(
        engine.setProductMaintenancePolicy(current.id, 'intensive'),
        true,
        'timely quality control must use the normal maintenance policy API'
      );
      maintenanceChangeWeek = Number(engine.g.week);
    }

    assert.notEqual(engine.advanceWeek(false), false, `advanceWeek failed at week ${engine.g.week}`);
    const updated = engine.g.productVentures[0];
    maxTechnicalDebt = Math.max(maxTechnicalDebt, Number(updated.technicalDebt));
    minCash = Math.min(minCash, Number(engine.g.companyCash));
    if (Number(updated.profit) > 0) profitableWeeks++;
    observedWeeks++;
    maxActiveRecalls = Math.max(maxActiveRecalls, engine.g.activeProductRecall ? 1 : 0);

    const starts = engine.g.productRecallHistory.filter(row => row.type === 'started');
    if (starts.length && firstRecallWeek === null) firstRecallWeek = Number(starts.at(-1).week);
  }

  const starts = engine.g.productRecallHistory.filter(row => row.type === 'started');
  const resolved = engine.g.productRecallHistory.filter(row => row.type === 'resolved');
  const startWeeks = starts.map(row => Number(row.week)).sort((a, b) => a - b);
  for (let i = 1; i < startWeeks.length; i++) {
    assert(startWeeks[i] - startWeeks[i - 1] >= 52, 'global recall cooldown must separate starts by 52 weeks');
  }
  assert(maxActiveRecalls <= 1, 'only one recall may be active');
  assert(starts.length <= 4, `52-week cooldown must bound 208-week recall count: ${starts.length}`);

  const cumulativeLostRevenue = resolved.reduce(
    (sum, row) => sum + Number(row.cumulativeLostRevenue || 0),
    0
  ) + Number(engine.g.activeProductRecall?.cumulativeLostRevenue || 0);

  const financeValidation = loaded.modules.finance.validate(engine.g);
  assert.equal(financeValidation.ok, true, JSON.stringify(financeValidation));
  const lifecycleValidation = loaded.modules.productLifecycle.validate(engine.g);
  assert.equal(lifecycleValidation.ok, true, lifecycleValidation.errors.join('\n'));

  const finalProduct = engine.g.productVentures[0];
  return {
    style,
    seed,
    firstRecallWeek,
    recallCount: starts.length,
    recallStartWeeks: startWeeks,
    maintenanceChangeWeek,
    cumulativeLostRevenue: Math.round(cumulativeLostRevenue),
    finalCash: Math.round(engine.g.companyCash),
    minCash: Math.round(minCash),
    companyReputation: Number(engine.g.companyReputation.toFixed(4)),
    finalTechnicalDebt: Number(finalProduct.technicalDebt.toFixed(4)),
    maxTechnicalDebt: Number(maxTechnicalDebt.toFixed(4)),
    finalMaintenancePolicy: finalProduct.maintenancePolicy,
    finalRevenue: Math.round(finalProduct.revenue),
    finalProfit: Math.round(finalProduct.profit),
    profitableRatio: Number((profitableWeeks / Math.max(1, observedWeeks)).toFixed(4)),
    riskHistory: engine.g.productRecallRiskHistory.length,
    recallHistory: engine.g.productRecallHistory.length,
    finalWeek: engine.g.week
  };
}

console.log(`PRODUCT_RECALL_INCIDENCE_CASE ${JSON.stringify(simulate())}`);
