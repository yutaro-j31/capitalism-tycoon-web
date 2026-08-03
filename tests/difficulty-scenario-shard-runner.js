const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCENARIOS, SEEDS } = require('./strategy-balance-runner');

const STRATEGY_IDS = ['ramen-bootstrap','cafe-bootstrap','conveni-leverage','real-estate-agency','web-agency'];
const DIFFICULTIES = ['easy','normal','hard'];
const GAME_SCENARIOS = ['free','standard'];
const caseScript = path.join(__dirname, 'difficulty-scenario-case.js');

function integerEnv(name) {
  const value = Number(process.env[name]);
  assert.ok(Number.isInteger(value), `${name} must be an integer`);
  return value;
}
function runCase({strategy,difficulty,gameScenario,seed}) {
  const child = spawnSync(process.execPath, [caseScript, strategy.id, difficulty, gameScenario, String(seed)], {
    encoding:'utf8', maxBuffer:16 * 1024 * 1024, timeout:180_000
  });
  if (child.error || child.status !== 0) {
    process.stderr.write(child.stdout || '');
    process.stderr.write(child.stderr || '');
    throw child.error || new Error(`case failed: ${strategy.id}/${difficulty}/${gameScenario}/${seed}`);
  }
  return JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
}

const shardIndex = integerEnv('DIFFICULTY_MATRIX_SHARD_INDEX');
const shardCount = integerEnv('DIFFICULTY_MATRIX_SHARD_COUNT');
const outputFile = process.env.DIFFICULTY_MATRIX_OUTPUT;
assert.ok(shardCount >= 1, 'DIFFICULTY_MATRIX_SHARD_COUNT must be at least 1');
assert.ok(shardIndex >= 0 && shardIndex < shardCount, 'DIFFICULTY_MATRIX_SHARD_INDEX must be within shard count');
assert.ok(outputFile, 'DIFFICULTY_MATRIX_OUTPUT is required');

const cases = [];
for (const id of STRATEGY_IDS) {
  const strategy = SCENARIOS.find(row => row.id === id);
  assert.ok(strategy, `missing strategy ${id}`);
  for (const difficulty of DIFFICULTIES) for (const gameScenario of GAME_SCENARIOS) for (const seed of SEEDS) cases.push({strategy,difficulty,gameScenario,seed});
}
assert.equal(cases.length, 90, 'expected 90 difficulty/scenario cases');
const selected = cases.filter((_, caseIndex) => caseIndex % shardCount === shardIndex);
assert.ok(selected.length > 0, 'selected shard must contain at least one case');
const results = selected.map(testCase => {
  const result = runCase(testCase);
  console.log(`DIFFICULTY_SCENARIO_RESULT ${JSON.stringify(result)}`);
  return result;
});
fs.mkdirSync(path.dirname(outputFile), {recursive:true});
fs.writeFileSync(outputFile, `${JSON.stringify(results)}\n`);
console.log(JSON.stringify({shardIndex,shardCount,cases:results.length,totalCases:cases.length},null,2));
