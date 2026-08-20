'use strict';

// 30→5業種一本化のA2: ジム（gym）を「顧客数×単価」の簡易businessから、
// 会員制サブスクリプションモデル（入会・退会・定員）へ最小限深化する。
//
// ラーメン・コンビニ・不動産仲介と違い、ジムは「毎週買われる」のではなく
// 「入会したら退会するまで会費を払い続ける」という粘着質の収益構造を持つ、
// 5本柱の中で最も異質なビジネスモデルにする。実装方針はコンビニ（#490）と同じく、
// 需要の算出自体はengine.js側の既存式（客足・景気・季節・品質/ブランド/DX・営業時間・
// 競合圧力、既存のrand()呼び出しも含めて完全に同一）に委ね、本モジュールは
// その値を新規入会シグナルとして使うだけの決定論的な導出にとどめる。新たな乱数消費は無い。
//
// 新しいプレイヤー操作ボタンは追加していない。既存の「品質投資」「効率化」ボタンが退会率を
// 下げ、既存の「設備強化」（store-equipment.jsのcapacityMultiplier）が定員を上げ、既存の
// 「価格変更」が月会費を変える。既存ボタンだけで完結するトレードオフにした。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function scenario(seed = 190826041, difficulty = 'normal') {
  const loaded = loadGame({ random: lcg(seed) });
  const engine = loaded.ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.difficulty = difficulty;
  engine.g.companyCash = 30_000_000; // storeCost 14,000,000 のため初期資金では出店できない
  // companyCashを直接書き換えるので、financeの期首残高も合わせて作り直す
  // （real-estate-agency-pipeline-test.jsのscenario()と同じ手当て）。
  engine.g.finance = loaded.modules.finance.defaultFinanceState(engine.g);
  Object.assign(engine.g.finance, { openingCash: engine.g.companyCash, openingAssets: engine.g.companyCash, openingEquity: engine.g.companyCash, openingRetainedEarnings: engine.g.companyCash });
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'gym', name: 'ジム1号店', operatingHours: 3 }), true);
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);
  return { loaded, engine, store };
}

// 1. モジュールが配線されている。
{
  const { modules } = loadGame({});
  assert.ok(modules.gymMembershipModel, 'gymMembershipModel module is wired');
}

// 2. capacityForは効率化投資と設備強化レベルの両方に応じて増える。
{
  const { modules } = loadGame({});
  const mod = modules.gymMembershipModel;
  const lowEfficiency = mod.capacityFor({ level: 1 }, { efficiency: 0 });
  const highEfficiency = mod.capacityFor({ level: 1 }, { efficiency: 100 });
  assert.ok(highEfficiency > lowEfficiency, '効率化が高いほど定員が増える');
  const lowLevel = mod.capacityFor({ level: 1 }, { efficiency: 50 });
  const highLevel = mod.capacityFor({ level: 8 }, { efficiency: 50 });
  assert.ok(highLevel > lowLevel, '設備強化レベルが高いほど定員が増える');
}

// 3. churnRateForは品質・店舗状態が良いほど下がる（下限・上限でクランプされる）。
{
  const { modules } = loadGame({});
  const mod = modules.gymMembershipModel;
  const poor = mod.churnRateFor({ quality: 0 }, { condition: 40 });
  const good = mod.churnRateFor({ quality: 100 }, { condition: 100 });
  assert.ok(good < poor, '品質・状態が良いほど退会率が下がる');
  assert.ok(good >= .018 && poor <= .11, '退会率は妥当な範囲にクランプされる');
}

// 4. processStoreは新たに乱数を消費せず、同じ入力からは同じ出力が得られる（決定論）。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'gym-membership-model.js'), 'utf8');
  assert.doesNotMatch(source, /Math\.random/, 'gym-membership-model.js はMath.randomを使わない');
  const business = { price: 7800, quality: 10, efficiency: 10 };
  const gA = { week: 5, stores: [{ id: 's1' }] }, gB = { week: 5, stores: [{ id: 's1' }] };
  const rowA = mod.processStore(gA, { id: 's1', businessID: 'gym', level: 1, condition: 100 }, business, 260, 1);
  const rowB = mod.processStore(gB, { id: 's1', businessID: 'gym', level: 1, condition: 100 }, business, 260, 1);
  assert.deepEqual(rowA, rowB, '同じ入力からは同じ結果が決定論的に得られる');
}

