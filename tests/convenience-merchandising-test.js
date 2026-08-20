'use strict';

// 30→5業種一本化のA1: コンビニ（conveni）を「顧客数×単価」の簡易businessから、
// 品揃え構成（惣菜・弁当強化 / 標準構成 / 定番・日用品重視）と廃棄ロスのトレードオフを
// 持つビジネスへ最小限深化する。
//
// 実装方針（不動産仲介パイプライン#488と異なる点）: 不動産仲介は会社ledgerに存在しない
// 全く新しい収益源（仲介手数料）だったため、旧式の「顧客数×単価」を丸ごと置き換えても
// バランスへの影響は小さかった。一方コンビニは既に旧式の需要式で健全な粗利
// （価格540円・原価335円、約39%）を持つ既存30業種の1つであり、旧式を丸ごと置き換えると
// 序盤バランスを崩すリスクがある（#488の初版が不動産仲介で実際に踏んだ問題）。
// そのため本モジュールは需要そのものの算出はengine.js側の既存式（客足・景気・季節・
// 品質/ブランド/DX・営業時間・競合圧力、既存のrand()呼び出しも含めて完全に同一）に委ね、
// 品揃え構成の倍率・廃棄ロス率を掛けるだけの決定論的な導出にとどめる。新たな乱数消費は無い。

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
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'conveni', name: 'コンビニ1号店', operatingHours: 3 }), true);
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);
  return { loaded, engine, store };
}

// 1. モジュールが配線されている。
{
  const { modules } = loadGame({});
  assert.ok(modules.convenienceMerchandising, 'convenienceMerchandising module is wired');
}

// 2. 3つの構成方針が存在し、惣菜強化は標準より需要倍率・廃棄ロス率とも高い。
//    定番重視は逆に需要倍率・廃棄ロス率とも低い（トレードオフの向きを固定する）。
{
  const { modules } = loadGame({});
  const { POLICIES } = modules.convenienceMerchandising;
  assert.equal(Object.keys(POLICIES).length, 3, '構成方針は3種類');
  assert.ok(POLICIES.freshFocus.demandMultiplier > POLICIES.standard.demandMultiplier, '惣菜強化は標準より需要倍率が高い');
  assert.ok(POLICIES.freshFocus.wasteRate > POLICIES.standard.wasteRate, '惣菜強化は標準より廃棄ロス率が高い');
  assert.ok(POLICIES.staples.demandMultiplier < POLICIES.standard.demandMultiplier, '定番重視は標準より需要倍率が低い');
  assert.ok(POLICIES.staples.wasteRate < POLICIES.standard.wasteRate, '定番重視は標準より廃棄ロス率が低い');
}

// 3. processStoreは新たに乱数を消費しない（demandは呼び出し側から渡された既算出値を使うだけ）。
{
  const mod = loadGame({}).modules.convenienceMerchandising;
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'convenience-merchandising.js'), 'utf8');
  assert.doesNotMatch(source, /Math\.random/, 'convenience-merchandising.js はMath.randomを使わない');
  const g = { week: 10, stores: [] };
  const store = { id: 's1', businessID: 'conveni' };
  const business = { price: 540, unitCost: 335 };
  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try { mod.processStore(g, store, business, 1000, 1); }
  finally { Math.random = originalRandom; }
  assert.equal(randomCalls, 0, 'processStoreはRNGを消費しない');
}

// 4. 同じ入力なら同じ出力（決定論）。
{
  const mod = loadGame({}).modules.convenienceMerchandising;
  const business = { price: 540, unitCost: 335 };
  const gA = { week: 5, stores: [{ id: 's1' }] }, gB = { week: 5, stores: [{ id: 's1' }] };
  const rowA = mod.processStore(gA, { id: 's1', businessID: 'conveni' }, business, 1500, 1.02);
  const rowB = mod.processStore(gB, { id: 's1', businessID: 'conveni' }, business, 1500, 1.02);
  assert.deepEqual(rowA, rowB, '同じ入力からは同じ結果が決定論的に得られる');
}

// 4b. 廃棄ロスは必ず variable（原価）側に加算される。ここを見落とすと廃棄ロスは
//     KPI表示上の数字だけになり、惣菜強化が実質ノーリスクになってしまう。
{
  const mod = loadGame({}).modules.convenienceMerchandising;
  const business = { price: 540, unitCost: 335 };
  const g = { week: 1, stores: [{ id: 's1' }], conveniMerchandising: { policyID: 'freshFocus' } };
  const result = mod.processStore(g, { id: 's1', businessID: 'conveni' }, business, 1000, 1);
  const policy = mod.POLICIES.freshFocus;
  const adjustedDemand = 1000 * policy.demandMultiplier;
  const expectedSales = Math.round(adjustedDemand * business.price);
  const expectedWasteCost = Math.round(expectedSales * policy.wasteRate);
  const baseVariable = Math.round(adjustedDemand * business.unitCost * policy.marginMultiplier);
  assert.ok(result.variable > baseVariable, '返り値のvariableは廃棄ロス抜きの原価より必ず大きい（廃棄ロスが原価に加算されている）');
  assert.equal(result.variable, Math.round(adjustedDemand * business.unitCost * policy.marginMultiplier + expectedWasteCost), 'variableは需要×原価×マージン倍率＋廃棄ロスちょうどに一致する');
  assert.equal(result.sales, expectedSales);
  assert.equal(g.conveniMerchandising.totals.wasteCost, expectedWasteCost);
}

