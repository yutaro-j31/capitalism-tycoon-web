const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const caseScript = path.join(__dirname, 'difficulty-scenario-case.js');
const CASES = Object.freeze([
  Object.freeze({ strategy:'ramen-bootstrap', difficulty:'easy', gameScenario:'free', seed:1797259521 }),
  Object.freeze({ strategy:'cafe-bootstrap', difficulty:'easy', gameScenario:'standard', seed:1797259778 }),
  // conveni-leverage swapped for cram-school: see strategy-balance-pr-smoke-test.js and
  // docs/QA_AUDIT_2026-08-25.md C2 -- conveni-leverage is a known-unviable scenario since
  // the corporate-tax fix, tracked with an explicit exception in strategy-balance-matrix-test.js.
  Object.freeze({ strategy:'cram-school', difficulty:'normal', gameScenario:'free', seed:1797260035 }),
  Object.freeze({ strategy:'real-estate-agency', difficulty:'normal', gameScenario:'standard', seed:1797259521 }),
  Object.freeze({ strategy:'web-agency', difficulty:'hard', gameScenario:'free', seed:1797259778 }),
  Object.freeze({ strategy:'ramen-bootstrap', difficulty:'hard', gameScenario:'standard', seed:1797260035 })
]);

function runCase(testCase) {
  const child = spawnSync(process.execPath, [
    caseScript,
    testCase.strategy,
    testCase.difficulty,
    testCase.gameScenario,
    String(testCase.seed)
  ], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000
  });
  if (child.error || child.status !== 0) {
    process.stderr.write(child.stdout || '');
    process.stderr.write(child.stderr || '');
    throw child.error || new Error(`representative case failed: ${testCase.strategy}/${testCase.difficulty}/${testCase.gameScenario}/${testCase.seed}`);
  }
  return JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
}

assert.equal(CASES.length, 6, 'PR smoke must run exactly six representative cases');
assert.equal(new Set(CASES.map(row => row.strategy)).size, 5, 'PR smoke must cover all five matrix strategies');
for (const difficulty of ['easy','normal','hard']) {
  assert.equal(CASES.filter(row => row.difficulty === difficulty).length, 2, `${difficulty} must appear twice`);
}
for (const gameScenario of ['free','standard']) {
  assert.equal(CASES.filter(row => row.gameScenario === gameScenario).length, 3, `${gameScenario} must appear three times`);
}
for (const seed of [1797259521,1797259778,1797260035]) {
  assert.equal(CASES.filter(row => row.seed === seed).length, 2, `seed ${seed} must appear twice`);
}

const results = CASES.map(testCase => {
  const result = runCase(testCase);
  assert.equal(result.id, testCase.strategy);
  assert.equal(result.difficulty, testCase.difficulty);
  assert.equal(result.gameScenario, testCase.gameScenario);
  assert.equal(result.seed, testCase.seed);
  assert.equal(result.gameOver, false, `${testCase.strategy}/${testCase.difficulty}: representative case must not go bankrupt`);
  assert.ok(result.reports >= 52, `${testCase.strategy}/${testCase.difficulty}: representative case must produce reports`);
  assert.ok([result.cash,result.debt,result.value,result.annualProfit].every(Number.isFinite), `${testCase.strategy}: representative result must stay finite`);
  console.log(`DIFFICULTY_PR_SMOKE_RESULT ${JSON.stringify(result)}`);
  return result;
});

assert.equal(results.length, 6);
console.log(JSON.stringify({ cases:6, strategies:5, difficulties:3, scenarios:2, seeds:3 }, null, 2));
