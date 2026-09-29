'use strict';

// #766: an unattended, never-reinvested ramen store must not see its profit margin climb over a
// 25-year run. Revenue, material COGS, payroll and business fixed cost follow inflation; a store's
// contract rent and its repair expense must too, or they shrink against inflated revenue and the
// margin widens every year.
//
// This complements tests/supply-material-cost-inflation-test.js (years 6-10 level, unchanged) with
// the drift over the full 25 years, on the same three seeds and the same setup. Measured on these
// seeds (years 6-10 -> years 21-25, profit / sales per window):
//   main before #766:  36.0 -> 43.5 / 34.9 -> 41.8 / 20.4 -> 32.6   (+7.5 / +6.9 / +12.2 pts)
//   with #766:         31.2 -> 32.2 / 30.2 -> 29.2 / 13.9 -> 16.3   (+1.0 / -1.0 / +2.4 pts)

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { loadGame } = require('./harness');

const SEEDS = [0x51a17e01, 101, 202];
const WEEKS = 1300; // 25 years at the game's 52-week year.
const YEAR = 52;
const RESULT_PREFIX = 'STORE_COST_INFLATION_25Y_RESULT ';

// One seed's 25-year run. Each seed runs in its own child process so the three runs share the
// runner's cores (a single process takes over 10 minutes for all three).
function runSeed(seed) {
  let s = seed >>> 0;
  const random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const { engineModule } = loadGame({ isolatedLegacyIndex: true, random });
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'Idle', companyName: 'Idle Co', difficulty: 'normal', scenario: 'free', founderPrefID: 'tokyo', founderTraitID: 'merchant' });
  e.g.companyCash += 1_000_000_000;
  const tenant = e.g.tenants.find(t => t.prefID === 'tokyo' && t.businessID === 'ramen' && !t.occupiedBy);
  assert.ok(e.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'Idle Ramen', operatingHours: 3 }), 'store must open');
  const weeks = [];
  for (let i = 0; i < WEEKS && !e.g.gameOver; i++) {
    e.advanceWeek(false);
    const st = e.g.stores[0];
    weeks.push({ sales: st.lastSales, profit: st.lastProfit });
  }
  assert.ok(!e.g.gameOver, `seed ${seed}: the idle store must not go bankrupt over 25 years`);
  assert.equal(weeks.length, WEEKS, `seed ${seed}: the full 25-year history is recorded`);
  assert.ok(weeks.every(row => Number.isFinite(row.sales) && Number.isFinite(row.profit)), `seed ${seed}: weekly sales and profit stay finite`);
  // Aggregate profit over aggregate sales for a five-year window.
  const margin = firstYear => {
    const rows = weeks.slice((firstYear - 1) * YEAR, (firstYear + 4) * YEAR);
    const sales = rows.reduce((a, row) => a + row.sales, 0);
    assert.ok(sales > 0, `seed ${seed}: years ${firstYear}-${firstYear + 4} have sales`);
    return rows.reduce((a, row) => a + row.profit, 0) / sales;
  };
  return { seed, early: margin(6), late: margin(21), inflation: e.g.inflation };
}

function runChild(seed) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename], { env: { ...process.env, STORE_COST_INFLATION_25Y_SEED: String(seed) } });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      const line = out.split(/\r?\n/).find(row => row.startsWith(RESULT_PREFIX));
      if (code !== 0 || !line) return reject(new Error(`seed ${seed} run failed (exit ${code})\n${out}${err}`));
      resolve(JSON.parse(line.slice(RESULT_PREFIX.length)));
    });
  });
}

function check(runs) {
  const pts = x => (x * 100).toFixed(1);
  const detail = runs.map(r => `seed ${r.seed}: ${pts(r.early)}% -> ${pts(r.late)}% (inflation ${r.inflation.toFixed(3)})`).join(' / ');
  const meanDrift = runs.reduce((a, r) => a + (r.late - r.early), 0) / runs.length;
  assert.equal(runs.length, SEEDS.length, 'every seed reported');
  assert.ok(meanDrift < 0.04, `the unattended margin must not climb with inflation: mean drift years 6-10 -> 21-25 is ${pts(meanDrift)} pts (${detail})`);
  for (const r of runs) {
    assert.ok(r.late - r.early < 0.05, `seed ${r.seed}: margin drift years 6-10 -> 21-25 is ${pts(r.late - r.early)} pts (${detail})`);
  }
  console.log(`store cost inflation 25y: mean drift ${pts(meanDrift)} pts; ${detail}`);
}

if (process.env.STORE_COST_INFLATION_25Y_SEED) {
  console.log(RESULT_PREFIX + JSON.stringify(runSeed(Number(process.env.STORE_COST_INFLATION_25Y_SEED))));
} else {
  Promise.all(SEEDS.map(runChild)).then(check).catch(error => { console.error(error); process.exit(1); });
}
