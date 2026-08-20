'use strict';

// 創業ガイドのdashboard CTA（外部監査P2、iPhone実プレイ監査①）。
//
// dashboardステップのCTA「CEO Dashboardを見る」は targetTab:'home' で、ホーム画面自体が
// 既定タブのため、タップしても g.selectedTab が変化しない。完了条件が
// 「selectedTabがhomeでなくなること」等の他行動の副作用に頼っていたため、CTAをタップした
// だけでは永遠に完了せず、初心者が同じCTAを見続ける状態になっていた（実測で再現）:
//
//   初期状態                     step=dashboard completed=false
//   CTAタップ後（従来の挙動）        step=dashboard completed=false ← 変化しない
//
// CTAが実際にタップされたことを g.foundingTutorialProgress.dashboardAcknowledged に
// 明示的に記録し、それ自体を完了条件へ加える。他の完了条件（selectedTab/店舗/週/実績）は
// 変更していない。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 190826041) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, engine };
}

const dashboardStep = (modules, g) => modules.foundingTutorial.build(g).steps.find(s => s.id === 'dashboard');

// 1. 回帰の本体: CTAをタップした従来の挙動（selectedTab='home'のまま）を再現しても、
//    acknowledgeDashboardを呼ばない限り完了しない。呼べば完了する。
{
  const { modules, engine } = newGame();
  engine.g.selectedTab = 'home'; // CTAの targetTab は 'home'。タップしても変化しない値を再現する
  assert.equal(dashboardStep(modules, engine.g).completed, false, '前提: 従来の挙動では完了しない');

  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  assert.equal(dashboardStep(modules, engine.g).completed, true, 'acknowledgeDashboard後は完了する');
}

// 2. acknowledge後、現在のステップはfirst_storeへ進む。店舗0件なので#478の
//    「最初の店舗を出す」文言へ自然につながる。
{
  const { modules, engine } = newGame();
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  const model = modules.foundingTutorial.build(engine.g);

  assert.equal(model.current.id, 'first_store', 'dashboard完了後はfirst_storeが現在のステップ');
  assert.equal(model.current.title, '最初の店舗を出す', '#478の店舗0件文言へ自然に繋がる');
}

// 3. 他の完了条件（店舗を開く／週を進める／実績を積む）は従来どおり機能する。
//    acknowledgeを呼ばなくても、これらの行動だけで完了できる。
{
  const { modules, engine } = newGame();
  assert.equal(dashboardStep(modules, engine.g).completed, false, '前提: 未完了');

  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  assert.equal(dashboardStep(modules, engine.g).completed, true, '店舗を開けば従来どおり完了する（acknowledge不要）');
}

// 4. 保存・再読込を跨いでも逆戻りしない。JSON往復（save/loadの実体）で確認する。
{
  const { modules, engine } = newGame();
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  assert.equal(dashboardStep(modules, engine.g).completed, true, '前提: acknowledge直後は完了');

  const reloaded = JSON.parse(JSON.stringify(engine.g));
  assert.equal(dashboardStep(modules, reloaded).completed, true, 'save/reloadを跨いでも完了状態を維持する');
  assert.equal(modules.foundingTutorial.build(reloaded).current.id, 'first_store', 'reload後もdashboardへ逆戻りしない');
}

// 5. 旧セーブ互換: foundingTutorialProgressフィールドが無くても安全に読み込める。
{
  const { modules, engine } = newGame();
  delete engine.g.foundingTutorialProgress;
  assert.doesNotThrow(() => modules.foundingTutorial.build(engine.g), 'フィールド欠落でも例外を投げない');
  assert.equal(dashboardStep(modules, engine.g).completed, false, 'フィールドが無ければ未確認として扱う（false）');
}

// 6. acknowledgeDashboardは不正な入力でも例外を投げず、既存のforeignTutorialProgress
//    フィールドを破壊しない（他のプロパティが既にあれば保持する）。
{
  const { modules, engine } = newGame();
  assert.equal(modules.foundingTutorial.acknowledgeDashboard(null), null, 'nullを渡しても例外を投げない');
  assert.equal(modules.foundingTutorial.acknowledgeDashboard(undefined), undefined, 'undefinedを渡しても例外を投げない');

  engine.g.foundingTutorialProgress = { someOtherFlag: true };
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  assert.equal(engine.g.foundingTutorialProgress.someOtherFlag, true, '既存の他フィールドを破壊しない');
  assert.equal(engine.g.foundingTutorialProgress.dashboardAcknowledged, true, '対象フィールドは設定される');
}

// 7. 冪等性: 何度呼んでも同じ状態になる。
{
  const { modules, engine } = newGame();
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  assert.equal(engine.g.foundingTutorialProgress.dashboardAcknowledged, true, '複数回呼んでも状態は変わらない');
}

// 8. 読み取り専用性: buildはRNGを消費せず、acknowledge以外の呼び出しでは状態を変えない。
{
  const { modules, engine } = newGame();
  modules.foundingTutorial.acknowledgeDashboard(engine.g);
  const before = JSON.stringify(engine.g);

  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try { modules.foundingTutorial.build(engine.g); modules.foundingTutorial.build(engine.g); }
  finally { Math.random = originalRandom; }

  assert.equal(randomCalls, 0, 'buildはRNGを消費しない');
  assert.equal(JSON.stringify(engine.g), before, 'buildはゲーム状態を変更しない');
}

// 9. UI配線: dashboardステップのCTAだけがdata-step="dashboard"を持ち、
//    クリックハンドラがacknowledgeDashboard→engine.save()の順で呼ぶ。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

  assert.match(source, /data-step="\$\{esc\(current\.id\)\}"/, 'CTAボタンが現在ステップのidをdata-stepとして持つ');
  assert.match(
    source,
    /case 'founding-tutorial-jump':if\(el\.dataset\.step==='dashboard'\)\{foundingTutorialModule\.acknowledgeDashboard\(engine\.g\);engine\.save\(\);\}/,
    'dashboardステップのタップ時だけacknowledgeDashboardとsaveを呼ぶ'
  );
}

// 10. STEPSの定義・完了条件・順序は他ステップについて変更していない。
{
  const { modules } = newGame();
  assert.equal(
    modules.foundingTutorial.STEPS.map(s => s.id).join(','),
    'dashboard,first_store,unit_economics,first_week,weekly_recap,first_improvement,cash_runway,growth_step,organization,graduation',
    'ステップの構成は不変'
  );
  const dashboardBase = modules.foundingTutorial.STEPS.find(s => s.id === 'dashboard');
  assert.equal(dashboardBase.title, '会社の現在地を確認', 'dashboardステップの基本定義は不変');
  assert.equal(dashboardBase.buttonLabel, 'CEO Dashboardを見る', 'CTA文言は不変');
}

console.log('founding dashboard CTA tests passed');
