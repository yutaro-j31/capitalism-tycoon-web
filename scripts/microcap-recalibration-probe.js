'use strict';
// TEMPORARY MEASUREMENT SCRIPT -- not a committed regression test. Preliminary-measurement phase
// for Microcap archetype recalibration (docs/MICROCAP_MODE_DESIGN.md SS4.1, docs/GAME_OVERVIEW.md
// SS5/SS7). Measures the real production advanceWeek() engine's microcap multiplier distribution
// across N independently-seeded (companyName, lcgSeed) scenarios.
//
// Reuses the "real engine harness" technique from
// tests/ramen-supply-payment-terms-244week-regression-test.js (loadGame({random: lcg(lcgSeed)})
// + a distinct companyName per scenario, which independently seeds both
// js/deterministic-economic-foundation.js's economicFoundation.seed = hash(companyName:ticker)
// (macro trajectory) and, via the harness's crypto.randomUUID stub deriving from the same seeded
// random(), js/engine.js's buildCompetitorRoster(uuid) competitor IDs that
// js/microcap-listings.js's deriveIdentity() folds into microcapMarket.identity (microcap
// archetype/spawn RNG stream)) -- but with a much larger, mechanically-generated sample count and
// a continuous-distribution metric instead of the ramen test's 8-scenario binary bankruptcy check
// (see the investigation report SS3 for why 8 scenarios / a binary metric does not transfer).
//
// This script does NOT adjust any calibration parameter. It only measures.
//
// CONCLUSION (kept for reproducibility, not deleted after use): a 50-scenario x 1560-week run
// (unconditional hold to the end, "Rule B" -- see microcap-diagnostic-holding-rules.js) produced
// the numbers now recorded in docs/MICROCAP_MODE_DESIGN.md SS4.1 and docs/GAME_OVERVIEW.md SS5/SS7,
// which superseded the original design-doc target numbers. No production code
// (js/microcap-listings.js's ARCHETYPES etc.) was changed as a result -- the original target
// numbers, not the implementation, were found to be the source of the mismatch (see
// microcap-diagnostic-zero-economy-term.js and microcap-diagnostic-next-listing-rule.js for the
// ruled-out alternative explanations).
//
// Usage: node scripts/microcap-recalibration-probe.js [seedCount] [weeks] [--verify-determinism] [--checkpoint=<path>] [--limit=<n>]
//
// --checkpoint=<path>: appends each scenario's full result (as one JSON line, including its raw
// multipliers) to <path> as soon as it is computed, and on startup skips any scenario whose
// companyName is already present in that file. Added after this environment killed a long
// (50-scenario, ~8h) unattended background run partway through on what looked like a container
// restart, losing all progress because only summary lines (not the raw multipliers needed for the
// final aggregate) had been logged. With --checkpoint, a restart can resume instead of starting
// over.
//
// --limit=<n>: process at most <n> NOT-YET-checkpointed scenarios this invocation, then stop
// (still printing the aggregate summary over ALL checkpointed scenarios so far, old + new).
// Added because this environment appears to reclaim the container after a period of session
// inactivity, which killed unattended multi-hour nohup-detached background runs outright (twice).
// Chaining many short --limit=1 (or small-N) FOREGROUND invocations one after another keeps the
// session actively making tool calls throughout, instead of sitting idle waiting on one huge
// detached job -- the pattern that survived in this investigation was always short (<=~40min),
// actively-awaited background Bash calls, never a fire-and-forget detached process across a long
// idle gap.
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require(path.join(__dirname, '..', 'tests', 'harness'));

const SEED_COUNT = Number(process.argv[2]) || 60;
const WEEKS = Number(process.argv[3]) || 1560; // 30 years, matching design doc SS4.1
const VERIFY_DETERMINISM = process.argv.includes('--verify-determinism');
const CHECKPOINT_ARG = process.argv.find(a => a.startsWith('--checkpoint='));
const CHECKPOINT_PATH = CHECKPOINT_ARG ? CHECKPOINT_ARG.slice('--checkpoint='.length) : null;
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.slice('--limit='.length)) : Infinity;
const BASE_SEED = 481516234; // arbitrary constant, distinct from the ramen regression test's 190826041

