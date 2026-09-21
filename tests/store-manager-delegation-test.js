'use strict';

// Issue #423 priority 2: store-manager / delegation policy. Per CLAUDE.md, this must not
// revive the old storeManagersByStoreID map. Audit finding: the engine already has a
// company-wide auto-pilot toggle (g.autoManage / g.autoManageStyle, wired to Settings UI
// and to autoManage(), called once per week only when enabled) and a per-store workforce
// staffing snapshot (workforceTeams[].managerHeadcount, workforceResultsByStoreID). This
// feature is implemented purely by extending autoManage() to also delegate a store's
// weekly operating-hours decision, gated on that store's workforce team already having a
// hired manager (managerHeadcount>=1, via the existing 'manager' role hiring flow) -- no
// new top-level state field, no revived route/manager map, and a strict no-op for every
// save/test that never sets g.autoManage=true.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 990001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 990001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

function openRamenStore(engine) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen') || engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, 'a free tenant must exist for this seed');
  assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '委任検証店', operatingHours: 3 }), false);
  const store = engine.g.stores[engine.g.stores.length - 1];
  store.status = 'open';
  return store;
}

function hireCEO(engine) {
  engine.g.executives.CEO = { role: 'CEO', name: 'テストCEO', skill: 80, salary: 4_000_000 };
}

function makeFoundableBusinessesProfitable(modules, engine) {
  for (const id of modules.engine.FOUNDABLE_BUSINESS_IDS) {
    const b = engine.business(id);
    b.demand = Math.max(500, Number(b.demand) || 0);
    b.price = Math.max(10_000, Number(b.price) || 0);
    b.unitCost = Math.min(100, Number(b.unitCost) || 0);
    b.fixedCost = 0;
    b.wage = 0;
  }
}

// Seeds the per-store workforce team and last-week staffing snapshot directly, matching the
// established "capitalized audit route" idiom used elsewhere in this repo's tests, instead
// of driving many simulated weeks to arrive at a specific utilization value.
function seedManagerAndUtilization(modules, engine, store, { managerHeadcount = 1, staffingUtilization = 1 } = {}) {
  const team = modules.workforce.createStoreTeam(engine.g, store.id);
  team.managerHeadcount = managerHeadcount;
  team.headcount = Math.max(team.headcount, managerHeadcount);
  engine.g.workforceResultsByStoreID[store.id] = {
    storeID: store.id, requiredStaff: 1, actualStaff: team.headcount, managerHeadcount,
    staffLimitedCapacity: 1000, staffingUtilization, staffLostDemand: 0,
    serviceQualityAdjustment: 0, managementAdjustment: 0, fatigueAdjustment: 0
  };
}

// 1. Default (autoManage disabled): operatingHours must never auto-change, even with a
// manager and favorable utilization seeded -- zero behavior change for every existing
// save/test that never opts in.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  hireCEO(engine);
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .5 });
  assert.equal(engine.g.autoManage, false, 'precondition: autoManage defaults to off');
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 3, 'operatingHours must not change while autoManage is off');
}

// 2. aggressive style with favorable utilization and a manager -> hours extend to 4.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'aggressive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .9 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 4, 'aggressive delegation extends hours when staffing is favorable');
}

// 3. aggressive style still pulls back to 3 when severely understaffed.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.operatingHours = 4;
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'aggressive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: 1.5 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 3, 'aggressive delegation pulls back when severely understaffed');
}

// 4. defensive style always targets baseline hours regardless of utilization.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.operatingHours = 4;
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'defensive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .3 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 3, 'defensive delegation always holds to baseline hours');
}

// 5. balanced style: comfortable utilization extends hours, overloaded pulls back, and the
// middle band is left untouched.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'balanced';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .5 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 4, 'balanced delegation extends hours when comfortably staffed');
}
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.operatingHours = 4;
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'balanced';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: 1.4 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 3, 'balanced delegation pulls back hours when overloaded');
}
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.operatingHours = 2;
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'balanced';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .92 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 2, 'balanced delegation leaves hours untouched in the middle utilization band');
}

// 6. No manager -> delegation must not touch operatingHours even with autoManage on and
// favorable utilization. This proves the manager gate is load-bearing, not decorative.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'aggressive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 0, staffingUtilization: .5 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 3, 'without a manager, delegation must not change operatingHours');
}

