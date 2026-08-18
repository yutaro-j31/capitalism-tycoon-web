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

console.log('Store-manager delegation tests passed');
