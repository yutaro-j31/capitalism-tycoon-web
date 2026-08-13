'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const INITIAL_COMPANY_CASH = 500_000_000;
const INITIAL_REPUTATION = 70;

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
    category: 'SaaS', risk: .08,
    quality: 92, brand: 85, revenue: 0, profit: 0, users: 45000, paidUsers: 8000,
    price: 6000, serverCost: 75000, serverCapacity: 250000, market: 5_000_000,
    valuation: 300_000_000, maintenancePolicy: policy, technicalDebt: 0,
    lifecycleAgeWeeks: 0, lifecycleStage: 'active', lifecycleIncidents: 0
  };
}

function configureEstablishedCompany(loaded, engine, policy) {
  engine.g.productVentures = [releasedProduct(policy)];
  engine.normalize();
  engine.g.companyCash = INITIAL_COMPANY_CASH;
  engine.g.companyReputation = INITIAL_REPUTATION;
  engine.g.consecutiveNegativeCashWeeks = 0;
  engine.g.gameOver = false;
  engine.g.finance = loaded.modules.finance.defaultFinanceState(engine.g);
  engine.g.configured = true;
}

// Determinism is a property of the path, so verifying it does not require a second full
// 207-week replay. A capped run walks the same path and must reach the same checkpoint
// the full run passes through; any divergence before it still surfaces.
const CHECKPOINT_WEEKS = 26;

