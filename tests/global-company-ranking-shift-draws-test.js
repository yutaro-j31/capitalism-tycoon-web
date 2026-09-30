'use strict';

// #812: the global ranking's weekly market shift must be an independent draw each week, and each game
// must have its own. The FNV-1a hash barely moved when only the week at the end of the key changed
// (lag-1 correlation .37), and the key used the company name, so every game of the same name got the
// same shifts. Measured through rankFor, the rank the player sees.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const mod = loadGame({ headless: true }).modules.globalCompanyRankingGoals;
const game = (seed, week, companyName = '世界商事') => ({ companyName, week, simulationRng: { seed, state: seed, draws: 0, nextID: 1, version: 1 } });
// With score 0 the rank is 1 + floor((1500 + shift) / 4): 368..383 as the shift runs over -30..30.
const ranks = (seed, companyName) => Array.from({ length: 1040 }, (_, i) => mod.rankFor(game(seed, i + 1, companyName), 0));

// 1. Week-to-week independence across 20 games.
{
  const xs = [], ys = [];
  for (let s = 0; s < 20; s++) { const r = ranks(0x812500 + s); for (let k = 1; k < r.length; k++) { xs.push(r[k - 1]); ys.push(r[k]); } }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, mx = mean(xs), my = mean(ys);
  let c = 0, vx = 0, vy = 0; for (let k = 0; k < xs.length; k++) { c += (xs[k] - mx) * (ys[k] - my); vx += (xs[k] - mx) ** 2; vy += (ys[k] - my) ** 2; }
  const r = c / Math.sqrt(vx * vy);
  assert.ok(Math.abs(r) < .1, `weekly rank lag-1 correlation ${r.toFixed(3)} (independent: 0)`);
  // The shift keeps its range and centre: -30..30 gives ranks 368..383, mean about 375.5.
  assert.equal(Math.min(...xs), 368);
  assert.equal(Math.max(...xs), 383);
  assert.ok(Math.abs(mx - 375.5) < .5, `mean rank at score 0: ${mx.toFixed(2)}`);
}

// 2. Each game has its own shifts, whatever the company is called; the same game seed gives the same ones.
{
  assert.deepEqual(ranks(0x812500), ranks(0x812500), 'the same game seed gives the same ranks');
  assert.notDeepEqual(ranks(0x812501), ranks(0x812500), 'another game seed with the same company name gives other ranks');
  assert.deepEqual(ranks(0x812500, '別名商事'), ranks(0x812500), 'the company name does not choose the shifts');
}

console.log('global company ranking shift draws tests passed');
