'use strict';

// Verifies the store-zero investment-company founding route required by CLAUDE.md:
// a founder who opens zero stores can still reach the company-account investment
// capability (office -> investment department -> company stock purchase) through the
// existing capability/unlock state, without any dedicated route flag, and without
// unlocking anything beyond what establishing the investment department already grants.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 77001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 77001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

function cheapestOffice(engine) {
  return engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
}

// Drives a fresh, store-zero company through office contracting and investment
// department establishment using only production engine methods (no state hand-editing).
function reachInvestmentDepartment(engine) {
  assert.equal(engine.g.stores.length, 0, 'precondition: store-zero start');
  const office = cheapestOffice(engine);
  assert.equal(engine.contractOffice(office.id), true, '本社オフィスを契約できる');
  assert.equal(engine.establishDepartment('investment'), true, '店舗0件のまま投資部門を設置できる');
}

// 1. Legacy save / saveVersion 9: an old save with no knowledge of this route still loads.
{
  const { modules, ctx, engine } = newGame();
  reachInvestmentDepartment(engine);
  engine.save();
  const saved = JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.equal(saved.saveVersion, 9, 'saveVersion stays 9');
  assert.equal(Object.prototype.hasOwnProperty.call(saved, 'foundingRoute'), false, '新しいroute stateは追加しない');
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  assert.equal(reloaded.g.stores.length, 0, 'reload後も店舗0件のまま');
  assert.equal(Boolean(reloaded.g.departments.investment), true, 'reload後も投資部門が残っている');
}

// 2. Store-zero reachability: office -> investment department, with zero stores throughout.
// Both steps also complete a one-time progression mission (mission_office / mission_department),
// which is existing, unrelated behavior (evaluateProgression()) -- accounted for explicitly here
// rather than asserting a naive cash delta that would falsely fail against that reward.
{
  const { modules, engine } = newGame();
  const missionReward = id => modules.data.MISSION_DEFS.find(m => m.id === id).reward;
  assert.equal(engine.g.stores.length, 0);
  const office = cheapestOffice(engine);
  const cashBeforeOffice = engine.g.companyCash;
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.g.companyCash, cashBeforeOffice - office.deposit + missionReward('mission_office'), 'オフィス保証金が引かれ、契約ミッション報酬が加わる');
  assert.equal(engine.g.stores.length, 0, 'オフィス契約は店舗を増やさない');
  const cashBeforeDept = engine.g.companyCash;
  assert.equal(engine.establishDepartment('investment'), true);
  const dept = modules.data.MASTER.departments.find(d => d.id === 'investment');
  assert.equal(engine.g.companyCash, cashBeforeDept - dept.setupCost + missionReward('mission_department'), '設置費が引かれ、部門ミッション報酬が加わる');
  assert.equal(engine.g.stores.length, 0, '投資部門設置後も店舗は0件のまま');
  assert.equal(Boolean(engine.g.departments.investment), true);
}

// 2b. Without a head office, the store-zero alternate path still does not bypass the
// existing head-office requirement (the alternate path only widens the store-count gate).
// The failure reason is asserted explicitly (not just the boolean return) because at the
// default officeCapacity=2 an unrelated capacity failure would also return false here,
// which would silently hide a regression that removed the hasHeadOffice check itself.
{
  const { engine } = newGame();
  let lastFailMessage = '';
  engine.addEventListener('notify', e => { lastFailMessage = e.detail.message; });
  assert.equal(engine.g.hasHeadOffice, false);
  assert.equal(engine.establishDepartment('investment'), false, '本社オフィスが無ければ店舗0件でも設置できない');
  assert.equal(lastFailMessage, '本社オフィスが必要です。', '失敗理由が本社オフィス未契約であることを確認する（別理由での偶然の失敗ではない）');
  assert.equal(Boolean(engine.g.departments.investment), false);
}

