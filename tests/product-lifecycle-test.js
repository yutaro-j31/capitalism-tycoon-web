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