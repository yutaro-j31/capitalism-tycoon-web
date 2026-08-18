'use strict';

// feature-requests.md R1 remaining item "VCファンド／LP". Audited first: js/engine.js's
// buyPersonalInvestment()/sellPersonalInvestment() and the weekly
// `for(const x of this.g.personalInvestments)` mark-to-market loop already implement the
// entire "commit personal capital to a fund product, it moves week over week, redeem for
// current value" mechanic (used today by bond/index/REIT/PE offers). The only thing missing
// for a genuine VC/LP flavor was (a) a fund product themed and risk-tuned for early-stage
// venture, and (b) a general-partner performance cut (carry) taken only on gains at
// redemption -- real funds don't charge carry on a loss. Both are added as data plus a
// small, backward-compatible change to sellPersonalInvestment gated on a new optional
// carryRate field that is 0/undefined (a strict no-op) on every pre-existing offer.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 610423001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 610423001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 100_000_000;
  return { modules, ctx, engine };
}

// 1. Buying the VC fund offer: personalCash decreases by the invested amount, the holding
// carries the offer's carryRate (20%) and VC type.
{
  const { engine } = newGame();
  const before = engine.g.personalCash;
  assert.equal(engine.buyPersonalInvestment('vc-fund', 15_000_000), true);
  assert.equal(engine.g.personalCash, before - 15_000_000);
  const holding = engine.g.personalInvestments.find(x => x.type === 'VC');
  assert.ok(holding, 'VC fund holding must be recorded');
  assert.equal(holding.carryRate, .20);
  assert.equal(holding.principal, 15_000_000);
  assert.equal(holding.currentValue, 15_000_000);
}

// 2. Below minAmount fails cleanly.
{
  const { engine } = newGame();
  const before = engine.g.personalCash;
  assert.equal(engine.buyPersonalInvestment('vc-fund', 1_000_000), false, '最低出資額未満は失敗する');
  assert.equal(engine.g.personalCash, before);
}

// 3. Redemption with a gain: the general partner's carry (20% of the gain, never of
// principal) is deducted from proceeds.
{
  const { engine } = newGame();
  assert.equal(engine.buyPersonalInvestment('vc-fund', 15_000_000), true);
  const holding = engine.g.personalInvestments.find(x => x.type === 'VC');
  holding.currentValue = 25_000_000; // simulate 10,000,000 of gain having accrued
  const before = engine.g.personalCash;
  const expectedCarry = (25_000_000 - 15_000_000) * .20;
  assert.equal(engine.sellPersonalInvestment(holding.id), true);
  assert.equal(engine.g.personalCash, before + 25_000_000 - expectedCarry, '解約時に含み益の20%だけ成功報酬として控除される');
}

// 4. Redemption at a loss: no carry is taken (a GP doesn't get paid on a loss), full
// currentValue is credited.
{
  const { engine } = newGame();
  assert.equal(engine.buyPersonalInvestment('vc-fund', 15_000_000), true);
  const holding = engine.g.personalInvestments.find(x => x.type === 'VC');
  holding.currentValue = 9_000_000; // simulate a loss
  const before = engine.g.personalCash;
  assert.equal(engine.sellPersonalInvestment(holding.id), true);
  assert.equal(engine.g.personalCash, before + 9_000_000, '含み損では成功報酬は発生せず全額が戻る');
}

// 5. Regression guard: pre-existing offers (no carryRate) still redeem with zero deduction
// even when showing a gain -- proves the carry logic is a strict no-op for them.
{
  const { engine } = newGame();
  assert.equal(engine.buyPersonalInvestment('bond', 1_000_000), true);
  const holding = engine.g.personalInvestments.find(x => x.type === '債券');
  assert.equal(holding.carryRate, 0, '既存商品はcarryRate0で作成される');
  holding.currentValue = 1_500_000;
  const before = engine.g.personalCash;
  assert.equal(engine.sellPersonalInvestment(holding.id), true);
  assert.equal(engine.g.personalCash, before + 1_500_000, '既存商品は含み益があっても控除されない（後方互換）');
}

// 6. Weekly mark-to-market already applies to the new offer through the pre-existing
// unconditional loop -- no new code was needed for this, just verifying integration.
{
  const { engine } = newGame();
  assert.equal(engine.buyPersonalInvestment('vc-fund', 15_000_000), true);
  const holding = engine.g.personalInvestments.find(x => x.type === 'VC');
  const before = holding.currentValue;
  assert.notEqual(engine.advanceWeek(false), false);
  assert.notEqual(holding.currentValue, before, '週次のmark-to-marketで評価額が動く');
}

// 7. Company/personal separation: buying/selling the VC fund never touches companyCash.
{
  const { engine } = newGame();
  const companyCashBefore = engine.g.companyCash;
  assert.equal(engine.buyPersonalInvestment('vc-fund', 15_000_000), true);
  assert.equal(engine.g.companyCash, companyCashBefore, '購入はcompanyCashに影響しない');
  const holding = engine.g.personalInvestments.find(x => x.type === 'VC');
  assert.equal(engine.sellPersonalInvestment(holding.id), true);
  assert.equal(engine.g.companyCash, companyCashBefore, '解約もcompanyCashに影響しない');
}

// 8. Determinism: same seed, same actions -> identical resulting state.
{
  function run() {
    const { engine } = newGame(778001);
    engine.buyPersonalInvestment('vc-fund', 15_000_000);
    engine.advanceWeek(false);
    return JSON.stringify({ personalCash: engine.g.personalCash, investments: engine.g.personalInvestments });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 9. Save/reload round trip: carryRate persists.
{
  const { modules, engine } = newGame();
  assert.equal(engine.buyPersonalInvestment('vc-fund', 15_000_000), true);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  const holding = reloaded.g.personalInvestments.find(x => x.type === 'VC');
  assert.ok(holding, 'reload後もVCファンド保有が残る');
  assert.equal(holding.carryRate, .20);
}

// 10. Static source scan: no new MutationObserver.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(engineSrc), 'engine.jsに新しいMutationObserverを追加していない');
}

console.log('VC fund / LP tests passed');
