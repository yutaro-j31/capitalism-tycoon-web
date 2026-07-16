const assert = require('node:assert');
const { findStateIssues } = require('./harness');
const { SCENARIOS, runScenario } = require('./strategy-balance-runner');

const id = process.argv[2];
const seed = Number(process.argv[3]);
const scenario = SCENARIOS.find(row => row.id === id);
assert.ok(scenario, `unknown strategy scenario: ${id}`);
assert.ok(Number.isInteger(seed), `invalid strategy seed: ${process.argv[3]}`);

const result = runScenario(scenario, seed, { includeState: true });
const { state, modules, ...summary } = result;
const validation = modules.finance.validate(state);
assert.equal(validation.ok, true, validation.errors.join('\n'));
const serialized = JSON.stringify(state);
assert.ok(serialized.length > 0, 'strategy state must remain JSON serializable');
const issues = findStateIssues(JSON.parse(serialized)).filter(issue =>
  !issue.startsWith('g.finance.lastStatements.ratios.') &&
  !/^g\.finance\.transactions\[\d+\]\.inventoryAmount: negative quantity\/inventory\/share value$/.test(issue)
);
assert.deepEqual(issues, []);
process.stdout.write(`${JSON.stringify(summary)}\n`);
