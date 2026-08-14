'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 4242) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 4242) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.companyCash = 500_000_000;
  return { modules, ctx, engine };
}

function openRamenStore(engine) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen')
    || engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, 'a free tenant must exist');
  assert.notEqual(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '検証店', operatingHours: 3 }), false);
  const store = engine.g.stores[engine.g.stores.length - 1];
  store.status = 'open';
  return store;
}

// 1. 既存セーブ互換：level 未設定の店舗は Lv1 として扱われ、容量倍率は 1.0 のまま。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  assert.equal(Object.prototype.hasOwnProperty.call(store, 'level'), false, '新規店舗は level を持たない（既存セーブと同じ形）');
  assert.equal(modules.storeEquipment.level(store), 1, 'level 未設定は Lv1 として解決される');
  assert.equal(modules.storeEquipment.capacityMultiplier(store), 1, '未強化の容量倍率は 1.0');
}

// 2. 強化するとレベル・現金・固定資産・容量倍率がすべて整合して動く。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  const business = engine.business('ramen');
  const cashBefore = engine.g.companyCash;
  const assetsBefore = engine.g.finance.fixedAssets.length;
  const cost = modules.storeEquipment.upgradeCost(business, store);

  assert.equal(engine.upgradeStoreEquipment(store.id), true, '強化は成功する');
  assert.equal(store.level, 2, 'レベルが 2 になる');
  assert.equal(engine.g.companyCash, cashBefore - cost, '会社現金がコスト分だけ減る');
  assert.equal(engine.g.finance.fixedAssets.length, assetsBefore + 1, '固定資産が 1 件増える');

  const asset = engine.g.finance.fixedAssets[engine.g.finance.fixedAssets.length - 1];
  assert.equal(asset.assetType, 'storeEquipment', '既存の店舗設備と同じ資産種別で計上する');
  assert.equal(asset.acquisitionCost, cost, '取得原価が支払額と一致する');
  assert.equal(asset.storeID, store.id, '資産が店舗に紐づく');
  assert.equal(asset.salvageValue, Math.round(cost * modules.storeEquipment.SALVAGE_RATE), '残存価額が規定どおり');
  assert.ok(Math.abs(modules.storeEquipment.capacityMultiplier(store) - 1.08) < 1e-9, 'Lv2 の容量倍率は +8%');
}

// 3. 実際に market の販売能力が増え、機会損失が減る（モデルに効いていることの確認）。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  const business = engine.business('ramen');
  const pref = engine.pref(store.prefID);

  const capacityAt = lv => {
    const probe = { ...store };
    if (lv > 1) probe.level = lv; else delete probe.level;
    return modules.market.effectiveCapacity(probe, business, pref);
  };
  const base = capacityAt(1);
  assert.ok(base > 0, '基準の販売能力が正の値');
  assert.ok(capacityAt(2) > base, 'Lv2 で販売能力が増える');
  assert.ok(capacityAt(5) > capacityAt(2), 'Lv5 はさらに増える');
}

// 4. 上限レベルで止まり、それ以上は失敗する。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  for (let i = 1; i < modules.storeEquipment.MAX_LEVEL; i++) {
    assert.equal(engine.upgradeStoreEquipment(store.id), true, `Lv${i + 1} への強化は成功する`);
  }
  assert.equal(store.level, modules.storeEquipment.MAX_LEVEL, '最大レベルに到達する');
  assert.equal(modules.storeEquipment.isMaxLevel(store), true);
  const cashAtMax = engine.g.companyCash;
  assert.equal(engine.upgradeStoreEquipment(store.id), false, '上限を超える強化は失敗する');
  assert.equal(engine.g.companyCash, cashAtMax, '失敗時に現金は減らない');
  assert.equal(store.level, modules.storeEquipment.MAX_LEVEL, '失敗時にレベルは変わらない');
}

// 5. 現金不足では実行できず、状態を一切変えない。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  const cost = modules.storeEquipment.upgradeCost(engine.business('ramen'), store);
  engine.g.companyCash = cost - 1;
  const assetsBefore = engine.g.finance.fixedAssets.length;
  assert.equal(engine.upgradeStoreEquipment(store.id), false, '現金不足なら失敗する');
  assert.equal(engine.g.companyCash, cost - 1, '現金は変わらない');
  assert.equal(Object.prototype.hasOwnProperty.call(store, 'level'), false, 'レベルは付与されない');
  assert.equal(engine.g.finance.fixedAssets.length, assetsBefore, '固定資産は増えない');
}

