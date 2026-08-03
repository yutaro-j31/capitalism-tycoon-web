const assert = require('node:assert');
const { findStateIssues } = require('./harness');
const { SCENARIOS, runScenario } = require('./strategy-balance-runner');

const id = process.argv[2];
const difficulty = process.argv[3];
const gameScenario = process.argv[4];
const seed = Number(process.argv[5]);
const strategy = SCENARIOS.find(row => row.id === id);
assert.ok(strategy, `unknown strategy: ${id}`);
assert.ok(['easy','normal','hard'].includes(difficulty), `invalid difficulty: ${difficulty}`);
assert.ok(['free','standard'].includes(gameScenario), `invalid scenario: ${gameScenario}`);
assert.ok(Number.isInteger(seed), `invalid seed: ${process.argv[5]}`);

const result = runScenario(strategy, seed, { includeState:true, difficulty, gameScenario });
const { state, modules, ...summary } = result;
const validation = modules.finance.validate(state);
assert.equal(validation.ok, true, validation.errors.join('\n'));
const weeklyCashDrift = (state.finance?.weeklySnapshots || []).filter(row => Math.abs(Number(row.cashDifference || 0)) > 0.01);
assert.equal(
  weeklyCashDrift.length,
  0,
  `weekly cash rounding drift must stay within one cent: ${weeklyCashDrift.slice(0,5).map(row => `week ${row.week}: ${row.cashDifference}`).join(', ')}`
);
modules.difficultyScenarioBalance.validate(state);
const serialized = JSON.stringify(state);
assert.ok(serialized.length > 0, 'state must remain JSON serializable');
const issues = findStateIssues(JSON.parse(serialized)).filter(issue =>
  !issue.startsWith('g.finance.lastStatements.ratios.') &&
  !/^g\.finance\.lastStatements\.(?:cashFlow|workingCapital)\.inventoryChange: negative quantity\/inventory\/share value$/.test(issue) &&
  !/^g\.finance\.transactions\[\d+\]\.inventoryAmount: negative quantity\/inventory\/share value$/.test(issue)
);
assert.deepEqual(issues, []);
process.stdout.write(`${JSON.stringify(summary)}\n`);
