'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

function lcg(seed = 314159) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
function game(seed = 314159) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.companyCash = 50_000_000;
  return { modules, ctx, engine };
}
function ramenStore(engine, id = 'lifecycle-store') {
  const tenant = engine.g.tenants.find(row => !row.occupiedBy);
  const store = { id, name: 'ライフサイクル店', businessID: 'ramen', prefID: tenant.prefID, tenantID: tenant.id, status: 'open', condition: 100, operatingHours: 3, capacity: 1_000_000, quality: 0, brand: 0, lastSales: 0, lastProfit: 0, menuItems: [{ menuID: 'classic' }, { menuID: 'spicy' }] };
  engine.g.stores.push(store);
  return store;
}
function establishProductDepartment(engine) {
  engine.g.departments = { ...(engine.g.departments || {}), product: true };
}

// Research resolution records the company-global completion week exactly once.
{
  const { engine, modules } = game();
  establishProductDepartment(engine);
  assert.equal(engine.startMenuResearch('spicy'), true);
  const resolveWeek = engine.menuResearchPlan().pending.resolveWeek;
  while (engine.g.week < resolveWeek) engine.advanceWeek(false);
  assert.equal(engine.g.menuResearch.completedWeekByID.spicy, resolveWeek);
  engine.g.menuResearch.pending = { menuID: 'spicy', committedWeek: resolveWeek + 2, resolveWeek: resolveWeek + 5 };
  engine.g.week = resolveWeek + 5;
  modules.menuResearch.resolvePending(engine);
  assert.equal(engine.g.menuResearch.completedWeekByID.spicy, resolveWeek, 'completion week must never be refreshed');
  assert.ok(Object.keys(engine.g.menuResearch.completedWeekByID).length <= modules.storeEquipment.MENU_CATALOG.length - 1);
}

// The exact four lifecycle bands are derived without weekly state mutation.
{
  const { engine, modules } = game();
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID: { spicy: 10 } };
  for (const [week, age, multiplier, stage] of [[10, 0, 1, '新作'], [13, 3, 1, '新作'], [14, 4, .75, '話題'], [22, 12, .75, '話題'], [23, 13, .45, '定着'], [35, 25, .45, '定着'], [36, 26, .2, '成熟']]) {
    engine.g.week = week;
    assert.equal(JSON.stringify(modules.menuResearch.lifecycle(engine.g, 'spicy')), JSON.stringify({ ageWeeks: age, multiplier, stage, isLegacy: false }));
  }
}

// Only novelty decays. Catalog quality, price, fit, and recipes stay byte-for-byte equivalent.
{
  const { engine, modules } = game();
  const store = ramenStore(engine);
  engine.g.week = 40;
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID: { spicy: 10 } };
  const item = engine.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy');
  const catalog = modules.storeEquipment.MENU_CATALOG.find(row => row.id === 'spicy');
  assert.equal(item.noveltyDelta, catalog.noveltyDelta * .2);
  assert.equal(item.baseNoveltyDelta, catalog.noveltyDelta);
  assert.equal(item.qualityDelta, catalog.qualityDelta);
  assert.equal(item.priceMultiplier, catalog.priceMultiplier);
  assert.equal(item.effectivePrice, Math.round(engine.business('ramen').price * catalog.priceMultiplier));
  assert.deepEqual(item.segmentFit, catalog.segmentFit);
  assert.deepEqual(item.recipeMultipliers, catalog.recipeMultipliers);
}

// Legacy unlocked menus with no timestamp retain exact historical novelty and survive reload.
{
  const { engine, modules } = game();
  const store = ramenStore(engine);
  engine.g.week = 100;
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null };
  const catalog = modules.storeEquipment.MENU_CATALOG.find(row => row.id === 'spicy');
  const item = engine.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy');
  assert.equal(item.noveltyDelta, catalog.noveltyDelta);
  assert.equal(item.isLegacyLifecycle, true);
  assert.equal(item.lifecycleStage, null);
  engine.save();
  const loaded = modules.engine.TycoonEngine.load();
  assert.equal(loaded.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy').noveltyDelta, catalog.noveltyDelta);
}