// 5. 会員数は定員で頭打ちになり、超過分はlostSignupsとして記録される（あふれない）。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  const business = { price: 7800, quality: 10, efficiency: 0 };
  const store = { id: 's1', businessID: 'gym', level: 1, condition: 100 };
  const g = { week: 1, stores: [store] };
  for (let i = 0; i < 20; i++) { g.week = i + 1; mod.processStore(g, store, business, 5000, 1); } // 大きすぎる需要を与え続ける
  const capacity = mod.capacityFor(store, business);
  assert.equal(store.gymMembership.members, capacity, '会員数は定員を超えない');
  assert.ok(store.gymMembership.lastWeek.lostSignups > 0, '定員超過分はlostSignupsとして記録される');
}

// 6. 廃棄ロスに相当する会員1人あたりの限界費用（VARIABLE_COST_RATIO）は必ずvariable側に
//    加算される。ここを見落とすと会員は実質ノーコストになってしまう
//    （#490のconveni実装で最初に見落としたのと同種のミスを繰り返さないための直接検証）。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  const business = { price: 7800, quality: 10, efficiency: 10 };
  const store = { id: 's1', businessID: 'gym', level: 1, condition: 100 };
  const g = { week: 1, stores: [store] };
  const result = mod.processStore(g, store, business, 500, 1);
  assert.ok(result.sales > 0, '前提: 売上が発生する');
  assert.ok(result.variable > 0, 'variableは0より大きい（会員あたりの限界費用が加算されている）');
  assert.ok(result.variable < result.sales, '限界費用は売上の一部（全額が変動費にはならない）');
}

// 7. 208週の実プレイ（通常難易度・engine.advanceWeekを通した統合テスト）で倒産しない。
{
  const { engine } = scenario();
  let sawSales = false;
  for (let i = 0; i < 208 && !engine.g.gameOver; i++) {
    engine.advanceWeek(false);
    if (engine.g.stores[0].lastSales > 0) sawSales = true;
  }
  assert.equal(engine.g.gameOver, false, '208週で倒産しない');
  assert.ok(sawSales, '売上が発生する週がある');
  assert.ok(engine.g.companyCash > 0, '会社現金がプラスで推移する');
}

// 8. 価格変更（月会費の変更）が週次売上へ反映される（既存のengine.adjustPriceを再利用）。
{
  const { engine, store } = scenario();
  engine.advanceWeek(false);
  const before = store.lastSales;
  assert.equal(engine.adjustPrice('gym', 15000), true, '価格変更に成功する');
  engine.advanceWeek(false);
  assert.ok(store.lastSales > before, '月会費を上げると週次売上が増える');
}

// 9. 旧セーブ互換: store.gymMembershipが無い/壊れていても例外を投げず、安全に復旧する。
//    engine.normalize()はg.storesを新しいオブジェクトへ差し替える（{...s}）ため、
//    以降は都度engine.g.storesから引き直す（キャプチャ済みのstore変数は差し替え後は古いまま）。
{
  const { engine, store } = scenario();
  const storeID = store.id;
  const current = () => engine.g.stores.find(s => s.id === storeID);
  delete current().gymMembership;
  assert.doesNotThrow(() => engine.normalize(), '欠落状態のnormalize()は例外を投げない');
  assert.doesNotThrow(() => engine.advanceWeek(false), '欠落状態からの週送りも例外を投げない');
  assert.ok(Number.isFinite(current().gymMembership.members), '週送りで改めて安全な状態が生成される');

  current().gymMembership = { members: 'not-a-number', totals: null, lastWeek: 'bad' };
  assert.doesNotThrow(() => engine.normalize());
  assert.equal(current().gymMembership.members, 0, '不正なmembersは0にフォールバックする');
  assert.doesNotThrow(() => engine.advanceWeek(false));
}

// 10. save/reload で会員数・累計statsが保持される。
{
  const { engine, store } = scenario();
  engine.advanceWeek(false);
  engine.advanceWeek(false);
  const before = JSON.stringify(store.gymMembership);
  engine.save();
  const reloaded = engine.constructor.load();
  const reloadedStore = reloaded.g.stores.find(s => s.id === store.id);
  assert.equal(JSON.stringify(reloadedStore.gymMembership), before, 'save/reloadで会員制モデルの状態が保持される');
}

// 11. 会計整合性: 通常のstore revenue/expense経路を使うだけなので、既存のfinance.validateが通る。
{
  const { engine, loaded } = scenario();
  for (let i = 0; i < 20; i++) engine.advanceWeek(false);
  const result = loaded.modules.finance.validate(engine.g);
  assert.equal(result.ok, true, result.errors.join('\n'));
}

