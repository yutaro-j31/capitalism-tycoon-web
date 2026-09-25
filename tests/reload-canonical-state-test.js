'use strict';

// Issue #732 (P0-07): continuous play never normalized (configure only normalizes outside a
// transaction, and module wrappers always run it inside one), the browser engine was normalized
// before most modules registered, the weekly pipeline depended on whether TycoonEngine.load()
// installed product innovation, the luxury auction pool was shuffled in module memory, normalize
// was not idempotent, and several normalizers re-derived values the weekly processing owns.
// Continuous play, browser reload and a fully-loaded reload therefore produced different state
// shapes and different futures. The founding state is normalized once; after that, each week's
// processing must itself leave a state a reload's normalize does not change.
// Every check runs (each reports on its own) against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const KEY = 'capitalism_tycoon_web_v1';
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
function switchable(seed) {
  let current = lcg(seed);
  const random = () => current();
  random.reseed = next => { current = lcg(next); };
  return random;
}
// lastSaveDate is wall-clock time, not simulation state.
const strip = g => { const copy = JSON.parse(JSON.stringify(g)); delete copy.lastSaveDate; return copy; };
function leaves(value, path = '', out = new Map()) {
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) out.set(path, Array.isArray(value) ? '[]' : '{}');
    for (const key of keys) leaves(value[key], path ? `${path}.${key}` : key, out);
  } else out.set(path, JSON.stringify(value));
  return out;
}
function differences(x, y) {
  const a = leaves(strip(x)), b = leaves(strip(y)), rows = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) if (a.get(key) !== b.get(key)) rows.push(`${key}: ${a.get(key) ?? '(missing)'} -> ${b.get(key) ?? '(missing)'}`);
  return rows;
}
const openRamen = (engine, name) => {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name, operatingHours: 3 }), true);
};
// Browser boot: the engine app.js creates while the later modules are still loading.
const browserBoot = (random, saved) => loadGame({ random, ...(saved ? { localStorageInitial: { [KEY]: saved } } : {}) }).ctx.__ct_engine;
// Fully-loaded runtime (how most tests build engines).
const fullLoad = (random, saved) => {
  const loaded = loadGame({ headless: true, random, ...(saved ? { localStorageInitial: { [KEY]: saved } } : {}) });
  return { loaded, TycoonEngine: loaded.engineModule.TycoonEngine };
};
const saveOf = engine => { engine.save(); return JSON.stringify(engine.g); };

const failures = [];
function check(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (error) { failures.push(name); console.log(`FAIL ${name}\n     ${String(error.message).split('\n').slice(0, 6).join('\n     ')}`); }
}

// 1. Fork: play N weeks, then A continues in memory while B (browser boot) and C (fully-loaded
//    load) reload A's save in fresh runtimes; the same action sequence gives identical states.
//    A save taken at a week boundary is canonical, so the states match right after the reload.
//    A save taken right after a mid-week action (not normalized until the week closes) must
//    still lead to the same future. The fork comes after week 10 so a luxury auction refresh
//    (every 8 weeks) happens both before and after it.
function fork(midWeekAction) {
  const rA = switchable(732), A = browserBoot(rA);
  A.configure({ playerName: 'Fork', companyName: 'Fork Co', difficulty: 'normal' });
  A.g.companyCash = 300_000_000;
  openRamen(A, '1号店');
  for (let i = 0; i < 10; i++) assert.notEqual(A.advanceWeek(false), false);
  if (midWeekAction) openRamen(A, '2号店');
  const saved = saveOf(A);
  const rB = switchable(1), B = browserBoot(rB, saved);
  const rC = switchable(2), { TycoonEngine } = fullLoad(rC, saved), C = TycoonEngine.load();
  if (!midWeekAction) {
    const atFork = [...differences(A.g, B.g).map(x => `B ${x}`), ...differences(A.g, C.g).map(x => `C ${x}`)];
    assert.deepEqual(atFork.slice(0, 12), [], `state differs right after reload (${atFork.length} leaves)`);
  }
  for (const random of [rA, rB, rC]) random.reseed(4242);
  for (const engine of [A, B, C]) {
    for (let i = 0; i < 10; i++) {
      if (i === 3) openRamen(engine, '3号店');
      assert.notEqual(engine.advanceWeek(false), false);
    }
  }
  const later = [...differences(A.g, B.g).map(x => `B ${x}`), ...differences(A.g, C.g).map(x => `C ${x}`)];
  assert.deepEqual(later.slice(0, 12), [], `futures diverge after the same 10 weeks (${later.length} leaves)`);
}
check('fork at a week boundary: continuous play == browser reload == fully-loaded reload', () => fork(false));
check('fork after a mid-week action: the same future after reload', () => fork(true));

