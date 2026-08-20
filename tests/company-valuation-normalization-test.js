'use strict';

// companyValue() capitalised each store at `max(0, lastProfit) * 52 * 4` -- one single week's
// profit, annualised and multiplied. Because companyCreditLimit() is
// companyValue * (.15 + companyCredit/250), that number is also the player's borrowing capacity.
//
// Measured on fixed seeds before this change:
//   * the week a store opened, companyValue rose by up to 461% in one step, taking borrowing
//     capacity from 262万 to 1474万 against roughly 404万 of capital actually invested;
//   * week-to-week, a single demand roll moved companyValue by tens of percent with nothing
//     averaging it out.
// "Open one store, wait for a good week, borrow against that week" was therefore strictly
// optimal, which is what this fixes.
//
// The fix is deliberately narrow. It changes only how earnings are *normalised* into the
// valuation -- a running mean plus a maturity ramp over the store's first 13 weeks of trading.
// It does NOT change the steady-state multiple (still 52*4 once a store is mature), because
// that is a separate balance decision affecting IPO pricing, buyout offers and achievements.
// Assertion 5 pins that steady state so a future change to it has to be deliberate.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819907) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819907) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, engine };
}

function openRamenStore(engine) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, '前提: 空きテナントが存在する');
  const before = engine.g.companyCash;
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '検証店', operatingHours: 3 }), true);
  return { store: engine.g.stores.at(-1), invested: before - engine.g.companyCash };
}

// 1. The opening spike is gone: a store cannot capitalise a week it has not traded yet, so
// borrowing capacity no longer leaps the instant the doors open.
{
  const { engine } = newGame();
  const { store, invested } = openRamenStore(engine);
  assert.ok(invested > 0, '前提: 出店に資本を投下している');

  while (engine.g.week < store.openingWeek) assert.notEqual(engine.advanceWeek(false), false);
  const beforeOpen = engine.companyValue();
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(store.status, 'open', '前提: 店舗が開店した');
  assert.ok(store.lastProfit > 0, '前提: 開店週に利益が出ている');

  const afterOpen = engine.companyValue();
  const jump = (afterOpen - beforeOpen) / Math.max(1, beforeOpen);
  assert.ok(jump < 0.5, `開店週の企業価値の跳ね上がりが50%未満に収まる (実測 ${(jump * 100).toFixed(1)}%)`);
  assert.ok(
    engine.companyCreditLimit() < invested * 2,
    `開店直後の借入枠が投下資本の2倍を超えない (枠 ${Math.round(engine.companyCreditLimit())} / 投下 ${Math.round(invested)})`
  );
}

// 2. Week-to-week noise is damped: across three seeds no single week may move companyValue by
// more than half, where the old formula reached 461%.
{
  for (const seed of [7, 42, 1234]) {
    const { engine } = newGame(seed);
    const { store } = openRamenStore(engine);
    let previous = null, worst = 0;
    for (let w = 0; w < 26; w++) {
      assert.notEqual(engine.advanceWeek(false), false);
      const value = engine.companyValue();
      if (previous !== null && previous > 0) worst = Math.max(worst, Math.abs(value - previous) / previous);
      previous = value;
    }
    assert.ok(worst < 0.5, `seed ${seed}: 週次の企業価値変動が50%未満 (実測 ${(worst * 100).toFixed(1)}%)`);
    assert.ok(store.smoothedProfit > 0, '平準化利益が記録されている');
  }
}

// 3. The maturity ramp is a real function of trading weeks, reaching full weight at exactly
// VALUATION_OBSERVATION_WEEKS and never exceeding it.
{
  const { modules, engine } = newGame();
  const { store } = openRamenStore(engine);
  const weeks = modules.engine.VALUATION_OBSERVATION_WEEKS;
  assert.equal(weeks, 13, '観測期間は13週（finance.jsの四半期と揃える）');

  const valueAt = traded => {
    const probe = { ...store, openingWeek: 100 - traded, smoothedProfit: 100000 };
    return modules.engine.storeEarningsValue({ week: 100 }, probe);
  };
  assert.equal(valueAt(0), 0, '取引0週の店舗は利益を資本化しない');
  assert.ok(valueAt(1) > 0 && valueAt(1) < valueAt(6), 'ランプは単調に増加する');
  assert.ok(valueAt(6) < valueAt(13), 'ランプは満期まで増加し続ける');
  assert.equal(valueAt(13), 100000 * 52 * 4, '13週で満期となり従来どおりの倍率になる');
  assert.equal(valueAt(52), valueAt(13), '満期を超えても倍率は増えない');
}

