'use strict';

// Audit finding (Priority 3 of the R1 post-merge audit): updatePersonalAssets() applied
// `rand(-x.risk, x.risk) / 20` as the weekly noise term for every PERSONAL_INVESTMENT_OFFERS
// product. Across a 10,000-trial, 52-week Monte Carlo, every product from 'bond' (risk .01)
// through 'vc-fund' (risk .13) showed a 0.0% chance of ending the year below principal -- the
// `risk` field a player is shown never actually manifested as risk, regardless of how large
// it was declared to be. The /20 divisor is now /5: low-risk products (bond, index) stay safe
// most of the time, while higher-risk products (pe, vc-fund) get a real, risk-scaling chance
// of loss. This is a pure constant change to an existing rand() call already made once per
// personalInvestment per week -- it draws no additional randomness.
//
// updatePersonalAssets() is called directly (bypassing buyPersonalInvestment/advanceWeek's
// save()/emit() side effects) so a multi-thousand-trial Monte Carlo stays fast in canonical CI.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 730601001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 730601001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

const OFFERS = [
  { id: 'bond', weeklyReturn: .00035, risk: .01 },
  { id: 'index', weeklyReturn: .00125, risk: .035 },
  { id: 'reit', weeklyReturn: .0011, risk: .04 },
  { id: 'pe', weeklyReturn: .0020, risk: .09 },
  { id: 'vc-fund', weeklyReturn: .0026, risk: .13, carryRate: .20 }
];

// Runs `trials` independent 52-week holding periods for one offer via the real production
// updatePersonalAssets() path (not a re-implemented formula), returning the number of trials
// that ended below principal.
function simulateLossCount(engine, offer, trials, weeks = 52) {
  let lossCount = 0;
  for (let t = 0; t < trials; t++) {
    const h = { id: `sim-${offer.id}-${t}`, name: offer.id, type: offer.id, principal: 1_000_000, currentValue: 1_000_000, weeklyReturn: offer.weeklyReturn, risk: offer.risk, carryRate: 0, purchasedWeek: 1, reinvest: true };
    engine.g.personalInvestments = [h];
    for (let w = 0; w < weeks; w++) engine.updatePersonalAssets();
    if (h.currentValue < h.principal) lossCount++;
  }
  return lossCount;
}

// 1. Regression guard against re-dampening: 'pe' and 'vc-fund' (the two highest-risk
// products) must show a real, non-zero chance of ending below principal over 52 weeks. With
// the old /20 divisor this was exactly 0/N for every trial count tried (up to 10,000).
{
  const { engine } = newGame();
  const trials = 2000;
  const peLosses = simulateLossCount(engine, OFFERS.find(o => o.id === 'pe'), trials);
  const vcLosses = simulateLossCount(engine, OFFERS.find(o => o.id === 'vc-fund'), trials);
  engine.g.personalInvestments = [];
  assert.ok(peLosses > 0, `peは${trials}試行中ゼロ回の損失は不自然（risk=.09が全く反映されていない）`);
  assert.ok(vcLosses > 0, `vc-fundは${trials}試行中ゼロ回の損失は不自然（risk=.13が全く反映されていない）`);
}

// 2. Risk ordering: the declared risk field must have a visible effect on outcome spread.
// bond (risk .01) must lose far less often than vc-fund (risk .13) across the same trial
// count and the same underlying random stream (both draw from the same engine, sequentially,
// so this is not comparing across independent seeds).
{
  const { engine } = newGame();
  const trials = 2000;
  const bondLosses = simulateLossCount(engine, OFFERS.find(o => o.id === 'bond'), trials);
  const vcLosses = simulateLossCount(engine, OFFERS.find(o => o.id === 'vc-fund'), trials);
  engine.g.personalInvestments = [];
  assert.ok(vcLosses > bondLosses, 'vc-fund（risk .13）の損失回数はbond（risk .01）より明確に多い');
}

// 3. Zero additional RNG consumption: the fix only changes a divisor constant on an existing
// rand() call, so the number of Math.random() draws per updatePersonalAssets() call must be
// unchanged (exactly one per personalInvestment).
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalInvestments = [
    { id: 'a', name: 'bond', type: 'bond', principal: 1_000_000, currentValue: 1_000_000, weeklyReturn: .00035, risk: .01, carryRate: 0, purchasedWeek: 1, reinvest: true },
    { id: 'b', name: 'vc-fund', type: 'VC', principal: 15_000_000, currentValue: 15_000_000, weeklyReturn: .0026, risk: .13, carryRate: .20, purchasedWeek: 1, reinvest: true }
  ];
  const before = calls;
  engine.updatePersonalAssets();
  assert.equal(calls - before, 2, 'personalInvestments 1件につきMath.random()は1回のみ消費される（保有2件で+2）');
}

// 4. End-to-end realism: buying an offer through the production action, advancing many weeks
// through the production updatePersonalAssets() path, and redeeming through the production
// sellPersonalInvestment() action must be able to realize an actual loss (currentValue below
// principal) without throwing, without personalCash going negative or NaN, and with the
// existing carryRate no-op-on-loss behavior (js/engine.js's sellPersonalInvestment) intact.
{
  const { engine } = newGame(19831231);
  engine.g.personalCash = 100_000_000;
  assert.equal(engine.buyPersonalInvestment('vc-fund', 15_000_000), true);
  const h = engine.g.personalInvestments[0];
  for (let w = 0; w < 52; w++) engine.updatePersonalAssets();
  assert.ok(Number.isFinite(h.currentValue) && h.currentValue >= 0, 'currentValueは有限かつ非負を維持する');
  const before = engine.g.personalCash;
  assert.equal(engine.sellPersonalInvestment(h.id), true);
  assert.ok(Number.isFinite(engine.g.personalCash), 'personalCashはNaN化しない');
  assert.ok(engine.g.personalCash >= before, '解約時に現金がマイナス方向へ壊れることはない（currentValueがどうであれ非負のまま加算される）');
}

// 5. Company/personal separation: this fix only touches personalInvestments/personalCash
// math; it must never move companyCash.
{
  const { engine } = newGame();
  const companyCashBefore = engine.g.companyCash;
  engine.g.personalCash = 100_000_000;
  assert.equal(engine.buyPersonalInvestment('pe', 20_000_000), true);
  for (let w = 0; w < 20; w++) engine.updatePersonalAssets();
  assert.equal(engine.g.companyCash, companyCashBefore, 'personalInvestmentsの評価変動はcompanyCashに一切影響しない');
}

// 6. Determinism: same seed, same actions -> identical resulting personalInvestments state.
{
  function run() {
    const { engine } = newGame(555001);
    engine.g.personalCash = 100_000_000;
    engine.buyPersonalInvestment('reit', 3_000_000);
    for (let w = 0; w < 30; w++) engine.updatePersonalAssets();
    return JSON.stringify(engine.g.personalInvestments);
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 7. Existing baseline/calibration fixtures are unaffected: the standard 208-week baseline
// scenario never calls buyPersonalInvestment, so personalInvestments stays empty and this
// divisor change cannot move randomCallsAtWeek52 or the transaction/calibration fixtures.
// (Verified directly by re-running those suites alongside this file; not duplicated here.)

// 8. Static source scan: no new MutationObserver.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(engineSrc), 'engine.jsに新しいMutationObserverを追加していない');
}

console.log('Personal investment risk model tests passed');
