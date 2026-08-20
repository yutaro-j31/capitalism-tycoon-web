'use strict';

// 創業ガイドのTutorial skip問題（外部監査P2②、iPhone実プレイ監査引き継ぎ資料 §7①より）。
//
// unit_economics と weekly_recap は「店舗が開いてから経過した週数」ではなく「ゲーム開始からの
// 絶対週数・累計レポート数」で完了判定していた。出店には3〜8週の準備期間があり、first_store
// 自身のCTA（PR #478の「開業準備中・あとN週」）に従って週送りするだけで、店舗が一度も
// 稼働していないのに次の条件が先に満たされてしまう。実測（第1〜4週、ramen出店・修正前）:
//
//   週2 準備中 reports=1  first_week=✓（店舗は影も形も稼働していない）
//   週3 準備中 reports=2  weekly_recap=✓（前週比較する中身が無いのに完了扱い）
//   週4 開店   reports=3  first_store/unit_economics/first_week/weekly_recapが同時に✓
//
// 開店した瞬間に4ステップ分がまとめて完了扱いになり、プレイヤーは「価格・商品・供給を確認」
// （strategy画面）や「週間インパクトを読む」（weekly-impactカード）へ一度も案内されないまま
// 「最初の改善を行う」へ飛ばされる。
//
// 修正: unit_economics / weekly_recap を「店舗が実際に開店してから経過した実トレード週数」
// （weeksSinceFirstOpen）基準にした。first_week はあえて変更していない。その条件
// （week>1||reports.length>0）は「週送りボタンを押したか」を見ているだけで、準備期間中に
// 押しても押した事実に変わりはなく虚偽の完了ではない。またSTEPSの並び順でfirst_week
// （index3）はunit_economics（index2）より後ろにあるため、店舗が開くまではfirst_storeが、
// 開いた直後はunit_economicsがcurrentを占有し、first_weekが単独でcurrentとして
// 表示されることは元の設計でも無い（並び順自体は変更していない）。

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

// 1. 回帰の本体: 準備期間中にweekly_recapが完了しない。店舗が稼働していないのに
//    「週間インパクトを読む」が完了扱いになる、という監査の指摘そのものを再現・検証する。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 }), true);
  const store = engine.g.stores.at(-1);
  assert.ok(store.openingWeek - engine.g.week >= 2, '前提: 準備期間が2週以上ある（ramenは3週）');

  while (store.status === 'preparing') {
    assert.equal(isDone(modules, engine.g, 'weekly_recap'), false, `第${engine.g.week}週（準備中）: weekly_recapは完了しない`);
    assert.equal(isDone(modules, engine.g, 'unit_economics'), false, `第${engine.g.week}週（準備中）: unit_economicsは完了しない`);
    assert.equal(currentID(modules, engine.g), 'first_store', `第${engine.g.week}週（準備中）: 依然としてfirst_storeが現在のステップ`);
    assert.notEqual(engine.advanceWeek(false), false);
  }
  assert.equal(store.status, 'open', '前提: ループを抜けたら開店している');
}

// 2. 開店直後は unit_economics が現在のステップになり、即座には完了しない。
//    supply設定は出店の瞬間に自動生成されるため、以前は「supply設定が存在する」だけで
//    即完了していた。1トレード週の経過を要求することで、プレイヤーが供給・価格画面を
//    見る機会が生まれる。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);

  assert.equal(store.status, 'open', '前提: 開店した');
  assert.ok(engine.g.supplySettingsByStoreID?.[store.id], '前提: 供給設定は出店時に自動生成される');
  assert.equal(isDone(modules, engine.g, 'unit_economics'), false, '開店した週の時点ではunit_economicsはまだ完了しない');
  assert.equal(currentID(modules, engine.g), 'unit_economics', '開店直後はunit_economicsが現在のステップになる（1ステップだけ先に進む）');
}

