'use strict';

// PE mode T7 (docs/PE_MODE_TASKS.md): DPI/IRR and the next-fund formation gate. No
// deal-financing mechanic exists yet (state.peFirm.funds[].deals is only ever populated by a
// later task's real acquisition flow), so these tests seed synthetic deal/distribution
// figures directly on a fund, exactly as js/pe-fund.js's own header says a test should.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/completion.js', '../js/pe-fund.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pf: modules.peFund };
}
const { TycoonEngine, pf } = load();

function fundWith(size, investedAmount, cash, distributed) {
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size, y0: 1 });
  if (investedAmount > 0) fund.deals.push({ id: 'd1', investedAmount });
  fund.cash = cash;
  fund.distributed = distributed;
  return { e, fund };
}

// 1. DPI = distributed / contributed (size, since T5 calls the full size upfront).
{
  const { fund } = fundWith(1_000_000_000, 900_000_000, 100_000_000, 1_500_000_000);
  assert.ok(Math.abs(pf.fundDPI(fund) - 1.5) < 1e-9);
  assert.ok(Math.abs(pf.fundContributed(fund) - 1_000_000_000) < 1e-9);
  assert.ok(Math.abs(pf.fundDeployed(fund) - 900_000_000) < 1e-9);
  assert.ok(Math.abs(pf.fundDeploymentRate(fund) - .9) < 1e-9);
}
{
  const { fund } = fundWith(500_000_000, 0, 500_000_000, 0);
  assert.equal(pf.fundDPI(fund), 0, 'a fund with nothing distributed yet has DPI 0');
  assert.equal(pf.fundDeploymentRate(fund), 0);
}

// 2. fundIRR is positive when DPI>1 over a positive holding period, negative when DPI<1, and
// approaches 0 as the fund approaches a 1.0x DPI.
{
  const { fund: winner } = fundWith(1_000_000_000, 1_000_000_000, 0, 2_000_000_000);
  const { fund: loser } = fundWith(1_000_000_000, 1_000_000_000, 0, 500_000_000);
  const { fund: flat } = fundWith(1_000_000_000, 1_000_000_000, 0, 1_000_000_000);
  assert.ok(pf.fundIRR(winner, winner.y0 + 260) > 0, 'a fund that returned 2x must have positive IRR');
  assert.ok(pf.fundIRR(loser, loser.y0 + 260) < 0, 'a fund that returned 0.5x must have negative IRR');
  assert.ok(Math.abs(pf.fundIRR(flat, flat.y0 + 260)) < 1e-6, 'a fund that exactly returned its capital must have ~0 IRR');
}

// 3. Completion criterion: next-fund formation requires BOTH DPI>=1.2 AND deployment>=80% --
// each condition alone is not enough.
{
  const cases = [
    { dpi: 1.5, deployment: .9, expected: true, label: 'both conditions met' },
    { dpi: 1.5, deployment: .3, expected: false, label: 'good DPI but low deployment' },
    { dpi: 1.0, deployment: .95, expected: false, label: 'high deployment but DPI below 1.2' },
    { dpi: 1.2, deployment: .8, expected: true, label: 'exactly at both thresholds' },
  ];
  for (const c of cases) {
    const { e, fund } = fundWith(1_000_000_000, c.deployment * 1_000_000_000, (1 - c.deployment) * 1_000_000_000, c.dpi * 1_000_000_000);
    pf.evaluateFund(e.g, fund.id, fund.y0 + pf.INVESTMENT_PERIOD_WEEKS);
    assert.equal(pf.canFormNextFund(e.g), c.expected, `${c.label}: dpi=${c.dpi} deployment=${c.deployment}`);
  }
}

// 4. Completion criterion: deployment below 80% withholds the track-record credit even when
// DPI is good, but at/above 80% it is added.
{
  const { e: eLow, fund: fundLow } = fundWith(1_000_000_000, 300_000_000, 700_000_000, 1_400_000_000);
  const before = eLow.g.peFirm.trackRecord.exits.length;
  const resultLow = pf.evaluateFund(eLow.g, fundLow.id, fundLow.y0 + pf.INVESTMENT_PERIOD_WEEKS);
  assert.equal(resultLow.trackRecordAdded, false);
  assert.equal(eLow.g.peFirm.trackRecord.exits.length, before, 'low deployment must not add a track-record entry');

  const { e: eHigh, fund: fundHigh } = fundWith(1_000_000_000, 900_000_000, 100_000_000, 1_400_000_000);
  const resultHigh = pf.evaluateFund(eHigh.g, fundHigh.id, fundHigh.y0 + pf.INVESTMENT_PERIOD_WEEKS);
  assert.equal(resultHigh.trackRecordAdded, true);
  assert.equal(eHigh.g.peFirm.trackRecord.exits.length, 1, 'sufficient deployment must add a track-record entry');
  assert.equal(eHigh.g.peFirm.trackRecord.exits[0].exitType, 'fund');
}

