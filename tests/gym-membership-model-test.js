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
//
// churnRateForが返していた単一の退会率を理由別成分へ分解する。既存のchurnRateForは
// 後方互換（合計値を返すラッパー）として維持し、新しくchurnBreakdownForで内訳を取れる。
// プレイヤーが既存の品質投資・改装（店舗状態の回復）・広告/効率化のどれを優先すべきかを
// 退会理由から読み取れるようにする。新しい操作ボタンは追加していない。

// 13. churnBreakdownForは4つの成分（base/quality/condition/competition）の合計が
//     churnRateForの返り値と一致する（クランプされていない範囲で）。
{
  const { modules } = loadGame({});
  const mod = modules.gymMembershipModel;
  const business = { quality: 30 }, store = { condition: 60 };
  const breakdown = mod.churnBreakdownFor(business, store, .3);
  const rate = mod.churnRateFor(business, store, .3);
  assert.equal(rate, breakdown.total, 'churnRateForはchurnBreakdownForのtotalと一致する（後方互換ラッパー）');
  assert.ok(Math.abs(breakdown.base + breakdown.quality + breakdown.condition + breakdown.competition - breakdown.total) < 1e-9, '4つの成分の合計はtotalと一致する（クランプされない範囲）');
}

// 14. 各成分は対応する要因が悪化すると増える。品質・状態が完璧で競合圧力0なら、
//     total（=churnRateFor）は下限.018ちょうどになる。
{
  const { modules } = loadGame({});
  const mod = modules.gymMembershipModel;
  const perfect = mod.churnBreakdownFor({ quality: 100 }, { condition: 100 }, 0);
  assert.equal(perfect.quality, 0, '品質が十分高ければ品質起因の退会は0');
  assert.equal(perfect.condition, 0, '状態が十分良ければ設備起因の退会は0');
  assert.equal(perfect.competition, 0, '競合圧力0なら競合起因の退会は0');
  assert.equal(perfect.total, .018, '全要因が良好なら下限（自然減のみ）になる');

  const poorQuality = mod.churnBreakdownFor({ quality: 0 }, { condition: 100 }, 0);
  assert.ok(poorQuality.quality > 0, '品質が低いと品質起因の退会が発生する');
  const poorCondition = mod.churnBreakdownFor({ quality: 100 }, { condition: 20 }, 0);
  assert.ok(poorCondition.condition > 0, '状態が悪いと設備起因の退会が発生する');
  const highCompetition = mod.churnBreakdownFor({ quality: 100 }, { condition: 100 }, 1);
  assert.ok(highCompetition.competition > 0, '競合圧力が高いと競合起因の退会が発生する');
}

// 15. processStoreは退会数を理由別へ按分し、按分の合計が総退会数に一致する。
//     累計statsにも理由別の内訳が積み上がる。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  const business = { price: 7800, quality: 20, efficiency: 10 };
  const store = { id: 's1', businessID: 'gym', level: 1, condition: 50 };
  const g = { week: 1, stores: [store] };
  // まず十分な会員を作ってから、退会が実際に発生する状況で検証する。
  for (let i = 0; i < 5; i++) { g.week = i + 1; mod.processStore(g, store, business, 5000, 1); }
  const row = store.gymMembership.lastWeek;
  const reasonSum = row.churnedByReason.quality + row.churnedByReason.condition + row.churnedByReason.competition + row.churnedByReason.base;
  assert.equal(reasonSum, row.churned, '理由別内訳の合計は総退会数に一致する（丸め誤差はbaseで吸収）');
  assert.ok(store.gymMembership.totals.churnedByReason.quality + store.gymMembership.totals.churnedByReason.condition + store.gymMembership.totals.churnedByReason.competition + store.gymMembership.totals.churnedByReason.base >= 0, '累計にも理由別内訳が積み上がる');
  assert.equal(store.gymMembership.totals.churnedMembers, store.gymMembership.totals.churnedByReason.quality + store.gymMembership.totals.churnedByReason.condition + store.gymMembership.totals.churnedByReason.competition + store.gymMembership.totals.churnedByReason.base, '累計の理由別内訳の合計は累計退会数に一致する');
}

// 15b. baseは「churned - 他3成分」の残差として計算しなければならない。各成分を独立に
//      四捨五入すると合計が総退会数からずれることがある（丸め誤差の吸収先を間違えると
//      理由別内訳の合計が実際の退会数と合わなくなる）。quality=0/condition=0/competition=1・
//      members=179という具体的な数値は、残差方式と独立丸め方式が実際に食い違う
//      （15/17 vs 3/17）ことを事前に計算で確認して選んだもの。members=5では偶然一致して
//      しまい検知できなかったため、この専用ケースを追加した。
{
  const mod = loadGame({}).modules.gymMembershipModel;
  const business = { price: 7800, quality: 0, efficiency: 0 };
  const store = { id: 's1', businessID: 'gym', level: 1, condition: 0, gymMembership: { members: 179 } };
  const g = { week: 1, stores: [store] };
  mod.processStore(g, store, business, 0, 1, 1); // localCompetition=1, demand=0（新規入会させず退会だけ発生させる）
  const row = store.gymMembership.lastWeek;
  assert.equal(row.churned, 17, '前提: この構成では退会数が17になる（事前計算どおり）');
  const reasonSum = row.churnedByReason.quality + row.churnedByReason.condition + row.churnedByReason.competition + row.churnedByReason.base;
  assert.equal(reasonSum, row.churned, 'baseは残差として計算され、理由別内訳の合計は総退会数に厳密に一致する');
  assert.equal(row.churnedByReason.base, 2, 'baseは残差方式で2になる（独立丸めだと3になり、この違いが検知の要点）');
}

// 16. 競合圧力（engine.js側で計算されるlocalCompetition）がprocessStoreへ実際に
//     渡されている（配線の固定）。
{
  const engineSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
  assert.match(engineSource, /gymMembershipModel\.processStore\(this\.g,store,b,demand,this\.g\.inflation,localCompetition\)/, 'engine.jsはlocalCompetitionをgymMembershipModel.processStoreへ渡す');
}

// 17. UI配線: 退会理由の内訳が事業画面に表示される。
{
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(appSource, /退会理由の内訳/, '退会理由の内訳セクションが表示される');
  assert.match(appSource, /品質不足/, '品質不足の内訳が表示される');
  assert.match(appSource, /設備の老朽化/, '設備の老朽化の内訳が表示される');
  assert.match(appSource, /競合圧力/, '競合圧力の内訳が表示される');
}

console.log('gym membership model tests passed');
