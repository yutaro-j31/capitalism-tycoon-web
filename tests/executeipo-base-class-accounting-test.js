'use strict';

// QA監査(docs/QA_AUDIT_2026-08-25.md C3)の修正確認。修正前は js/engine.js の基底
// executeIPO() 単体には finance.event の記録が無く、js/save-v9.js の
// TycoonEngineV9.executeIPO() が独自に再計算した companyRaise を先回りして記録する
// ことで初めて会計が成立していた。2つの計算式が将来どちらかだけ変更されると
// 静かに会計整合性が壊れる危険な二重実装だったため、記録を基底executeIPO()側に
// 一元化し、save-v9側の再計算を撤去した。このテストは基底クラス単体で
// finance.validate() が通ることを確認する（save-v9無しでは元々何週も
// advanceWeek()を回せる状態ではないため、IPO直前の最小状態を直接組み立てて検証する）。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function baseEngineClass(loaded) {
  // engineModule.TycoonEngine is reassigned to TycoonEngineV9 by js/save-v9.js at load
  // time (Object.assign(engine,{TycoonEngine:TycoonEngineV9,...})), so the only way to
  // reach js/engine.js's own class is to walk back up the prototype chain.
  return Object.getPrototypeOf(loaded.engineModule.TycoonEngine.prototype).constructor;
}

function ipoReadyBaseEngine(loaded) {
  const BaseEngine = baseEngineClass(loaded);
  const engine = new BaseEngine();
  engine.configure({ playerName: '検証者', companyName: 'IPO検証商事', difficulty: 'normal', scenario: 'standard', founderPrefID: 'fukuoka', founderTraitID: 'merchant' });
  engine.g.hasHeadOffice = true;
  engine.g.departments.accounting = true;
  engine.g.boardEstablished = true;
  for (let i = 0; i < 52; i++) engine.g.reports.push({ week: i + 1, profit: 300000 });
  // Seed cash through a real finance.event so the ledger balances before executeIPO() runs,
  // isolating executeIPO()'s own accounting effect from this fixture's setup.
  const seedAmount = 200_000_000;
  loaded.modules.finance.event(engine.g, 'equityFinancing', seedAmount, { cashEffect: seedAmount, equityEffect: seedAmount, sourceType: 'testSeed', sourceID: 'seed', operationID: 'seed', idempotencyKey: 'seed', description: 'test seed capital' });
  const ledger = loaded.modules.finance.ensureFinance(engine.g);
  ledger.balances.capitalSurplus = (ledger.balances.capitalSurplus || 0) + seedAmount;
  engine.g.companyCash += seedAmount;
  return engine;
}

// 1. 基底クラス単体でIPOを実行しても会計が成立する（資産=負債+純資産）。
{
  const loaded = loadGame({ random: () => 0.42 });
  const engine = ipoReadyBaseEngine(loaded);
  // VMサンドボックス越しの配列はNodeのグローバルArrayと別レルムになるため、
  // assert.deepEqual(x, []) はNode環境によって「構造は同じだが参照が異なる」で
  // 失敗することがある(既知の落とし穴)。.length===0で比較する。
  assert.equal(engine.ipoMissingReasons().length, 0, 'IPO条件を満たしている');
  assert.equal(loaded.modules.finance.validate(engine.g).errors.length, 0, 'executeIPO前は会計が成立している');
  const before = engine.g.companyCash;
  assert.equal(engine.executeIPO('東証グロース', 0), true, 'IPOが実行できる');
  assert.ok(engine.g.companyCash > before, '会社資金が増える');
  const afterErrors = loaded.modules.finance.validate(engine.g).errors;
  assert.equal(afterErrors.length, 0, `executeIPO後も会計整合性が保たれる（旧: 資産=負債+純資産が不一致になっていた）: ${JSON.stringify(afterErrors)}`);
}

// 2. 記録される取引は既存の契約(sourceType/operationID/idempotencyKey)を維持する。
// docs/PHASE6A_V1_PROGRESSION_GATE.md, tests/v1-progression-gate-test.js,
// tests/investment-route-ipo-reachability-test.js が同じ契約に依存している。
{
  const loaded = loadGame({ random: () => 0.42 });
  const engine = ipoReadyBaseEngine(loaded);
  const week = engine.g.week;
  engine.executeIPO('東証グロース', 0);
  const txs = engine.g.finance.transactions.filter(t => t.sourceType === 'parentCompanyIPO');
  assert.equal(txs.length, 1, 'parentCompanyIPO取引が1件だけ記録される');
  assert.equal(txs[0].operationID, `parent-ipo-${week}`, 'operationIDの命名規則を維持する');
  assert.equal(txs[0].idempotencyKey, `parent-ipo-${week}`, 'idempotencyKeyの命名規則を維持する');
  assert.equal(txs[0].category, 'equityFinancing');
  assert.ok(txs[0].cashEffect > 0 && txs[0].equityEffect === txs[0].cashEffect, 'cashEffectとequityEffectが一致する（新規負債を作らない）');
}

// 3. 会社資金の増加分は、その週に新規記録された取引のcashEffect合計と一致する
// （evaluateProgression()経由のミッション報酬等を含め、追跡されない現金移動が無い）。
{
  const loaded = loadGame({ random: () => 0.42 });
  const engine = ipoReadyBaseEngine(loaded);
  const beforeCash = engine.g.companyCash;
  const beforeTxCount = engine.g.finance.transactions.length;
  engine.executeIPO('東証グロース', 0);
  const ipoTx = engine.g.finance.transactions.find(t => t.sourceType === 'parentCompanyIPO');
  assert.ok(ipoTx.cashEffect > 0, 'IPO取引のcashEffectは正');
  const newTxs = engine.g.finance.transactions.slice(beforeTxCount);
  const newTxCashTotal = newTxs.reduce((sum, t) => sum + t.cashEffect, 0);
  const companyDelta = engine.g.companyCash - beforeCash;
  assert.ok(Math.abs(companyDelta - newTxCashTotal) < 1, `会社資金の増加額(${companyDelta})がその週の新規取引cashEffect合計(${newTxCashTotal})と一致する`);
}

// 4. js/save-v9.js のクラス定義は、もはや executeIPO を再定義していない
// (companyRaiseを再計算する二重実装の再発防止)。difficulty-scenario-balance.js が
// 進行度トラッキングのために TycoonEngineV9.prototype.executeIPO を薄くラップするのは
// 正当な別の関心事なので、ソースファイル単位でのチェックにする。
{
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'save-v9.js'), 'utf8');
  assert.ok(!source.includes('super.executeIPO'), 'js/save-v9.jsはexecuteIPOをオーバーライドしない(super呼び出しが無い)');
  assert.ok(!source.includes('projectedStockPrice') && !source.includes('projectedNewShares'), '旧・重複していた株価/株数の再計算式が残っていない');
}

// 5. 決定論: executeIPOはMath.randomを消費しない。
{
  const loaded = loadGame({ random: () => 0.42 });
  const engine = ipoReadyBaseEngine(loaded);
  let calls = 0;
  const original = loaded.ctx.Math.random;
  loaded.ctx.Math.random = () => { calls++; return original(); };
  engine.executeIPO('東証グロース', 0);
  loaded.ctx.Math.random = original;
  assert.equal(calls, 0, 'executeIPOはMath.randomを消費しない');
}

console.log('executeIPO base-class accounting tests passed');
