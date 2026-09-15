'use strict';

// Founding Route Rebalance Final -- PR B: bounded nationwide chain-scale procurement discount
// for conveni. Structural bug this addresses (independently re-measured against current
// production code, not carried over from the abandoned/discredited PR #653): standard-play
// multi-store expansion picks progressively lower-traffic tenants while merchandise cost stays
// flat, so average margin trended toward zero/negative as store count grew (measured on
// unmodified main: ~11% at 1 store down to ~2% average and briefly negative by 8-11 stores).
//
// js/convenience-merchandising.js already had a per-prefecture "dominant strategy" cluster bonus
// (demand/waste only). This adds a *separate*, nationwide, procurement-cost-only lever:
// chainStoreCountFor() counts open conveni stores nationwide (excluding the store itself), and
// chainScaleDiscountFor() turns that into a bounded, deterministic discount on merchandiseCost
// (CHAIN_SCALE_DISCOUNT_PER_STORE per other open store, capped at CHAIN_SCALE_DISCOUNT_MAX).
// A lone store has zero other stores, so it gets zero discount -- no artificial first-store
// enrichment. This is a structural fix only; js/data.js calibration is out of scope for this PR.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

// ---- 1. unit-level: chainStoreCountFor / chainScaleDiscountFor -----------------------------
{
  const loaded = loadGame({ random: lcg() });
  const merch = loaded.modules.convenienceMerchandising;
  const g = { stores: [
    { id: 's1', businessID: 'conveni', status: 'open' },
    { id: 's2', businessID: 'conveni', status: 'open' },
    { id: 's3', businessID: 'conveni', status: 'closed' }, // closed: must not count
    { id: 's4', businessID: 'gym', status: 'open' },        // other business: must not count
  ] };
  assert.equal(merch.chainStoreCountFor(g, { id: 's1', businessID: 'conveni' }), 1, 'counts only the other OPEN conveni store, excludes closed/other-business stores');
  assert.equal(merch.chainScaleDiscountFor(g, { id: 's1', businessID: 'conveni' }), 1 * merch.CHAIN_SCALE_DISCOUNT_PER_STORE);
  assert.equal(merch.chainScaleDiscountFor({ stores: [] }, { id: 'lone', businessID: 'conveni' }), 0, 'a lone store (no other stores at all) gets zero discount');
}

// ---- 2. bounded: discount saturates at CHAIN_SCALE_DISCOUNT_MAX and never exceeds it --------
{
  const loaded = loadGame({ random: lcg() });
  const merch = loaded.modules.convenienceMerchandising;
  const manyStores = Array.from({ length: 200 }, (_, i) => ({ id: `s${i}`, businessID: 'conveni', status: 'open' }));
  const g = { stores: manyStores };
  const discount = merch.chainScaleDiscountFor(g, manyStores[0]);
  assert.equal(discount, merch.CHAIN_SCALE_DISCOUNT_MAX, 'discount saturates at the explicit cap regardless of how large the chain grows');
  assert.ok(discount <= merch.CHAIN_SCALE_DISCOUNT_MAX, 'discount never exceeds the bound');
}

// ---- 3. no simulation RNG consumed by the chain-scale lever ---------------------------------
{
  let randomCalls = 0;
  const loaded = loadGame({ random: () => { randomCalls += 1; return 0.5; } });
  const merch = loaded.modules.convenienceMerchandising;
  const g = { stores: [{ id: 's1', businessID: 'conveni', status: 'open' }, { id: 's2', businessID: 'conveni', status: 'open' }] };
  const before = randomCalls;
  merch.chainStoreCountFor(g, g.stores[0]);
  merch.chainScaleDiscountFor(g, g.stores[0]);
  assert.equal(randomCalls, before, 'counting existing stores and computing the bounded discount consumes no RNG');
}