// 3. 開店から1週経過するとunit_economicsが完了し、weekly_recapへ現在のステップが進む。
//    さらに1週経過するとweekly_recapも完了する。unit_economicsとweekly_recapが
//    別々の週で完了する（同時に完了しない）ことを固定する。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);

  engine.advanceWeek(false); // 開店から1トレード週経過
  assert.equal(isDone(modules, engine.g, 'unit_economics'), true, '1トレード週でunit_economicsが完了する');
  assert.equal(isDone(modules, engine.g, 'weekly_recap'), false, 'この時点ではweekly_recapはまだ完了しない');
  assert.equal(currentID(modules, engine.g), 'weekly_recap', 'unit_economics完了後はweekly_recapが現在のステップになる');

  engine.advanceWeek(false); // 開店から2トレード週経過
  assert.equal(isDone(modules, engine.g, 'weekly_recap'), true, '2トレード週でweekly_recapが完了する');
}

// 4. first_storeの完了条件は変更していない（openStores>=1のまま）。
{
  const { modules, engine } = newGame();
  assert.equal(isDone(modules, engine.g, 'first_store'), false, '前提: 店舗0件では未完了');
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  assert.equal(isDone(modules, engine.g, 'first_store'), false, '準備中はまだ未完了');
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);
  assert.equal(isDone(modules, engine.g, 'first_store'), true, '開店したら完了する（従来どおり）');
}

// 5. first_weekの完了条件は意図的に変更していない。準備期間中に週送りボタンを押した
//    事実は本物であり、虚偽の完了ではないため、そのまま残す。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  assert.equal(isDone(modules, engine.g, 'first_week'), false, '前提: 出店直後、週送り前は未完了');
  engine.advanceWeek(false);
  assert.equal(isDone(modules, engine.g, 'first_week'), true, '週送りボタンを1回押せば（準備中でも）完了する');
  assert.equal(engine.g.stores.at(-1).status, 'preparing', '前提: この時点でまだ店舗は準備中');
}

// 6. 業種が非詳細シミュレーション対象（cafe等）でも、unit_economicsが必ず詰まないことは
//    このPRの対象外。既存の挙動（永久に未完了）が変わっていないことだけ確認する
//    （別の既知の問題として切り分けており、このPRでは触らない）。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'cafe', name: 'カフェ', operatingHours: 3 });
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);
  for (let i = 0; i < 8; i++) engine.advanceWeek(false);
  assert.equal(isDone(modules, engine.g, 'unit_economics'), false, 'cafeなど非詳細業種ではunit_economicsが完了しない（既知・対象外、挙動は不変）');
}

// 7. 手組みstateでopeningWeekが欠落していても詰まない（旧セーブ・不整合データへの防御）。
//    実際のopenStore()は必ずopeningWeekを設定するが、想定外のデータに対しても
//    「たった今開いた」とみなして安全に進行させる。
{
  const { modules, engine } = newGame();
  const g = engine.g;
  g.stores.push({ id:'legacy-1', businessID:'ramen', prefID:'tokyo', name:'旧店舗', status:'open', quality:0, brand:0, condition:100 });
  g.supplySettingsByStoreID = { 'legacy-1': { autoPolicy:'balanced' } };
  assert.doesNotThrow(() => modules.foundingTutorial.build(g), 'openingWeek欠落でも例外を投げない');
  assert.equal(isDone(modules, g, 'unit_economics'), false, '欠落時は「たった今開いた」扱いなので即完了はしない');
  g.week += 1;
  assert.equal(isDone(modules, g, 'unit_economics'), true, '1週進めれば完了する（永久には詰まない）');
}

// 8. 読み取り専用であること。RNGを消費せず、状態も変えない。
{
  const { modules, engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  const before = JSON.stringify(engine.g);

  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try { modules.foundingTutorial.build(engine.g); modules.foundingTutorial.build(engine.g); }
  finally { Math.random = originalRandom; }

  assert.equal(randomCalls, 0, 'buildはRNGを消費しない');
  assert.equal(JSON.stringify(engine.g), before, 'buildはゲーム状態を変更しない');
}

// 9. STEPSの定義・順序は不変。
{
  const { modules } = newGame();
  assert.equal(
    modules.foundingTutorial.STEPS.map(s => s.id).join(','),
    'dashboard,first_store,unit_economics,first_week,weekly_recap,first_improvement,cash_runway,growth_step,organization,graduation',
    'ステップの構成は不変'
  );
}

console.log('founding tutorial skip tests passed');
