'use strict';
// TEMPORARY DIAGNOSTIC SCRIPT -- not a committed test, not a calibration change. Single-shot Rule
// C per the task instructions: "hold until the next microcap listing event occurs, then sell".
//
// Implementation: every currently-tracked-but-unresolved stock is resolved at its CURRENT price
// the moment a NEW microcap listing spawns (detected via microcapMarket.listings.length
// increasing week over week). Resolution happens BEFORE the newly-spawned stock itself is added
// to tracking, so a stock can never resolve against its own spawn event. A stock still unresolved
// at week 1560 (i.e. it was the last listing and no further spawn happened before the run ended)
// falls back to the week-1560 price, matching Rule B's fallback in
// scripts/microcap-diagnostic-holding-rules.js.
//
// js/microcap-listings.js and js/engine.js are not touched in any way. Same 3 scenarios as every
// prior diagnostic in this investigation (MicrocapProbe0000-0002). Run once, per instructions --
// no further rule variants after this one.
//
// CONCLUSION: "Rule C" undershoots §4.1's targets even further than the take-profit rule (the
// ~13-week average spawn interval leaves too little time for trend/volatility to compound). No
// single mechanical holding rule among the three tried (this one, take-profit, hold-to-end)
// reproduces §4.1's targets -- see docs/MICROCAP_MODE_DESIGN.md §4.1 for how that was ultimately
// resolved (the hold-to-end measurement was adopted as the documented baseline, not this rule).
const { scenarios, summarize } = require('./microcap-recalibration-probe');
const path = require('node:path');
const { loadGame } = require(path.join(__dirname, '..', 'tests', 'harness'));

const WEEKS = 1560;
const SEED_COUNT = 3;

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

function runScenarioNextListingRule({ companyName, lcgSeed }, weeks) {
  const { modules } = loadGame({ random: lcg(lcgSeed), headless: true });
  const Engine = modules.engine.TycoonEngine;
  const engine = new Engine();
  engine.configure({ playerName: 'プローブ', companyName, configured: true });

  const tracked = new Map(); // stockID -> { listingPrice, resolvedPrice: null|number }
  let prevListingsCount = 0;

  function scanForNewListings() {
    for (const stock of engine.g.market) {
      if (!stock.microcap) continue;
      if (stock.microcapSignalProfitable !== true) continue; // fullbet only the profitable-signal listings, per design doc §4.1
      if (tracked.has(stock.id)) continue;
      tracked.set(stock.id, { listingPrice: stock.price, resolvedPrice: null });
    }
  }

  scanForNewListings();
  prevListingsCount = engine.g.microcapMarket.listings.length;

  for (let w = 1; w <= weeks && !engine.g.gameOver; w++) {
    engine.advanceWeek(false);
    const currentListingsCount = engine.g.microcapMarket.listings.length;
    if (currentListingsCount > prevListingsCount) {
      // A new listing spawned this week: it is "the next listing" for every stock already being
      // tracked and not yet resolved. Resolve those now, at their current (this-week) price,
      // BEFORE adding the newly-spawned stock(s) to tracking.
      for (const [stockID, entry] of tracked) {
        if (entry.resolvedPrice !== null) continue;
        const stock = engine.g.market.find(s => s.id === stockID);
        if (stock) entry.resolvedPrice = stock.price;
      }
      scanForNewListings();
      prevListingsCount = currentListingsCount;
    }
  }

  const multipliers = [];
  for (const [stockID, entry] of tracked) {
    const stock = engine.g.market.find(s => s.id === stockID);
    if (!stock) continue;
    const sellPrice = entry.resolvedPrice !== null ? entry.resolvedPrice : stock.price; // no further listing before week1560 -> fall back to final price
    multipliers.push(sellPrice / entry.listingPrice);
  }

  return { companyName, lcgSeed, finalWeek: engine.g.week, gameOver: engine.g.gameOver, trackedCount: tracked.size, multipliers };
}

function main() {
  const list = scenarios(SEED_COUNT);
  console.log(`=== rule C diagnostic (sell at next listing event): same ${SEED_COUNT} scenarios x ${WEEKS} weeks ===`);
  const runs = [];
  for (const s of list) {
    const t = Date.now();
    const r = runScenarioNextListingRule(s, WEEKS);
    console.log(JSON.stringify({ companyName: s.companyName, lcgSeed: s.lcgSeed, elapsedMs: Date.now() - t, finalWeek: r.finalWeek, trackedCount: r.trackedCount }));
    runs.push(r);
  }

  console.log('\n=== rule C: sell at the next microcap listing event (fallback to week1560 price if this is the last listing) ===');
  console.log(JSON.stringify(summarize(runs), null, 2));

  console.log('\n=== design doc §4.1 targets ===');
  console.log(JSON.stringify({ median: 1.11, p90: 5.7, p99: 44.9, hit10xRate: 0.056, hit50xRate: 0.0085, neverHit50xRate: 0.64 }, null, 2));
}

main();
