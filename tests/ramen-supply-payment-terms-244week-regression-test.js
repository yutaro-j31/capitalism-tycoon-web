'use strict';
// Regression test for the js/supply.js payment-terms fix (Founding Route Rebalance Final, PR E).
// Background (documented in founding-route-verification-log.md Entry 20-25): under the pre-fix
// code, balanced_wholesale's nominal 2-week payment terms provided zero real cash-flow float
// after delivery (paymentDueWeek was anchored on the order week, not the arrival week, and
// leadTimeWeeks===paymentTermsWeeks===2 made them collide exactly). A sustained multi-week
// economic downturn around week200+ would then trigger a cash-gated procurement death spiral in
// ramen (js/supply.js's autoOrder()/createOrder()/receiveOrderNow() chain -- the only business
// gated by TARGET_BUSINESS_IDS=['ramen']): orders get blocked/shrunk for lack of cash, inventory
// runs short, applyConstraint() caps sold units below demand, revenue collapses, and the company
// goes bankrupt. 3 of 8 independently-seeded economic scenarios (distinct economicFoundation.seed
// values, derived from companyName) were measured to default this way, specifically between
// week236 and week242.
//
// Checkpoint-diff structure (following tests/executive-dismissal-reachability-test.js's
// precedent: the phenomenon-reaching guarantee stays a full-length run, while properties that
// don't need the full length use a much shorter one instead of duplicating the expensive run):
//
// - CRITICAL_SCENARIOS (デルタ商会/エータ食堂/シータ商会, the 3 that actually defaulted
//   pre-fix): run to CRITICAL_WEEKS=244. This cannot be shortened -- their historical default
//   weeks (236-242) were confirmed under BOTH this test's own reverted-code check
//   (tests/ramen-supply-payment-terms-negative-test.js) and the original investigation, so any
//   checkpoint short of ~242 would fail to distinguish "fixed" from "still broken" for this group
//   by construction (an earlier draft of this test tried a 208-week horizon and confirmed exactly
//   that: even the fully-reverted pre-fix code doesn't default by week208). A CRITICAL_CHECKPOINT
//   snapshot at week200 is recorded from the same run (no extra simulation cost) purely as an
//   early-warning diagnostic, not as a substitute for the week244 assertion.
// - CONTROL_SCENARIOS (アルファ商事/ベータ食品/ガンマフーズ/イプシロン飲食/ゼータ商事, the 5
//   that never defaulted at any tested paymentTermsWeeks value from Entry 19-25): these don't
//   need to reach the week236-242 failure window at all -- they were never at risk there. Run to
//   CONTROL_WEEKS=52 (one full year of simulated operation, past the initial 1st/2nd-store
//   ramp-up) as a basic no-regression sanity check, at a fraction of the full-run cost.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const CRITICAL_WEEKS = 244;
const CRITICAL_CHECKPOINT_WEEK = 200;
const CONTROL_WEEKS = 52;

// Same 8 independently-seeded scenarios used throughout the investigation: companyName drives
// deterministic-economic-foundation.js's economicFoundation.seed, so each name is a genuinely
// separate macroeconomic trajectory. lcgSeed drives Math.random()-backed paths (news events,
// etc.) and is otherwise irrelevant to which economic scenario is played out.
const CRITICAL_SCENARIOS = [
  { companyName: 'デルタ商会', lcgSeed: 190826041 + 3 }, // defaulted pre-fix (week239/243w)
  { companyName: 'エータ食堂', lcgSeed: 190826041 + 6 }, // defaulted pre-fix (week236/243w)
  { companyName: 'シータ商会', lcgSeed: 190826041 + 7 }, // defaulted pre-fix (week242/243w)
];
const CONTROL_SCENARIOS = [
  { companyName: 'アルファ商事', lcgSeed: 190826041 + 0 },
  { companyName: 'ベータ食品', lcgSeed: 190826041 + 1 },
  { companyName: 'ガンマフーズ', lcgSeed: 190826041 + 2 },
  { companyName: 'イプシロン飲食', lcgSeed: 190826041 + 4 },
  { companyName: 'ゼータ商事', lcgSeed: 190826041 + 5 },
];

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

