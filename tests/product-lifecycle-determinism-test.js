const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGameFromHtml, readIndex, ROOT } = require('./harness');

const LIFECYCLE_PATH = path.join(ROOT, 'js', 'product-lifecycle.js');
const LIFECYCLE_TAG = '<script src="./js/product-lifecycle.js"></script>';

function installLifecycle(ctx) {
  vm.runInContext(fs.readFileSync(LIFECYCLE_PATH, 'utf8'), ctx, { filename: 'js/product-lifecycle.js' });
}

function loadWithoutLifecycle(randomValue) {
  const html = readIndex().replace(LIFECYCLE_TAG, '');
  assert.notEqual(html, readIndex(), 'product lifecycle script must be removable from the test index');
  return loadGameFromHtml(html, { random: () => randomValue });
}

function build(randomValue, options = {}) {
  const { ctx, engineModule, modules } = loadWithoutLifecycle(randomValue);
  if (options.removeEngineRand) delete modules.engine.rand;
  installLifecycle(ctx);
  const engine = new engineModule.TycoonEngine();
  engine.g.configured = true;
  engine.g.companyCash = 50_000_000;
  engine.g.productVentures.push({
    id: 'deterministic-product', name: 'Deterministic SaaS', status: 'released', origin: 'office',
    quality: 70, brand: 55, revenue: 6_000_000, users: 8000, paidUsers: 500,
    price: 2500, serverCost: 25000, serverCapacity: 20000, market: 1_500_000,
    valuation: 60_000_000, maintenancePolicy: 'lean', technicalDebt: 90,
    lifecycleAgeWeeks: 20, lifecycleStage: 'active'
  });
  engine.ensureExpansionDefaults();
  engine.ensureProductInnovationDefaults();
  engine.ensureProductLifecycleDefaults();
  if (options.throwOnRandom) ctx.Math.random = () => { throw new Error('unexpected nondeterministic random access'); };
  const saveVersion = engine.g.saveVersion;
  const weekBefore = 11;
  engine.g.week = weekBefore;
  const cashBefore = engine.g.companyCash;
  engine.g.week = 12;
  engine.updateProductLifecycleWeekly();
  const validation = modules.productLifecycle.validate(engine.g);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(engineModule.SAVE_KEY, 'capitalism_tycoon_web_v1');
  assert.equal(engineModule.SAVE_VERSION, 9);
  assert.equal(engine.g.saveVersion, saveVersion, 'lifecycle update must not change saveVersion');
  assert.equal(engine.g.week, weekBefore + 1, 'direct lifecycle update must not advance more than the requested week');
  const maintenance = engine.g.finance.transactions.filter(t => t.sourceType === 'productMaintenance');
  assert.equal(maintenance.length, 1, 'one maintenance accounting event should be recorded');
  assert.equal(maintenance[0].cashEffect, engine.g.companyCash - cashBefore, 'cash delta must match maintenance cash effect');
  const snapshot = JSON.stringify({
    product: engine.g.productVentures[0],
    cash: engine.g.companyCash,
    saveVersion: engine.g.saveVersion,
    week: engine.g.week,
    history: engine.g.productLifecycleHistory,
    news: engine.g.news,
    transactions: maintenance
  });
  engine.updateProductLifecycleWeekly();
  assert.equal(JSON.stringify({
    product: engine.g.productVentures[0],
    cash: engine.g.companyCash,
    saveVersion: engine.g.saveVersion,
    week: engine.g.week,
    history: engine.g.productLifecycleHistory,
    news: engine.g.news,
    transactions: engine.g.finance.transactions.filter(t => t.sourceType === 'productMaintenance')
  }), snapshot, 'same-week lifecycle processing must remain idempotent');
  return snapshot;
}

