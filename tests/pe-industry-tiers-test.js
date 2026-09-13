'use strict';

// PE mode T11 (docs/PE_MODE_TASKS.md): industry tiers and deterministic annual deal supply.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/store-market-environment.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/completion.js', '../js/pe-fund.js', '../js/pe-industry-tiers.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pf: modules.peFund, tiers: modules.peIndustryTiers };
}
const { TycoonEngine, pf, tiers } = load();

// 1. Exactly 4 tiers, matching the design doc's §15 table numbers.
{
  assert.equal(tiers.TIER_IDS.length, 4);
  assert.equal(tiers.TIERS.pillar.acquisitionMultiple, 8.0);
  assert.equal(tiers.TIERS.pillar.leverage, 3.5);
  assert.equal(tiers.TIERS.pillar.skillMultiplier, .28);
  assert.deepEqual(tiers.TIERS.pillar.businessIDs, ['ramen', 'conveni', 'gym', 'realEstateAgency', 'productVentures']);
  assert.equal(tiers.TIERS.smallSuccession.skillMultiplier, .04);
  assert.deepEqual(tiers.TIERS.smallSuccession.exitOptions, ['sale']);
  assert.equal(tiers.TIERS.midCap.acquisitionMultiple, 7.0);
  assert.equal(tiers.TIERS.largeCap.sizeMax, 400_000_000_000);
}

// 2. Completion criterion: which tiers a fund can play changes with its scale, matching the
// design doc's own illustrative table (§15): Fund I (28億) -> smallSuccession + pillar;
// 132億 -> midCap + pillar (smallSuccession no longer fits); 810億 -> midCap + largeCap + pillar.
function fundWithScore(size, score) {
  const e = new TycoonEngine();
  return pf.createFund(e.g, { size, y0: 1, terms: pf.fundTermsForScore(score) });
}
{
  const fundI = fundWithScore(2_811_000_000, 5);
  const eligibleI = new Set(tiers.eligibleTiers(fundI));
  assert.ok(eligibleI.has('pillar'), 'Fund I must be able to play the 5-pillar tier');
  assert.ok(eligibleI.has('smallSuccession'), 'Fund I must be able to play small-succession deals');
  assert.ok(!eligibleI.has('midCap'), 'Fund I must not yet reach mid-cap');
  assert.ok(!eligibleI.has('largeCap'));
}
{
  const fund2 = fundWithScore(13_200_000_000, 35);
  const eligible2 = new Set(tiers.eligibleTiers(fund2));
  assert.ok(eligible2.has('pillar'));
  assert.ok(eligible2.has('midCap'), '132億 fund must reach mid-cap');
  assert.ok(!eligible2.has('smallSuccession'), 'small-succession no longer fits a 132億 fund (設計書: 以降は規模が合わなくなる)');
  assert.ok(!eligible2.has('largeCap'));
}
{
  const fund3 = fundWithScore(81_000_000_000, 60);
  const eligible3 = new Set(tiers.eligibleTiers(fund3));
  assert.ok(eligible3.has('pillar'));
  assert.ok(eligible3.has('midCap'));
  assert.ok(eligible3.has('largeCap'), '810億 fund must reach large-cap');
  assert.ok(!eligible3.has('smallSuccession'));
}
{
  assert.deepEqual(tiers.eligibleTiers(null), []);
  const empty = fundWithScore(0, 5);
  assert.deepEqual(tiers.eligibleTiers(empty), []);
}

// 3. Completion criterion: supply floor -- generateAnnualDeals ALWAYS returns exactly
// DEALS_PER_YEAR (4), regardless of how extreme the market condition is (数は市況で変わらない).
{
  for (const economy of [.5, .72, 1, 1.28, 2, 0]) {
    const e = new TycoonEngine();
    e.g.economy = economy;
    const deals = tiers.generateAnnualDeals(e.g, 1);
    assert.equal(deals.length, tiers.DEALS_PER_YEAR);
    assert.equal(deals.length, 4);
  }
}

