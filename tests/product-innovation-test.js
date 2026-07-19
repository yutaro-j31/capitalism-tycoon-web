const assert = require('node:assert');
const { loadGame } = require('./harness');

const { engineModule, modules } = loadGame({ random: () => 0.5 });
const innovation = modules.productInnovation;
assert.ok(innovation?.__installed, 'product innovation module should register');
assert.equal(engineModule.TycoonEngine.prototype.__productInnovationInstalled, true, 'engine extension should install before app load');
assert.equal(innovation.ROADMAPS.length, 4, 'four strategic roadmaps should be available');

const e = new engineModule.TycoonEngine();
e.g.configured = true;
e.g.selectedTab = 'business';
e.g.companyCash = 150_000_000;
e.g.departments.product = { name: '商品開発部' };
e.g.departments.marketing = { name: 'マーケティング部' };
e.g.departments.dx = { name: 'DX部' };
e.g.departmentStaff.product = 5;
e.g.departmentStaff.marketing = 4;
e.g.departmentStaff.dx = 4;
e.g.founderSkillTech = 1.4;
e.g.productVentures.push({
  id: 'innovation-product-1', blueprintID: 'app', name: '成長SaaS', category: 'SaaS', status: 'released',
  progress: 100, quality: 45, brand: 30, users: 10000, paidUsers: 500, price: 3000,
  serverCost: 20000, serverCapacity: 25000, market: 2_000_000, risk: 0.08,
  valuation: 30_000_000, revenue: 2_000_000, cost: 800_000, profit: 1_200_000
});
e.ensureExpansionDefaults();
e.ensureProductInnovationDefaults();

const options = e.productInnovationOptions('innovation-product-1');
const qualityOption = options.find(x => x.id === 'quality_refresh');
assert.ok(qualityOption?.canStart, qualityOption?.reasons?.join(', ') || 'quality roadmap should start');
const openingCash = e.g.companyCash;
const project = e.startProductInnovationRoadmap('innovation-product-1', 'quality_refresh');
assert.ok(project && project.status === 'active', 'roadmap should be active');
assert.equal(e.g.companyCash, openingCash - qualityOption.cost, 'roadmap cost should be expensed immediately');
assert.equal(e.productInnovationOptions('innovation-product-1').every(x => !x.canStart), true, 'only one active roadmap is allowed per product');

const product = e.g.productVentures.find(x => x.id === 'innovation-product-1');
const qualityBefore = product.quality;
e.g.week = 2;
e.updateProductInnovationWeekly();
const firstProgress = project.progress;
assert.ok(firstProgress > 0 && firstProgress < 100, 'weekly update should advance progress');
e.updateProductInnovationWeekly();
assert.equal(project.progress, firstProgress, 'same-week rerun must be idempotent');
for (let week = 3; week <= 20 && project.status === 'active'; week++) {
  e.g.week = week;
  e.updateProductInnovationWeekly();
}
assert.equal(project.status, 'completed', 'roadmap should complete');
assert.equal(project.progress, 100);
assert.equal(product.quality, qualityBefore + 8, 'quality roadmap should apply its strategic effect once');
assert.equal(product.innovationLevel, 1);
assert.equal(product.completedRoadmapCount, 1);
assert.ok(e.g.productInnovationHistory.some(x => x.type === 'roadmapCompleted'));

const funnel = e.ensureProductFunnel(product);
const conversionBefore = funnel.conversionRate;
const patentCashBefore = e.g.companyCash;
e.g.patentRecords.push({ id: 'innovation-patent-1', projectID: 'payment', name: '決済最適化特許', effect: 'product', strength: 0.045, licensed: false });
assert.equal(e.assignPatentToProduct('innovation-patent-1', product.id), true, 'patent should be assignable');
assert.equal(e.g.companyCash, patentCashBefore - 1_500_000, 'patent implementation should cost 1.5m');
assert.ok(product.appliedPatentIDs.includes('innovation-patent-1'));
assert.ok(funnel.conversionRate > conversionBefore, 'product patent should improve conversion');
assert.equal(e.assignPatentToProduct('innovation-patent-1', product.id), false, 'a patent cannot be assigned twice');

const html = innovation.renderSection(e);
assert.ok(html.includes('プロダクト・イノベーション'));
assert.ok(html.includes('成長SaaS'));
assert.ok(html.includes('Phase 8A-2'));

const version = e.g.saveVersion;
delete e.g.productInnovationVersion;
delete e.g.productRoadmaps;
delete e.g.productInnovationHistory;
delete e.g.productPatentAssignments;
e.normalize();
assert.equal(e.g.saveVersion, version, 'innovation migration must not change the save version');
assert.ok(Array.isArray(e.g.productRoadmaps));
assert.equal(innovation.validate(e.g).ok, true, innovation.validate(e.g).errors.join('\n'));
console.log('product innovation roadmap checks passed');
