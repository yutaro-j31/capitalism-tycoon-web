'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

function lcg(seed = 20260825) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
function game(seed = 20260825) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.companyCash = 50_000_000;
  return { modules, ctx, engine };
}
function ramenStore(engine, id = 'seasonal-store', menuItems = [{ menuID: 'classic' }, { menuID: 'chilled' }, { menuID: 'misoNikomi' }]) {
  const tenant = engine.g.tenants.find(row => !row.occupiedBy);
  const store = { id, name: '季節店', businessID: 'ramen', prefID: tenant.prefID, tenantID: tenant.id, status: 'open', condition: 100, operatingHours: 3, capacity: 1_000_000, quality: 0, brand: 0, lastSales: 0, lastProfit: 0, menuItems };
  engine.g.stores.push(store);
  return store;
}
function establishProductDepartment(engine) {
  engine.g.departments = { ...(engine.g.departments || {}), product: true };
}
function unlockedResearch(extra = {}) {
  return { unlockedIDs: ['classic', 'chilled', 'misoNikomi'], pending: null, completedWeekByID: {}, ...extra };
}

// 1. The catalog gains exactly two seasonal items; every pre-existing item is unaffected.
{
  const { modules } = game();
  const catalog = modules.storeEquipment.MENU_CATALOG;
  const chilled = catalog.find(row => row.id === 'chilled'), miso = catalog.find(row => row.id === 'misoNikomi');
  assert.ok(chilled && miso, 'both seasonal items exist in the catalog');
  assert.equal(chilled.season, 'summer');
  assert.equal(miso.season, 'winter');
  for (const row of catalog) if (row.id !== 'chilled' && row.id !== 'misoNikomi') assert.equal(row.season, undefined, `${row.id} must not carry a season field`);
}

// 2. In-season and off-season multipliers are exact, deterministic, and independent of lifecycle.
{
  const { engine, modules } = game();
  const store = ramenStore(engine);
  engine.g.menuResearch = unlockedResearch();
  for (const week of [1, 5, 26, 30, 35, 44, 48, 52]) {
    engine.g.week = week;
    const plan = engine.getStoreMenuPlan(store.id);
    const chilled = plan.items.find(row => row.id === 'chilled'), miso = plan.items.find(row => row.id === 'misoNikomi');
    const month = modules.engine.gameDate(week).month;
    const chilledInSeason = month >= 6 && month <= 8, misoInSeason = month === 12 || month <= 2;
    assert.equal(chilled.inSeason, chilledInSeason, `week ${week} chilled inSeason`);
    assert.equal(miso.inSeason, misoInSeason, `week ${week} miso inSeason`);
    assert.equal(chilled.seasonMultiplier, chilledInSeason ? 1.6 : .3);
    assert.equal(miso.seasonMultiplier, misoInSeason ? 1.6 : .3);
    // isLegacyLifecycle (no completedWeekByID entry) keeps lifecycle.multiplier at 1, so noveltyDelta
    // isolates the season factor exactly.
    assert.equal(chilled.noveltyDelta, 9 * chilled.seasonMultiplier);
    assert.equal(miso.noveltyDelta, 7 * miso.seasonMultiplier);
  }
}

// 3. Season and lifecycle multipliers compound multiplicatively; only noveltyDelta moves.
{
  const { engine, modules } = game();
  const store = ramenStore(engine);
  engine.g.week = 35; // month 8 (August) -> chilled in season, miso off season
  engine.g.menuResearch = unlockedResearch({ completedWeekByID: { chilled: 9, misoNikomi: 9 } }); // ageWeeks 26 -> lifecycle multiplier .2 ("成熟")
  const plan = engine.getStoreMenuPlan(store.id);
  const chilled = plan.items.find(row => row.id === 'chilled'), catalog = modules.storeEquipment.MENU_CATALOG.find(row => row.id === 'chilled');
  assert.equal(chilled.lifecycleStage, '成熟');
  assert.equal(chilled.noveltyMultiplier, .2, 'noveltyMultiplier keeps its pre-existing lifecycle-only meaning');
  assert.equal(chilled.seasonMultiplier, 1.6);
  assert.equal(chilled.noveltyDelta, catalog.noveltyDelta * .2 * 1.6, 'lifecycle and season multipliers compound');
  assert.equal(chilled.qualityDelta, catalog.qualityDelta);
  assert.equal(chilled.priceMultiplier, catalog.priceMultiplier);
  assert.deepEqual(chilled.segmentFit, catalog.segmentFit);
  assert.deepEqual(chilled.recipeMultipliers, catalog.recipeMultipliers);
}

// 4. Non-seasonal items are byte-for-byte unaffected: season/seasonMultiplier/inSeason stay neutral.
{
  const { engine } = game();
  const store = ramenStore(engine, 'plain-store', [{ menuID: 'classic' }, { menuID: 'spicy' }]);
  engine.g.menuResearch = { unlockedIDs: ['classic', 'spicy'], pending: null, completedWeekByID: {} };
  for (const week of [1, 26, 52]) {
    engine.g.week = week;
    const item = engine.getStoreMenuPlan(store.id).items.find(row => row.id === 'spicy');
    assert.equal(item.season, null);
    assert.equal(item.seasonMultiplier, 1);
    assert.equal(item.inSeason, null);
  }
}

// 5. The inactive (not-yet-added) list also carries season/seasonMultiplier so the R&D and store
// screens can show it before a menu is even added.
{
  const { engine } = game();
  const store = ramenStore(engine, 'inactive-store', [{ menuID: 'classic' }]);
  engine.g.week = 26; // in season for chilled
  engine.g.menuResearch = unlockedResearch();
  const inactive = engine.getStoreMenuPlan(store.id).inactive.find(row => row.id === 'chilled');
  assert.equal(inactive.season, 'summer');
  assert.equal(inactive.seasonMultiplier, 1.6);
  assert.equal(inactive.inSeason, true);
}

