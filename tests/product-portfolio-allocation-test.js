const assert = require('node:assert');
const { loadGame } = require('./harness');

const { engineModule, modules } = loadGame({ random: () => 0.5, isolatedLegacyIndex: true });
const innovation = modules.productInnovation;

const product = (id, origin = 'office') => ({ id, name: `Product ${id}`, origin, status: 'released', lifecycleStage: 'active', quality: 40, brand: 30, valuation: 20_000_000 });
const project = (id, productID, roadmapID = 'quality_refresh') => ({ projectID: id, productID, roadmapID, status: 'active', progress: 0, plannedWeeks: 8, startedWeek: 1, lastUpdatedWeek: 0, cost: 0 });
const state = (products, projects, focus) => ({ week: 1, productVentures: products, productRoadmaps: projects, productInnovationFocusID: focus });
const factors = s => Object.fromEntries(innovation.productPortfolioAllocationSnapshot(s).map(row => [row.projectID, row]));

assert.equal(innovation.VERSION, 2);
assert.equal(innovation.FOCUS_SHARE, 0.65);
const legacy = state([product('a')], [project('pa', 'a')]);
innovation.ensure(legacy);
assert.equal(legacy.productInnovationFocusID, null, 'old saves default to equal allocation');
assert.equal(factors(legacy).pa.allocationFactor, 1, 'a single roadmap keeps exact legacy capacity');

for (const malformed of ['', [], {}, 'missing']) {
  const s = state([product('a')], [project('pa', 'a')], malformed);
  innovation.ensure(s);
  assert.equal(s.productInnovationFocusID, null, 'malformed focus is permanently cleared');
}

let s = state([product('a'), product('b')], [project('pa', 'a'), project('pb', 'b')]);
let randomCalls = 0;const originalRandom = Math.random;Math.random = () => { randomCalls++; return 0.5; };
let rows = factors(s);
Math.random = originalRandom;
assert.equal(randomCalls, 0, 'allocation consumes no random values');
assert.equal(rows.pa.allocationFactor, 0.5);
assert.equal(rows.pb.allocationFactor, 0.5);
assert.equal(rows.pa.departmentShares.product + rows.pb.departmentShares.product, 1);

s = state([product('a'), product('b'), product('c')], [project('pa', 'a'), project('pb', 'b'), project('pc', 'c')]);
rows = factors(s);
for (const id of ['pa', 'pb', 'pc']) assert.ok(Math.abs(rows[id].allocationFactor - 1 / 3) < 1e-12);

s.productInnovationFocusID = 'a';
rows = factors(s);
assert.equal(rows.pa.allocationFactor, 0.65);
assert.equal(rows.pb.allocationFactor, 0.175);
assert.equal(rows.pc.allocationFactor, 0.175);
assert.equal(Object.values(rows).reduce((sum, row) => sum + row.departmentShares.product, 0), 1);

s = state([product('a'), product('b')], [project('pa', 'a', 'growth_engine'), project('pb', 'b')]);
rows = factors(s);
assert.equal(rows.pa.departmentShares.product, 0.5);
assert.equal(rows.pa.departmentShares.marketing, 1);
assert.equal(rows.pa.allocationFactor, 0.5, 'the most constrained department is the bottleneck');

s = state([product('a'), product('b')], [project('pa', 'a'), project('pb', 'b', 'scale_platform')]);
rows = factors(s);
assert.equal(rows.pa.allocationFactor, 1);
assert.equal(rows.pb.allocationFactor, 1, 'non-overlapping departments retain full speed');

s = state([product('home', 'founderHome'), product('a')], [project('ph', 'home'), project('pa', 'a')], 'home');
rows = factors(s);
assert.equal(rows.ph.allocationFactor, 1);
assert.equal(rows.pa.allocationFactor, 1, 'founder-home work does not contend for office departments');
assert.equal(s.productInnovationFocusID, null, 'founder-home products cannot become company focus');

s = state([product('a'), product('b'), product('idle')], [project('pa', 'a'), project('pb', 'b')], 'idle');
rows = factors(s);
assert.equal(rows.pa.allocationFactor, 0.5);
assert.equal(rows.pb.allocationFactor, 0.5, 'an idle focus reserves no capacity');

