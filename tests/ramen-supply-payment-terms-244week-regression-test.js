'use strict';
// 244-week regression test for the js/supply.js payment-terms fix (Founding Route Rebalance
// Final, PR E). Background (documented in founding-route-verification-log.md Entry 20-25):
// under the pre-fix code, balanced_wholesale's nominal 2-week payment terms provided zero real
// cash-flow float after delivery (paymentDueWeek was anchored on the order week, not the arrival
// week, and leadTimeWeeks===paymentTermsWeeks===2 made them collide exactly). A sustained
// multi-week economic downturn around week200+ would then trigger a cash-gated procurement death
// spiral in ramen (js/supply.js's autoOrder()/createOrder()/receiveOrderNow() chain -- the only
// business gated by TARGET_BUSINESS_IDS=['ramen']): orders get blocked/shrunk for lack of cash,
// inventory runs short, applyConstraint() caps sold units below demand, revenue collapses, and
// the company goes bankrupt. 3 of 8 independently-seeded economic scenarios (distinct
// economicFoundation.seed values, derived from companyName) were measured to default this way,
// specifically between week236 and week242.
//
// This was originally written against a 208-week horizon (the repo's usual lighter-weight
// regression convention -- see CLAUDE.md section 8; the heavier 500-week validation is
// intentionally not part of this gate), but that cuts off *before* this specific failure mode's
// week236-242 window: run against the reverted pre-fix code, none of the 8 scenarios default by
// week208 either, so a 208-week horizon cannot actually distinguish fixed from broken here. 244
// weeks (matching the horizon used throughout Entry 20-25's investigation) is the shortest
// horizon that reliably reaches the failure window, so this test uses that instead.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const WEEKS = 244;

// Same 8 independently-seeded scenarios used throughout the investigation: companyName drives
// deterministic-economic-foundation.js's economicFoundation.seed, so each name is a genuinely
// separate macroeconomic trajectory. lcgSeed drives Math.random()-backed paths (news events,
// etc.) and is otherwise irrelevant to which economic scenario is played out.
const SCENARIOS = [
  { companyName: 'アルファ商事', lcgSeed: 190826041 + 0 },
  { companyName: 'ベータ食品', lcgSeed: 190826041 + 1 },
  { companyName: 'ガンマフーズ', lcgSeed: 190826041 + 2 },
  { companyName: 'デルタ商会', lcgSeed: 190826041 + 3 }, // defaulted pre-fix (week239/243w)
  { companyName: 'イプシロン飲食', lcgSeed: 190826041 + 4 },
  { companyName: 'ゼータ商事', lcgSeed: 190826041 + 5 },
  { companyName: 'エータ食堂', lcgSeed: 190826041 + 6 }, // defaulted pre-fix (week236/243w)
  { companyName: 'シータ商会', lcgSeed: 190826041 + 7 }, // defaulted pre-fix (week242/243w)
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

// Standard expansion heuristic used throughout the investigation: every 4th week, open a 2nd
// (etc.) store once trailing 8-week average profit is positive and cash covers 3x the next
// store's cost.
function run(companyName, lcgSeed) {
  const { ctx } = loadGame({ random: lcg(lcgSeed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.companyName = companyName;
  tryOpen(engine);
  const business = engine.business('ramen');
  for (let w = 1; w <= WEEKS && !engine.g.gameOver; w++) {
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
  }
  return { companyName, gameOver: engine.g.gameOver, finalWeek: engine.g.week, finalCash: Math.round(engine.g.companyCash) };
}

const results = SCENARIOS.map(s => run(s.companyName, s.lcgSeed));
for (const r of results) console.log(JSON.stringify(r));

const defaulted = results.filter(r => r.gameOver);
assert.equal(defaulted.length, 0, `expected 0 defaults across ${SCENARIOS.length} independent economic scenarios over ${WEEKS} weeks, got: ${JSON.stringify(defaulted)}`);
for (const r of results) {
  assert(r.finalCash > 0, `${r.companyName}: expected positive final cash after the payment-terms fix, got ${r.finalCash}`);
}

console.log(`ramen supply payment terms ${WEEKS}-week regression ok (0/${SCENARIOS.length} defaults)`);
