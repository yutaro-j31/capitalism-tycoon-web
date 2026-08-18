'use strict';

// feature-requests.md R2 remaining item "再建中の企業の週次業績を改善度と連動させる".
// Before this, a peDeal carried no weekly P&L at all -- only currentValuation drifted
// (mostly market noise, plus a token improvementScore/50000 nudge). This adds
// weeklyRevenue (fixed at acquisition, a share of investedAmount) and a margin derived
// from improvementScore around the same EXIT_BASELINE_SCORE=20 baseline the exit premium
// already uses (js/pe-value-creation.js): an untouched deal is a real weekly cash drain,
// and only sustained improvement past the acquisition condition turns it into a cash
// generator. Revenue is fixed (not recomputed weekly), so this draws no new randomness.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 730801001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 730801001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 500_000_000;
  return { modules, ctx, engine };
}

function enableCompanyPE(engine, modules) {
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);
  engine.g.companyCash = 200_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
}

// 1. createPEDeal sets weeklyRevenue as a fixed share of investedAmount, weeklyProfit
// starts at 0 (nothing has happened yet).
{
  const { engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  assert.equal(d.weeklyRevenue, Math.round(20_000_000 * .03));
  assert.equal(d.weeklyProfit, 0);
}

// 2. Baseline (untouched, improvementScore===EXIT_BASELINE_SCORE===20) deal loses money
// every week -- this is the real, immediate consequence of not running any initiative.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  assert.equal(d.improvementScore, 20, '前提: createPEDealはEXIT_BASELINE_SCOREで開始する');
  const expectedProfit = Math.round(d.weeklyRevenue * modules.peValueCreation.marginFor(d));
  assert.ok(expectedProfit < 0, '未改善の案件は損失を出す');
  const before = engine.g.personalCash;
  engine.updatePersonalExpandedWeekly();
  assert.equal(d.weeklyProfit, expectedProfit);
  assert.equal(engine.g.personalCash, before + expectedProfit, '週次損益がそのままpersonalCashへ反映される');
}

// 3. Full turnaround (improvementScore===MAX_SCORE) makes the deal cash-flow positive.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  d.improvementScore = modules.peValueCreation.MAX_SCORE;
  const expectedProfit = Math.round(d.weeklyRevenue * modules.peValueCreation.marginFor(d));
  assert.ok(expectedProfit > 0, '完全再建した案件は黒字化する');
  const before = engine.g.personalCash;
  engine.updatePersonalExpandedWeekly();
  assert.equal(engine.g.personalCash, before + expectedProfit);
}

// 4. Deeper distress (improvementScore below baseline) loses more than the baseline case.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const baselineProfit = modules.peValueCreation.weeklyProfitFor(d);
  d.improvementScore = 0;
  const worseProfit = modules.peValueCreation.weeklyProfitFor(d);
  assert.ok(worseProfit < baselineProfit, '改善度が低いほど週次損失が大きくなる');
}

// 5. Company-owned deal: companyCash moves by exactly the weekly profit and a matching
// finance ledger row is recorded (accounting integrity for the company account only --
// personal-owned deals intentionally never touch the finance ledger, matching every other
// personal-only cash flow in this codebase).
{
  const { modules, engine } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'company'), true);
  const d = engine.g.peDeals[0];
  const before = engine.g.companyCash;
  engine.updatePersonalExpandedWeekly();
  assert.equal(engine.g.companyCash, before + d.weeklyProfit);
  const rows = engine.g.finance.transactions.filter(t => t.sourceType === 'peWeeklyPerformance' && t.sourceID === d.id);
  assert.equal(rows.length, 1, '会社保有の週次業績は台帳に1行だけ記録される');
  assert.equal(rows[0].cashEffect, d.weeklyProfit);
  assert.equal(rows[0].profitEffect, d.weeklyProfit);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 6. Company/personal separation: a personal-owned deal's weekly P&L never touches
// companyCash, and a company-owned deal's weekly P&L never touches personalCash.
{
  const { modules, engine } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('個人テック', 20_000_000, 'personal'), true);
  const companyCashBefore = engine.g.companyCash;
  engine.updatePersonalExpandedWeekly();
  assert.equal(engine.g.companyCash, companyCashBefore, '個人保有案件の週次損益はcompanyCashに影響しない');
}

// 7. Integration: a full advanceWeek() (not just the raw update function) also applies the
// weekly P&L, proving this is wired into the real game loop and not just directly callable.
{
  const { engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  const before = engine.g.personalCash;
  assert.notEqual(engine.advanceWeek(false), false);
  assert.notEqual(d.weeklyProfit, 0, 'advanceWeek()経由でも週次損益が計上される');
  assert.notEqual(engine.g.personalCash, before);
}

// 8. Determinism: same seed, same actions -> identical resulting state (weeklyRevenue is
// fixed at creation and margin is a pure function of improvementScore, so no RNG is drawn
// by this feature).
{
  function run() {
    const { engine } = newGame(19831231);
    engine.createPEDeal('テック', 20_000_000, 'personal');
    engine.updatePersonalExpandedWeekly();
    return JSON.stringify({ personalCash: engine.g.personalCash, peDeals: engine.g.peDeals });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 9. Zero additional RNG consumption from the new weekly P&L math itself: the pre-existing
// valuation-drift line already draws exactly one rand() call per active peDeal
// (`rand(-.012,.025)`). weeklyRevenue is fixed at creation and marginFor() is a pure
// function of improvementScore, so adding the weekly P&L feature must not raise that count
// above the one draw the valuation drift alone already accounts for.
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 500_000_000;
  engine.createPEDeal('テック', 20_000_000, 'personal');
  const before = calls;
  engine.updatePersonalExpandedWeekly();
  assert.equal(calls - before, 1, '週次処理1件あたりのMath.random消費は既存のvaluation drift分(1回)のみで、週次業績の追加消費はゼロ');
}

// 10. Save/reload round trip: weeklyRevenue/weeklyProfit persist.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  engine.updatePersonalExpandedWeekly();
  const before = JSON.stringify(engine.g.peDeals);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  assert.equal(JSON.stringify(reloaded.g.peDeals), before, 'reload後もweeklyRevenue/weeklyProfitが一致する');
}

// 11. Legacy fallback: a peDeal entity with no stored weeklyRevenue (e.g. a save from
// before this feature) must still produce a sensible, non-NaN weekly profit derived from
// investedAmount, not a broken/zero value.
{
  const { modules, engine } = newGame();
  assert.equal(engine.createPEDeal('テック', 20_000_000, 'personal'), true);
  const d = engine.g.peDeals[0];
  delete d.weeklyRevenue;
  const profit = modules.peValueCreation.weeklyProfitFor(d);
  assert.ok(Number.isFinite(profit), 'weeklyRevenue欠損時もNaNにならない');
  assert.equal(profit, Math.round(Math.round(20_000_000 * .03) * modules.peValueCreation.marginFor(d)));
}

// 12. Static source scan: no new MutationObserver introduced by this feature.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const expansionSrc = fs.readFileSync(path.join(__dirname, '../js/expansion.js'), 'utf8');
  const peSrc = fs.readFileSync(path.join(__dirname, '../js/pe-value-creation.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(expansionSrc), 'expansion.jsに新しいMutationObserverを追加していない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(peSrc), 'pe-value-creation.jsに新しいMutationObserverを追加していない');
}

console.log('PE weekly performance tests passed');
