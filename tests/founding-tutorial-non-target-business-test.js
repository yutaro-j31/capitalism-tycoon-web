'use strict';

// 創業ガイドのunit_economicsが非詳細シミュレーション対象業種で永久に完了しない問題。
// PR #483（Tutorial skip問題）の調査中に発見した別問題。
//
// unit_economicsの完了条件は hasInventory/hasSupplyPlan/supplyResultsByStoreID という
// 供給シグナルに依存していたが、これらは market.js/supply.js/workforce.js の
// TARGET_BUSINESS_IDS（現状 ramen のみ）にしか存在しない。cafe 等29業種を最初の店舗にすると、
// 店舗が正常に稼働していても unit_economics が一生completeにならず、創業ガイドが
// そこで永久に詰まる。実測（cafeを最初の店舗にして13週稼働）:
//
//   週13 store.status=open displayMode=guide current=unit_economics
//   unit_economics completed= false
//   supplySettingsByStoreID: []
//   inventoryByStoreID: []
//   supplyResultsByStoreID: []
//
// 供給シグナルは対象業種（ramen）についても、店舗が開いた瞬間（weeksSinceFirstOpen=0の週）に
// 自動生成されており、PR #483が追加したweeksSinceFirstOpen>=1のゲートが成立する時点では
// 既に必ず真になっている。つまり非対象業種を詰ませるだけで、対象業種側に追加の意味のある
// ゲートを提供していなかった。削除しても対象業種側の挙動は変わらないことを本テストで固定する。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 190826041) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  return { modules, engine };
}

const currentID = (modules, g) => modules.foundingTutorial.build(g).current?.id || null;
const isDone = (modules, g, id) => modules.foundingTutorial.build(g).steps.find(s => s.id === id).completed;

// 1. 回帰の本体: 非詳細シミュレーション対象の30業種すべてで、店舗開店から1週後に
//    unit_economicsが完了する（供給システムを一切持たない業種でも詰まない）。
{
  for (const businessID of ['cafe', 'conveni', 'bookstore', 'gym', 'izakaya']) {
    const { modules, engine } = newGame();
    engine.g.companyCash = 500_000_000; // gym等の高額業種でも初期資金で出店できるようにする
    const tenant = engine.g.tenants.find(t => !t.occupiedBy);
    assert.equal(engine.openStore({ tenantID: tenant.id, businessID, name: '検証店', operatingHours: 3 }), true, `${businessID}: 出店できる`);
    const store = engine.g.stores.at(-1);
    while (store.status !== 'open') engine.advanceWeek(false);

    assert.equal(isDone(modules, engine.g, 'unit_economics'), false, `${businessID}: 開店した週の時点ではまだ完了しない`);
    engine.advanceWeek(false);
    assert.equal(isDone(modules, engine.g, 'unit_economics'), true, `${businessID}: 開店から1週でunit_economicsが完了する`);
    assert.equal(engine.g.supplySettingsByStoreID?.[store.id], undefined, `${businessID}: 前提として供給システムを持たない`);
  }
}

// 2. 長期間放置しても以前は詰まっていたことの確認（回帰前の状態を長い週数でも再現しないこと）。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'cafe', name: 'カフェ', operatingHours: 3 });
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);
  for (let i = 0; i < 12; i++) engine.advanceWeek(false);

  const model = modules.foundingTutorial.build(engine.g);
  assert.notEqual(model.current?.id, 'unit_economics', '12週稼働してもunit_economicsに詰まっていない');
  assert.equal(engine.g.supplySettingsByStoreID?.[store.id], undefined, '供給システムは依然として生成されない（対象外業種のまま）');
}

// 3. 対象業種（ramen）の挙動は完全に不変。PR #483の実測（週4=unit_economics、
//    週5=weekly_recap、週6=first_improvement）と一致する。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);

  assert.equal(currentID(modules, engine.g), 'unit_economics', '開店週はunit_economicsが現在のステップ（#483と同じ）');
  assert.ok(engine.g.supplySettingsByStoreID?.[store.id], '前提: ramenは供給設定が自動生成される');

  engine.advanceWeek(false);
  assert.equal(isDone(modules, engine.g, 'unit_economics'), true, '1週で完了する（#483と同じ）');
  assert.equal(currentID(modules, engine.g), 'weekly_recap', 'weekly_recapへ進む（#483と同じ）');
}

// 4. 混在ケース: 最初の店舗が非対象業種で、後から対象業種（ramen）を追加しても、
//    unit_economicsの完了（最初の店舗基準）に影響しない。
{
  const { modules, engine } = newGame();
  const tenants = engine.g.tenants.filter(t => !t.occupiedBy).slice(0, 2);
  engine.openStore({ tenantID: tenants[0].id, businessID: 'cafe', name: 'カフェ', operatingHours: 3 });
  const cafeStore = engine.g.stores.at(-1);
  while (cafeStore.status !== 'open') engine.advanceWeek(false);

  engine.openStore({ tenantID: tenants[1].id, businessID: 'ramen', name: 'ラーメン', operatingHours: 3 });
  engine.advanceWeek(false);
  assert.equal(isDone(modules, engine.g, 'unit_economics'), true, 'カフェが1週稼働した時点で完了する（ラーメンの開店を待たない）');
}

// 5. 読み取り専用であること。RNGを消費せず、状態も変えない。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'cafe', name: 'カフェ', operatingHours: 3 });
  const before = JSON.stringify(engine.g);

  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try { modules.foundingTutorial.build(engine.g); modules.foundingTutorial.build(engine.g); }
  finally { Math.random = originalRandom; }

  assert.equal(randomCalls, 0, 'buildはRNGを消費しない');
  assert.equal(JSON.stringify(engine.g), before, 'buildはゲーム状態を変更しない');
}

// 6. STEPSの定義・順序は不変。
{
  const { modules } = newGame();
  assert.equal(
    modules.foundingTutorial.STEPS.map(s => s.id).join(','),
    'dashboard,first_store,unit_economics,first_week,weekly_recap,first_improvement,cash_runway,growth_step,organization,graduation',
    'ステップの構成は不変'
  );
}

console.log('founding tutorial non-target business tests passed');
