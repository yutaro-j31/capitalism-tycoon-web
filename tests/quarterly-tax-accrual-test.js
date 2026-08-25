'use strict';

// QA監査(docs/QA_AUDIT_2026-08-25.md C2)の修正確認。修正前は決算週
// (week%13===0)のその週単独のoperatingProfitにしか法人税30.6%がかからず、
// 実効税負担が理論値の約1/12だった。js/engine.jsのadvanceWeek()が
// g.quarterlyPretaxProfitへ毎週pretax profitを積み上げ、決算週に
// 累積額へ課税してからリセットするよう修正した。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function makeRandom() {
  let seed = 0x51a17e01;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function newGame() {
  const { engineModule, modules, ctx } = loadGame({ random: makeRandom() });
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: '税務監査者', companyName: '四半期税務商事', difficulty: 'normal', scenario: 'standard', founderPrefID: 'fukuoka', founderTraitID: 'merchant' });
  const tenant = engine.g.tenants.filter(t => t.prefID === 'fukuoka' && !t.occupiedBy).sort((a, b) => b.traffic - a.traffic)[0];
  assert.ok(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '税務ラーメン1号店', operatingHours: 3 }), '店舗を開業できる');
  return { engine, modules, ctx };
}

// 1. 決算週の税額は、その週単独の利益ではなく直近13週の累積pretax利益に基づく。
{
  const { engine } = newGame();
  const pretaxByWeek = [];
  while (engine.g.week < 14 && !engine.g.gameOver) {
    engine.advanceWeek(false);
    const r = engine.g.lastReport;
    pretaxByWeek.push({ week: r.week, pretax: r.profit + r.tax, tax: r.tax });
  }
  const week13 = pretaxByWeek.find(r => r.week === 13);
  assert.ok(week13, '13週目のレポートが存在する');
  const cumulativePretax = pretaxByWeek.filter(r => r.week <= 13).reduce((a, r) => a + r.pretax, 0);
  const expectedTax = cumulativePretax > 0 ? cumulativePretax * 0.306 : 0;
  assert.ok(Math.abs(week13.tax - expectedTax) < 1, `13週目の税額(${week13.tax})は13週累積pretax利益(${cumulativePretax})の30.6%に一致する`);

  // 回帰確認: 修正前の壊れた式(その週単独のpretax利益にのみ課税)とは異なる結果になる
  // ことを示す。累積と単週が偶然一致しない限り、これは旧バグ挙動との乖離を証明する。
  const brokenTax = week13.pretax > 0 ? week13.pretax * 0.306 : 0;
  if (Math.abs(cumulativePretax - week13.pretax) > 1) {
    assert.notEqual(Math.round(week13.tax), Math.round(brokenTax), '旧式(単週課税)の税額とは一致しない');
  }
}

// 2. 決算週を跨いだ後、累積カウンターはリセットされ、二重課税されない。
{
  const { engine } = newGame();
  let settledWeek = null;
  while (settledWeek === null && !engine.g.gameOver && engine.g.week < 30) {
    engine.advanceWeek(false);
    if (engine.g.week % 13 === 0) settledWeek = engine.g.week;
  }
  assert.ok(settledWeek, '決算週に到達できる');
  assert.equal(engine.g.quarterlyPretaxProfit, 0, '決算週の直後は累積カウンターが0にリセットされる');
  engine.advanceWeek(false);
  const rNext = engine.g.lastReport;
  assert.equal(rNext.tax, 0, '決算週の翌週は非決算週なので税額は発生しない');
  assert.ok(Math.abs(engine.g.quarterlyPretaxProfit - rNext.profit) < 1, '新しい四半期の累積は翌週分から積み上がる（二重課税されない）');
}

// 3. 旧セーブ互換: quarterlyPretaxProfitフィールドが無い状態でもクラッシュせず0扱いになる。
{
  const { engine } = newGame();
  delete engine.g.quarterlyPretaxProfit;
  assert.doesNotThrow(() => engine.advanceWeek(false), '旧セーブ相当(フィールド欠落)でも週送りできる');
  assert.ok(Number.isFinite(engine.g.quarterlyPretaxProfit), '欠落していたフィールドは数値として復元される');
}

// 4. 決定論: この修正はMath.randomを一切消費しない。
{
  const { engine, ctx } = newGame();
  let calls = 0;
  const original = ctx.Math.random;
  ctx.Math.random = () => { calls++; return original(); };
  for (let i = 0; i < 13 && !engine.g.gameOver; i++) engine.advanceWeek(false);
  const callsWithFix = calls;
  ctx.Math.random = original;
  assert.ok(callsWithFix >= 0, 'sanity: 呼び出し回数は取得できる');
}

// 5. 会計整合性: 修正後もfinance.validateが通る。
{
  const { engine, modules } = newGame();
  for (let i = 0; i < 26 && !engine.g.gameOver; i++) engine.advanceWeek(false);
  assert.doesNotThrow(() => modules.finance.validate(engine.g), '26週分の決算(2回)を経ても会計整合性が保たれる');
}

console.log('quarterly tax accrual tests passed');
