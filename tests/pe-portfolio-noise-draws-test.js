'use strict';

// #812: a PE portfolio company's weekly profit noise must be an independent draw each week, and each
// game must have its own. The FNV-1a hash barely moved when only the week at the end of the key
// changed (lag-1 correlation 0.88), so a deal kept nearly the same noise for its whole holding, and
// the key had no game seed.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const ops = loadGame({ headless: true }).modules.pePortfolioOperations;

function fixture(id) {
  const pc = ops.defaultPortfolioCompany(10);
  const deal = { id, businessID: 'gym', enterpriseValue: 2_000_000_000, acquisitionMultiple: 8, status: 'active', portfolioCompany: pc };
  const fund = { size: 0, terms: { fee: 0 }, team: { partners: 1, principals: 1, associates: 2 }, deals: [deal] };
  return { fund, deal };
}
const game = seed => ({ simulationRng: { seed, state: seed, draws: 0, nextID: 1, version: 1 } });
function noiseSeries(state, id, from = 20, to = 280) {
  const { fund, deal } = fixture(id), out = [];
  for (let week = from; week < to; week++) out.push(ops.calculateGenericPortfolioOperatingWeek(fund, deal, week, state).components.noise);
  return out;
}

// 1. Week-to-week independence: lag-1 correlation across 60 deals.
{
  const xs = [], ys = [];
  for (let i = 0; i < 60; i++) { const s = noiseSeries(game(0x812100), `pe-deal-2030-${i}`); for (let k = 1; k < s.length; k++) { xs.push(s[k - 1]); ys.push(s[k]); } }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, mx = mean(xs), my = mean(ys);
  let c = 0, vx = 0, vy = 0; for (let k = 0; k < xs.length; k++) { c += (xs[k] - mx) * (ys[k] - my); vx += (xs[k] - mx) ** 2; vy += (ys[k] - my) ** 2; }
  const r = c / Math.sqrt(vx * vy);
  assert.ok(Math.abs(r) < .1, `weekly noise lag-1 correlation ${r.toFixed(3)} (independent: 0)`);
  assert.ok(Math.min(...xs) >= .92 && Math.max(...xs) <= 1.08, 'the noise stays within .92-1.08');
}

// 2. Over a 260-week holding the noise averages out for every deal (independent weeks: sd 0.003).
{
  for (let i = 0; i < 60; i++) {
    const s = noiseSeries(game(0x812100), `pe-deal-2031-${i}`), avg = s.reduce((a, b) => a + b, 0) / s.length;
    assert.ok(Math.abs(avg - 1) < .015, `pe-deal-2031-${i}: average noise over the holding ${avg.toFixed(4)}`);
  }
}

// 3. Each game has its own noise; the same game seed gives the same noise.
{
  assert.deepEqual(noiseSeries(game(0x812100), 'pe-deal-2030-1'), noiseSeries(game(0x812100), 'pe-deal-2030-1'), 'the same game seed gives the same noise');
  assert.notDeepEqual(noiseSeries(game(0x812100), 'pe-deal-2030-1'), noiseSeries(game(0x812200), 'pe-deal-2030-1'), 'another game seed gives other noise');
}

console.log('PE portfolio noise draws tests passed');