// 2c. A player with 1 or 2 stores (not zero, not yet 3) still needs the normal minStores
// gate; the alternate path is not a general relaxation of the investment unlock.
{
  const { engine } = newGame();
  const office = cheapestOffice(engine);
  assert.equal(engine.contractOffice(office.id), true);
  const tenant = engine.g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen') || engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, 'a free tenant must exist for this seed');
  assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '検証店', operatingHours: 3 }), false);
  engine.g.stores[engine.g.stores.length - 1].status = 'open';
  assert.equal(engine.g.stores.length, 1, 'precondition: exactly one store');
  assert.equal(engine.establishDepartment('investment'), false, '店舗1件では引き続き店舗3件条件が適用される');
}

// 2d. The alternate path is scoped to investment and accounting only: at store-zero,
// every store-operations department (whose minStores is 1 or 2) must remain blocked
// exactly as before -- this feature must not become a general "ignore minStores at
// zero stores" rule. accounting is exempted alongside investment because
// ipoMissingReasons() requires it, and IPO must be reachable on this route (see test 10).
{
  const { engine } = newGame();
  const office = cheapestOffice(engine);
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.g.stores.length, 0);
  for (const id of ['hr', 'product', 'operations', 'marketing', 'dx']) {
    assert.equal(engine.establishDepartment(id), false, `店舗0件では${id}部門は依然として設置できない`);
    assert.equal(Boolean(engine.g.departments[id]), false);
  }
  assert.equal(engine.establishDepartment('investment'), true, '一方でinvestment部門は店舗0件でも設置できる');
  assert.equal(engine.establishDepartment('accounting'), true, 'accounting部門もIPO到達のため店舗0件で設置できる');
}

// 3 & 4 & 5 & 6. Company stock purchase at store-zero: companyCash decreases,
// companyStocks increases, personalCash/personalStocks are untouched.
{
  const { engine } = newGame();
  reachInvestmentDepartment(engine);
  const stock = engine.g.market[0];
  const qty = 50;
  const cost = stock.price * qty * 1.001;
  const companyCashBefore = engine.g.companyCash;
  const personalCashBefore = engine.g.personalCash;
  const personalStocksBefore = JSON.stringify(engine.g.personalStocks);

  assert.equal(engine.buyStock(stock.id, qty, 'company'), true, '店舗0件のまま会社口座で株式を購入できる');

  assert.ok(Math.abs(engine.g.companyCash - (companyCashBefore - cost)) < 1, 'companyCashだけがコスト分減る');
  assert.equal(engine.g.companyStocks[stock.id].qty, qty, 'companyStocksが増える');
  assert.equal(engine.g.personalCash, personalCashBefore, 'personalCashは不変');
  assert.equal(JSON.stringify(engine.g.personalStocks), personalStocksBefore, 'personalStocksは不変');
  assert.equal(engine.g.stores.length, 0, '株式購入後も店舗は0件のまま');
}

