'use strict';

const assert = require('node:assert/strict');
const { SCENARIOS, SEEDS, MAX_WEEKS, runScenario } = require('./strategy-balance-runner');

// Representative PR coverage. The full 13-strategy x 3-seed matrix remains on main/nightly.
const REPRESENTATIVE_CASES = Object.freeze([
  ['ramen-bootstrap', SEEDS[0]],
  ['conveni-leverage', SEEDS[1]],
  ['real-estate-agency', SEEDS[2]],
  ['beauty-service', SEEDS[0]],
  ['web-agency', SEEDS[1]],
]);

const results = [];
for (const [scenarioID, seed] of REPRESENTATIVE_CASES) {
  const scenario = SCENARIOS.find(row => row.id === scenarioID);
  assert.ok(scenario, `missing representative strategy scenario: ${scenarioID}`);
  const result = runScenario(scenario, seed);
  results.push(result);

  assert.equal(result.gameOver, false, `${scenarioID} seed ${seed} must not go bankrupt: ${JSON.stringify(result)}`);
  assert.equal(result.ipo, true, `${scenarioID} seed ${seed} must reach IPO: ${JSON.stringify(result)}`);
  assert.ok(result.ipoWeek >= 53 && result.ipoWeek <= MAX_WEEKS, `${scenarioID} seed ${seed} IPO week out of range: ${result.ipoWeek}`);
  assert.ok(result.reports >= 52, `${scenarioID} seed ${seed} must have 52 organic reports`);
  assert.ok(result.stores >= 3 && result.openStores >= 3, `${scenarioID} seed ${seed} must operate at least three stores`);
  assert.ok(result.annualProfit >= 10_000_000 && result.annualProfit < 200_000_000, `${scenarioID} seed ${seed} annual profit out of calibrated range: ${result.annualProfit}`);
  assert.ok(result.value >= 100_000_000 && result.value < 2_000_000_000, `${scenarioID} seed ${seed} company value out of calibrated range: ${result.value}`);
  assert.ok(result.debt >= 0 && result.debt < 100_000_000, `${scenarioID} seed ${seed} debt out of calibrated range: ${result.debt}`);
  assert.equal(result.missing.length, 0, `${scenarioID} seed ${seed} has remaining IPO blockers: ${JSON.stringify(result.missing)}`);
  if (scenario.debt) assert.ok(result.debt > 0, `${scenarioID} seed ${seed} must exercise company borrowing`);
  else assert.equal(result.debt, 0, `${scenarioID} seed ${seed} bootstrap route must remain debt-free`);
}

assert.equal(results.length, REPRESENTATIVE_CASES.length, 'strategy PR smoke coverage mismatch');
assert.equal(new Set(results.map(row => row.id)).size, REPRESENTATIVE_CASES.length, 'strategy PR smoke must not duplicate scenarios');
assert.ok(results.some(row => row.debtStrategy), 'strategy PR smoke must include leveraged strategies');
assert.ok(results.some(row => !row.debtStrategy), 'strategy PR smoke must include debt-free strategies');

console.log(`STRATEGY_PR_SMOKE ${JSON.stringify(results.map(row => ({ id: row.id, seed: row.seed, ipoWeek: row.ipoWeek, debt: row.debt, value: row.value })))} `);
console.log('strategy balance PR smoke passed');
