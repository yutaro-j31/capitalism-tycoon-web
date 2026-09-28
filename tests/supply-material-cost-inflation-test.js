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
// profit margin drift open-endedly over a 25-year production run. Revenue, material COGS, payroll,
// fixed cost, post-year-one contract rent and repair expense must remain on comparable nominal
// inflation bases. This intentionally runs the real advanceWeek() composition rather than a
// detached formula so future store-cost changes cannot silently reopen #766.
{
  // Two fixed seeds keep the test multi-path while limiting canonical CI cost. The previous
  // 10-year guard could pass while margins accelerated during years 11-25, so compare five-year
  // averages from years 6-10 and years 21-25 instead of one week or one early window.
  const SEEDS = [0x51a17e01, 101];
  const WEEKS = 1300; // 25 years at the game's 52-week year.
  const WINDOW = 260; // five years.
  const runs = SEEDS.map(seed => {
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
      const st = e.g.stores[0];
      margins.push(st.lastProfit / st.lastSales);
    }
    assert.ok(!e.g.gameOver, `seed ${seed}: the idle store must not go bankrupt over the run`);
    const store = e.g.stores[0];
    assert.ok(Number.isFinite(store.lastSales) && store.lastSales > 0, `seed ${seed}: store must still be trading`);
    assert.equal(margins.length, WEEKS, `seed ${seed}: full 25-year margin history is required`);
    assert.ok(margins.every(Number.isFinite), `seed ${seed}: every weekly margin is finite`);
    const early = margins.slice(260, 520);
    const late = margins.slice(WEEKS - WINDOW);
    const average = rows => rows.reduce((a, b) => a + b, 0) / rows.length;
    return { seed, early: average(early), late: average(late), inflation: e.g.inflation };
  });
  const mean = key => runs.reduce((a, row) => a + row[key], 0) / runs.length;
  const earlyMean = mean('early'), lateMean = mean('late');
  assert.ok(
    lateMean < 0.40,
    `unattended-store late margin must stay bounded (years 21-25 mean ${(lateMean * 100).toFixed(1)}%: ${runs.map(x => (x.late * 100).toFixed(1)).join(' / ')})`
  );
  assert.ok(
    lateMean - earlyMean < 0.04,
    `unattended-store margin must not structurally climb with inflation (years 6-10 ${(earlyMean * 100).toFixed(1)}% -> years 21-25 ${(lateMean * 100).toFixed(1)}%; per seed ${runs.map(x => `${(x.early * 100).toFixed(1)}->${(x.late * 100).toFixed(1)}`).join(' / ')})`
  );
  assert.ok(
    runs.every(row => row.late < 0.43),
    `no seed may retain the old 40%+ runaway tail (${runs.map(x => `seed ${x.seed}: ${(x.late * 100).toFixed(1)}%`).join(' / ')})`
  );
  console.log(
    `supply material cost inflation: unattended ramen years 6-10 ${(earlyMean * 100).toFixed(1)}% -> years 21-25 ${(lateMean * 100).toFixed(1)}%; ` +
    runs.map(x => `seed ${x.seed} ${(x.early * 100).toFixed(1)}->${(x.late * 100).toFixed(1)}% inflation ${x.inflation.toFixed(3)}`).join(' / ')
  );
}