function assertNoNondeterministicRandomFallback(source) {
  const compact = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, '');
  const checks = [
    { name: 'direct Math.random', re: /\bMath\s*\.\s*random\b/ },
    { name: 'optional Math?.random', re: /\bMath\s*\?\.\s*random\b/ },
    { name: 'globalThis Math.random', re: /\bglobalThis\s*\.\s*Math\s*\.\s*random\b/ },
    { name: 'globalThis optional Math.random', re: /\bglobalThis\s*\.\s*Math\s*\?\.\s*random\b/ },
    { name: 'globalThis optional Math optional random', re: /\bglobalThis\s*\.\s*Math\s*\?\.\s*random\s*\?\./ },
    { name: 'compacted direct random', re: /Math(?:\?\.)?\.random|globalThis\.Math(?:\?\.)?\.random/ }
  ];
  for (const check of checks) {
    assert.doesNotMatch(source, check.re, `product lifecycle must not contain ${check.name}`);
    assert.doesNotMatch(compact, check.re, `product lifecycle must not contain compacted ${check.name}`);
  }
}

function recallFixture(policy = 'lean') {
  const { ctx, engineModule, modules } = loadWithoutLifecycle(0.5);
  installLifecycle(ctx);
  const engine = new engineModule.TycoonEngine();
  engine.g.configured = true;
  engine.g.companyReputation = 50;
  engine.g.productVentures = [{
    id: 'recall-product', name: 'Recall SaaS', status: 'released', origin: 'office',
    quality: 70, brand: 60, revenue: 2_000_000, profit: 1_500_000,
    users: 12000, paidUsers: 900, price: 3000, serverCost: 50000,
    serverCapacity: 30000, market: 2_000_000, valuation: 80_000_000,
    maintenancePolicy: policy, technicalDebt: 90, lifecycleAgeWeeks: 30,
    lifecycleStage: 'active', lifecycleIncidents: 2
  }];
  engine.ensureExpansionDefaults();
  engine.ensureProductInnovationDefaults();
  engine.ensureProductLifecycleDefaults();
  engine.g.week = 20;
  return { engine, modules };
}

function riskRows(count, policy = 'lean', spike = false) {
  return Array.from({ length: count }, (_, i) => ({
    week: 13 + i,
    productID: 'recall-product',
    productName: 'Recall SaaS',
    maintenancePolicy: spike && i < count - 1 ? 'standard' : policy,
    technicalDebt: spike && i < count - 1 ? 30 : 90,
    revenue: 2_000_000,
    profit: 1_500_000,
    quality: 70
  }));
}

assert.equal(build(0.01), build(0.01), 'same RNG path must produce identical lifecycle results');
assert.notEqual(build(0.01), build(0.99), 'different RNG paths should control incident outcomes through the injected engine rand path');
assert.equal(build(0.01, { removeEngineRand: true }), build(0.99, { removeEngineRand: true }), 'missing engine rand must use deterministic fixed fallback, not nondeterminism');
assert.doesNotThrow(() => build(0.01, { removeEngineRand: true, throwOnRandom: true }), 'missing engine rand fallback must not access Math.random');

{
  const { engine, modules } = recallFixture();
  delete engine.g.productRecallRiskHistory;
  delete engine.g.productRecallHistory;
  delete engine.g.activeProductRecall;
  modules.productLifecycle.ensure(engine.g);
  assert.deepEqual(Array.from(engine.g.productRecallRiskHistory), []);
  assert.deepEqual(Array.from(engine.g.productRecallHistory), []);
  engine.g.productRecallRiskHistory = Array.from({ length: 70 }, (_, i) => ({ ...riskRows(1)[0], week: i + 1 }));
  modules.productLifecycle.ensure(engine.g);
  assert.equal(engine.g.productRecallRiskHistory.length, 52, 'recall risk history is bounded');
}