// 4. smoothedProfit is a running mean, not just the latest week: a one-week spike must not
// drag the valuation with it the way lastProfit did.
{
  const { modules, engine } = newGame();
  const { store } = openRamenStore(engine);
  while (engine.g.week < store.openingWeek) engine.advanceWeek(false);
  for (let w = 0; w < 20; w++) engine.advanceWeek(false);

  const settled = store.smoothedProfit;
  assert.ok(settled > 0, '前提: 平準化利益が安定している');
  const valueBefore = engine.companyValue();

  store.lastProfit = settled * 20;
  modules.engine.storeNormalizedProfit(store);
  assert.equal(
    modules.engine.storeNormalizedProfit(store),
    settled,
    '評価はlastProfitではなく平準化利益を使う'
  );
  assert.equal(engine.companyValue(), valueBefore, '単週の急騰は企業価値を即座に動かさない');
}

// 5. Steady state is unchanged: a mature store is still valued at the historical multiple, so
// this is a normalisation fix and not a silent rebalance of company worth.
{
  const { modules, engine } = newGame();
  const store = { openingWeek: 1, smoothedProfit: 250000, lastProfit: 250000 };
  assert.equal(
    modules.engine.storeEarningsValue({ week: 1 + modules.engine.VALUATION_OBSERVATION_WEEKS }, store),
    250000 * 52 * 4,
    '成熟した店舗の評価倍率は従来と同じ 52週×4'
  );
}

// 6. Backward compatibility: a save written before this change has no smoothedProfit. Such a
// store must fall back to lastProfit -- exactly the old numerator -- so an existing save keeps
// its previous valuation instead of collapsing to zero. saveVersion stays 9.
{
  const { modules, engine } = newGame();
  const { store } = openRamenStore(engine);
  while (engine.g.week < store.openingWeek) engine.advanceWeek(false);
  for (let w = 0; w < 20; w++) engine.advanceWeek(false);

  delete store.smoothedProfit;
  assert.equal(modules.engine.storeNormalizedProfit(store), store.lastProfit, '旧セーブはlastProfitにフォールバックする');
  assert.ok(engine.companyValue() > 0, '旧セーブの企業価値がゼロにならない');

  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(reloaded.g.saveVersion, 9);
  assert.ok(reloaded.companyValue() > 0, 'reload後も企業価値が算出できる');
  assert.notEqual(reloaded.advanceWeek(false), false, 'reload後も週送りできる');
  const reloadedStore = reloaded.g.stores.find(s => s.id === store.id);
  assert.ok(Number.isFinite(reloadedStore.smoothedProfit), '週送り後は平準化利益が補完される');
}

// 7. Determinism: normalisation draws no random numbers, and reading the valuation never
// mutates state. (companyValue() gates an RNG-consuming news roll behind
// `publicCompany && companyValue() > 1e9`, so a change here could have shifted the RNG stream;
// tests/transaction-regression-test.js pins randomCallsAtWeek52 at 6625 and still passes.)
{
  const { engine } = newGame();
  openRamenStore(engine);
  for (let w = 0; w < 8; w++) engine.advanceWeek(false);

  const snapshot = JSON.stringify(engine.g);
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    engine.companyValue();
    engine.companyCreditLimit();
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '企業価値の算出はMath.randomを消費しない');
  assert.equal(JSON.stringify(engine.g), snapshot, '企業価値の算出は状態を変更しない');
}

console.log('company valuation normalization tests passed');
