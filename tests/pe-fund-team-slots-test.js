'use strict';

// PE mode T9 (docs/PE_MODE_TASKS.md): team headcount and deal-slot capacity, both derived
// purely from a fund's own locked-in size/terms.fee (no live global state needed).

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

function fundWithScore(size, score) {
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size, y0: 1, terms: pf.fundTermsForScore(score) });
  return fund;
}

// 1. Completion criterion (design doc §4 table): score5/28.11億-scale fund -> team 2人,
// slots within the stated "2〜3件" band.
{
  const fund = fundWithScore(2_811_000_000, 5);
  assert.equal(pf.teamCapacity(fund), 2, `Fund I (score5) team must be 2, got ${pf.teamCapacity(fund)}`);
  const slots = pf.slotCapacity(fund);
  assert.ok(slots >= 2 && slots <= 3, `Fund I slots must be in [2,3], got ${slots}`);
}

// 2. score35/132億-scale fund -> team 12人 (design doc §4 table), slots within "4〜6件".
{
  const fund = fundWithScore(13_200_000_000, 35);
  assert.equal(pf.teamCapacity(fund), 12, `132億 fund (score35) team must be 12, got ${pf.teamCapacity(fund)}`);
  const slots = pf.slotCapacity(fund);
  assert.ok(slots >= 4 && slots <= 6, `132億 fund slots must be in [4,6], got ${slots}`);
}

// 3. score60/810億-scale fund -> team capped at 60 (design doc's stated cap), slots at the
// absolute ceiling of 8.
{
  const fund = fundWithScore(81_000_000_000, 60);
  assert.equal(pf.teamCapacity(fund), 60, `810億 fund (score60) team must be capped at 60, got ${pf.teamCapacity(fund)}`);
  assert.equal(pf.slotCapacity(fund), 8);
}

// 4. Completion criterion / 設計書§9 失敗6: even an enormous fund never exceeds the 60-person
// cap, despite the raw (uncapped) computation implying far more.
{
  const fund = fundWithScore(5_000_000_000_000, 85); // 5兆円, the fund-size absolute ceiling
  const rawUncapped = Math.floor(fund.size * fund.terms.fee / pf.MANAGEMENT_FEE_PER_HEAD);
  assert.ok(rawUncapped > pf.TEAM_CAP, 'sanity: the raw computation must exceed the cap for this to be a meaningful test');
  assert.equal(pf.teamCapacity(fund), 60);
  assert.equal(pf.slotCapacity(fund), 8, 'slots must also stay at the absolute ceiling, not grow with fund size once team is capped');
}

// 5. slotCapacity is monotonically non-decreasing in team size (staircase 2 -> 4 -> 6 -> 8;
// see docs/PE_MODE_TASKS.md T9).
{
  const sizes = [500_000_000, 2_000_000_000, 10_000_000_000, 30_000_000_000, 100_000_000_000, 1_000_000_000_000];
  let prevSlots = 0;
  for (const size of sizes) {
    const fund = fundWithScore(size, 40);
    const slots = pf.slotCapacity(fund);
    assert.ok(slots >= prevSlots, `slotCapacity must be non-decreasing as fund size grows: ${prevSlots} -> ${slots} at size ${size}`);
    assert.ok(slots >= 1 && slots <= pf.SLOT_CAP_ABSOLUTE);
    prevSlots = slots;
  }
}

// 6. A fund too small to clear even one MIN_TICKET_PER_DEAL still gets at least 1 slot (a
// fund must always be able to do SOMETHING), and maxSingleDealSize scales with fund size.
{
  const fund = fundWithScore(50_000_000, 5);
  assert.equal(pf.slotCapacity(fund), 1);
  assert.ok(Math.abs(pf.maxSingleDealSize(fund) - 12_500_000) < 1e-6);
}
{
  const fund = fundWithScore(0, 5);
  assert.equal(pf.slotCapacity(fund), 0);
  assert.equal(pf.teamCapacity(fund), 0);
}

// 7. Completion criterion: attention (team/deals) below 1 measurably reduces
// attentionMultiplier; at or above 1 it stays at its ceiling (no unbounded upside from an
// oversized team relative to a single deal).
{
  const fund = fundWithScore(13_200_000_000, 35); // team 12
  fund.deals = [{ id: 'd1' }];
  const ratioOneDeal = pf.attentionRatio(fund);
  const multOneDeal = pf.attentionMultiplier(fund);
  fund.deals = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}` })); // dilute far below 1/deal
  const ratioManyDeals = pf.attentionRatio(fund);
  const multManyDeals = pf.attentionMultiplier(fund);
  assert.ok(ratioManyDeals < ratioOneDeal);
  assert.ok(multManyDeals < multOneDeal, `attentionMultiplier must drop when attention is diluted: ${multOneDeal} -> ${multManyDeals}`);
  assert.ok(multOneDeal <= 1 && multManyDeals >= .5, 'multiplier must stay within its designed [.5, 1] band');
}
{
  // exited deals do not count toward attention dilution.
  const fund = fundWithScore(13_200_000_000, 35);
  fund.deals = [{ id: 'd1', status: 'exited' }, { id: 'd2', status: 'exited' }];
  assert.equal(pf.activeDealCount(fund), 0);
  assert.equal(pf.attentionMultiplier(fund), 1);
}

// 8. Holding-period optimum: fund index 0 (Fund I) -> 4 years; any later fund -> 3 years
// (design doc §2/§4).
{
  assert.equal(pf.optimalHoldWeeks(0), 208);
  assert.equal(pf.optimalHoldWeeks(1), 156);
  assert.equal(pf.optimalHoldWeeks(4), 156);
}

// 9. Safe on a null/absent fund.
{
  assert.equal(pf.teamCapacity(null), 0);
  assert.equal(pf.slotCapacity(null), 0);
  assert.equal(pf.maxSingleDealSize(null), 0);
  assert.equal(pf.attentionMultiplier(null), 1);
}

// 10. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-fund.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe fund team/slot tests passed');
