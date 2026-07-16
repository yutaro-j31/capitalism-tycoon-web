const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCENARIOS, SEEDS, MAX_WEEKS } = require('./strategy-balance-runner');

const caseScript = path.join(__dirname, 'strategy-balance-case.js');
const results = [];
for (const scenario of SCENARIOS) {
  for (const seed of SEEDS) {
    const child = spawnSync(process.execPath, [caseScript, scenario.id, String(seed)], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 180_000
    });
    assert.equal(child.error, undefined, `${scenario.id} seed ${seed} process error: ${child.error?.message}`);
    assert.equal(child.status, 0, `${scenario.id} seed ${seed} failed:\n${child.stdout}\n${child.stderr}`);
    const result = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
    results.push(result);
    assert.equal(result.gameOver, false, `${scenario.id} seed ${seed} must not go bankrupt: ${JSON.stringify(result)}`);
    assert.equal(result.ipo, true, `${scenario.id} seed ${seed} must reach IPO: ${JSON.stringify(result)}`);
    assert.ok(result.ipoWeek >= 53 && result.ipoWeek <= MAX_WEEKS, `${scenario.id} seed ${seed} IPO week out of range: ${result.ipoWeek}`);
    assert.ok(result.reports >= 52, `${scenario.id} seed ${seed} must have 52 organic reports`);
    assert.ok(result.stores >= 3 && result.openStores >= 3, `${scenario.id} seed ${seed} must operate at least three stores`);
    assert.ok(result.annualProfit >= 10_000_000, `${scenario.id} seed ${seed} trailing profit below IPO gate: ${result.annualProfit}`);
    assert.ok(result.annualProfit < 200_000_000, `${scenario.id} seed ${seed} trailing profit is implausibly dominant: ${result.annualProfit}`);
    assert.ok(result.value >= 100_000_000 && result.value < 2_000_000_000, `${scenario.id} seed ${seed} company value out of calibrated range: ${result.value}`);
    assert.ok(result.debt >= 0 && result.debt < 100_000_000, `${scenario.id} seed ${seed} debt out of calibrated range: ${result.debt}`);
    assert.deepEqual(result.missing, [], `${scenario.id} seed ${seed} has remaining IPO blockers`);
    if (scenario.debt) assert.ok(result.debt > 0, `${scenario.id} seed ${seed} must exercise company borrowing`);
    else assert.equal(result.debt, 0, `${scenario.id} seed ${seed} bootstrap route must remain debt-free`);
  }
}

for (const scenario of SCENARIOS) {
  const rows = results.filter(result => result.id === scenario.id);
  assert.equal(rows.length, SEEDS.length, `${scenario.id} matrix coverage mismatch`);
  assert.equal(new Set(rows.map(result => result.seed)).size, SEEDS.length, `${scenario.id} seed coverage mismatch`);
}
assert.equal(results.length, SCENARIOS.length * SEEDS.length, 'strategy matrix size mismatch');
const summary = SCENARIOS.map(scenario => {
  const rows = results.filter(result => result.id === scenario.id);
  return {
    id: scenario.id,
    ipoWeeks: rows.map(result => result.ipoWeek),
    profitRange: [Math.min(...rows.map(result => result.annualProfit)), Math.max(...rows.map(result => result.annualProfit))],
    valueRange: [Math.min(...rows.map(result => result.value)), Math.max(...rows.map(result => result.value))],
    debtRange: [Math.min(...rows.map(result => result.debt)), Math.max(...rows.map(result => result.debt))]
  };
});
console.log(`STRATEGY_BALANCE_MATRIX ${JSON.stringify(summary)}`);
console.log('strategy balance matrix passed');