const e = new engineModule.TycoonEngine();
e.g.configured = true;
e.g.selectedTab = 'business';
e.g.productVentures = [product('a'), product('b')];
e.g.productRoadmaps = [project('pa', 'a'), project('pb', 'b')];
e.ensureProductInnovationDefaults();
const before = { cash: e.g.companyCash, personal: e.g.personalCash, quality: e.g.productVentures[0].quality, brand: e.g.productVentures[0].brand, valuation: e.g.productVentures[0].valuation, ledger: (e.g.financeTransactions || e.g.transactions || []).length };
assert.equal(e.setProductInnovationFocus('a'), true);
assert.equal(e.g.companyCash, before.cash);
assert.equal(e.g.personalCash, before.personal);
assert.equal(e.g.productVentures[0].quality, before.quality);
assert.equal(e.g.productVentures[0].brand, before.brand);
assert.equal(e.g.productVentures[0].valuation, before.valuation);
assert.equal((e.g.financeTransactions || e.g.transactions || []).length, before.ledger);
assert.equal(e.setProductInnovationFocus('a'), false, 'same focus is a no-op');
assert.equal(e.setProductInnovationFocus('missing'), false);
const restored = JSON.parse(JSON.stringify(e.g));
innovation.ensure(restored);
assert.equal(restored.productInnovationFocusID, 'a', 'focus survives save/reload');
restored.productVentures[0].lifecycleStage = 'retired';
innovation.ensure(restored);
assert.equal(restored.productInnovationFocusID, null, 'retirement clears focus');

const run = focus => {
  const engine = new engineModule.TycoonEngine();
  engine.g.productVentures = [product('a'), product('b')];
  engine.g.productRoadmaps = [project('pa', 'a'), project('pb', 'b')];
  engine.g.productInnovationFocusID = focus;
  engine.g.founderSkillTech = 1;
  engine.ensureProductInnovationDefaults();
  const first = [];
  for (let week = 1; week <= 30; week++) {
    engine.g.week = week;
    engine.updateProductInnovationWeekly();
    if (week <= 12) first.push([engine.g.productRoadmaps[0].progress, engine.g.productRoadmaps[1].progress]);
  }
  return { engine, first, completed: engine.g.productRoadmaps.map(row => row.completedWeek) };
};
const equal = run(null), focused = run('a');
assert.equal(equal.first[0][0], equal.first[0][1]);
assert.ok(focused.first[0][0] > focused.first[0][1]);
assert.ok(focused.completed[0] < equal.completed[0]);
assert.ok(focused.completed[1] > equal.completed[1]);
assert.ok(Math.abs((equal.first[0][0] + equal.first[0][1]) - (focused.first[0][0] + focused.first[0][1])) < 1e-12, 'focus redistributes rather than creating throughput');
assert.ok(focused.first[11][1] > 0, 'non-focused work never starves');

const longRun = new engineModule.TycoonEngine();
longRun.g.productVentures = [product('a'), product('b'), product('c')];
longRun.g.productRoadmaps = [project('pa', 'a'), project('pb', 'b'), project('pc', 'c')];
longRun.g.productInnovationFocusID = 'a';longRun.ensureProductInnovationDefaults();
for (let week = 1; week <= 104; week++) { longRun.g.week = week; longRun.updateProductInnovationWeekly(); }
assert.ok(longRun.g.productRoadmaps.every(row => row.status === 'completed' && Number.isFinite(row.progress)), 'three-project 104-week portfolio completes without deadlock');
assert.equal(innovation.validate(longRun.g).ok, true);

const single = new engineModule.TycoonEngine();
single.g.productVentures = [product('a')];single.g.productRoadmaps = [project('pa', 'a')];single.g.week = 1;single.ensureProductInnovationDefaults();
const expected = 100 / 8 * Math.max(0.55, Math.min(1.75, 0.72 + single.departmentEffect('product') * 0.24 + Math.max(1, Math.min(3, single.g.founderSkillTech)) * 0.09)) * innovation.workforceFactor(single.g, ['product']);
single.updateProductInnovationWeekly();
assert.equal(single.g.productRoadmaps[0].progress, expected, 'single-project progress is exact legacy math');
const progress = single.g.productRoadmaps[0].progress;single.updateProductInnovationWeekly();assert.equal(single.g.productRoadmaps[0].progress, progress, 'same-week update remains idempotent');

const fatigued = new engineModule.TycoonEngine();
fatigued.g.productVentures = [product('a')];fatigued.g.productRoadmaps = [project('pa', 'a')];fatigued.g.workforceResultsByDepartmentID = { product: { utilization: 1.8, fatigue: 90 } };fatigued.g.week = 1;fatigued.ensureProductInnovationDefaults();fatigued.updateProductInnovationWeekly();
assert.ok(fatigued.g.productRoadmaps[0].progress < single.g.productRoadmaps[0].progress, 'existing workforce fatigue and utilization still reduce progress');

const html = innovation.renderSection(e);
assert.ok(html.includes('開発リソース配分'));
assert.ok(html.includes('均等配分'));
assert.ok(html.includes('開発配分 65%'));
assert.ok(/data-product-innovation-action="focus"/.test(html));
assert.ok(/style="min-height:44px" data-product-innovation-action="focus"/.test(html), 'focus controls keep a 44px touch target');

console.log(JSON.stringify({ equalCompletionWeeks: equal.completed, focusedCompletionWeeks: focused.completed, threeProjectCompletionWeeks: longRun.g.productRoadmaps.map(row => row.completedWeek), focusShare: innovation.FOCUS_SHARE }));
console.log('product portfolio allocation checks passed');