// 12. UI配線: 事業画面がgymMembershipModelを使い、会員KPIを表示する。
{
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(appSource, /function renderMembershipModel\(stores\)\{/, 'renderMembershipModelが存在する');
  assert.match(appSource, /membership=b\.id==='gym'\?renderMembershipModel\(ss\):''/, 'businessFullCardはgymの時だけrenderMembershipModelを呼ぶ');
  assert.match(appSource, /const modAPI=__modules\.gymMembershipModel;/, 'renderMembershipModelはgymMembershipModelを参照する');
}

// --- 退会理由の内訳（品質不足・設備の老朽化・競合圧力・自然減）---

// 13. PR baseの退会率をgridで固定し、競合圧力がtotalを変えないことを保証する。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  const legacy = (quality, condition) => Math.min(.11, Math.max(.018, .055 - quality * .0003 - (condition - 70) * .0006));
  for (const quality of [0, 30, 60, 100]) for (const condition of [0, 60, 80, 100]) {
    const totals = [];
    const competitions = [];
    for (const localCompetition of [0, .3, 1]) {
      const breakdown = mod.churnBreakdownFor({ quality }, { condition }, localCompetition);
      const expected = legacy(quality, condition);
      assert.ok(Math.abs(breakdown.total - expected) < 1e-12, `legacy total parity q=${quality} c=${condition} comp=${localCompetition}`);
      assert.ok(Math.abs(mod.churnRateFor({ quality }, { condition }, localCompetition) - expected) < 1e-12, 'churnRateForもlegacy式を維持する');
      assert.ok(Math.abs(breakdown.base + breakdown.quality + breakdown.condition + breakdown.competition - breakdown.total) < 1e-12, '理由別rate合計はtotalと一致する');
      for (const key of ['base', 'quality', 'condition', 'competition']) assert.ok(breakdown[key] >= 0, `${key} componentは非負`);
      totals.push(breakdown.total); competitions.push(breakdown.competition);
    }
    assert.deepEqual(totals, [totals[0], totals[0], totals[0]], 'competitionを変えてもtotalは完全不変');
    assert.ok(competitions[0] <= competitions[1] && competitions[1] <= competitions[2], 'competition attributionは競合圧力とともに増える');
  }
}

// 14. largest-remainder配分は広い入力gridで非負整数かつ総退会数を厳密に保存する。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  for (const members of [0, 1, 2, 7, 17, 53, 179, 499, 5000]) for (const quality of [0, 30, 60, 100]) for (const condition of [0, 60, 80, 100]) for (const localCompetition of [0, .3, 1]) {
    const business = { price: 7800, quality, efficiency: 0 };
    const store = { id: 's1', businessID: 'gym', level: 1, condition, gymMembership: { members } };
    mod.processStore({ week: 1, stores: [store] }, store, business, 0, 1, localCompetition);
    const row = store.gymMembership.lastWeek, values = Object.values(row.churnedByReason);
    assert.equal(values.reduce((sum, value) => sum + value, 0), row.churned, '理由別人数合計は総退会数と一致する');
    assert.ok(values.every(value => Number.isInteger(value) && value >= 0), '理由別人数はすべて非負整数');
  }
  const breakdown = mod.churnBreakdownFor({ quality: 30 }, { condition: 60 }, .3);
  assert.deepEqual(mod.allocateChurnedByReason(37, breakdown), mod.allocateChurnedByReason(37, breakdown), '配分は決定論的');
}

// 15. 欠落・null・primitive・部分欠落・非finiteな旧save内訳を安全な非負整数へ正規化する。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  const malformedRows = [undefined, null, 42, 'bad', {}, { quality: 3 }, { quality: NaN, condition: Infinity, competition: -4, base: '7.9' }];
  for (const churnedByReason of malformedRows) {
    const store = { businessID: 'gym', gymMembership: { members: 10, totals: { churnedMembers: 5, churnedByReason } } };
    assert.doesNotThrow(() => mod.ensureStore(store));
    const normalized = store.gymMembership.totals.churnedByReason;
    assert.deepEqual(Object.keys(normalized), ['quality', 'condition', 'competition', 'base']);
    assert.ok(Object.values(normalized).every(value => Number.isInteger(value) && value >= 0), 'malformed値は非負整数へ正規化される');
  }
}

// 16. 競合圧力（engine.js側で計算されるlocalCompetition）がprocessStoreへ渡される。
{
  const engineSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
  assert.match(engineSource, /gymMembershipModel\.processStore\(this\.g,store,b,demand,this\.g\.inflation,localCompetition\)/);
}

// 17. UIは4理由を表示し、広告・効率化が競合圧力や退会率を下げるという誤説明をしない。
{
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  for (const label of ['退会理由の内訳', '品質不足', '設備の老朽化', '競合圧力', '自然減']) assert.match(appSource, new RegExp(label));
  assert.doesNotMatch(appSource, /競合圧力は広告・効率化で対処/);
  assert.doesNotMatch(appSource, /品質投資・効率化は退会率を下げ/);
  assert.match(appSource, /競合圧力は現在の地域・競合環境による影響度です/);
}

console.log('gym membership model tests passed');