// 6. Seasonal items reuse the exact same R&D commit-now/reveal-later gate as every other menu --
// no special-casing, no new engine methods.
{
  const { engine, modules } = game();
  const store = ramenStore(engine, 'rd-store', [{ menuID: 'classic' }]);
  assert.equal(engine.addStoreMenuItem(store.id, 'chilled'), false, '商品開発部門が無ければ追加できない');
  establishProductDepartment(engine);
  assert.equal(engine.addStoreMenuItem(store.id, 'chilled'), false, '未研究のメニューは追加できない');
  const chilledCatalog = modules.storeEquipment.MENU_CATALOG.find(row => row.id === 'chilled');
  const expectedCost = modules.menuResearch.researchCost(chilledCatalog);
  assert.equal(expectedCost, Math.round(250000 + 15000 * (Math.abs(chilledCatalog.qualityDelta) + Math.abs(chilledCatalog.noveltyDelta))));
  assert.equal(engine.startMenuResearch('chilled'), true);
  const resolveWeek = engine.menuResearchPlan().pending.resolveWeek;
  while (engine.g.week < resolveWeek) engine.advanceWeek(false);
  assert.equal(engine.g.menuResearch.completedWeekByID.chilled, resolveWeek);
  assert.equal(engine.addStoreMenuItem(store.id, 'chilled'), true);
  assert.equal(engine.getStoreMenuPlan(store.id).items.some(row => row.id === 'chilled'), true);
}

// 7. menuResearchPlan() exposes season so the R&D screen can label items before they unlock.
{
  const { engine } = game();
  const plan = engine.menuResearchPlan();
  const chilled = plan.items.find(row => row.id === 'chilled'), miso = plan.items.find(row => row.id === 'misoNikomi'), spicy = plan.items.find(row => row.id === 'spicy');
  assert.equal(chilled.season, 'summer');
  assert.equal(miso.season, 'winter');
  assert.equal(spicy.season, null);
}

// 8. Determinism: reading season/lifecycle state consumes no Math.random calls.
{
  const { engine, ctx } = game();
  const store = ramenStore(engine);
  engine.g.menuResearch = unlockedResearch();
  let calls = 0;
  const original = ctx.Math.random;
  ctx.Math.random = () => { calls += 1; return original(); };
  try {
    for (const week of [1, 26, 52]) { engine.g.week = week; engine.getStoreMenuPlan(store.id); }
  } finally { ctx.Math.random = original; }
  assert.equal(calls, 0);
}

// 9. Save/reload preserves the store's seasonal menu selection; season fields are recomputed, not
// persisted (they follow the current week, exactly like lifecycle fields already do).
{
  const { engine, modules } = game();
  const store = ramenStore(engine);
  engine.g.week = 1; // winter (misoNikomi in season, chilled off season)
  engine.g.menuResearch = unlockedResearch();
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  const plan = reloaded.getStoreMenuPlan(store.id);
  assert.equal(plan.items.find(row => row.id === 'chilled').inSeason, false);
  assert.equal(plan.items.find(row => row.id === 'misoNikomi').inSeason, true);
  reloaded.g.week = 30; // now summer
  assert.equal(reloaded.getStoreMenuPlan(store.id).items.find(row => row.id === 'chilled').inSeason, true);
}

// 10. Market probe: in-season demand for the brand/novelty-sensitive segment exceeds off-season
// demand for the same store, holding everything else constant -- mirrors the existing lifecycle
// market probe's shape.
function marketAt(week) {
  const { engine, modules } = game(1234567);
  const store = ramenStore(engine, 'market-store', [{ menuID: 'classic' }, { menuID: 'chilled' }]);
  engine.g.week = week;
  engine.g.menuResearch = { unlockedIDs: ['classic', 'chilled'], pending: null, completedWeekByID: {} };
  const offer = modules.market.storeOffer(engine.g, store);
  const brand = modules.market.SEGMENTS.find(row => row.id === 'brand');
  const brandChoice = modules.market.menuChoice(offer, brand);
  const chilledShare = brandChoice.find(row => row.item.id === 'chilled').share;
  const result = modules.market.calculateMarket(engine.g, [store]).stores[store.id];
  return { chilledShare, chilledPotentialUnits: result.menuPotentialUnits.chilled, revenue: result.revenue, contribution: result.contributionMargin };
}
const inSeason = marketAt(30), offSeason = marketAt(44);
assert.ok(inSeason.chilledShare > offSeason.chilledShare, 'in-season chilled must win more brand-sensitive share than off-season');
assert.ok(inSeason.chilledPotentialUnits > offSeason.chilledPotentialUnits, 'in-season allocation must exceed off-season allocation');
for (const value of Object.values(offSeason)) assert.ok(Number.isFinite(value), 'off-season market values stay finite');
assert.ok(offSeason.chilledPotentialUnits > 0 && offSeason.revenue > 0 && offSeason.contribution > 0, 'off-season item remains sellable, not forced out');
console.log(`SEASONAL_MENU_BALANCE ${JSON.stringify({ inSeason, offSeason })}`);

// 11. Minimal UI: labels exist, no new button/interaction surface was introduced.
{
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /夏季メニュー/);
  assert.match(app, /冬季メニュー/);
  assert.match(app, /夏季限定/);
  assert.match(app, /冬季限定/);
  assert.doesNotMatch(app, /data-action="seasonal-menu"/);
  assert.doesNotMatch(app, /set-seasonal/);
}

console.log('seasonal menu tests passed');
