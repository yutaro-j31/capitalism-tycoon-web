'use strict';

// #812: an executive's weekly review variance (-4..+4 on the score) must be an independent draw each
// week, and each game must have its own. The FNV-1a hash barely moved when only the week at the end of
// the key changed (lag-1 correlation .2), and the key had no game seed, so an executive with the same
// id got the same reviews in every game. Measured through review(), the score the player sees.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const mod = loadGame({ headless: true }).modules.executiveReviewsSuccessionBoard;
const IDS = Array.from({ length: 40 }, (_, i) => `executive-${i}`);
// Skill 50, no department and no tenure (hired in the future), so score = 50 + variance.
function scores(seed, from = 100, weeks = 104) {
  const state = { week: from, simulationRng: { seed, state: seed, draws: 0, nextID: 1, version: 1 }, executiveManagement: { executives: IDS.map(id => ({ id, role: 'CFO', name: id, skill: 50, hiredWeek: 1e6 })), assignments: {} } };
  const out = Object.fromEntries(IDS.map(id => [id, []]));
  for (let w = from; w < from + weeks; w++) { state.week = w; for (const r of mod.review(state)) out[r.executiveId].push(r.score - 50); }
  return out;
}

// 1. Week-to-week independence, range and mean.
{
  const s = scores(0x812700), xs = [], ys = [];
  for (const id of IDS) for (let k = 1; k < s[id].length; k++) { xs.push(s[id][k - 1]); ys.push(s[id][k]); }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, mx = mean(xs), my = mean(ys);
  let c = 0, vx = 0, vy = 0; for (let k = 0; k < xs.length; k++) { c += (xs[k] - mx) * (ys[k] - my); vx += (xs[k] - mx) ** 2; vy += (ys[k] - my) ** 2; }
  const r = c / Math.sqrt(vx * vy);
  assert.ok(Math.abs(r) < .1, `weekly review variance lag-1 correlation ${r.toFixed(3)} (independent: 0)`);
  assert.equal(Math.min(...xs), -4);
  assert.equal(Math.max(...xs), 4);
  assert.ok(Math.abs(mx) < .2, `mean variance ${mx.toFixed(3)}`);
}

// 2. Each game has its own reviews; the same game seed gives the same ones.
{
  assert.deepEqual(scores(0x812700), scores(0x812700), 'the same game seed gives the same reviews');
  assert.notDeepEqual(scores(0x812701), scores(0x812700), 'another game seed gives other reviews');
}

console.log('executive review variance draws tests passed');
