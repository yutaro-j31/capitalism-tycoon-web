'use strict';

// Issue #732 (P0-07): continuous play never normalized (configure/advanceWeek normalize only
// outside a transaction, and module wrappers always run them inside one), the browser engine was
// normalized before most modules registered, the weekly pipeline depended on whether
// TycoonEngine.load() installed product innovation, the luxury auction pool was shuffled in
// module memory, and normalize was not idempotent. Continuous play, browser reload and a
// fully-loaded reload therefore produced different state shapes and different futures.
// All three checks run (each reports on its own) against the full production script set.

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
//    still lead to the same future.
function fork(midWeekAction) {
  const rA = switchable(732), A = browserBoot(rA);
  A.configure({ playerName: 'Fork', companyName: 'Fork Co', difficulty: 'normal' });
  A.g.companyCash = 300_000_000;
  openRamen(A, '1号店');
  for (let i = 0; i < 6; i++) assert.notEqual(A.advanceWeek(false), false);
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

// 2. Boot paths: the browser-boot engine, a fully-loaded load() and a fully-loaded new engine all
//    end up with the same state keys after founding, and use the same weekly pipeline.
check('boot paths: browser boot, fully-loaded load() and fully-loaded new share the state keys', () => {
  const B = browserBoot(lcg(11));
  const full = fullLoad(lcg(11));
  const L = full.TycoonEngine.load(), N = new full.TycoonEngine();
  for (const engine of [B, L, N]) {
    engine.configure({ playerName: 'Keys', companyName: 'Keys Co', difficulty: 'normal' });
    assert.notEqual(engine.advanceWeek(false), false);
  }
  const keys = engine => Object.keys(engine.g).sort();
  const onlyIn = (x, y) => keys(x).filter(k => !keys(y).includes(k));
  assert.deepEqual({ browserOnly: onlyIn(B, L), loadOnly: onlyIn(L, B) }, { browserOnly: [], loadOnly: [] }, 'browser boot vs fully-loaded load()');
  assert.deepEqual({ newOnly: onlyIn(N, L), loadOnly: onlyIn(L, N) }, { newOnly: [], loadOnly: [] }, 'fully-loaded new vs fully-loaded load()');
  assert.equal(typeof full.TycoonEngine.prototype.updateProductInnovationWeekly, 'function', 'product innovation is installed without load(), so the weekly pipeline matches the browser');
});

// 3. normalize is idempotent and continuous play is already canonical at a week boundary.
check('normalize: idempotent, and a no-op on a state at a week boundary', () => {
  const E = browserBoot(lcg(21));
  E.configure({ playerName: 'Idem', companyName: 'Idem Co', difficulty: 'normal' });
  openRamen(E, '1号店');
  for (let i = 0; i < 8; i++) assert.notEqual(E.advanceWeek(false), false);
  const atBoundary = strip(E.g);
  E.normalize();
  const once = strip(E.g);
  E.normalize();
  const twice = strip(E.g);
  const first = differences(atBoundary, once), second = differences(once, twice);
  assert.deepEqual(second.slice(0, 12), [], `a second normalize changes ${second.length} leaves`);
  assert.deepEqual(first.slice(0, 12), [], `normalize changes ${first.length} leaves of a week-boundary state`);
});

if (failures.length) {
  console.log(`reload canonical state tests FAILED: ${failures.length}/4`);
  process.exit(1);
}
console.log('reload canonical state tests passed');