{
  const { engine, modules } = recallFixture();
  engine.g.productRecallRiskHistory = riskRows(7);
  assert.equal(modules.productLifecycle.recallReadiness(engine.g).maturity, 0);
  assert.equal(modules.productLifecycle.startRecall(engine), null, 'seven risk weeks cannot trigger');
  engine.g.productRecallRiskHistory = riskRows(8);
  const cashBefore = engine.g.companyCash;
  const reputationBefore = engine.g.companyReputation;
  const recall = modules.productLifecycle.startRecall(engine);
  assert(recall, 'eighth persistent risk week starts recall');
  assert.equal(engine.g.companyCash, cashBefore - recall.initialCost);
  assert.equal(engine.g.companyReputation, reputationBefore - 8);
  assert.equal(engine.g.productVentures[0].quality, 66);
  assert.equal(engine.g.finance.transactions.filter(t => t.sourceType === 'productRecall').length, 1);
  assert.equal(modules.productLifecycle.startRecall(engine), null, 'overlapping recall is rejected');
  const product = engine.g.productVentures[0];
  product.revenue = 1_000_000;
  product.profit = 800_000;
  const adjusted = modules.productLifecycle.applyRecallRevenueImpact(engine, { revenue: 1_000_000, cost: 200_000, profit: 800_000 });
  assert.equal(product.revenue, 650_000);
  assert.equal(adjusted.revenue, 650_000);
  assert.equal(adjusted.profit, 450_000);
  assert.equal(recall.cumulativeLostRevenue, 350_000);
  const debtBefore = product.technicalDebt;
  const responseCashBefore = engine.g.companyCash;
  const responseReputationBefore = engine.g.companyReputation;
  assert.equal(engine.executeProductRecallResponse(), true);
  assert(engine.g.companyCash < responseCashBefore);
  assert.equal(engine.g.companyReputation, responseReputationBefore + 4);
  assert.equal(product.technicalDebt, Math.max(0, debtBefore - 45));
  assert.equal(product.maintenancePolicy, 'intensive');
  assert.equal(recall.revenueMultiplier, modules.productLifecycle.RECALL.RESPONDED_REVENUE_MULTIPLIER);
  assert.equal(recall.plannedWeeks, 2);
  assert.equal(engine.g.finance.transactions.filter(t => t.sourceType === 'productRecallResponse').length, 1);
  assert.equal(engine.executeProductRecallResponse(), false, 'duplicate response is rejected');
  const lifecycleValidation = modules.productLifecycle.validate(engine.g);
  assert.equal(lifecycleValidation.ok, true, lifecycleValidation.errors.join('\n'));
  const financeValidation = modules.finance.validate(engine.g);
  assert.equal(financeValidation.ok, true, JSON.stringify(financeValidation));
}

{
  const { engine, modules } = recallFixture();
  engine.g.productRecallRiskHistory = riskRows(8, 'lean', true);
  assert.equal(modules.productLifecycle.recallReadiness(engine.g).eligible, false, 'one-week spike cannot trigger');
  engine.g.productRecallRiskHistory = riskRows(8, 'standard');
  assert.equal(modules.productLifecycle.recallReadiness(engine.g).eligible, false, 'standard maintenance cannot trigger');
  engine.g.productRecallRiskHistory = riskRows(8, 'intensive');
  assert.equal(modules.productLifecycle.recallReadiness(engine.g).eligible, false, 'intensive maintenance cannot trigger');
}

{
  const { engine, modules } = recallFixture();
  engine.g.productRecallRiskHistory = riskRows(8);
  engine.g.lastProductRecallWeek = engine.g.week - 51;
  assert.equal(modules.productLifecycle.startRecall(engine), null, '51-week cooldown blocks recall');
  engine.g.lastProductRecallWeek = engine.g.week - 52;
  assert(modules.productLifecycle.startRecall(engine), '52-week cooldown boundary permits recall');
}

{
  const { engine, modules } = recallFixture();
  engine.g.productRecallRiskHistory = riskRows(8);
  const recall = modules.productLifecycle.startRecall(engine);
  assert(recall);
  assert.equal(engine.executeProductRecallResponse(), true);
  for (let i = 1; i <= 2; i++) {
    engine.g.week += 1;
    engine.g.productVentures[0].revenue = 1_000_000;
    engine.g.productVentures[0].profit = 800_000;
    modules.productLifecycle.applyRecallRevenueImpact(engine, { revenue: 1_000_000, cost: 200_000, profit: 800_000 });
    modules.productLifecycle.advanceRecall(engine);
  }
  assert.equal(engine.g.activeProductRecall, null, 'responded recall resolves after two impacted weeks');
  assert(engine.g.productRecallHistory.some(row => row.type === 'resolved'));
}

assertNoNondeterministicRandomFallback(fs.readFileSync(LIFECYCLE_PATH, 'utf8'));
console.log('product lifecycle determinism and product recall core ok');