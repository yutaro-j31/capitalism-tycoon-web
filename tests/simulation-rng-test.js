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
  // The initial executive market (age, gender) is the only thing drawn while a state is built.
  assert.equal(fresh.simulationRng.draws, 2 * fresh.executiveMarket.length);
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

// 7. #731 PR2: engine.js draws and IDs come from the save stream. The same save and the same
//    engine actions give the same state in runtimes whose host Math.random, clock and UUID differ.
{
  const hostile = seed => { const r = runtime(seed); vm.runInContext(`Date.now = () => ${seed}; crypto.randomUUID = () => 'host-${seed}';`, r.loaded.ctx); return r; };
  const a = hostile(21), b = hostile(83);
  const base = a.engine.createInitialState({ configured: true, companyName: 'Engine Co', playerName: 'E' });
  base.companyCash = 5_000_000_000;
  base.departments = { hr: { level: 1 }, investment: { level: 1 }, product: { level: 1 } };
  const play = r => {
    const E = new r.engine.TycoonEngine(JSON.parse(JSON.stringify(base)));
    E.save = () => {}; E.emit = () => {}; E.notify = () => {};
    const draws = E.g.simulationRng.draws;
    assert.equal(E.refreshExecutives(), true);
    assert.equal(E.generateMATargets(true), true);
    E.proposeInternalVenture();
    assert.ok(E.g.simulationRng.draws > draws + 50, 'the engine actions drew from the save stream');
    return E.g;
  };
  const ga = play(a), gb = play(b);
  const view = g => JSON.stringify({ executives: g.executiveMarket, targets: g.acquisitionTargets, ventures: g.internalVentureProposals, cash: g.companyCash, stream: g.simulationRng });
  assert.equal(view(ga), view(gb), 'engine draws and IDs follow the save, not the host');
  assert.match(ga.acquisitionTargets[0].id, /^target-s[0-9a-z]+$/);
  assert.equal(new Set(ga.acquisitionTargets.map(t => t.id)).size, 8);
}

// 8. A new game reads host entropy once, for its seed; the initial catalogue has stable IDs and
//    leaves the ID counter untouched.
{
  const seedOf = seed => { const r = runtime(seed); const E = new r.engine.TycoonEngine(); E.configure({ playerName: 'N', companyName: 'New Co', difficulty: 'normal' }); return E.g; };
  const g1 = seedOf(31), g2 = seedOf(31), g3 = seedOf(32);
  assert.equal(g1.simulationRng.seed, g2.simulationRng.seed, 'the same entropy gives the same game');
  assert.notEqual(g1.simulationRng.seed, g3.simulationRng.seed, 'a new game is seeded from host entropy');
  assert.equal(JSON.stringify(g1.executiveMarket), JSON.stringify(g2.executiveMarket));
  assert.equal(g1.simulationRng.nextID, 1, 'the initial catalogue does not use the ID counter');
  assert.equal(JSON.stringify(g1.properties.map(p => p.id)), JSON.stringify(g3.properties.map(p => p.id)), 'catalogue IDs are stable');
  for (const key of ['properties', 'tenants', 'rentalOffices', 'startups', 'executiveMarket', 'competitors']) assert.equal(new Set(g1[key].map(x => x.id)).size, g1[key].length, `${key} IDs are unique`);
  const { rng } = runtime(8);
  assert.equal(rng.seedFromEntropy(0), rng.seedFromEntropy(Number.NaN));
  assert.ok(rng.seedFromEntropy(0) > 0 && rng.seedFromEntropy(.999999) > 0);
}

console.log('simulation rng tests passed');