// 7. No CEO -> autoManage() (and delegation with it) is a no-op even if autoManage is on,
// matching the pre-existing brand-investment auto-pilot's own CEO gate.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'aggressive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .5 });
  assert.equal(engine.g.executives.CEO, undefined, 'precondition: no CEO hired');
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 3, 'without a CEO, autoManage (and delegation) does nothing');
}

// 8. Closed stores are skipped even with autoManage on and a manager present.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.status = 'closed';
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'aggressive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .5 });
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.operatingHours, 3, 'closed stores are never auto-adjusted');
}

// 9. No stray accounting side effect: delegation only ever touches store.operatingHours.
// finance.validate() / workforce.validate() must stay clean through the delegated week.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'aggressive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .9 });
  assert.notEqual(engine.advanceWeek(false), false);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
  const wv = modules.workforce.validate(engine.g);
  assert.equal(wv.ok, true, (wv.errors || []).join('\n'));
}

// 10. Determinism: same seed and setup -> identical resulting operatingHours/state.
{
  function run() {
    const { modules, engine } = newGame(551234);
    const store = openRamenStore(engine);
    hireCEO(engine);
    engine.g.autoManage = true; engine.g.autoManageStyle = 'balanced';
    seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .6 });
    engine.advanceWeek(false);
    return JSON.stringify({ operatingHours: store.operatingHours, week: engine.g.week, companyCash: engine.g.companyCash });
  }
  assert.equal(run(), run(), 'same seed and setup must produce the same delegation outcome');
}

// 11. Save/reload: a delegated operatingHours change persists like any other store field --
// no new top-level state was introduced, so there is nothing extra to migrate.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  hireCEO(engine);
  engine.g.autoManage = true; engine.g.autoManageStyle = 'aggressive';
  seedManagerAndUtilization(modules, engine, store, { managerHeadcount: 1, staffingUtilization: .9 });
  engine.advanceWeek(false);
  assert.equal(store.operatingHours, 4);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  const reloadedStore = reloaded.g.stores.find(s => s.id === store.id);
  assert.equal(reloadedStore.operatingHours, 4, 'delegated operatingHours survives reload');
}

// 12. Static source scan: no revived storeManagersByStoreID, no new MutationObserver.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  assert.ok(!/storeManagersByStoreID/.test(engineSrc), '旧storeManagersByStoreIDを復活させていない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(engineSrc), 'engine.jsに新しいMutationObserverを追加していない');
}

// 13. Auto management actually expands stores. Seed one ramen location first, then at the
// balanced 13-week cadence the next automated opening must be one of the other foundable
// businesses rather than another ramen store.
{
  const { modules, engine } = newGame(712345);
  makeFoundableBusinessesProfitable(modules, engine);
  openRamenStore(engine);
  hireCEO(engine);
  engine.g.autoManage = true;
  engine.g.autoManageStyle = 'balanced';
  engine.g.companyCash = 500_000_000;
  engine.g.week = 13;
  const before = engine.g.stores.length;
  engine.autoManage();
  assert.equal(engine.g.stores.length, before + 1, 'autoManage() opens a store on its 13-week cadence');
  const opened = engine.g.stores.at(-1);
  assert.notEqual(opened.businessID, 'ramen', 'missing non-ramen core business is prioritized over another ramen location');
  assert.ok(modules.engine.FOUNDABLE_BUSINESS_IDS.includes(opened.businessID), 'automated opening stays inside the canonical foundable-business set');
  assert.match(String(opened.id), /^auto-store-13-/, 'automated opening uses a deterministic store ID instead of a fresh UUID');
  assert.equal(engine.g.tenants.find(t => t.id === opened.tenantID).occupiedBy, 'player', 'canonical openStore settlement occupies the tenant');
}

