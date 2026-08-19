'use strict';

// Two display defects found by an external audit of the map store-detail panel, both verified
// against the running engine before fixing.
//
// 1. The panel printed 営業中 unconditionally. js/engine.js's openStore() sets
//    status:'preparing' with an openingWeek and only flips to 'open' in the weekly loop, so a
//    store still under construction rendered exactly like a trading one -- its ¥0 sales were
//    indistinguishable from a failing store, which matters most in the cash-tight opening weeks.
//
// 2. 来客数 and 満足度 always rendered "—", even for a fully simulated ramen store. The panels
//    read store.lastCustomers / store.satisfaction, which are written NOWHERE in the codebase
//    (grep: zero assignments). What the simulation actually produces is
//    store.marketResult.unitsSold / .customerSatisfaction, set by js/market.js and stored by
//    js/engine.js. js/iphone-playtest-fixes.js already read the market result first, so two of
//    the three store UIs were simply left behind -- this aligns them.
//
// Both fixes are read-path only: no engine, save, ledger or RNG behaviour changes, which is why
// this test asserts rendered output rather than any state mutation.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819905) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819905) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, engine };
}

function openRamenStore(engine) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, '前提: 空きテナントが存在する');
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '検証店', operatingHours: 3 }), true);
  return engine.g.stores.at(-1);
}

const detailFor = (modules, engine, store) => modules.dUIShell.selectedDetail({ kind: 'store', store }, engine.g);

// 1. A store that has not opened yet reports its remaining weeks, never 営業中.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  assert.equal(store.status, 'preparing', '前提: 出店直後はpreparing');
  const weeksLeft = store.openingWeek - engine.g.week;
  assert.ok(weeksLeft > 0, '前提: 開店予定週は未来');

  const html = detailFor(modules, engine, store);
  assert.match(html, new RegExp(`開業準備中・あと${weeksLeft}週`), '準備中は残り週数を表示する');
  assert.doesNotMatch(html, /<b>営業中<\/b>/, '準備中に営業中と表示しない');
}

// 2. The countdown actually counts down, and becomes 営業中 exactly when the engine opens it.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  const openingWeek = store.openingWeek;

  while (engine.g.week < openingWeek) {
    const expected = openingWeek - engine.g.week;
    assert.match(detailFor(modules, engine, store), new RegExp(`あと${expected}週`), `第${engine.g.week}週の残り表示`);
    assert.notEqual(engine.advanceWeek(false), false);
  }

  assert.equal(store.status, 'open', '開店予定週に到達したらopenになる');
  assert.match(detailFor(modules, engine, store), /<b>営業中<\/b>/, '開店後は営業中を表示する');
}

// 3. A closed store is labelled as closed, not as trading.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.status = 'closed';
  const html = detailFor(modules, engine, store);
  assert.match(html, /<b>閉店<\/b>/);
  assert.doesNotMatch(html, /<b>営業中<\/b>/);
}

// 4. The core defect: an open, simulated store surfaces the customer count and satisfaction the
// market model already computed, instead of rendering "—".
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  while (engine.g.week < store.openingWeek) engine.advanceWeek(false);
  assert.notEqual(engine.advanceWeek(false), false);

  assert.ok(store.marketResult, '前提: ramen店はmarketResultを持つ');
  const units = store.marketResult.unitsSold;
  const satisfaction = store.marketResult.customerSatisfaction;
  assert.ok(units > 0, `前提: 販売数が計算されている (${units})`);
  assert.ok(satisfaction > 0, `前提: 満足度が計算されている (${satisfaction})`);

  const html = detailFor(modules, engine, store);
  assert.doesNotMatch(html, /<strong>—<\/strong>/, '計算済みのKPIが—にならない');
  assert.match(html, new RegExp(`${Math.round(units).toLocaleString('ja-JP')}人`), '来客数はmarketResult.unitsSoldを表示する');
  assert.match(html, new RegExp(`${satisfaction.toFixed(1)} ★`), '満足度はmarketResult.customerSatisfactionを表示する');
}

// 5. The store-detail context tabs read the same source, so both surfaces agree.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  while (engine.g.week < store.openingWeek) engine.advanceWeek(false);
  engine.advanceWeek(false);

  const business = engine.business(store.businessID);
  const overview = modules.dUIContextTabs.panelContent('overview', { store, business, g: engine.g });
  assert.match(overview, new RegExp(`${Math.round(store.marketResult.unitsSold).toLocaleString('ja-JP')}`), 'コンテキストタブも同じ販売数を表示する');
}

// 6. Backward compatibility: a legacy store with no marketResult at all (a non-target business,
// or a save written before market.js existed) must still render without throwing, falling back
// to the historical fields and finally to "—".
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  store.status = 'open';
  store.marketResult = null;
  const html = detailFor(modules, engine, store);
  assert.match(html, /<b>営業中<\/b>/);
  assert.match(html, /—/, 'marketResultが無ければ従来どおり—を表示する');

  store.lastCustomers = 1234;
  store.satisfaction = 71.5;
  const legacy = detailFor(modules, engine, store);
  assert.match(legacy, /1,234人/, '旧フィールドが存在する場合はそれを使う');
  assert.match(legacy, /71\.5 ★/);
}

// 7. Determinism: rendering is a pure read and must not consume RNG or mutate state.
{
  const { modules, engine } = newGame();
  const store = openRamenStore(engine);
  while (engine.g.week < store.openingWeek) engine.advanceWeek(false);
  engine.advanceWeek(false);

  const before = JSON.stringify(engine.g);
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    detailFor(modules, engine, store);
    modules.dUIContextTabs.panelContent('overview', { store, business: engine.business(store.businessID), g: engine.g });
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '描画はMath.randomを消費しない');
  assert.equal(JSON.stringify(engine.g), before, '描画は状態を変更しない');
}

console.log('store status / KPI display tests passed');
