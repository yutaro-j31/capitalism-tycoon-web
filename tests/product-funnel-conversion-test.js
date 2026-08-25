'use strict';

// productVentures.conversionRate is a persistent week-over-week accumulator
// (`f.conversionRate += (quality - CONVERSION_QUALITY_NEUTRAL) / 52000`), unlike churnRate
// which is recomputed fresh from quality every week with no memory. A freshly-launched product
// starts at quality 20 and, even under sustained heavy investment, took roughly 90-100 weeks to
// cross the old neutral point of 50 in a real 208-week playtest -- so for close to half of a
// playthrough conversionRate eroded every single week regardless of how well the product was
// actually run, and the remaining weeks were spent clawing back what had been lost rather than
// growing toward the .18 ceiling. js/expansion.js now centers the neutral point on the
// product's actual starting quality (20) instead of an arbitrary, distant 50.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 909) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newProduct(engine, overrides = {}) {
  const product = {
    id: 'conv-test-product', blueprintID: 'app', name: 'テストSaaS', category: 'SaaS', status: 'released',
    progress: 100, quality: 20, brand: 30, users: 500, paidUsers: 5, price: 1200,
    serverCost: 20000, serverCapacity: 25000, market: 90000, risk: .13,
    valuation: 6_000_000, revenue: 0, cost: 0, profit: 0, releaseWeek: 1,
    ...overrides
  };
  engine.g.productVentures.push(product);
  return product;
}

function withEngine(seed = 909) {
  const loaded = loadGame({ random: lcg(seed), headless: true });
  const e = new loaded.engineModule.TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 200_000_000;
  return { loaded, e, expansion: loaded.modules.expansion };
}

// 1. The constant is exported and matches the product's actual launch quality (js/engine.js
// launchProduct() hardcodes quality:20).
{
  const { expansion } = withEngine();
  assert.equal(expansion.CONVERSION_QUALITY_NEUTRAL, 20);
  const engineSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'engine.js'), 'utf8');
  assert.match(engineSource, /quality:20,/, '前提: launchProductの初期qualityは20のまま');
}

// 2. At exactly the neutral quality, conversionRate holds steady week over week (no erosion at
// launch-quality, unlike the old neutral=50 which guaranteed erosion for a freshly-launched
// product).
{
  const { e } = withEngine();
  const product = newProduct(e, { quality: 20 });
  const funnel = e.ensureProductFunnel(product);
  const before = funnel.conversionRate;
  e.g.week = 2; e.updateProductFunnelsWeekly();
  e.g.week = 3; e.updateProductFunnelsWeekly();
  e.g.week = 4; e.updateProductFunnelsWeekly();
  assert.equal(e.g.productFunnels[product.id].conversionRate, before, '発売時点の品質(20)ではconversionRateは変化しない');
}

// 3. Above-neutral quality grows conversionRate; below-neutral quality still erodes it (the
// asymmetric penalty is preserved, just recentered on a realistic starting point).
{
  const { e: eHigh } = withEngine();
  const highProduct = newProduct(eHigh, { quality: 80 });
  const beforeHigh = eHigh.ensureProductFunnel(highProduct).conversionRate;
  eHigh.g.week = 2; eHigh.updateProductFunnelsWeekly();
  assert.ok(eHigh.g.productFunnels[highProduct.id].conversionRate > beforeHigh, '中立点より高い品質ではconversionRateが伸びる');

  const { e: eLow } = withEngine();
  const lowProduct = newProduct(eLow, { quality: 5 });
  const beforeLow = eLow.ensureProductFunnel(lowProduct).conversionRate;
  eLow.g.week = 2; eLow.updateProductFunnelsWeekly();
  assert.ok(eLow.g.productFunnels[lowProduct.id].conversionRate < beforeLow, '中立点より低い品質ではconversionRateは今も低下する（非対称な罰則自体は維持）');
}

// 4. Determinism: identical seed/state produces identical conversionRate trajectories, and the
// conversionRate formula itself never touches Math.random (only the unrelated b2bContracts /
// server-overload branches in the same function do, and those are untouched by this fix).
{
  const runTrajectory = () => {
    const { e } = withEngine(4242);
    const product = newProduct(e, { quality: 55 });
    const trace = [];
    for (let week = 2; week <= 30; week++) {
      e.g.week = week; e.updateProductFunnelsWeekly();
      trace.push(+e.g.productFunnels[product.id].conversionRate.toFixed(6));
    }
    return trace;
  };
  assert.deepEqual(runTrajectory(), runTrajectory(), '同一seed・同一状態なら同じconversionRate推移になる');
}

// 5. A 208-week run at a realistic, steadily-improving quality trajectory must not spend the
// bulk of the run below its own starting conversionRate -- the exact pathology this fix
// removes (quality crossing the old neutral=50 only after ~90-100 weeks in real playtests).
{
  const { e } = withEngine(7);
  const product = newProduct(e, { quality: 20 });
  const startingConversion = e.ensureProductFunnel(product).conversionRate;
  let weeksBelowStart = 0;
  for (let week = 2; week <= 208; week++) {
    product.quality = Math.min(85, 20 + week * .35); // steady, realistic improvement, matching real playtests
    e.g.week = week; e.updateProductFunnelsWeekly();
    if (e.g.productFunnels[product.id].conversionRate < startingConversion) weeksBelowStart++;
  }
  assert.ok(weeksBelowStart < 20, `208週中${weeksBelowStart}週も発売時conversionRateを下回ってはならない（旧式は100週近く下回り続けていた）`);
}

console.log('product funnel conversion neutral-point checks passed');
