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

assert.equal(build(0.01), build(0.01), 'same RNG path must produce identical lifecycle results');
assert.notEqual(build(0.01), build(0.99), 'different RNG paths should control incident outcomes through the injected engine rand path');
assert.equal(build(0.01, { removeEngineRand: true }), build(0.99, { removeEngineRand: true }), 'missing engine rand must use deterministic fixed fallback, not nondeterminism');
assert.doesNotThrow(() => build(0.01, { removeEngineRand: true, throwOnRandom: true }), 'missing engine rand fallback must not access Math.random');

assertNoNondeterministicRandomFallback(fs.readFileSync(LIFECYCLE_PATH, 'utf8'));
console.log('product lifecycle determinism ok');
