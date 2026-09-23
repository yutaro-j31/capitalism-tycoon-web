'use strict';
// TEMPORARY DIAGNOSTIC SCRIPT -- not a committed test, not a calibration change.
//
// docs/MICROCAP_MODE_DESIGN.md §4.1 (the 300-seed standalone-model target numbers) never states
// which holding/selling rule was used to compute a listing's "multiplier". §3.3 only lists two
// player decision axes ("take profit at 3x" vs "hold for 10x") without saying which one (if
// either) §4.1's simulation actually applied. This script implements BOTH rules against the same
// 3 scenarios used throughout this investigation, on the real, unmodified production
// advanceWeek() engine, and compares which (if either) lands closer to the §4.1 targets.
//
// - take-profit rule: multiplier = price at the first week the stock's price reaches >= 3x its
//   listing price (tracked live, week by week, during the run -- not reconstructed from
//   stock.priceHistory after the fact, since priceHistory is capped at 260 weeks and would lose
//   the crossing week for early listings by week 1560). If 3x is never reached, falls back to the
//   final (week-1560) price, per the task instructions.
// - hold-to-end rule: multiplier = price at week 1560 regardless of path (same as
//   microcap-recalibration-probe.js's existing runScenario()).
//
// js/microcap-listings.js and js/engine.js are not touched in any way (not even in-memory) by
// this script -- only the real g.market state is read, once per simulated week.
//
// CONCLUSION: neither rule alone reproduces §4.1's targets -- they land on opposite sides of it
// (take-profit undershoots the tail entirely, hold-to-end overshoots it by ~100x at p99). The
// "hold-to-end" rule ("Rule B") was ultimately adopted as the documented, measured baseline in
// docs/MICROCAP_MODE_DESIGN.md §4.1 and docs/GAME_OVERVIEW.md §5 -- not because it was proven
// correct, but because it is the one rule under which "occasionally hitting a big multiple" (the
// feature's core design intent, §1/§4.1's prose) is even reachable; a player who takes profit at
// 3x instead gets the calmer, still-legitimate outcome this script measures under rule A.
const { scenarios, summarize } = require('./microcap-recalibration-probe');
const path = require('node:path');
const { loadGame } = require(path.join(__dirname, '..', 'tests', 'harness'));

const WEEKS = 1560;
const SEED_COUNT = 3;

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

function runScenarioDualRule({ companyName, lcgSeed }, weeks) {
  const { modules } = loadGame({ random: lcg(lcgSeed), headless: true });
  const Engine = modules.engine.TycoonEngine;
  const engine = new Engine();
  engine.configure({ playerName: 'プローブ', companyName, configured: true });

  const tracked = new Map(); // stockID -> { listingPrice, takeProfitPrice: null|number }

  function scanForNewListings() {
    for (const stock of engine.g.market) {
      if (!stock.microcap) continue;
      if (stock.microcapSignalProfitable !== true) continue; // fullbet only the profitable-signal listings, per design doc §4.1
      if (tracked.has(stock.id)) continue;
      tracked.set(stock.id, { listingPrice: stock.price, takeProfitPrice: null });
    }
  }
  function scanForTakeProfitCrossings() {
    for (const stock of engine.g.market) {
      const entry = tracked.get(stock.id);
      if (!entry || entry.takeProfitPrice !== null) continue;
      if (stock.price >= entry.listingPrice * 3) entry.takeProfitPrice = stock.price;
    }
  }

  scanForNewListings();
  for (let w = 1; w <= weeks && !engine.g.gameOver; w++) {
    engine.advanceWeek(false);
    scanForNewListings();
    scanForTakeProfitCrossings();
  }

  const takeProfitMultipliers = [];
  const holdToEndMultipliers = [];
  for (const [stockID, entry] of tracked) {
    const stock = engine.g.market.find(s => s.id === stockID);
    if (!stock) continue; // should not happen within 1560wk given HISTORY_LIMIT=200
    holdToEndMultipliers.push(stock.price / entry.listingPrice);
    const takeProfitPrice = entry.takeProfitPrice !== null ? entry.takeProfitPrice : stock.price; // never reached 3x -> fall back to final price, per instructions
    takeProfitMultipliers.push(takeProfitPrice / entry.listingPrice);
  }

  return {
    companyName, lcgSeed, finalWeek: engine.g.week, gameOver: engine.g.gameOver,
    trackedCount: tracked.size,
    takeProfitMultipliers, holdToEndMultipliers,
  };
}

function main() {
  const list = scenarios(SEED_COUNT);
  console.log(`=== dual holding-rule diagnostic: same ${SEED_COUNT} scenarios x ${WEEKS} weeks ===`);
  const runs = [];
  for (const s of list) {
    const t = Date.now();
    const r = runScenarioDualRule(s, WEEKS);
    console.log(JSON.stringify({ companyName: s.companyName, lcgSeed: s.lcgSeed, elapsedMs: Date.now() - t, finalWeek: r.finalWeek, trackedCount: r.trackedCount }));
    runs.push(r);
  }

  const takeProfitRuns = runs.map(r => ({ multipliers: r.takeProfitMultipliers }));
  const holdToEndRuns = runs.map(r => ({ multipliers: r.holdToEndMultipliers }));

  console.log('\n=== rule A: take-profit at first week price >= 3x listing price (fallback to week1560 price if never reached) ===');
  console.log(JSON.stringify(summarize(takeProfitRuns), null, 2));

  console.log('\n=== rule B: hold unconditionally to week1560 (same as microcap-recalibration-probe.js) ===');
  console.log(JSON.stringify(summarize(holdToEndRuns), null, 2));

  console.log('\n=== design doc §4.1 targets ===');
  console.log(JSON.stringify({ median: 1.11, p90: 5.7, p99: 44.9, hit10xRate: 0.056, hit50xRate: 0.0085, neverHit50xRate: 0.64 }, null, 2));
}

main();
