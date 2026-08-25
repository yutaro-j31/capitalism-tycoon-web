const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame, ROOT } = require('./harness');

const { ctx, engineModule, modules } = loadGame({ random: () => 0, isolatedLegacyIndex:true });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/product-lifecycle.js'), 'utf8'), ctx, { filename: 'js/product-lifecycle.js' });
const lifecycle = modules.productLifecycle;
assert.ok(lifecycle?.__installed, 'product lifecycle module should register');
assert.equal(engineModule.TycoonEngine.prototype.__productLifecycleInstalled, true);
assert.equal(lifecycle.VERSION, 3);
assert.equal(lifecycle.AGE_PRESSURE_CAP, 2.5);
assert.equal(lifecycle.agePressureFor(12), 0, 'the first 12 weeks retain the legacy zero age pressure');
assert.equal(lifecycle.agePressureFor(52), 40 / 30, 'young products retain the exact legacy curve');
assert(lifecycle.agePressureFor(104) > lifecycle.agePressureFor(52), 'ageing pressure must remain meaningful');
for (const age of [117, 156, 208, 520, 5000, Infinity, NaN]) {
  const pressure = lifecycle.agePressureFor(age);
  assert(Number.isFinite(pressure), `age pressure must be finite at ${age}`);
  assert(pressure >= 0 && pressure <= lifecycle.AGE_PRESSURE_CAP, `age pressure must be capped at ${age}`);
}
assert.equal(lifecycle.agePressureFor(208), lifecycle.AGE_PRESSURE_CAP);
assert.equal(lifecycle.agePressureFor(520), lifecycle.AGE_PRESSURE_CAP);

const e = new engineModule.TycoonEngine();
e.g.configured = true;
e.g.selectedTab = 'business';
e.g.companyCash = 100_000_000;
e.g.productVentures.push({
  id: 'lifecycle-product-1', name: '成熟SaaS', status: 'released', origin: 'office',
  quality: 60, brand: 45, revenue: 10_000_000, users: 12000, paidUsers: 900,
  price: 3000, serverCost: 30000, serverCapacity: 50000, market: 2_000_000,
  valuation: 80_000_000
});
e.ensureExpansionDefaults();
e.ensureProductInnovationDefaults();
e.ensureProductLifecycleDefaults();
const product = e.g.productVentures.find(x => x.id === 'lifecycle-product-1');
assert.equal(product.maintenancePolicy, 'standard');
assert.equal(product.technicalDebt, 0);
assert.equal(product.lifecycleStage, 'active');

const openingCash = e.g.companyCash;
e.g.week = 2;
e.updateProductLifecycleWeekly();
assert.ok(e.g.companyCash < openingCash, 'maintenance should consume company cash');
assert.ok(product.technicalDebt > 0, 'standard maintenance should allow bounded debt growth');
const debtAfterFirst = product.technicalDebt;
e.updateProductLifecycleWeekly();
assert.equal(product.technicalDebt, debtAfterFirst, 'same-week update must be idempotent');

assert.equal(e.setProductMaintenancePolicy(product.id, 'lean'), true);
e.g.week = 3;
e.updateProductLifecycleWeekly();
assert.ok(product.technicalDebt > debtAfterFirst, 'lean maintenance should grow debt faster');
const leanDebt = product.technicalDebt;
assert.equal(e.setProductMaintenancePolicy(product.id, 'intensive'), true);
e.g.week = 4;
e.updateProductLifecycleWeekly();
assert.ok(product.technicalDebt < leanDebt, 'intensive maintenance should reduce debt');