// 7. finance ledger integrity: the company-side purchase is recorded once, correctly.
{
  const { modules, engine } = newGame();
  reachInvestmentDepartment(engine);
  const stock = engine.g.market[1];
  const qty = 30;
  const cost = stock.price * qty * 1.001;
  const txBefore = engine.g.finance.transactions.length;
  assert.equal(engine.buyStock(stock.id, qty, 'company'), true);
  const newTx = engine.g.finance.transactions.slice(txBefore);
  assert.equal(newTx.length, 1, '会計イベントは1件だけ記録される');
  assert.equal(newTx[0].sourceType, 'buyStock');
  assert.ok(Math.abs(newTx[0].cashEffect + cost) < 1, 'cashEffectが購入コストと一致する');
  assert.ok(Math.abs(newTx[0].assetEffect - cost) < 1, 'assetEffectが購入コストと一致する（純資産不変）');
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 8. Invalid-action atomicity: an unaffordable purchase changes nothing.
{
  const { engine } = newGame();
  reachInvestmentDepartment(engine);
  const stock = engine.g.market[2];
  const hugeQty = Math.ceil((engine.g.companyCash * 100) / stock.price);
  const snapshot = () => JSON.stringify({
    companyCash: engine.g.companyCash, companyStocks: engine.g.companyStocks,
    personalCash: engine.g.personalCash, personalStocks: engine.g.personalStocks,
    tx: engine.g.finance.transactions.length
  });
  const before = snapshot();
  assert.equal(engine.buyStock(stock.id, hugeQty, 'company'), false, '資金不足では失敗する');
  assert.equal(snapshot(), before, '失敗時は状態が一切変わらない');
}

// 9. The existing store-founding route is not broken: normal progress to 3 stores still
// unlocks the investment department through the original minStores gate.
{
  const { engine } = newGame(4242);
  const office = cheapestOffice(engine);
  assert.equal(engine.contractOffice(office.id), true);
  for (let i = 0; i < 3; i++) {
    const tenant = engine.g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen') || engine.g.tenants.find(t => !t.occupiedBy);
    assert.ok(tenant, `a free tenant must exist for store ${i + 1}`);
    assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: `店${i + 1}`, operatingHours: 3 }), false);
    engine.g.stores[engine.g.stores.length - 1].status = 'open';
  }
  assert.equal(engine.g.stores.length, 3);
  assert.equal(engine.establishDepartment('investment'), true, '店舗ルートでも従来どおり投資部門を設置できる');
}

// 10. Opening the investment route does not unconditionally unlock M&A, real estate,
// governance, IPO, or other high-tier systems beyond what establishing the investment
// department has always granted (which is unchanged by this feature).
{
  const { engine } = newGame();
  reachInvestmentDepartment(engine);
  const stock = engine.g.market[3];
  assert.equal(engine.buyStock(stock.id, 10, 'company'), true);

  // Real estate purchase power is unrelated to departments/stores in the existing code
  // (buyProperty only checks cash), so it is unaffected either way and stays reachable
  // only through its own cash gate -- confirmed unrelated to this change.
  // accounting is not asserted false here: it is now independently reachable at store-zero
  // (test 2d), but nothing in this test calls establishDepartment('accounting'), so it
  // simply was never established -- this checks that buying stock / establishing investment
  // has no side effect on it, not that it is blocked.
  assert.equal(Boolean(engine.g.departments.accounting), false, 'accounting部門は明示的に設置しない限り自動では付与されない');
  assert.equal(Boolean(engine.g.departments.hr), false, '人事部門は未設置のまま（minStores1は変えていない）');
  assert.equal(Boolean(engine.g.departments.product), false, '商品開発部門は未設置のまま');
  assert.equal(Boolean(engine.g.departments.operations), false, '生産管理部門は未設置のまま（minStores2は変えていない）');
  assert.equal(Boolean(engine.g.departments.marketing), false, '宣伝部門は未設置のまま');
  assert.equal(Boolean(engine.g.departments.dx), false, '技術部門は未設置のまま');
  assert.equal(engine.g.boardEstablished, false, '取締役会は無条件に設置されない');
  assert.equal(engine.g.publicCompany, false, 'IPOは無条件に発生しない');
  const missing = engine.ipoMissingReasons();
  assert.ok(!missing.includes('店舗3店'), 'IPO条件はstores>=3を要求しない（別PRで撤去済み）');
  assert.ok(missing.length > 0, 'accounting/board/利益/企業価値が未達のためIPOはまだ無条件には解放されない');
  assert.equal(engine.g.subsidiaries.length, 0, '子会社は無条件に生成されない');
  assert.equal(engine.g.maSubsidiaries.length, 0, 'M&A子会社は無条件に生成されない');
  assert.equal((engine.g.properties || []).filter(p => p.owner).length, 0, '不動産は無条件に取得されない');
}

