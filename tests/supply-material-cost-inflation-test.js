'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

// js/supply.js's createOrder() must scale material purchase price with g.inflation, exactly like
// every other cost line in the game (rent/wage/fixedCost/non-target-business unitCost, all in
// js/engine.js). Before this fix, ramen's actual COGS (js/supply.js, which overrides market.js's
// theoretical variableCost once supply.applyConstraint() runs) never inflated while its revenue
// (js/market.js) did, so an untouched store's profit margin grew without bound over long-run play
// (manual audit: ~35% at year 1 drifting past 70% by year 99, with weekly profit outgrowing weekly
// sales by roughly 2x over the run).
{
  const { modules } = loadGame();
  function state(inflation) {
    const g = modules.engine.createInitialState({ configured: true });
    g.inflation = inflation;
    g.stores.push({ id: 's1', businessID: 'ramen', prefID: 'tokyo', name: 'S', status: 'open', operatingHours: 3, condition: 100 });
    modules.supply.ensureStore(g, g.stores[0]);
    modules.finance.ensureFinance(g);
    return g;
  }

  const g1 = state(1);
  const po1 = modules.supply.createOrder(g1, 's1', 'ramen_noodles', 60, { supplierID: 'balanced_wholesale' });
  assert.ok(po1, 'baseline order must succeed');

  const g2 = state(2.5);
  const po2 = modules.supply.createOrder(g2, 's1', 'ramen_noodles', 60, { supplierID: 'balanced_wholesale' });
  assert.ok(po2, 'inflated order must succeed');
  // Both states start at week 0 with the same supplier/material, so the deterministic price
  // volatility term (hash01 of week+supplier+material) is identical between po1 and po2 -- the
  // only thing that should differ is the inflation factor itself.
  assert.equal(po1.orderWeek, po2.orderWeek, 'both orders must be placed in the same week to isolate the inflation factor');
  // createOrder() rounds unitCost to the nearest 0.01 yen (see r() in js/supply.js), so comparing
  // against po1.unitCost*2.5 (itself already rounded once) needs a cent-level tolerance rather
  // than exact equality.
  assert.ok(
    Math.abs(po2.unitCost - po1.unitCost * 2.5) < 0.01,
    `material unit cost must scale with g.inflation (got ${po1.unitCost} at inflation=1, ${po2.unitCost} at inflation=2.5, expected ~${po1.unitCost * 2.5})`
  );

  const g3 = state(1);
  const po3 = modules.supply.createOrder(g3, 's1', 'ramen_noodles', 60, { supplierID: 'balanced_wholesale' });
  assert.equal(po3.unitCost, po1.unitCost, 'two orders at the same inflation/week/supplier must be priced identically (sanity check on the test setup itself)');

  console.log('supply material cost inflation: createOrder() unit price scales exactly with g.inflation');
}

// End-to-end regression guard: an unattended, never-reinvested ramen store must not show its
// profit margin drift open-endedly over a multi-decade run -- COGS (supply.js, via the automatic
// weekly supply.autoOrder()) and revenue (market.js) must inflate at comparable rates. Uses the
// same isolated-core + one-time raw cash injection pattern as tests/long-run-test.js (documented
// there as not a balance test).
{
  // Averaging the margin over years 6-10 across three seeds (the original seed plus two fixed in
  // advance) replaces a single week's value: a single week varied by seed alone from 18.7% to
  // 37.2% on main (#731 moved the simulation onto the save-held stream, which changed the path).
  // Measured (this metric, these seeds): main 32.8%, #731 PR3 34.3%, and with the material price
  // inflation removed from supply.createOrder() (the pre-fix behaviour) 39.8%.
  // Over 25 years the margin still rises on main as well; that is tracked separately in #766.
  const SEEDS = [0x51a17e01, 101, 202];
  const WEEKS = 520; // ~10 years, same scale as tests/long-run-test.js.
  const averages = SEEDS.map(seed => {
    let s = seed >>> 0;
    const random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
    const { engineModule } = loadGame({ isolatedLegacyIndex: true, random });
    const e = new engineModule.TycoonEngine();
    e.configure({ playerName: 'Idle', companyName: 'Idle Co', difficulty: 'normal', scenario: 'free', founderPrefID: 'tokyo', founderTraitID: 'merchant' });
    e.g.companyCash += 1_000_000_000;
    const tenant = e.g.tenants.find(t => t.prefID === 'tokyo' && t.businessID === 'ramen' && !t.occupiedBy);
    assert.ok(e.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'Idle Ramen', operatingHours: 3 }), 'store must open');
    const margins = [];
    for (let i = 0; i < WEEKS && !e.g.gameOver; i++) {
      e.advanceWeek(false);
      if (i >= WEEKS - 260) { const st = e.g.stores[0]; margins.push(st.lastProfit / st.lastSales); }
    }
    assert.ok(!e.g.gameOver, `seed ${seed}: the idle store must not go bankrupt over the run`);
    const store = e.g.stores[0];
    assert.ok(Number.isFinite(store.lastSales) && store.lastSales > 0, `seed ${seed}: store must still be trading`);
    assert.ok(margins.every(Number.isFinite), `seed ${seed}: every weekly margin is finite`);
    return margins.reduce((a, b) => a + b, 0) / margins.length;
  });
  const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
  assert.ok(
    mean < 0.36,
    `unattended-store margin must not drift upward with inflation (years 6-10 average across seeds ${(mean * 100).toFixed(1)}%: ` +
    `${averages.map(x => (x * 100).toFixed(1)).join(' / ')}; without the material price inflation it measured 39.8%)`
  );
  console.log(`supply material cost inflation: unattended ramen store margin, years 6-10 average across ${SEEDS.length} seeds ${(mean * 100).toFixed(1)}% (${averages.map(x => (x * 100).toFixed(1)).join(' / ')})`);
}