function loadCheckpoint(checkpointPath) {
  if (!checkpointPath || !fs.existsSync(checkpointPath)) return new Map();
  const lines = fs.readFileSync(checkpointPath, 'utf8').split('\n').filter(Boolean);
  const byName = new Map();
  for (const line of lines) {
    try { const row = JSON.parse(line); byName.set(row.companyName, row); } catch { /* skip a truncated last line from a killed prior run */ }
  }
  return byName;
}
function appendCheckpoint(checkpointPath, result) {
  if (!checkpointPath) return;
  fs.appendFileSync(checkpointPath, JSON.stringify(result) + '\n');
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

// Mechanical, deterministic scenario generation: scenario i is fully determined by i itself.
function scenarios(n) {
  return Array.from({ length: n }, (_, i) => ({
    companyName: `MicrocapProbe${String(i).padStart(4, '0')}`,
    lcgSeed: BASE_SEED + i,
  }));
}

function runScenario({ companyName, lcgSeed }, weeks) {
  const { modules } = loadGame({ random: lcg(lcgSeed), headless: true });
  const Engine = modules.engine.TycoonEngine;
  const engine = new Engine();
  engine.configure({ playerName: 'プローブ', companyName, configured: true });
  for (let w = 1; w <= weeks && !engine.g.gameOver; w++) engine.advanceWeek(false);

  const multipliers = [];
  for (const meta of engine.g.microcapMarket.listings) {
    const stock = engine.g.market.find(s => s.id === meta.stockID);
    if (!stock) continue; // should not happen within 1560wk given HISTORY_LIMIT=200 (see report note)
    if (stock.microcapSignalProfitable !== true) continue; // fullbet only the profitable-signal listings, per design doc SS4.1
    const listingPrice = meta.valuation / stock.issuedShares;
    multipliers.push(stock.price / listingPrice);
  }

  return {
    companyName, lcgSeed,
    finalWeek: engine.g.week, gameOver: engine.g.gameOver,
    totalListings: engine.g.microcapMarket.listings.length,
    signalProfitableListings: multipliers.length,
    multipliers,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function summarize(runs) {
  const pooled = runs.flatMap(r => r.multipliers).sort((a, b) => a - b);
  const median = percentile(pooled, 0.5);
  const p90 = percentile(pooled, 0.9);
  const p99 = percentile(pooled, 0.99);
  const max = pooled.length ? pooled[pooled.length - 1] : NaN;
  const hit10x = pooled.filter(m => m >= 10).length / pooled.length;
  const hit50x = pooled.filter(m => m >= 50).length / pooled.length;
  const scenariosWithNo50x = runs.filter(r => !r.multipliers.some(m => m >= 50)).length;
  const neverHit50xRate = scenariosWithNo50x / runs.length;
  return { sampleCount: pooled.length, scenarioCount: runs.length, median, p90, p99, max, hit10xRate: hit10x, hit50xRate: hit50x, neverHit50xRate };
}

function main() {
  const list = scenarios(SEED_COUNT);
  console.log(`=== microcap recalibration probe: ${SEED_COUNT} scenarios x ${WEEKS} weeks ===`);
  const checkpointed = loadCheckpoint(CHECKPOINT_PATH);
  if (checkpointed.size) console.log(`resuming from checkpoint: ${checkpointed.size} scenario(s) already done, skipping those`);
  const perScenarioTimingsMs = [];
  const runs = [];
  const t0 = Date.now();
  let remaining = 0;
  for (const s of list) {
    if (checkpointed.has(s.companyName)) { runs.push(checkpointed.get(s.companyName)); continue; }
    if (perScenarioTimingsMs.length >= LIMIT) { remaining += 1; continue; }
    const t = Date.now();
    const result = runScenario(s, WEEKS);
    const elapsed = Date.now() - t;
    perScenarioTimingsMs.push(elapsed);
    runs.push(result);
    appendCheckpoint(CHECKPOINT_PATH, result);
    console.log(JSON.stringify({ companyName: s.companyName, lcgSeed: s.lcgSeed, elapsedMs: elapsed, finalWeek: result.finalWeek, gameOver: result.gameOver, totalListings: result.totalListings, signalProfitableListings: result.signalProfitableListings }));
  }
  if (Number.isFinite(LIMIT)) console.log(`\n(--limit=${LIMIT}: ran ${perScenarioTimingsMs.length} new scenario(s) this invocation; ${remaining} scenario(s) still not done)`);
  const totalMs = Date.now() - t0;
  const avgMsPerScenario = perScenarioTimingsMs.length ? totalMs / perScenarioTimingsMs.length : NaN;

  console.log('\n=== timing ===');
  console.log(JSON.stringify({ totalMs, avgMsPerScenario, seedCount: SEED_COUNT, weeksPerScenario: WEEKS }));
  const extrapolated300x1560Ms = avgMsPerScenario * 300;
  console.log(JSON.stringify({ extrapolatedFor300ScenariosMs: extrapolated300x1560Ms, extrapolatedFor300ScenariosMinutes: extrapolated300x1560Ms / 60000 }));

  console.log('\n=== multiplier distribution (pooled across all scenarios, signal-profitable listings only) ===');
  const summary = summarize(runs);
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n=== design doc SS4.1 targets (standalone-model estimate, for comparison only) ===');
  console.log(JSON.stringify({ median: 1.11, p90: 5.7, p99: 44.9, hit10xRate: 0.056, hit50xRate: 0.0085, neverHit50xRate: 0.64 }, null, 2));

  if (VERIFY_DETERMINISM) {
    console.log('\n=== determinism check (re-running first 2 scenarios) ===');
    for (const s of list.slice(0, 2)) {
      const a = runScenario(s, WEEKS);
      const b = runScenario(s, WEEKS);
      const identical = JSON.stringify(a) === JSON.stringify(b);
      console.log(JSON.stringify({ companyName: s.companyName, identical, aFinalWeek: a.finalWeek, bFinalWeek: b.finalWeek, aListings: a.totalListings, bListings: b.totalListings, aMultiplierSum: a.multipliers.reduce((x, y) => x + y, 0), bMultiplierSum: b.multipliers.reduce((x, y) => x + y, 0) }));
      if (!identical) { console.error(`DETERMINISM FAILURE for ${s.companyName}`); process.exitCode = 1; }
    }
  }
}

module.exports = { scenarios, runScenario, summarize, percentile, BASE_SEED };

if (require.main === module) main();