// 5. 惣菜強化は標準構成より売上・廃棄ロスとも増える（同じdemand入力で比較）。
{
  const mod = loadGame({}).modules.convenienceMerchandising;
  const business = { price: 540, unitCost: 335 };
  const gStd = { week: 1, stores: [{ id: 's1' }], conveniMerchandising: { policyID: 'standard' } };
  const gFresh = { week: 1, stores: [{ id: 's1' }], conveniMerchandising: { policyID: 'freshFocus' } };
  const std = mod.processStore(gStd, { id: 's1', businessID: 'conveni' }, business, 1000, 1);
  const fresh = mod.processStore(gFresh, { id: 's1', businessID: 'conveni' }, business, 1000, 1);
  assert.ok(fresh.sales > std.sales, '惣菜強化は標準より売上が大きい');
  assert.ok(gFresh.conveniMerchandising.totals.wasteCost > gStd.conveniMerchandising.totals.wasteCost, '惣菜強化は標準より廃棄ロスが大きい');
}

// 6. setPolicy: 存在しない方針IDは拒否する。
{
  const mod = loadGame({}).modules.convenienceMerchandising;
  const g = { conveniMerchandising: undefined };
  assert.equal(mod.setPolicy(g, 'not-a-policy'), false, '不正な方針IDは拒否される');
  assert.equal(mod.setPolicy(g, 'freshFocus'), true, '正しい方針IDは受理される');
  assert.equal(g.conveniMerchandising.policyID, 'freshFocus');
}

// 7. 208週の実プレイ（通常難易度・engine.advanceWeekを通した統合テスト）で、
//    倒産せず、健全な範囲の利益で推移する。#488の不動産仲介初版がここで倒産したため、
//    同じ回帰を踏まないことを直接確認する。
{
  const { engine } = scenario();
  engine.g.companyCash = 8_000_000; // 初期資金のまま（現実的な厳しさで検証する）
  let sawSales = false;
  for (let i = 0; i < 208 && !engine.g.gameOver; i++) {
    engine.advanceWeek(false);
    if (engine.g.stores[0].lastSales > 0) sawSales = true;
  }
  assert.equal(engine.g.gameOver, false, '208週、初期資金のままでも倒産しない');
  assert.ok(sawSales, '売上が発生する週がある');
  assert.ok(engine.g.companyCash > 0, '会社現金がプラスで推移する');
}

// 8. 方針変更が実際に週次利益へ反映される（engine.changeMerchandisingPolicyの配線確認）。
{
  const { engine, store } = scenario();
  engine.advanceWeek(false);
  const before = JSON.parse(JSON.stringify(engine.g.conveniMerchandising));
  assert.equal(engine.changeMerchandisingPolicy('freshFocus'), true, '方針変更に成功する');
  assert.equal(engine.g.conveniMerchandising.policyID, 'freshFocus');
  engine.advanceWeek(false);
  const after = engine.g.conveniMerchandising.lastWeekByStoreID[store.id];
  assert.equal(after.policyID, 'freshFocus', '翌週の結果に新しい方針が反映される');
  assert.notEqual(JSON.stringify(before.lastWeekByStoreID), JSON.stringify(engine.g.conveniMerchandising.lastWeekByStoreID));
}

// 9. 旧セーブ互換: g.conveniMerchandisingが無い/壊れていても例外を投げず、標準構成として扱う。
{
  const { engine } = scenario();
  delete engine.g.conveniMerchandising;
  assert.doesNotThrow(() => engine.normalize(), '欠落時のnormalize()は例外を投げない（realEstateAgencyPipelineと同じく未生成のまま何もしない）');
  assert.doesNotThrow(() => engine.advanceWeek(false), '欠落状態からの週送りも例外を投げない');
  assert.equal(engine.g.conveniMerchandising.policyID, 'standard', '週送りで改めて生成され、標準構成にフォールバックする');

  engine.g.conveniMerchandising = { policyID: 'bogus', totals: 'not-an-object', lastWeekByStoreID: null };
  assert.doesNotThrow(() => engine.normalize());
  assert.equal(engine.g.conveniMerchandising.policyID, 'standard', '不正な方針IDは標準構成にフォールバックする');
  assert.doesNotThrow(() => engine.advanceWeek(false));
}

// 10. save/reload で品揃え構成の状態が保持される。
{
  const { engine } = scenario();
  engine.changeMerchandisingPolicy('staples');
  engine.advanceWeek(false);
  const before = JSON.stringify(engine.g.conveniMerchandising);
  engine.save();
  const reloaded = engine.constructor.load();
  assert.equal(JSON.stringify(reloaded.g.conveniMerchandising), before, 'save/reloadで品揃え構成が保持される');
}

// 11. 会計整合性: 通常のstore revenue/expense経路を使うだけなので、既存のfinance.validateが通る。
{
  const { engine, loaded } = scenario();
  for (let i = 0; i < 20; i++) engine.advanceWeek(false);
  const result = loaded.modules.finance.validate(engine.g);
  assert.equal(result.ok, true, result.errors.join('\n'));
}

// 12. UI配線: 事業画面がconvenienceMerchandisingを使い、方針切り替えボタンを出す。
{
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(appSource, /function renderMerchandisingMix\(stores\)\{/, 'renderMerchandisingMixが存在する');
  assert.match(appSource, /merchandising=b\.id==='conveni'\?renderMerchandisingMix\(ss\):''/, 'businessFullCardはconveniの時だけrenderMerchandisingMixを呼ぶ');
  assert.match(appSource, /'set-merchandising-policy':engine\.changeMerchandisingPolicy\(kind\)/, '方針変更ボタンのアクションが配線されている');
}

console.log('convenience merchandising tests passed');
