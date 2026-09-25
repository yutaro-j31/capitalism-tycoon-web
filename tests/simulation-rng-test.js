'use strict';

// Issue #731 (P0-06) PR1: the deterministic simulation stream and ID counter kept in the save.
// Runs against the full production script set, in runtimes whose host Math.random, clock and
// crypto.randomUUID deliberately differ.

const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
// Reference mulberry32, written independently of js/simulation-rng.js.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const runtime = seed => {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  return { loaded, rng: loaded.modules.simulationRng, engine: loaded.modules.engine };
};

// 1. The stream is exactly mulberry32 from its seed and survives a JSON (save) round trip.
{
  const { rng } = runtime(1);
  const g = { companyName: 'A', playerName: 'P', week: 1 };
  rng.reseed(g, 12345);
  const ref = mulberry32(12345);
  for (let i = 0; i < 5; i++) assert.equal(rng.next(g), ref());
  const saved = JSON.parse(JSON.stringify(g));
  for (let i = 0; i < 5; i++) assert.equal(rng.next(saved), ref(), 'a saved stream continues where it stopped');
  assert.equal(saved.simulationRng.draws, 10);
}

// 2. The same save gives the same draws and IDs in runtimes whose host sources all differ.
{
  const a = runtime(11), b = runtime(99);
  vm.runInContext("Date.now = () => 0; crypto.randomUUID = () => 'host-uuid';", b.loaded.ctx);
  const save = JSON.stringify(a.engine.createInitialState({ configured: true, companyName: 'Det Co', playerName: 'Det' }));
  const ga = JSON.parse(save), gb = JSON.parse(save);
  const draw = (rng, g) => [rng.range(g, 10, 20), rng.pick(g, ['x', 'y', 'z']), rng.chance(g, 0.5), rng.nextID(g, 'store'), rng.next(g)];
  for (let i = 0; i < 20; i++) assert.equal(JSON.stringify(draw(a.rng, ga)), JSON.stringify(draw(b.rng, gb)));
  assert.equal(JSON.stringify(ga.simulationRng), JSON.stringify(gb.simulationRng));
}

// 3. Every way a state is made carries the stream, and normalize never moves it.
{
  const { loaded, engine, rng } = runtime(3);
  const fresh = engine.createInitialState({ configured: true, companyName: 'Fresh', playerName: 'F' });
  assert.equal(fresh.simulationRng.version, rng.VERSION);
  assert.equal(fresh.simulationRng.seed, rng.legacySeed(fresh));
  assert.equal(fresh.simulationRng.draws, 0);
  // A save made before #731 (no stream) gets a seed derived from the save, not from the host.
  const legacy = engine.createInitialState({ configured: true, companyName: 'Legacy', playerName: 'L' });
  delete legacy.simulationRng;
  const L1 = new engine.TycoonEngine(JSON.parse(JSON.stringify(legacy)));
  const L2 = new (runtime(77).engine.TycoonEngine)(JSON.parse(JSON.stringify(legacy)));
  assert.equal(JSON.stringify(L1.g.simulationRng), JSON.stringify(L2.g.simulationRng), 'a legacy save is seeded the same in any runtime');
  const E = new engine.TycoonEngine();
  E.configure({ playerName: 'Norm', companyName: 'Norm Co', difficulty: 'normal' });
  rng.next(E.g); rng.nextID(E.g, 'x');
  const before = JSON.stringify(E.g.simulationRng);
  E.normalize(); E.normalize();
  assert.equal(JSON.stringify(E.g.simulationRng), before, 'normalize keeps the stream position');
  assert.notEqual(loaded, null);
}

// 4. Broken fields are repaired to a valid stream; ensure is idempotent.
{
  const { rng } = runtime(4);
  const g = { companyName: 'R', simulationRng: { seed: -3, state: 'x', draws: -1, nextID: 0 } };
  rng.ensure(g);
  assert.ok(Number.isInteger(g.simulationRng.seed) && g.simulationRng.seed > 0);
  assert.equal(g.simulationRng.state, g.simulationRng.seed);
  assert.equal(g.simulationRng.draws, 0);
  assert.equal(g.simulationRng.nextID, 1);
  const once = JSON.stringify(g.simulationRng);
  rng.ensure(g);
  assert.equal(JSON.stringify(g.simulationRng), once);
}

// 5. The test hook positions the real stream: after reseed(seed, {skip}) the production next()
//    returns exactly what that stream produces from that point, and peek() does not consume.
{
  const { rng } = runtime(5);
  const g = {};
  rng.reseed(g, 777, { skip: 3 });
  const ref = mulberry32(777); ref(); ref(); ref();
  const peeked = rng.peek(g, 2);
  assert.equal(g.simulationRng.draws, 3, 'peek does not consume');
  const expected = [ref(), ref()];
  assert.deepEqual(Array.from(peeked), expected);
  assert.deepEqual([rng.next(g), rng.next(g)], expected, 'next() continues from the hooked position');
  assert.throws(() => rng.reseed(g, 0));
}

// 6. IDs are sequential per save, never repeat, and are not derived from the host.
{
  const { rng } = runtime(6);
  const g = { companyName: 'Ids' };
  const ids = Array.from({ length: 50 }, () => rng.nextID(g, 'store'));
  assert.equal(new Set(ids).size, 50);
  assert.equal(ids[0], 'store-s1');
  assert.equal(ids[35], 'store-s10');
}

console.log('simulation rng tests passed');