// 4. Market condition changes quality/price, not count: a booming economy must produce a
// higher average priceLevel than a depressed one, and distressed must flip accordingly.
{
  const e = new TycoonEngine();
  e.g.economy = 1.28;
  const boom = tiers.generateAnnualDeals(e.g, 5);
  e.g.economy = .72;
  const bust = tiers.generateAnnualDeals(e.g, 5);
  assert.ok(boom[0].priceLevel > bust[0].priceLevel, `boom priceLevel ${boom[0].priceLevel} must exceed bust ${bust[0].priceLevel}`);
  assert.equal(boom[0].distressed, false);
  assert.equal(bust[0].distressed, true);
  // The tier/size assignment itself is economy-independent (deterministic on year/index only).
  assert.equal(boom[0].tierID, bust[0].tierID);
  assert.equal(boom[0].enterpriseValue, bust[0].enterpriseValue);
}

// 5. Determinism: same year -> identical deal set across repeated calls, independent of which
// engine instance or personalCash/companyCash state calls it (pure function of year/index/economy).
{
  const e1 = new TycoonEngine();
  e1.g.economy = 1;
  const run1 = tiers.generateAnnualDeals(e1.g, 12);
  const e2 = new TycoonEngine();
  e2.g.economy = 1;
  e2.g.personalCash = 999_999_999;
  const run2 = tiers.generateAnnualDeals(e2.g, 12);
  assert.deepEqual(run1, run2);
  const run3 = tiers.generateAnnualDeals(e1.g, 12);
  assert.deepEqual(run1, run3, 'calling twice on the same state must also agree');
}

// 6. Different years/indices produce different deals (not a constant).
{
  const e = new TycoonEngine();
  e.g.economy = 1;
  const y1 = tiers.generateAnnualDeals(e.g, 1);
  const y2 = tiers.generateAnnualDeals(e.g, 2);
  assert.notDeepEqual(y1, y2);
  const ids = new Set(y1.map(d => d.id));
  assert.equal(ids.size, 4, 'the 4 deals within one year must have distinct ids');
}

// 6b. Regression: pickTierID must not collapse onto a single tier for a whole year's deals.
// (The 4 deals only differ by a small sequential index (0..3); an earlier bug used
// Math.floor(unit()*N), whose fractional step from that index alone is too small relative to
// the FNV prime/32-bit-range ratio to reliably cross a bucket boundary -- verified over a
// 200-year sample to always collapse under that formula. hash()%N does not.)
{
  const e = new TycoonEngine();
  e.g.economy = 1;
  let collapsedYears = 0;
  for (let year = 1; year <= 200; year++) {
    const tierIDs = new Set(tiers.generateAnnualDeals(e.g, year).map(d => d.tierID));
    if (tierIDs.size === 1) collapsedYears++;
  }
  assert.equal(collapsedYears, 0, `pickTierID must not collapse all 4 deals onto one tier in any of 200 sampled years, got ${collapsedYears}`);
}

// 7. Each generated deal's enterpriseValue falls within its assigned tier's stated range.
{
  const e = new TycoonEngine();
  e.g.economy = 1;
  for (let year = 1; year <= 20; year++) {
    for (const deal of tiers.generateAnnualDeals(e.g, year)) {
      const t = tiers.TIERS[deal.tierID];
      assert.ok(deal.enterpriseValue >= t.sizeMin && deal.enterpriseValue <= t.sizeMax, `deal ${deal.id} EV ${deal.enterpriseValue} out of ${deal.tierID} range [${t.sizeMin},${t.sizeMax}]`);
      if (deal.businessID) assert.ok(t.businessIDs.includes(deal.businessID));
      else assert.equal(t.businessIDs.length, 0, `${deal.tierID} deals must never carry a null businessID if the tier itself has candidates`);
    }
  }
}

// 8. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-industry-tiers.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe industry tiers tests passed');