// ---- 4. production integration: first store gets zero discount, is unaffected by the feature -
// Funds each store through the real borrowing API (engine.borrow(), the same ledger-recording
// path used elsewhere in this codebase) rather than mutating companyCash directly, so the
// finance ledger stays fully consistent and finance.validate() is a meaningful check here.
// Credit capacity grows with company value, so store openings are paced by advancing weeks
// (borrowing whatever room is available each week) until each one is actually affordable,
// instead of assuming unlimited immediate borrowing.
function openConveniAt(engine, prefID, name, maxRampWeeks = 60) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy && t.prefID === prefID);
  assert.ok(tenant, `precondition: an open tenant exists in ${prefID}`);
  const cost = engine.business('conveni').storeCost + tenant.deposit;
  for (let attempt = 0; attempt <= maxRampWeeks; attempt++) {
    const shortfall = cost - engine.g.companyCash;
    if (shortfall > 0) {
      const room = Math.floor(engine.companyCreditLimit() - engine.g.companyDebt);
      if (room > 0) assert.equal(engine.borrow(Math.min(shortfall, room), 'company'), true, `borrowing available credit room to fund ${name} in ${prefID}`);
    }
    if (engine.g.companyCash >= cost) break;
    assert.ok(attempt < maxRampWeeks, `precondition: ${name} in ${prefID} becomes affordable within ${maxRampWeeks} weeks of ramp-up`);
    engine.advanceWeek(false);
  }
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'conveni', name, operatingHours: 3 }), true);
  return engine.g.stores.at(-1);
}

function runScenario(seed) {
  const loaded = loadGame({ random: lcg(seed) });
  const engine = loaded.ctx.__ct_engine;
  engine.g.configured = true;
  const store1 = openConveniAt(engine, 'tokyo', 'コンビニ1号店');
  while (store1.status !== 'open') engine.advanceWeek(false);
  engine.advanceWeek(false); // settle one week as the sole store before the chain expands
  const soleStoreRow = engine.g.conveniMerchandising.lastWeekByStoreID[store1.id];

  const morePrefs = ['osaka', 'aichi', 'kanagawa'];
  const stores = [store1];
  for (const prefID of morePrefs) stores.push(openConveniAt(engine, prefID, 'コンビニ'));
  while (stores.some(s => s.status !== 'open')) engine.advanceWeek(false);
  // The light 26-week checkpoint window (tests/executive-dismissal-reachability-test.js's
  // pattern) starts once the chain has finished expanding to its target store count.
  for (let i = 0; i < 26 && !engine.g.gameOver; i++) engine.advanceWeek(false);

  const rows = stores.map(s => engine.g.conveniMerchandising.lastWeekByStoreID[s.id]);
  return {
    soleStoreRow, rows, gameOver: engine.g.gameOver, companyCash: engine.g.companyCash,
    financeOk: loaded.modules.finance.validate(engine.g).ok,
  };
}

const result = runScenario(190826041);

assert.equal(result.soleStoreRow.chainStoreCount, 0, 'the sole store sees zero other conveni stores');
assert.equal(result.soleStoreRow.chainScaleDiscount, 0, 'the sole store gets zero chain-scale discount -- first store is not artificially enriched');
assert.equal(result.soleStoreRow.chainScaleSavings, 0, 'zero discount means zero savings for the sole store');

for (const row of result.rows) {
  assert.equal(row.chainStoreCount, result.rows.length - 1, 'once the chain has expanded, every store sees the same nationwide other-store count');
  assert.ok(row.chainScaleDiscount > 0, 'an expanded chain gets a positive discount');
  assert.ok(row.chainScaleDiscount <= 0.12, 'discount stays within the explicit cap in production play');
}

assert.equal(result.gameOver, false, `chain expansion to ${result.rows.length} stores over 26 weeks does not bankrupt the company`);
assert.equal(result.financeOk, true, 'finance ledger stays balanced with the chain-scale discount active');

// ---- 5. determinism: identical seed and actions reproduce byte-identical results ------------
// JSON-string comparison (this codebase's established determinism-check convention, e.g.
// founding-profitability-measure2.js) rather than assert.deepEqual, which treats -0 and 0 as
// unequal -- a floating-point rounding artifact, not a real nondeterminism.
const resultA = runScenario(190826041), resultB = runScenario(190826041);
assert.equal(JSON.stringify(resultA), JSON.stringify(resultB), 'the chain-scale procurement discount is fully deterministic over the same seed and actions');

console.log('convenience chain-scale procurement tests passed');