// 2. Boot paths: an old, never-normalized save gets the same state keys whether the browser boots
//    it (engine created in app.js, before most modules register) or a fully-loaded runtime loads
//    it; continuous play has the same keys as its own reload; and product innovation is installed
//    without anyone calling load(), so every runtime composes the browser's weekly pipeline.
check('boot paths: browser boot, fully-loaded load() and continuous play share the state keys', () => {
  const full = fullLoad(lcg(11));
  assert.equal(typeof full.TycoonEngine.prototype.updateProductInnovationWeekly, 'function', 'product innovation is installed before any load(), so the weekly pipeline matches the browser');
  // The boundary must stay the outermost wrapper: a later wrapper would run after it.
  for (const name of ['configure', 'advanceWeek']) assert.equal(full.TycoonEngine.prototype[name].__canonicalNormalizeBoundary, true, `${name} is wrapped by the canonical state boundary last`);
  const keys = g => Object.keys(g).sort();
  const onlyIn = (x, y) => keys(x).filter(k => !keys(y).includes(k));
  const legacy = JSON.stringify(full.loaded.modules.engine.createInitialState({ configured: true, playerName: 'Keys', companyName: 'Keys Co' }));
  const booted = browserBoot(lcg(12), legacy).g, loaded = fullLoad(lcg(12), legacy).TycoonEngine.load().g;
  assert.deepEqual({ browserOnly: onlyIn(booted, loaded), loadOnly: onlyIn(loaded, booted) }, { browserOnly: [], loadOnly: [] }, 'old save: browser boot vs fully-loaded load()');
  const played = new full.TycoonEngine();
  played.configure({ playerName: 'Keys', companyName: 'Keys Co', difficulty: 'normal' });
  assert.notEqual(played.advanceWeek(false), false);
  const reloaded = fullLoad(lcg(13), saveOf(played)).TycoonEngine.load().g;
  assert.deepEqual({ playOnly: onlyIn(played.g, reloaded), reloadOnly: onlyIn(reloaded, played.g) }, { playOnly: [], reloadOnly: [] }, 'continuous play vs its reload');
});

// 3. normalize is idempotent, and continuous play is already canonical: right after founding, and at
//    every week boundary of a multi-business game (ramen, conveni, gym, a property; 60 weeks, which
//    covers an industry event, competitor text events and distress, and the week-53 budget cycle).
//    The weekly advance itself is not normalized, so each week's processing must leave nothing for
//    a reload's normalize to change.
check('normalize: idempotent, and a no-op after founding and at every week boundary', () => {
  const E = browserBoot(lcg(11));
  E.configure({ playerName: 'W', companyName: 'W Co', difficulty: 'normal' });
  const proto = Object.getPrototypeOf(E);
  const normalizedCopy = g => { const copy = Object.create(proto); copy.g = JSON.parse(JSON.stringify(g)); proto.normalize.call(copy); return copy.g; };
  const stable = label => {
    const once = normalizedCopy(E.g), first = differences(E.g, once), second = differences(once, normalizedCopy(once));
    assert.deepEqual(second.slice(0, 12), [], `${label}: a second normalize changes ${second.length} leaves`);
    assert.deepEqual(first.slice(0, 12), [], `${label}: normalize changes ${first.length} leaves`);
  };
  stable('after founding');
  E.g.companyCash = 5_000_000_000; E.g.personalCash = 1_000_000_000;
  for (const businessID of ['ramen', 'conveni', 'gym', 'ramen']) {
    const tenant = E.g.tenants.find(t => !t.occupiedBy);
    assert.equal(E.openStore({ tenantID: tenant.id, businessID, name: businessID, operatingHours: 3 }), true);
  }
  const land = E.g.properties.find(p => !p.owner && p.price < 300_000_000);
  assert.equal(E.buyProperty(land.id, 'company'), true);
  const store = E.g.stores[0], business = E.g.businesses[0], stores = E.g.stores;
  for (let i = 0; i < 60; i++) {
    assert.notEqual(E.advanceWeek(false), false);
    stable(`week ${E.g.week}`);
  }
  assert.ok(E.g.stores === stores && E.g.stores[0] === store && E.g.businesses[0] === business, 'a store/business held across weeks is still the live object');
});

if (failures.length) {
  console.log(`reload canonical state tests FAILED: ${failures.length}/4`);
  process.exit(1);
}
console.log('reload canonical state tests passed');
