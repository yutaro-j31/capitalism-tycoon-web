'use strict';

// 創業ガイドの初回出店CTA（外部監査P3）。
//
// first_store ステップは「最初の店舗を確認 / 客数、単価、原価、キャパシティを確認します」という
// 固定文言だった。実測すると、これは2つの状況で誤った指示になっていた:
//
//   1. 店舗0件のプレイヤー（dashboardステップを終えた直後）にこの文言が出る。
//      確認すべき店舗がまだ存在しない。初回出店のCTAとして機能していなかった。
//   2. 出店した直後の3〜8週（status='preparing'）も同じ文言が出続ける。
//      プレイヤーは正しく行動したのに承認されず、まだ発生していない客数を確認しろと言われる。
//
// 完了条件（openStores>=1）は変更していない。進行到達性に影響を出さず、文言だけを状態に合わせる。
// STEPS の id 列と順序も従来どおり（tests/founding-tutorial-test.js が固定している）。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 190826041) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, engine };
}

const stepOf = (modules, engine) => modules.foundingTutorial.build(engine.g).steps.find(s => s.id === 'first_store');
// dashboardステップを終わらせて first_store を current にする（プレイヤーが画面を移動した状態）。
const leaveHome = engine => { engine.g.selectedTab = 'map'; };

// 1. 回帰の本体: 店舗0件のとき、CTAは「確認」ではなく「出す」になる。
{
  const { modules, engine } = newGame();
  leaveHome(engine);
  assert.equal(engine.g.stores.length, 0, '前提: 店舗が1件も無い');

  const step = stepOf(modules, engine);
  assert.equal(step.current, true, '前提: first_storeが現在のステップ');
  assert.equal(step.title, '最初の店舗を出す', '店舗0件なら出店を促す');
  assert.doesNotMatch(step.title, /確認/, '存在しない店舗の確認を促さない');
  assert.doesNotMatch(step.description, /客数/, '発生していない客数の確認を促さない');
  assert.match(step.description, /テナント/, 'テナント選択という具体的な次の操作を示す');
  assert.equal(step.buttonLabel, '出店できる場所を見る');
  assert.equal(step.targetTab, 'map', '遷移先は地図のまま');
}

// 2. 出店直後（準備中）は、プレイヤーの行動を承認して残り週数を出す。
{
  const { modules, engine } = newGame();
  leaveHome(engine);
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 }), true);

  const store = engine.g.stores.at(-1);
  assert.equal(store.status, 'preparing', '前提: 出店直後はpreparing');
  const weeks = store.openingWeek - engine.g.week;

  const step = stepOf(modules, engine);
  assert.equal(step.title, `開業準備中・あと${weeks}週`, '残り週数を出す');
  assert.match(step.description, /出店は完了しました/, '出店したことを承認する');
  assert.doesNotMatch(step.description, /客数/, '準備中に客数の確認を促さない');
  assert.equal(step.buttonLabel, '準備中の店舗を見る');
}

// 3. 残り週数が実際にカウントダウンし、開店で完了へ切り替わる。
{
  const { modules, engine } = newGame();
  leaveHome(engine);
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  const store = engine.g.stores.at(-1);

  while (engine.g.week < store.openingWeek) {
    const expected = store.openingWeek - engine.g.week;
    assert.equal(stepOf(modules, engine).title, `開業準備中・あと${expected}週`, `第${engine.g.week}週の残り表示`);
    assert.equal(stepOf(modules, engine).completed, false, '開店前は未完了');
    assert.notEqual(engine.advanceWeek(false), false);
  }

  assert.equal(store.status, 'open', '開店予定週に営業中になる');
  const step = stepOf(modules, engine);
  assert.equal(step.completed, true, '開店したら完了する');
  assert.equal(step.title, '最初の店舗を確認', '営業中は本来の「確認」文言に戻る');
  assert.match(step.description, /客数/, '営業中は客数の確認を促してよい');
}

// 4. 進行到達性を変えていないこと。完了条件は従来どおり openStores>=1 のまま。
//    準備中の店舗を持っているだけでは完了しない。
{
  const { modules, engine } = newGame();
  leaveHome(engine);
  assert.equal(stepOf(modules, engine).completed, false, '店舗0件では未完了');

  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  assert.equal(stepOf(modules, engine).completed, false, '準備中だけでは完了しない（進行条件は不変）');
}

// 5. STEPSの定義そのものは変えていない。文言はbuild時に状態から解決する。
{
  const { modules } = newGame();
  const base = modules.foundingTutorial.STEPS.find(s => s.id === 'first_store');
  assert.equal(base.title, '最初の店舗を確認', 'STEPSの基本定義は従来のまま');
  assert.equal(base.order, 2, '順序も従来のまま');
  assert.equal(
    modules.foundingTutorial.STEPS.map(s => s.id).join(','),
    'dashboard,first_store,unit_economics,first_week,weekly_recap,first_improvement,cash_runway,growth_step,organization,graduation',
    'ステップの構成は不変'
  );
}

// 6. 他のステップの文言には触れていない。
{
  const { modules, engine } = newGame();
  leaveHome(engine);
  const model = modules.foundingTutorial.build(engine.g);
  for (const base of modules.foundingTutorial.STEPS) {
    if (base.id === 'first_store') continue;
    const rendered = model.steps.find(s => s.id === base.id);
    assert.equal(rendered.title, base.title, `${base.id}: タイトルが変わっていない`);
    assert.equal(rendered.description, base.description, `${base.id}: 説明が変わっていない`);
    assert.equal(rendered.buttonLabel, base.buttonLabel, `${base.id}: ボタン文言が変わっていない`);
  }
}

// 7. 読み取り専用であること。build()がゲーム状態を変えず、RNGも消費しない。
{
  const { modules, engine } = newGame();
  leaveHome(engine);
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });

  const before = JSON.stringify(engine.g);
  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try { modules.foundingTutorial.build(engine.g); modules.foundingTutorial.build(engine.g); }
  finally { Math.random = originalRandom; }

  assert.equal(randomCalls, 0, 'buildはRNGを消費しない');
  assert.equal(JSON.stringify(engine.g), before, 'ゲーム状態を変更しない');
}

// 8. 複数の準備中店舗があるときは、最も早く開店するものを基準にする。
{
  const { modules, engine } = newGame();
  leaveHome(engine);
  const tenants = engine.g.tenants.filter(t => !t.occupiedBy).slice(0, 2);
  // clinic は storeCost が大きく開店まで長い。ramen は3週。
  engine.g.companyCash = 500_000_000;
  engine.openStore({ tenantID: tenants[0].id, businessID: 'clinic', name: '遅い店', operatingHours: 3 });
  engine.openStore({ tenantID: tenants[1].id, businessID: 'ramen', name: '早い店', operatingHours: 3 });

  const soonest = Math.min(...engine.g.stores.map(s => s.openingWeek));
  assert.ok(engine.g.stores.length === 2, '前提: 準備中が2件');
  assert.equal(stepOf(modules, engine).title, `開業準備中・あと${soonest - engine.g.week}週`, '最も早く開店する店舗を基準にする');
}

console.log('first store CTA tests passed');