// 11. No unnecessary RNG consumption: the new store-zero branch in establishDepartment is
// a pure boolean/state check (id==='investment' && stores.length===0) with no rand()/uuid()
// call of its own, so it must consume exactly the same number of random draws as the
// unmodified store-route call to the same method (any nonzero count here comes from
// establishDepartment's existing body -- e.g. uuid() for the new office-floor entry --
// and is identical either way, not something this feature added).
{
  function measure(setup) {
    const calls = [];
    const countingRandom = (() => { const base = lcg(555); return () => { const v = base(); calls.push(v); return v; }; })();
    const { ctx } = loadGame({ random: countingRandom });
    const engine = ctx.__ct_engine;
    engine.g.configured = true;
    setup(engine);
    const before = calls.length;
    assert.equal(engine.establishDepartment('investment'), true);
    return calls.length - before;
  }

  const storeZeroRngCalls = measure(engine => {
    const office = cheapestOffice(engine);
    assert.equal(engine.contractOffice(office.id), true);
    assert.equal(engine.g.stores.length, 0);
  });

  const storeRouteRngCalls = measure(engine => {
    const office = cheapestOffice(engine);
    assert.equal(engine.contractOffice(office.id), true);
    for (let i = 0; i < 3; i++) {
      const tenant = engine.g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen') || engine.g.tenants.find(t => !t.occupiedBy);
      assert.ok(tenant);
      assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: `店${i + 1}`, operatingHours: 3 }), false);
      engine.g.stores[engine.g.stores.length - 1].status = 'open';
    }
    assert.equal(engine.g.stores.length, 3);
  });

  assert.equal(storeZeroRngCalls, storeRouteRngCalls, '店舗0件経路のestablishDepartmentは店舗ルートと同じ乱数消費量（新しい分岐が乱数を追加していない）');
}

// 12. Save -> reload round trip stays correct after the full vertical slice.
{
  const { modules, ctx, engine } = newGame(909);
  reachInvestmentDepartment(engine);
  const stock = engine.g.market[4];
  assert.equal(engine.buyStock(stock.id, 20, 'company'), true);
  const companyCashBefore = engine.g.companyCash;
  const companyStocksBefore = JSON.stringify(engine.g.companyStocks);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  assert.equal(reloaded.g.companyCash, companyCashBefore, 'reload後もcompanyCashが一致する');
  assert.equal(JSON.stringify(reloaded.g.companyStocks), companyStocksBefore, 'reload後もcompanyStocksが一致する');
  assert.equal(reloaded.g.stores.length, 0, 'reload後も店舗0件のまま');
  assert.equal(Boolean(reloaded.g.departments.investment), true, 'reload後も投資部門が残る');
}

// 13. Determinism: same seed, same actions -> identical resulting state.
{
  const run = () => {
    const { engine } = newGame(20260818);
    reachInvestmentDepartment(engine);
    const stock = engine.g.market[5];
    engine.buyStock(stock.id, 15, 'company');
    return JSON.stringify({
      companyCash: engine.g.companyCash, companyStocks: engine.g.companyStocks,
      personalCash: engine.g.personalCash, stores: engine.g.stores.length,
      departments: Object.keys(engine.g.departments)
    });
  };
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 14. finance.validate() and the accounting invariants stay clean through the whole
// vertical slice (office contract, department setup, and a company stock purchase).
{
  const { modules, engine } = newGame(1200);
  reachInvestmentDepartment(engine);
  const stock = engine.g.market[6];
  assert.equal(engine.buyStock(stock.id, 40, 'company'), true);
  for (let i = 0; i < 8; i++) engine.advanceWeek(false);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
  assert.equal(engine.g.stores.length, 0, '8週進めても店舗0件のまま継続できる');
}

// 15. syntax / static / module / test-registration are exercised by the repository's own
// canonical commands (test:syntax, test:static, test:modules); this focused test instead
// re-asserts the production wiring this feature touches has not introduced a second
// MutationObserver or any new top-level state field, matching CLAUDE.md's invariants.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  const appSrc = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(engineSrc), 'engine.jsに新しいMutationObserverを追加していない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(appSrc), 'app.jsに新しいMutationObserverを追加していない');
  assert.ok(!/foundingRoute/.test(engineSrc), '明示的なfoundingRoute stateを復活させていない');
}

console.log('Store-zero investment founding route tests passed');