function tryOpen(engine) {
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
  if (!tenant) return false;
  const business = engine.business('ramen');
  const cost = business.storeCost + tenant.deposit;
  const shortfall = cost - engine.g.companyCash;
  if (shortfall > 0) {
    const room = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt);
    const amount = Math.min(shortfall, Math.max(0, room));
    if (amount > 0) engine.borrow(amount, 'company');
  }
  return engine.openStore({ tenantID: tenant.id, businessID: 'ramen', operatingHours: 3 });
}

function snapshot(engine) {
  return { gameOver: engine.g.gameOver, week: engine.g.week, cash: Math.round(engine.g.companyCash) };
}

// Standard expansion heuristic used throughout the investigation: every 4th week, open a 2nd
// (etc.) store once trailing 8-week average profit is positive and cash covers 3x the next
// store's cost. checkpointWeek (if given) records a snapshot mid-run without altering the
// simulation, so the checkpoint costs nothing extra beyond the final run itself.
function run(companyName, lcgSeed, weeks, checkpointWeek) {
  const { ctx } = loadGame({ random: lcg(lcgSeed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.companyName = companyName;
  tryOpen(engine);
  const business = engine.business('ramen');
  let checkpoint = null;
  for (let w = 1; w <= weeks && !engine.g.gameOver; w++) {
    engine.advanceWeek(false);
    if (engine.g.week % 4 === 0 && !engine.g.gameOver) {
      const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => b.traffic - a.traffic || a.id.localeCompare(b.id))[0];
      if (tenant) {
        const hist = engine.g.weeklyProfitHistory.slice(-8);
        const avgProfit = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
        const nextCost = business.storeCost + tenant.deposit;
        if (avgProfit > 0 && engine.g.companyCash > nextCost * 3) tryOpen(engine);
      }
    }
    if (checkpointWeek !== undefined && checkpoint === null && engine.g.week >= checkpointWeek) checkpoint = snapshot(engine);
  }
  return { companyName, gameOver: engine.g.gameOver, finalWeek: engine.g.week, finalCash: Math.round(engine.g.companyCash), checkpoint };
}

console.log(`--- critical scenarios (previously defaulted, full ${CRITICAL_WEEKS}-week run with week${CRITICAL_CHECKPOINT_WEEK} checkpoint) ---`);
const criticalResults = CRITICAL_SCENARIOS.map(s => run(s.companyName, s.lcgSeed, CRITICAL_WEEKS, CRITICAL_CHECKPOINT_WEEK));
for (const r of criticalResults) console.log(JSON.stringify(r));

console.log(`--- control scenarios (previously healthy, ${CONTROL_WEEKS}-week checkpoint run) ---`);
const controlResults = CONTROL_SCENARIOS.map(s => run(s.companyName, s.lcgSeed, CONTROL_WEEKS));
for (const r of controlResults) console.log(JSON.stringify(r));

for (const r of criticalResults) {
  assert(r.checkpoint, `${r.companyName}: expected a week${CRITICAL_CHECKPOINT_WEEK} checkpoint to have been recorded`);
  assert.equal(r.checkpoint.gameOver, false, `${r.companyName}: expected no default by the week${CRITICAL_CHECKPOINT_WEEK} checkpoint, got ${JSON.stringify(r.checkpoint)}`);
  assert.equal(r.gameOver, false, `${r.companyName}: expected no default by week${CRITICAL_WEEKS} (its pre-fix default week), got ${JSON.stringify(r)}`);
  assert(r.finalCash > 0, `${r.companyName}: expected positive final cash after the payment-terms fix, got ${r.finalCash}`);
}
for (const r of controlResults) {
  assert.equal(r.gameOver, false, `${r.companyName}: expected no default within ${CONTROL_WEEKS} weeks, got ${JSON.stringify(r)}`);
  assert(r.finalCash > 0, `${r.companyName}: expected positive cash within ${CONTROL_WEEKS} weeks, got ${r.finalCash}`);
}

console.log(`ramen supply payment terms regression ok (0/${CRITICAL_SCENARIOS.length} critical defaults through week${CRITICAL_WEEKS}, 0/${CONTROL_SCENARIOS.length} control defaults through week${CONTROL_WEEKS})`);
