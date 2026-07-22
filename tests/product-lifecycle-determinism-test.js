const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame, ROOT } = require('./harness');

function build(randomValue) {
  const { ctx, engineModule, modules } = loadGame({ random: () => randomValue });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/product-lifecycle.js'), 'utf8'), ctx, { filename: 'js/product-lifecycle.js' });
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
  engine.g.week = 12;
  engine.updateProductLifecycleWeekly();
  modules.productLifecycle.validate(engine.g);
  return JSON.stringify({
    product: engine.g.productVentures[0],
    cash: engine.g.companyCash,
    history: engine.g.productLifecycleHistory,
    news: engine.g.news,
    transactions: engine.g.finance.transactions.filter(t => t.sourceType === 'productMaintenance')
  });
}

assert.equal(build(0.01), build(0.01), 'same RNG path must produce identical lifecycle results');
assert.notEqual(build(0.01), build(0.99), 'different RNG paths should still control incident outcomes through the injected rand path');

const source = fs.readFileSync(path.join(ROOT, 'js', 'product-lifecycle.js'), 'utf8');
assert.doesNotMatch(source, /Math\.random\(/, 'product lifecycle must not call Math.random directly');
console.log('product lifecycle determinism ok');