function controlledDebt(policy, { age = 208, load = 0.4, burden = 0.3, debt = 50 } = {}) {
  product.maintenancePolicy = policy;
  product.lifecycleAgeWeeks = age - 1;
  product.technicalDebt = debt;
  const funnel = e.ensureProductFunnel(product);
  funnel.serverLoad = load;
  funnel.supportBurden = burden;
  e.g.week += 1;
  e.g.companyCash = Math.max(e.g.companyCash, 100_000_000);
  e.updateProductLifecycleWeekly();
  return product.technicalDebt;
}
const intensiveOld = controlledDebt('intensive');
const standardOld = controlledDebt('standard');
const leanOld = controlledDebt('lean');
assert(intensiveOld < 50, 'controlled intensive maintenance must reduce debt even at week 208');
assert(standardOld > intensiveOld && leanOld > standardOld, 'policy risk ordering must remain lean > standard > intensive');
assert(controlledDebt('intensive', { load: 2, burden: 1.5 }) > 50, 'high load and support burden can overwhelm intensive maintenance');
assert(controlledDebt('lean', { age: 12 }) < controlledDebt('lean', { age: 208 }), 'old lean products must retain more age risk than young products');
const repeatA = controlledDebt('intensive', { age: 520 });
const repeatB = controlledDebt('intensive', { age: 520 });
assert.equal(repeatA, repeatB, 'same lifecycle inputs must remain deterministic');
product.maintenancePolicy = 'intensive';
product.lifecycleAgeWeeks = 0;
product.technicalDebt = 50;
const controlledFunnel = e.ensureProductFunnel(product);
controlledFunnel.serverLoad = 0.4;
controlledFunnel.supportBurden = 0.3;
let peakDebt = product.technicalDebt;
for (let week = 1; week <= 208; week += 1) {
  e.g.week += 1;
  e.g.companyCash = Math.max(e.g.companyCash, 100_000_000);
  e.updateProductLifecycleWeekly();
  peakDebt = Math.max(peakDebt, product.technicalDebt);
}
assert(peakDebt < 100 && product.technicalDebt < 55, '208-week controlled intensive maintenance must not become age-doomed');

product.technicalDebt = 90;
product.maintenancePolicy = 'lean';
const qualityBefore = product.quality;
e.g.week = 5;
const incidents = e.updateProductLifecycleWeekly();
assert.equal(incidents.length, 1, 'high debt plus deterministic RNG should create an incident');
assert.ok(product.quality < qualityBefore, 'incident should reduce quality');
assert.ok(product.lifecycleIncidents >= 1);
assert.ok(e.g.productLifecycleHistory.some(x => x.type === 'maintenanceIncident'));

product.technicalDebt = 10;
assert.equal(e.startProductSunset(product.id), true, 'active product should enter sunsetting');
assert.equal(product.lifecycleStage, 'sunsetting');
assert.equal(product.maintenancePolicy, 'lean');
const revenueBeforeSunset = product.revenue;
const usersBeforeSunset = product.users;
for (let week = 6; week <= 9; week += 1) {
  e.g.week = week;
  e.updateProductLifecycleWeekly();
}
assert.equal(product.sunsetWeeks, 4, 'sunsetting should count migration weeks');
assert.ok(product.revenue < revenueBeforeSunset, 'sunsetting should wind down revenue');
assert.ok(product.users < usersBeforeSunset, 'sunsetting should wind down users');
assert.ok(e.g.productLifecycleHistory.some(x => x.type === 'sunsetStarted'));

const cashBeforeRetirement = e.g.companyCash;
assert.equal(e.retireProduct(product.id, '収益性低下'), true, 'product should retire after migration period');
assert.equal(product.status, 'released', 'retirement should preserve existing product status invariants');
assert.equal(product.lifecycleStage, 'retired');
assert.equal(product.revenue, 0);
assert.equal(product.users, 0);
assert.equal(product.paidUsers, 0);
assert.ok(e.g.companyCash < cashBeforeRetirement, 'retirement should consume shutdown cost');
assert.ok(e.g.productLifecycleHistory.some(x => x.type === 'productRetired'));

const retiredCash = e.g.companyCash;
e.g.week = 10;
e.updateProductLifecycleWeekly();
assert.equal(e.g.companyCash, retiredCash, 'retired product should no longer consume maintenance cash');
assert.equal(product.revenue, 0, 'retired product should remain economically inactive');

const html = lifecycle.renderSection(e);
assert.ok(html.includes('プロダクト・ライフサイクル'));
assert.ok(html.includes('Phase 8A-5'));
assert.ok(html.includes('成熟SaaS'));
assert.ok(html.includes('終了済み'));

const saveVersion = e.g.saveVersion;
delete e.g.productLifecycleVersion;
delete e.g.productLifecycleHistory;
delete product.maintenancePolicy;
delete product.technicalDebt;
product.lifecycleStage = 'retired';
delete product.sunsetWeeks;
e.normalize();
assert.equal(e.g.saveVersion, saveVersion, 'lifecycle migration must not change save version');
assert.equal(product.maintenancePolicy, 'standard');
assert.equal(product.lifecycleStage, 'retired');
assert.equal(product.revenue, 0);
assert.equal(lifecycle.validate(e.g).ok, true, lifecycle.validate(e.g).errors.join('\n'));
console.log('product lifecycle checks passed');