// 6. 閉店した店舗は強化できない。
{
  const { engine } = newGame();
  const store = openRamenStore(engine);
  store.status = 'closed';
  const cashBefore = engine.g.companyCash;
  assert.equal(engine.upgradeStoreEquipment(store.id), false, '閉店店舗は強化できない');
  assert.equal(engine.g.companyCash, cashBefore, '現金は変わらない');
}

// 7. 存在しない店舗IDは安全に失敗する。
{
  const { engine } = newGame();
  openRamenStore(engine);
  assert.equal(engine.upgradeStoreEquipment('missing-store-id'), false, '不明なIDは失敗する');
  assert.equal(engine.storeEquipmentPlan('missing-store-id'), null, '不明なIDの計画は null');
}

// 8. 決定論：同じ種・同じ操作なら費用も結果も完全に一致する。
{
  const run = () => {
    const { engine } = newGame(20260814);
    const store = openRamenStore(engine);
    engine.upgradeStoreEquipment(store.id);
    engine.upgradeStoreEquipment(store.id);
    // loadGame は vm の別realmで動くため、配列の比較は値化してから行う。
    return JSON.stringify({ cash: engine.g.companyCash, level: store.level, assets: engine.g.finance.fixedAssets.map(a => a.acquisitionCost) });
  };
  assert.equal(run(), run(), '同じ入力なら同じ結果になる');
}

// 9. 費用は乱数に依存せず、業種と目標レベルだけで決まる。
{
  const a = newGame(1); const sa = openRamenStore(a.engine);
  const b = newGame(999); const sb = openRamenStore(b.engine);
  assert.equal(
    a.modules.storeEquipment.upgradeCost(a.engine.business('ramen'), sa),
    b.modules.storeEquipment.upgradeCost(b.engine.business('ramen'), sb),
    '乱数種が違っても同じ費用になる'
  );
  a.engine.upgradeStoreEquipment(sa.id);
  const first = a.modules.storeEquipment.upgradeCost(a.engine.business('ramen'), sa);
  assert.ok(first > b.modules.storeEquipment.upgradeCost(b.engine.business('ramen'), sb), 'レベルが上がるほど費用も上がる');
}

// 10. plan() が UI に必要な情報を矛盾なく返す。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  const plan = engine.storeEquipmentPlan(store.id);
  assert.equal(plan.currentLevel, 1);
  assert.equal(plan.nextLevel, 2);
  assert.equal(plan.maxLevel, modules.storeEquipment.MAX_LEVEL);
  assert.equal(plan.atMaxLevel, false);
  assert.equal(plan.affordable, true);
  assert.ok(plan.cost > 0);
  assert.ok(plan.nextCapacityMultiplier > plan.capacityMultiplier, '次レベルの倍率は現在より大きい');

  engine.g.companyCash = 0;
  assert.equal(engine.storeEquipmentPlan(store.id).affordable, false, '現金不足は affordable=false で表現される');
}

// 11. セーブ往復：saveVersion を変えずに level が永続化され、level を持たない旧セーブも壊れない。
{
  const { modules, ctx, engine } = newGame();
  const EngineClass = modules.engine.TycoonEngine;
  const store = openRamenStore(engine);
  engine.upgradeStoreEquipment(store.id);
  engine.save();

  const saved = JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.equal(saved.saveVersion, 9, 'saveVersion は 9 のまま');
  assert.equal(saved.stores[0].level, 2, 'level がセーブへ書き出される');

  const reloaded = EngineClass.load();
  assert.equal(reloaded.g.stores[0].level, 2, 'ロード後も level が復元される');

  // level を持たない旧セーブを再現する
  delete saved.stores[0].level;
  ctx.localStorage.setItem('capitalism_tycoon_web_v1', JSON.stringify(saved));
  const legacy = EngineClass.load();
  const legacyStore = legacy.g.stores[0];
  assert.equal(legacyStore.level, undefined, '旧セーブは level を持たない');
  assert.equal(modules.storeEquipment.level(legacyStore), 1, '旧セーブは Lv1 として解決される');
  assert.equal(modules.storeEquipment.capacityMultiplier(legacyStore), 1, '旧セーブの容量倍率は 1.0 のまま（既存の計算結果が変わらない）');
  assert.equal(legacy.storeEquipmentPlan(legacyStore.id).nextLevel, 2, '旧セーブからも強化を開始できる');
}

