'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const style = String(process.argv[2] || '');
const seed = Number(process.argv[3]);
const STYLES = new Set(['neglected-lean', 'timely-quality', 'healthy-standard']);
const INITIAL_COMPANY_CASH = 500_000_000;
const INITIAL_REPUTATION = 70;
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
    quality: 92, brand: 85, revenue: 0, profit: 0, users: 45000, paidUsers: 8000,
    price: 6000, serverCost: 75000, serverCapacity: 250000, market: 5_000_000,
    valuation: 300_000_000, maintenancePolicy: policy, technicalDebt: 0,
    lifecycleAgeWeeks: 0, lifecycleStage: 'active', lifecycleIncidents: 0
  };
}

function configureEstablishedCompany(loaded, engine, initialPolicy) {
  engine.g.productVentures = [product(initialPolicy)];
  engine.normalize();
  engine.g.companyCash = INITIAL_COMPANY_CASH;
  engine.g.companyReputation = INITIAL_REPUTATION;
  engine.g.consecutiveNegativeCashWeeks = 0;
  engine.g.gameOver = false;
  engine.g.finance = loaded.modules.finance.defaultFinanceState(engine.g);
  engine.g.configured = true;
}

function simulate() {
  const loaded = loadGame({ headless: true, random: rng(seed) });
  assert(loaded.modules.productLifecycle?.__installed, 'product lifecycle module must be loaded');
  const engine = new loaded.engineModule.TycoonEngine();
  const initialPolicy = style === 'healthy-standard' ? 'standard' : 'lean';
  configureEstablishedCompany(loaded, engine, initialPolicy);

  let maintenanceChangeWeek = null;
  const maintenanceChangeWeeks = [];
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
      maintenanceChangeWeeks.push({ week: maintenanceChangeWeek, policy: 'intensive' });
    } else if (style === 'healthy-standard') {
      let nextPolicy = null;
      if (current.maintenancePolicy === 'standard' && Number(current.technicalDebt) >= 45) nextPolicy = 'intensive';
      else if (current.maintenancePolicy === 'intensive' && Number(current.technicalDebt) <= 20) nextPolicy = 'standard';
      if (nextPolicy) {
        assert.equal(
          engine.setProductMaintenancePolicy(current.id, nextPolicy),
          true,
          'healthy quality guard must use the normal maintenance policy API'
        );
        if (maintenanceChangeWeek === null) maintenanceChangeWeek = Number(engine.g.week);
        maintenanceChangeWeeks.push({ week: Number(engine.g.week), policy: nextPolicy });
      }
    }

    assert.notEqual(
      engine.advanceWeek(false),
      false,
      `advanceWeek failed at week ${engine.g.week}: cash=${engine.g.companyCash}`
    );
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
    maintenanceChangeWeeks,
    maintenanceChangeCount: maintenanceChangeWeeks.length,
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