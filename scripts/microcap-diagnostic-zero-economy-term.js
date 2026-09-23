'use strict';
// TEMPORARY DIAGNOSTIC SCRIPT -- not a committed test, not a calibration change. Re-runs the same
// 3 scenarios from the microcap-recalibration-probe.js preliminary trial, with the
// `(this.g.economy-1)*.018` term in js/engine.js's updateMarket() (line 1524) temporarily zeroed
// IN MEMORY ONLY, to test the hypothesis that docs/MICROCAP_MODE_DESIGN.md SS4.1's targets were
// produced by a standalone model that did not include macro-economy influence on stock price
// movement.
//
// The patch is applied by intercepting fs.readFileSync for js/engine.js's specific path only,
// for the duration of this script's run, then restoring the original fs.readFileSync. The file
// on disk (js/engine.js) is never written to. No production parameter (js/microcap-listings.js's
// ARCHETYPES etc.) is touched.
//
// CONCLUSION: rejected. Zeroing the term moved every measured statistic further from the design
// doc's SS4.1 targets, not closer (see the investigation report SS3 for the numbers) -- the macro
// economy cycle is not the cause of the mismatch. The real cause turned out to be that SS4.1's
// original target numbers never recorded which holding/selling rule they assumed (see
// microcap-diagnostic-holding-rules.js and microcap-diagnostic-next-listing-rule.js), not
// anything in this term.
const fs = require('node:fs');
const path = require('node:path');
const { scenarios, runScenario, summarize } = require('./microcap-recalibration-probe');

const ENGINE_PATH = path.resolve(__dirname, '..', 'js', 'engine.js');
const ORIGINAL_TERM = '(this.g.economy-1)*.018';
const PATCHED_TERM = '(0)*.018';
const WEEKS = 1560;
const SEED_COUNT = 3;

function withEconomyTermZeroed(fn) {
  const originalReadFileSync = fs.readFileSync;
  let patchedOnce = false;
  fs.readFileSync = function (file, ...args) {
    const content = originalReadFileSync.call(fs, file, ...args);
    if (typeof file === 'string' && path.resolve(file) === ENGINE_PATH) {
      const text = content.toString('utf8');
      const occurrences = text.split(ORIGINAL_TERM).length - 1;
      if (occurrences !== 1) throw new Error(`expected exactly 1 occurrence of "${ORIGINAL_TERM}" in js/engine.js, found ${occurrences} -- refusing to patch ambiguously`);
      patchedOnce = true;
      return text.split(ORIGINAL_TERM).join(PATCHED_TERM);
    }
    return content;
  };
  try {
    const result = fn();
    if (!patchedOnce) throw new Error('js/engine.js was never read through the patched fs.readFileSync -- the economy term was not actually zeroed');
    return result;
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
}

function main() {
  const list = scenarios(SEED_COUNT);
  console.log(`=== diagnostic: same ${SEED_COUNT} scenarios x ${WEEKS} weeks, with (economy-1)*.018 zeroed in-memory only ===`);
  const runs = withEconomyTermZeroed(() => list.map(s => {
    const t = Date.now();
    const r = runScenario(s, WEEKS);
    console.log(JSON.stringify({ companyName: s.companyName, lcgSeed: s.lcgSeed, elapsedMs: Date.now() - t, finalWeek: r.finalWeek, totalListings: r.totalListings, signalProfitableListings: r.signalProfitableListings }));
    return r;
  }));

  console.log('\n=== multiplier distribution WITH economy term zeroed (pooled, signal-profitable listings only) ===');
  console.log(JSON.stringify(summarize(runs), null, 2));

  console.log('\n=== for reference: design doc SS4.1 targets ===');
  console.log(JSON.stringify({ median: 1.11, p90: 5.7, p99: 44.9, hit10xRate: 0.056, hit50xRate: 0.0085, neverHit50xRate: 0.64 }, null, 2));
}

main();