// 12. 改装：状態が回復し、費用が利益と現金の両方に反映される（資産計上ではない）。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.condition = 40;
  const cashBefore = engine.g.companyCash;
  const assetsBefore = engine.g.finance.fixedAssets.length;
  const cost = modules.storeEquipment.renovationCost(store);
  assert.equal(cost, Math.round(60 * modules.storeEquipment.RENOVATION_COST_PER_POINT), '費用は不足ポイント×単価');

  const txBefore = (engine.g.finance.transactions || []).length;

  assert.equal(engine.renovateStore(store.id), true, '改装は成功する');
  assert.equal(store.condition, modules.storeEquipment.FULL_CONDITION, '状態が100%へ回復する');
  assert.equal(engine.g.companyCash, cashBefore - cost, '現金が費用分だけ減る');
  assert.equal(engine.g.finance.fixedAssets.length, assetsBefore, '原状回復なので固定資産は増えない');

  // 修繕費は費用処理なので、現金だけでなく利益にも同額が効いていなければならない。
  const posted = (engine.g.finance.transactions || []).slice(txBefore)
    .filter(tx => tx.sourceType === 'storeRenovation');
  assert.equal(posted.length, 1, '改装の会計イベントが1件記録される');
  assert.equal(posted[0].cashEffect, -cost, '現金への影響が費用と一致する');
  assert.equal(posted[0].profitEffect, -cost, '利益への影響が費用と一致する（費用処理であること）');
  assert.equal(posted[0].storeID, store.id, 'イベントが店舗に紐づく');
}

// 13. 改装で市場の販売能力が実際に戻る。
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  const business = engine.business('ramen');
  const pref = engine.pref(store.prefID);
  const capacity = () => modules.market.effectiveCapacity(store, business, pref);

  const healthy = capacity();
  store.condition = 40;
  const worn = capacity();
  assert.ok(worn < healthy, '劣化すると販売能力が落ちる');
  engine.renovateStore(store.id);
  assert.equal(capacity(), healthy, '改装で販売能力が元に戻る');
}

// 14. 改装が不要・不可能なケースでは状態も現金も動かさない。
{
  const { engine } = newGame();
  const store = openRamenStore(engine);
  assert.equal(store.condition, 100, '新規店舗は状態100%');
  const cashBefore = engine.g.companyCash;
  assert.equal(engine.renovateStore(store.id), false, '状態100%では改装できない');
  assert.equal(engine.g.companyCash, cashBefore, '現金は変わらない');

  store.condition = 60;
  store.status = 'closed';
  assert.equal(engine.renovateStore(store.id), false, '閉店店舗は改装できない');
  assert.equal(store.condition, 60, '状態は変わらない');

  store.status = 'open';
  engine.g.companyCash = 1;
  assert.equal(engine.renovateStore(store.id), false, '現金不足では改装できない');
  assert.equal(store.condition, 60, '失敗時に状態は変わらない');
  assert.equal(engine.g.companyCash, 1, '失敗時に現金は変わらない');

  assert.equal(engine.renovateStore('missing-store-id'), false, '不明なIDは安全に失敗する');
  assert.equal(engine.storeRenovationPlan('missing-store-id'), null, '不明なIDの計画は null');
}

// 15. 改装費用は乱数に依存せず、状態だけで決まる。
{
  const a = newGame(3); const sa = openRamenStore(a.engine); sa.condition = 55;
  const b = newGame(8888); const sb = openRamenStore(b.engine); sb.condition = 55;
  assert.equal(
    a.modules.storeEquipment.renovationCost(sa),
    b.modules.storeEquipment.renovationCost(sb),
    '乱数種が違っても同じ費用になる'
  );
  sb.condition = 45;
  assert.ok(
    b.modules.storeEquipment.renovationCost(sb) > a.modules.storeEquipment.renovationCost(sa),
    '状態が悪いほど費用が高い'
  );
}

// 16. renovationPlan が UI に必要な情報を返す（節約できる維持費を含む）。
{
  const { engine } = newGame();
  const store = openRamenStore(engine);
  store.condition = 70;
  const plan = engine.storeRenovationPlan(store.id);
  assert.equal(plan.condition, 70);
  assert.equal(plan.needed, true);
  assert.equal(plan.affordable, true);
  assert.equal(plan.weeklyUpkeepSaved, 30 * 650, 'engine の週次維持費(650/pt)と一致する');
  assert.ok(plan.cost > 0);

  store.condition = 100;
  const settled = engine.storeRenovationPlan(store.id);
  assert.equal(settled.needed, false, '状態100%なら不要と表現される');
  assert.equal(settled.cost, 0);
}

console.log('store equipment tests passed');