// 5. Undeployed capital returned at par (1.0x) does not, by itself, drag DPI down below what
// the deployed portion alone would have produced -- returning it is DPI-neutral, not harmful.
{
  // Fund A: 100% deployed, that capital returns exactly 1.0x -> DPI 1.0.
  const { fund: fullyDeployed } = fundWith(1_000_000_000, 1_000_000_000, 0, 1_000_000_000);
  // Fund B: only 50% deployed (at the same 1.0x on the deployed part), the other 50% is
  // returned undeployed at par -- blended DPI must still be 1.0, not lower.
  const { fund: halfDeployed } = fundWith(1_000_000_000, 500_000_000, 0, 1_000_000_000);
  assert.ok(Math.abs(pf.fundDPI(fullyDeployed) - pf.fundDPI(halfDeployed)) < 1e-9, 'returning undeployed capital at par must not lower DPI relative to full deployment at the same multiple');
}

// 6. LP trust multiplier tiers exactly match the design doc's thresholds, and stays neutral
// (1) before any fund has been evaluated.
{
  const e = new TycoonEngine();
  assert.equal(pf.lpTrustMultiplier(e.g), 1, 'no evaluated fund yet must be neutral');
  for (const [dpi, expected] of [[1.5, 1.12], [1.2, 1.12], [1.1, .80], [1.0, .80], [.8, .55], [0, .55]]) {
    const { e: e2, fund } = fundWith(1_000_000_000, 1_000_000_000, 0, dpi * 1_000_000_000);
    pf.evaluateFund(e2.g, fund.id, fund.y0 + pf.INVESTMENT_PERIOD_WEEKS);
    assert.equal(pf.lpTrustMultiplier(e2.g), expected, `dpi ${dpi} must map to trust multiplier ${expected}`);
  }
}

// 7. A good next fund raises formableFundSize via the LP trust multiplier (completion
// criterion: "実績が出ると次号が組成でき、規模が伸びる"). Uses a fund whose deployment is
// BELOW 80% (so the track-record credit -- and therefore trackRecord.score -- is untouched;
// see scenario 4) to isolate the trust-multiplier effect from a score change, since a score
// recompute from a first-ever exit would otherwise confound the comparison.
{
  const { e, fund } = fundWith(1_000_000_000, 500_000_000, 500_000_000, 1_500_000_000);
  e.g.personalCash = 1_000_000_000;
  const scoreBefore = e.g.peFirm.trackRecord.score;
  const sizeBefore = pf.formableFundSize(e.g);
  const result = pf.evaluateFund(e.g, fund.id, fund.y0 + pf.INVESTMENT_PERIOD_WEEKS);
  assert.equal(result.trackRecordAdded, false, 'sanity: deployment is below 80% here, so score must not change');
  assert.equal(e.g.peFirm.trackRecord.score, scoreBefore);
  const sizeAfter = pf.formableFundSize(e.g);
  assert.ok(sizeAfter > sizeBefore, 'a DPI>=1.2 evaluation must raise the next formable fund size via the trust multiplier alone');
  assert.ok(Math.abs(sizeAfter / sizeBefore - 1.12) < 1e-9);
}

// 7b. When a fund clears BOTH thresholds, the next fund can actually be formed AND its
// ceiling grows, matching the completion criterion in full (score built from two realistic
// prior personal exits, so this fund's own evaluation adds to it rather than resetting it).
{
  const e = new TycoonEngine();
  e.g.personalCash = 1_000_000_000;
  pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 400_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 200, profitableWeekStreak: 150, employeeCount: 30 });
  pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 300_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 150, profitableWeekStreak: 120, employeeCount: 25 });
  const scoreBefore = e.g.peFirm.trackRecord.score;
  assert.ok(scoreBefore > 15, 'two solid prior exits must already exceed the first-exit ceiling');
  const fund = pf.createFund(e.g, { size: 1_000_000_000, y0: 400 });
  fund.deals.push({ id: 'd1', investedAmount: 900_000_000 });
  fund.cash = 100_000_000;
  fund.distributed = 1_500_000_000;
  const sizeBefore = pf.formableFundSize(e.g);
  pf.evaluateFund(e.g, fund.id, fund.y0 + pf.INVESTMENT_PERIOD_WEEKS);
  assert.equal(pf.canFormNextFund(e.g), true);
  assert.ok(e.g.peFirm.trackRecord.score >= scoreBefore, 'a good fund evaluation must not lower an already-built track record');
  assert.ok(pf.formableFundSize(e.g) > sizeBefore, 'the next fund ceiling must grow after a fund that clears both thresholds');
}

// 8. evaluateFund updates trackRecord.realizedDPI and is safe to call for an unknown fund id.
{
  const e = new TycoonEngine();
  assert.equal(pf.evaluateFund(e.g, 'does-not-exist', 100), null);
  const { e: e2, fund } = fundWith(1_000_000_000, 1_000_000_000, 0, 1_300_000_000);
  pf.evaluateFund(e2.g, fund.id, fund.y0 + pf.INVESTMENT_PERIOD_WEEKS);
  assert.ok(Math.abs(e2.g.peFirm.trackRecord.realizedDPI - 1.3) < 1e-9);
}

// 9. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-fund.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe fund DPI/next-fund tests passed');