function simulate({ policy, seed, respond, qualityGuard = false, weeks = 207 }) {
  const loaded = loadGame({ headless: true, random: rng(seed) });
  assert(loaded.modules.productLifecycle?.__installed, 'product lifecycle module must be loaded');
  const engine = new loaded.engineModule.TycoonEngine();
  configureEstablishedCompany(loaded, engine, policy);

  let firstRecallWeek = null;
  let responseWeek = null;
  let responseEffect = null;
  let minCash = engine.g.companyCash;
  const maintenanceChangeWeeks = [];
  let profitableWeeks = 0;
  let observedWeeks = 0;

  let checkpoint = null;
  for (let i = 0; i < weeks; i++) {
    const current = engine.g.productVentures[0];
    if (qualityGuard) {
      let nextPolicy = null;
      if (current.maintenancePolicy === 'standard' && Number(current.technicalDebt) >= 45) nextPolicy = 'intensive';
      else if (current.maintenancePolicy === 'intensive' && Number(current.technicalDebt) <= 20) nextPolicy = 'standard';
      if (nextPolicy) {
        assert.equal(
          engine.setProductMaintenancePolicy(current.id, nextPolicy),
          true,
          'healthy quality guard must use the normal maintenance policy API'
        );
        maintenanceChangeWeeks.push({ week: Number(engine.g.week), policy: nextPolicy });
      }
    }

    assert.notEqual(
      engine.advanceWeek(false),
      false,
      `normal advanceWeek stopped at week ${engine.g.week}: cash=${engine.g.companyCash}`
    );
    const product = engine.g.productVentures[0];
    if (Number(product?.profit) > 0) profitableWeeks++;
    observedWeeks++;
    minCash = Math.min(minCash, Number(engine.g.companyCash));
    const starts = engine.g.productRecallHistory.filter(row => row.type === 'started');
    if (starts.length && firstRecallWeek === null) firstRecallWeek = Number(starts.at(-1).week);

    if (respond && engine.g.activeProductRecall?.responseStatus === 'pending') {
      const cashBefore = Number(engine.g.companyCash);
      const reputationBefore = Number(engine.g.companyReputation);
      const debtBefore = Number(product.technicalDebt);
      const qualityBefore = Number(product.quality);
      const transactionCountBefore = engine.g.finance.transactions.length;
      assert.equal(engine.executeProductRecallResponse(), true, 'normal response API must be executable');
      const recall = engine.g.activeProductRecall;
      const responseTransaction = engine.g.finance.transactions
        .slice(transactionCountBefore)
        .find(row => row.sourceType === 'productRecallResponse');
      assert(responseTransaction, 'response must create a productRecallResponse finance transaction');
      responseWeek = Number(engine.g.week);
      responseEffect = {
        responseCost: Number(recall.responseCost),
        cashDelta: Math.round(Number(engine.g.companyCash) - cashBefore),
        reputationDelta: Number((Number(engine.g.companyReputation) - reputationBefore).toFixed(4)),
        technicalDebtDelta: Number((Number(product.technicalDebt) - debtBefore).toFixed(4)),
        qualityDelta: Number((Number(product.quality) - qualityBefore).toFixed(4)),
        revenueMultiplier: Number(recall.revenueMultiplier),
        plannedWeeks: Number(recall.plannedWeeks),
        financeCashEffect: Number(responseTransaction.cashEffect),
        financeProfitEffect: Number(responseTransaction.profitEffect)
      };
    }

    if (i === CHECKPOINT_WEEKS - 1) {
      checkpoint = {
        week: Number(engine.g.week),
        cash: Math.round(Number(engine.g.companyCash)),
        reputation: Number(Number(engine.g.companyReputation).toFixed(4)),
        recallStarts: engine.g.productRecallHistory.filter(row => row.type === 'started').length,
        activeRecallStatus: String(engine.g.activeProductRecall?.responseStatus || 'none'),
        technicalDebt: Number(Number(product?.technicalDebt || 0).toFixed(4)),
        quality: Number(Number(product?.quality || 0).toFixed(4)),
        revenue: Math.round(Number(product?.revenue || 0)),
        profit: Math.round(Number(product?.profit || 0)),
        maintenancePolicy: String(product?.maintenancePolicy || ''),
        maintenanceChangeWeeks: maintenanceChangeWeeks.slice(),
        riskHistory: engine.g.productRecallRiskHistory.length,
        transactions: engine.g.finance.transactions.length
      };
    }
  }

  const starts = engine.g.productRecallHistory.filter(row => row.type === 'started');
  const resolved = engine.g.productRecallHistory.filter(row => row.type === 'resolved');
  const initialTransactions = engine.g.finance.transactions.filter(row => row.sourceType === 'productRecall');
  const responseTransactions = engine.g.finance.transactions.filter(row => row.sourceType === 'productRecallResponse');
  const cumulativeLostRevenue = resolved.reduce((sum, row) => sum + Number(row.cumulativeLostRevenue || 0), 0)
    + Number(engine.g.activeProductRecall?.cumulativeLostRevenue || 0);
  const financeValidation = loaded.modules.finance.validate(engine.g);
  assert.equal(financeValidation.ok, true, JSON.stringify(financeValidation));
  const lifecycleValidation = loaded.modules.productLifecycle.validate(engine.g);
  assert.equal(lifecycleValidation.ok, true, lifecycleValidation.errors.join('\n'));

  return {
    policy, seed, respond,
    checkpoint,
    firstRecallWeek,
    responseWeek,
    responseEffect,
    maintenanceChangeWeeks,
    recallCount: starts.length,
    initialRecallCost: Math.round(initialTransactions.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
    initialRecallCashEffect: Math.round(initialTransactions.reduce((sum, row) => sum + Number(row.cashEffect || 0), 0)),
    responseTransactionCount: responseTransactions.length,
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
const ignoredReplay = simulate({ policy: 'lean', seed, respond: false, weeks: CHECKPOINT_WEEKS });
assert(ignoredA.checkpoint && ignoredReplay.checkpoint, 'both ignored runs record a checkpoint');
assert.deepEqual(ignoredReplay.checkpoint, ignoredA.checkpoint, 'same-seed ignored recall path is deterministic');
assert(ignoredA.firstRecallWeek !== null && ignoredA.firstRecallWeek <= 208, JSON.stringify(ignoredA));
assert(ignoredA.recallCount >= 1, JSON.stringify(ignoredA));
assert(ignoredA.initialRecallCost > 0, JSON.stringify(ignoredA));
assert.equal(ignoredA.initialRecallCashEffect, -ignoredA.initialRecallCost, JSON.stringify(ignoredA));
assert(ignoredA.cumulativeLostRevenue > 0, JSON.stringify(ignoredA));

const respondedA = simulate({ policy: 'lean', seed, respond: true });
const respondedReplay = simulate({ policy: 'lean', seed, respond: true, weeks: CHECKPOINT_WEEKS });
assert(respondedA.checkpoint && respondedReplay.checkpoint, 'both response runs record a checkpoint');
assert.deepEqual(respondedReplay.checkpoint, respondedA.checkpoint, 'same-seed response path is deterministic');
assert(respondedA.firstRecallWeek !== null, JSON.stringify(respondedA));
assert(respondedA.responseWeek !== null, JSON.stringify(respondedA));
assert(respondedA.responseEffect, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.cashDelta, -respondedA.responseEffect.responseCost, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.financeCashEffect, -respondedA.responseEffect.responseCost, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.financeProfitEffect, -respondedA.responseEffect.responseCost, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.reputationDelta, 4, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.technicalDebtDelta, -45, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.qualityDelta, 5, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.revenueMultiplier, 0.88, JSON.stringify(respondedA));
assert.equal(respondedA.responseEffect.plannedWeeks, 2, JSON.stringify(respondedA));
assert(respondedA.responseTransactionCount >= 1, JSON.stringify(respondedA));
assert(respondedA.cumulativeLostRevenue < ignoredA.cumulativeLostRevenue, JSON.stringify({ ignoredA, respondedA }));

const healthyA = simulate({ policy: 'standard', seed, respond: false, qualityGuard: true });
const healthyReplay = simulate({ policy: 'standard', seed, respond: false, qualityGuard: true, weeks: CHECKPOINT_WEEKS });
assert(healthyA.checkpoint && healthyReplay.checkpoint, 'both standard-maintenance runs record a checkpoint');
assert.deepEqual(healthyReplay.checkpoint, healthyA.checkpoint, 'same-seed standard-maintenance path is deterministic');
assert.equal(healthyA.recallCount, 0, JSON.stringify(healthyA));
assert(healthyA.maintenanceChangeWeeks.length >= 1, JSON.stringify(healthyA));
assert(healthyA.profitableRatio >= 0.8, `healthy control must actually be profitable: ${JSON.stringify(healthyA)}`);
assert(healthyA.finalProfit > 0, `healthy control final product must be profitable: ${JSON.stringify(healthyA)}`);

console.log(`PRODUCT_RECALL_REACHABILITY ${JSON.stringify({ ignored: ignoredA, responded: respondedA, healthy: healthyA })}`);
console.log('product recall 208-week reachability passed');