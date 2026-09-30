'use strict';

// #812: the economic foundation's weekly draws (cycle noise, stress, inflation, fx, commodity) must be
// independent from week to week, and each game must have its own economy. unit() hashed with FNV-1a
// and one xorshift round, which barely moved when only the week at the end of the key changed (lag-1
// correlation .18), and the seed came from the company name and ticker, so every game of the same name
// followed the same economy. New games now take the game's stored simulationRng seed; a save keeps the
// seed it stored.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const lcg = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function lag1(a) { const x = a.slice(0, -1), y = a.slice(1), mx = mean(x), my = mean(y); let c = 0, vx = 0, vy = 0; x.forEach((v, k) => { c += (v - mx) * (y[k] - my); vx += (v - mx) ** 2; vy += (y[k] - my) ** 2; }); return c / Math.sqrt(vx * vy); }

// 1. Each weekly draw is independent of the previous week's (20 seeds x 520 weeks).
{
  const mod = loadGame({ headless: true }).modules.deterministicEconomicFoundation;
  for (const key of ['cycle', 'stress', 'inflation', 'fx', 'commodity']) {
    const r = mean(Array.from({ length: 20 }, (_, s) => lag1(Array.from({ length: 520 }, (_, w) => mod.unit(0x812800 + s, `${key}-${w + 1}`)))));
    assert.ok(Math.abs(r) < .1, `${key} draw lag-1 correlation ${r.toFixed(3)} (independent: 0)`);
  }
}

// 2. A new game takes its economy seed from its simulationRng seed, not from the company name.
function newGame(companyName, lcgSeed) {
  const loaded = loadGame({ headless: true, random: lcg(lcgSeed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'P', companyName, difficulty: 'normal' });
  return { loaded, engine };
}
function economyPath(engine, weeks = 104) {
  const out = [];
  for (let w = 1; w <= weeks; w++) { engine.g.week = w; engine.updateMacro(); out.push(engine.g.economy); }
  return out;
}
{
  const a = newGame('同名商事', 1), b = newGame('同名商事', 2), c = newGame('別名商事', 1);
  assert.equal(a.engine.g.economicFoundation.seed, a.engine.g.simulationRng.seed, 'a new game uses its simulationRng seed');
  assert.notDeepEqual(economyPath(a.engine), economyPath(b.engine), 'two games with the same company name follow different economies');
  assert.deepEqual(economyPath(newGame('同名商事', 1).engine), economyPath(a.engine), 'the same game seed gives the same economy');
  assert.equal(c.engine.g.economicFoundation.seed, a.engine.g.economicFoundation.seed, 'the company name does not choose the economy');
}

// 3. A save keeps the seed it stored.
{
  const { loaded } = newGame('保存商事', 3);
  const mod = loaded.modules.deterministicEconomicFoundation;
  const saved = { companyName: '保存商事', simulationRng: { seed: 99, state: 99, draws: 0, nextID: 1, version: 1 }, economicFoundation: { seed: 123456789 } };
  assert.equal(mod.ensure(saved).economicFoundation.seed, 123456789);
  const legacy = { companyName: '旧商事', ticker: 'OLD', economicFoundation: {} };
  assert.equal(mod.ensure(legacy).economicFoundation.seed, mod.hash('旧商事:OLD'), 'a state without simulationRng falls back to the name');
}

console.log('economic foundation draws tests passed');
