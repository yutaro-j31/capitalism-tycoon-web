'use strict';

// R6 remaining item "メニューR&D". Before this, js/store-equipment.js's MENU_CATALOG had
// four non-classic items that any open ramen store could add instantly and for free --
// addMenu() (proto: addStoreMenuItem) charged nothing and checked nothing but the store
// being open. This ties new menu unlocks to 商品開発部門 (the department whose own
// description is literally "商品開発を解放" -- it already gates RD_PROJECTS,
// PRODUCT_BLUEPRINTS and internal venture proposals elsewhere in the codebase) and to a real
// cost + delay, following the exact commit-now/reveal-later idiom
// js/pe-value-creation.js established for PE initiatives: at most one menu in research at a
// time, and the unlock lands automatically once the delay elapses.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 260819801) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819801) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.companyCash = 50_000_000;
  return { modules, ctx, engine };
}

function openRamenStore(engine) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, '前提: 空きテナントが存在する');
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '検証ラーメン', operatingHours: 3 }), true);
  const store = engine.g.stores.at(-1);
  store.status = 'open';
  return store;
}

function establishProductDepartment(engine) {
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('product'), true);
}

// 0. Both the store-menu card and the R&D tab card must actually be wired: a locked item has
// no add button on the store side, and the R&D tab has a start-research action.
{
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(appSrc, /item\.unlocked\?btn\('追加','add-store-menu'/, '店舗側：未開発メニューには追加ボタンを出さない');
  assert.match(appSrc, /case 'start-menu-research':engine\.startMenuResearch\(id\);break;/, 'R&Dタブ：研究開始アクションが配線されている');
  assert.match(appSrc, /card\('メニュー開発'/, 'R&Dタブにメニュー開発カードがある');
}

// 1. Adding a non-classic menu is blocked before the department exists at all.
{
  const { engine } = newGame();
  const store = openRamenStore(engine);
  assert.equal(engine.addStoreMenuItem(store.id, 'chashu'), false, '商品開発部門が無ければ追加できない');
  const menu = engine.getStoreMenuPlan(store.id);
  assert.equal(menu.items.length, 1, '定番のみ');
  assert.equal(menu.inactive.find(x => x.id === 'chashu').unlocked, false);
}

// 2. Department alone is not enough -- research must actually be committed and resolved.
{
  const { engine } = newGame();
  const store = openRamenStore(engine);
  establishProductDepartment(engine);
  assert.equal(engine.addStoreMenuItem(store.id, 'chashu'), false, '部門があっても未研究なら追加できない');
}

// 3. Classic can never be researched (it is the always-unlocked baseline).
{
  const { engine } = newGame();
  openRamenStore(engine);
  establishProductDepartment(engine);
  assert.equal(engine.startMenuResearch('classic'), false);
}

// 4. Starting research charges the exact derived cost, and blocks a second concurrent
// research (models limited R&D bandwidth, same rule PE initiatives already enforce).
{
  const { engine, modules } = newGame();
  openRamenStore(engine);
  establishProductDepartment(engine);
  const before = engine.g.companyCash;
  const expectedCost = modules.menuResearch.researchCost(modules.storeEquipment.MENU_CATALOG.find(d => d.id === 'chashu'));
  assert.equal(engine.startMenuResearch('chashu'), true);
  assert.equal(before - engine.g.companyCash, expectedCost, '費用は導出値どおり課金される');

  assert.equal(engine.startMenuResearch('spicy'), false, '同時進行は1件まで');
  const plan = engine.menuResearchPlan();
  assert.equal(plan.pending.menuID, 'chashu');
  assert.equal(plan.pending.resolveWeek, 1 + modules.menuResearch.RESEARCH_DELAY_WEEKS);
}

// 5. The item cannot be added to any store while its own research is still pending.
{
  const { engine } = newGame();
  const store = openRamenStore(engine);
  establishProductDepartment(engine);
  assert.equal(engine.startMenuResearch('chashu'), true);
  assert.equal(engine.addStoreMenuItem(store.id, 'chashu'), false, '研究中は追加できない');
}

// 6. Once the delay elapses, the unlock lands automatically and the menu becomes addable.
{
  const { engine, modules } = newGame();
  const store = openRamenStore(engine);
  establishProductDepartment(engine);
  assert.equal(engine.startMenuResearch('chashu'), true);
  const resolveWeek = engine.menuResearchPlan().pending.resolveWeek;
  while (engine.g.week < resolveWeek) assert.notEqual(engine.advanceWeek(false), false);
  const plan = engine.menuResearchPlan();
  assert.equal(plan.pending, null, '解決後はpendingが消える');
  assert.equal(plan.items.find(x => x.id === 'chashu').unlocked, true);
  assert.equal(engine.addStoreMenuItem(store.id, 'chashu'), true, '解決後は追加できる');
  const menu = engine.getStoreMenuPlan(store.id);
  assert.deepEqual([...menu.items.map(x => x.id)].sort(), ['chashu', 'classic']);
}

// 7. An already-unlocked menu cannot be researched again (no double-charge).
{
  const { engine, modules } = newGame();
  openRamenStore(engine);
  establishProductDepartment(engine);
  engine.startMenuResearch('chashu');
  const resolveWeek = engine.menuResearchPlan().pending.resolveWeek;
  while (engine.g.week < resolveWeek) engine.advanceWeek(false);
  const cashBefore = engine.g.companyCash;
  assert.equal(engine.startMenuResearch('chashu'), false, '開発済みは再研究できない');
  assert.equal(engine.g.companyCash, cashBefore);
}

// 8. Insufficient cash blocks research and charges nothing.
{
  const { engine, modules } = newGame();
  openRamenStore(engine);
  establishProductDepartment(engine);
  const cost = modules.menuResearch.researchCost(modules.storeEquipment.MENU_CATALOG.find(d => d.id === 'chashu'));
  engine.g.companyCash = cost - 1;
  assert.equal(engine.startMenuResearch('chashu'), false, '費用に1円足りなければ失敗する');
  assert.equal(engine.g.companyCash, cost - 1, '失敗した研究は現金を動かさない');
}

// 9. Company/personal separation: only companyCash and the company ledger move. A rejected
// call is a true no-op (no ledger entry either).
{
  const { engine, modules } = newGame();
  openRamenStore(engine);
  establishProductDepartment(engine);
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  engine.g.personalCash = 12_345_678;
  const personalBefore = engine.g.personalCash;
  const ledgerBefore = engine.g.finance.transactions.length;

  assert.equal(engine.startMenuResearch('chashu'), true);
  assert.equal(engine.g.personalCash, personalBefore, '個人資金は動かない');
  assert.equal(engine.g.finance.transactions.length, ledgerBefore + 1, '会社台帳には1件だけ記帳される');
  assert.equal(modules.finance.validate(engine.g).ok, true);

  const ledgerAfterStart = engine.g.finance.transactions.length;
  assert.equal(engine.startMenuResearch('spicy'), false, '拒否される呼び出し');
  assert.equal(engine.g.finance.transactions.length, ledgerAfterStart, '拒否された研究は台帳に記帳しない');
}

// 10. Save/reload preserves both the pending research and any already-unlocked menus.
{
  const { engine, modules } = newGame();
  openRamenStore(engine);
  establishProductDepartment(engine);
  assert.equal(engine.startMenuResearch('chashu'), true);
  engine.save();

  const reloaded = modules.engine.TycoonEngine.load();
  const pending = reloaded.menuResearchPlan().pending;
  assert.ok(pending, 'reload後もpendingが残る');
  assert.equal(pending.menuID, 'chashu');
  assert.equal(reloaded.g.saveVersion, 9);

  const resolveWeek = pending.resolveWeek;
  while (reloaded.g.week < resolveWeek) reloaded.advanceWeek(false);
  assert.equal(reloaded.menuResearchPlan().items.find(x => x.id === 'chashu').unlocked, true, 'reload後も正常に解決する');
}

// 11. A save written before this feature existed -- a store that already has a non-classic
// menu item on it, and no menuResearch key at all -- must keep working exactly as before:
// the existing item stays priced and sellable. The lock only applies to a FUTURE addMenu
// call, never retroactively.
{
  const { engine } = newGame();
  const store = openRamenStore(engine);
  store.menuItems = [{ menuID: 'classic' }, { menuID: 'spicy' }];
  delete engine.g.menuResearch;

  const menu = engine.getStoreMenuPlan(store.id);
  assert.deepEqual([...menu.items.map(x => x.id)].sort(), ['classic', 'spicy'], '旧セーブの既存メニューは維持される');
  assert.ok(Number.isFinite(menu.items.find(x => x.id === 'spicy').effectivePrice), '価格計算も引き続き有効');

  assert.equal(engine.removeStoreMenuItem(store.id, 'spicy'), true);
  assert.equal(engine.addStoreMenuItem(store.id, 'spicy'), false, '外した後の再追加は新ルールで研究が必要になる');
}

// 12. Determinism / RNG budget: neither a successful nor a rejected call draws any random
// number, and two identical seeded runs converge exactly.
{
  function run() {
    const { engine } = newGame(31415);
    openRamenStore(engine);
    establishProductDepartment(engine);
    engine.startMenuResearch('chashu');
    for (let i = 0; i < 5; i++) engine.advanceWeek(false);
    return JSON.stringify({ cash: engine.g.companyCash, week: engine.g.week, plan: engine.menuResearchPlan() });
  }
  assert.equal(run(), run(), '同じseedで同じ結果になる');

  const { engine } = newGame();
  openRamenStore(engine);
  establishProductDepartment(engine);
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    assert.equal(engine.startMenuResearch('chashu'), true);
    assert.equal(engine.startMenuResearch('spicy'), false);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '成功・拒否どちらもMath.randomを消費しない');
}

// 13. Cost formula: locks in the specific derived values so an accidental rebalance shows up
// as a diff instead of silently drifting.
{
  const { modules } = newGame();
  const cost = id => modules.menuResearch.researchCost(modules.storeEquipment.MENU_CATALOG.find(d => d.id === id));
  assert.equal(cost('value'), 295000);
  assert.equal(cost('chashu'), 400000);
  assert.equal(cost('vegetable'), 400000);
  assert.equal(cost('spicy'), 475000);
}

console.log('menu research tests passed');