// Completion state survives save/load, and remove -> re-add cannot refresh a mature result.
{
  const { engine, modules } = game();
  const store = ramenStore(engine);
  engine.g.week = 50;
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID: { spicy: 20 } };
  assert.equal(engine.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy').lifecycleStage, '成熟');
  assert.equal(engine.removeStoreMenuItem(store.id, 'spicy'), true);
  assert.equal(engine.addStoreMenuItem(store.id, 'spicy'), true);
  assert.equal(engine.g.menuResearch.completedWeekByID.spicy, 20);
  assert.equal(engine.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy').noveltyMultiplier, .2);
  engine.save();
  const loaded = modules.engine.TycoonEngine.load();
  assert.equal(loaded.g.menuResearch.completedWeekByID.spicy, 20);
  assert.equal(loaded.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy').lifecycleStage, '成熟');
}

// Malformed and future timestamps fall back safely to full legacy novelty; unknown keys are bounded away.
{
  const malformedValues = [null, [], 'bad'];
  for (const completedWeekByID of malformedValues) {
    const { engine, modules } = game();
    const store = ramenStore(engine);
    engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID };
    assert.doesNotThrow(() => engine.getStoreMenuPlan(store.id));
    assert.equal(engine.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy').noveltyMultiplier, 1);
  }
  const { engine, modules } = game();
  const store = ramenStore(engine);
  engine.g.week = 20;
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID: { spicy: Infinity, unknown: 1, chashu: -2, vegetable: NaN, value: 99 } };
  const plan = engine.getStoreMenuPlan(store.id);
  assert.equal(plan.items.find(row => row.id === 'spicy').noveltyMultiplier, 1);
  assert.deepEqual(Object.keys(engine.g.menuResearch.completedWeekByID), ['value']);
  assert.equal(modules.menuResearch.lifecycle(engine.g, 'value').isLegacy, true, 'future completion must use legacy fallback');
}

// Lifecycle reads consume no Math.random calls.
{
  const { engine, modules, ctx } = game();
  const store = ramenStore(engine);
  engine.g.week = 40;
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID: { spicy: 10 } };
  let calls = 0;
  const original = ctx.Math.random;
  ctx.Math.random = () => { calls += 1; return original(); };
  try {
    modules.menuResearch.lifecycle(engine.g, 'spicy');
    engine.getStoreMenuPlan(store.id);
  } finally { ctx.Math.random = original; }
  assert.equal(calls, 0);
}

// Market probe: the same store/state loses only the spicy novelty boost as it matures.
function marketAt(week) {
  const { engine, modules } = game(271828);
  const store = ramenStore(engine);
  engine.g.week = week;
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID: { spicy: 100 } };
  const offer = modules.market.storeOffer(engine.g, store);
  const brand = modules.market.SEGMENTS.find(row => row.id === 'brand');
  const brandChoice = modules.market.menuChoice(offer, brand);
  const spicyBrandShare = brandChoice.find(row => row.item.id === 'spicy').share;
  const result = modules.market.calculateMarket(engine.g, [store]).stores[store.id];
  return { spicyBrandShare, spicyPotentialUnits: result.menuPotentialUnits.spicy, customers: result.unitsSold, revenue: result.revenue, contribution: result.contributionMargin };
}
const fresh = marketAt(100), mature = marketAt(126);
assert.ok(fresh.spicyBrandShare > mature.spicyBrandShare, 'brand/novelty-sensitive customers must prefer fresh spicy');
assert.ok(fresh.spicyPotentialUnits > mature.spicyPotentialUnits, 'fresh spicy allocation must exceed mature spicy');
for (const value of Object.values(mature)) assert.ok(Number.isFinite(value), 'mature market values stay finite');
assert.ok(mature.spicyPotentialUnits > 0 && mature.customers > 0 && mature.revenue > 0 && mature.contribution > 0, 'mature spicy remains sellable and profitable');
assert.ok(mature.revenue > fresh.revenue * .75, 'maturity must not collapse store revenue');
console.log(`MENU_LIFECYCLE_BALANCE ${JSON.stringify({ fresh, mature })}`);

// Minimal UI label, no new interaction surface.
const app = fs.readFileSync('js/app.js', 'utf8');
assert.match(app, /話題性 \$\{Math\.round\(item\.noveltyMultiplier\*100\)\}%/);
assert.doesNotMatch(app, /data-action="menu-lifecycle"/);

console.log('menu lifecycle tests passed');
