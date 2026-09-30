'use strict';

// #812: the global ranking's weekly market shift must be an independent draw each week, and each game
// must have its own. The FNV-1a hash barely moved when only the week at the end of the key changed
// (lag-1 correlation .37), and the key used the company name, so every game of the same name got the
// same shifts. Measured through rankFor, the rank the player sees.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const mod = loadGame({ headless: true }).modules.globalCompanyRankingGoals;
const game = (seed, week, companyName = '世界商事') => ({ companyName, week, simulationRng: { seed, state: seed, draws: 0, nextID: 1, version: 1 } });
// With score 0 the rank is 1 + floor((RANK_BASE + shift) / 4); the shift runs over -30..30 (#816: base 1600 -> 393..408).
const B = mod.RANK_BASE, LOW = 1 + Math.floor((B - 30) / 4), HIGH = 1 + Math.floor((B + 30) / 4), CENTRE = 1 + B / 4 - .5;
const ranks = (seed, companyName) => Array.from({ length: 1040 }, (_, i) => mod.rankFor(game(seed, i + 1, companyName), 0));

// 1. Week-to-week independence across 20 games.
{
  const xs = [], ys = [];
  for (let s = 0; s < 20; s++) { const r = ranks(0x812500 + s); for (let k = 1; k < r.length; k++) { xs.push(r[k - 1]); ys.push(r[k]); } }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, mx = mean(xs), my = mean(ys);
  let c = 0, vx = 0, vy = 0; for (let k = 0; k < xs.length; k++) { c += (xs[k] - mx) * (ys[k] - my); vx += (xs[k] - mx) ** 2; vy += (ys[k] - my) ** 2; }
  const r = c / Math.sqrt(vx * vy);
  assert.ok(Math.abs(r) < .1, `weekly rank lag-1 correlation ${r.toFixed(3)} (independent: 0)`);
  // The shift keeps its range and centre: -30..30 gives ranks LOW..HIGH, mean about CENTRE.
  assert.equal(Math.min(...xs), LOW);
  assert.equal(Math.max(...xs), HIGH);
  assert.ok(Math.abs(mx - CENTRE) < .5, `mean rank at score 0: ${mx.toFixed(2)} (expected about ${CENTRE})`);
}

// 2. Each game has its own shifts, whatever the company is called; the same game seed gives the same ones.
{
  assert.deepEqual(ranks(0x812500), ranks(0x812500), 'the same game seed gives the same ranks');
  assert.notDeepEqual(ranks(0x812501), ranks(0x812500), 'another game seed with the same company name gives other ranks');
  assert.deepEqual(ranks(0x812500, '別名商事'), ranks(0x812500), 'the company name does not choose the shifts');
}

console.log('global company ranking shift draws tests passed');