// 14. Repeated balanced expansion covers distinct missing core businesses before adding a
// second location to a business that is already represented.
{
  const { modules, engine } = newGame(812345);
  makeFoundableBusinessesProfitable(modules, engine);
  openRamenStore(engine);
  hireCEO(engine);
  engine.g.autoManage = true;
  engine.g.autoManageStyle = 'balanced';
  engine.g.companyCash = 1_000_000_000;
  for(const week of [13,26,39]){
    engine.g.week = week;
    assert.equal(engine.autoManageStoreExpansion(8_000_000), true, `week ${week}: another profitable missing core business should open`);
  }
  const represented = new Set(engine.g.stores.filter(s=>s.status!=='closed').map(s=>s.businessID));
  for(const id of modules.engine.FOUNDABLE_BUSINESS_IDS)assert.ok(represented.has(id), `${id} receives an automated first store before duplicate expansion`);
}

// 15. Cash reserve and cadence are load-bearing. No opening happens off-cycle or when the
// post-opening cash balance would breach the selected strategy reserve.
{
  const { engine } = newGame(912345);
  hireCEO(engine);
  engine.g.autoManage = true;
  engine.g.autoManageStyle = 'balanced';
  engine.g.companyCash = 500_000_000;
  engine.g.week = 12;
  assert.equal(engine.autoManageStoreExpansion(8_000_000), false, 'off-cycle week does not auto-open');
  assert.equal(engine.g.stores.length, 0);
  engine.g.week = 13;
  engine.g.companyCash = 1_000_000;
  assert.equal(engine.autoManageStoreExpansion(8_000_000), false, 'auto expansion does not spend through the reserve');
  assert.equal(engine.g.stores.length, 0);
}

// 16. Determinism: identical seeded state and cadence select the same non-ramen business,
// tenant stable key, accounting result, and deterministic store ID.
{
  function run(){
    const { modules, engine } = newGame(612345);
    makeFoundableBusinessesProfitable(modules, engine);
    openRamenStore(engine);
    hireCEO(engine);
    engine.g.autoManage = true;
    engine.g.autoManageStyle = 'balanced';
    engine.g.companyCash = 500_000_000;
    engine.g.week = 13;
    engine.autoManageStoreExpansion(8_000_000);
    const s=engine.g.stores.at(-1),t=engine.g.tenants.find(x=>x.id===s.tenantID);
    return JSON.stringify({id:s.id,businessID:s.businessID,tenant:t.stableKey,cash:engine.g.companyCash,status:s.status,openingWeek:s.openingWeek});
  }
  assert.equal(run(),run(),'same state and operations produce the same automated expansion result');
}

// 17. Static guard: the new expansion policy itself does not introduce RNG/time/UUID calls.
// openStore still supports its legacy manual UUID path, but automation supplies storeID explicitly.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  const start = src.indexOf('  autoManageStoreExpansion(reserve=0)');
  const end = src.indexOf('  // Store-manager delegation:', start);
  assert.ok(start >= 0 && end > start, 'autoManageStoreExpansion source block exists');
  const block = src.slice(start, end);
  assert.doesNotMatch(block, /Math\.random\(|Date\.now\(|randomUUID\(|uuid\(/, 'auto expansion introduces no RNG/time/UUID source');
  assert.match(block, /storeID:/, 'auto expansion passes a deterministic storeID into canonical openStore');
}

// 18. Duplicate deterministic store IDs fail atomically before any cash/tenant mutation.
{
  const { engine } = newGame(512345);
  engine.g.companyCash = 500_000_000;
  const [firstTenant, secondTenant] = engine.g.tenants.filter(t=>!t.occupiedBy).slice(0,2);
  assert.ok(firstTenant && secondTenant, 'fixture has two free tenants');
  assert.equal(engine.openStore({tenantID:firstTenant.id,businessID:'ramen',storeID:'auto-store-atomic-contract'}),true);
  const cashBefore=engine.g.companyCash, secondBefore=secondTenant.occupiedBy, storesBefore=engine.g.stores.length;
  assert.equal(engine.openStore({tenantID:secondTenant.id,businessID:'ramen',storeID:'auto-store-atomic-contract'}),false);
  assert.equal(engine.g.companyCash,cashBefore,'duplicate storeID failure does not move cash');
  assert.equal(secondTenant.occupiedBy,secondBefore,'duplicate storeID failure does not occupy the tenant');
  assert.equal(engine.g.stores.length,storesBefore,'duplicate storeID failure does not add a store');
}

console.log('Store-manager delegation and auto-expansion tests passed');
