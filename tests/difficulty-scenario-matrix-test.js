const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCENARIOS, SEEDS } = require('./strategy-balance-runner');

const STRATEGY_IDS = ['ramen-bootstrap','cafe-bootstrap','conveni-leverage','real-estate-agency','web-agency'];
const DIFFICULTIES = ['easy','normal','hard'];
const GAME_SCENARIOS = ['free','standard'];
const ECONOMIC_KEYS = ['ipo','ipoWeek','gameOver','week','stores','openStores','cash','debt','value','annualProfit','reports','calibratedDemand'];
const EXPECTED_START = {easy:[12_000_000,70],normal:[8_000_000,60],hard:[6_000_000,50]};
const strategies = STRATEGY_IDS.map(id => SCENARIOS.find(row => row.id === id));
const caseScript = path.join(__dirname, 'difficulty-scenario-case.js');

const close = (actual, expected, tolerance = 1e-8) => Math.abs(Number(actual) - Number(expected)) <= tolerance * Math.max(1, Math.abs(Number(expected)));
const expectedGrade = week => week <= 78 ? 'S' : week <= 104 ? 'A' : week <= 130 ? 'B' : week <= 156 ? 'C' : week <= 208 ? 'D' : 'E';
const expectedScore = week => Math.max(0, Math.min(100, Math.round(100 - Math.max(0, week - 52) * 100 / 156)));

function integerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  assert.ok(Number.isInteger(value), `${name} must be an integer`);
  return value;
}
function enumerateCases() {
  const cases = [];
  for (const strategy of strategies) {
    assert.ok(strategy, 'all configured strategies must exist');
    for (const difficulty of DIFFICULTIES) for (const gameScenario of GAME_SCENARIOS) for (const seed of SEEDS) cases.push({strategy,difficulty,gameScenario,seed});
  }
  assert.equal(cases.length, 90, 'expected 90 difficulty/scenario cases');
  return cases;
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
function validateIndividual(result) {
  const [cash, credit] = EXPECTED_START[result.difficulty];
  assert.equal(result.startingCash, cash, `${result.id}/${result.difficulty}: starting cash mismatch`);
  assert.equal(result.startingCredit, credit, `${result.id}/${result.difficulty}: starting credit mismatch`);
  assert.equal(result.gameOver, false, `${result.id}/${result.difficulty}/${result.seed}: bankruptcy is not acceptable`);
  assert.ok(result.reports >= 52, `${result.id}/${result.difficulty}/${result.seed}: insufficient organic reports`);
  assert.ok(result.stores >= 3, `${result.id}/${result.difficulty}/${result.seed}: insufficient stores`);
  assert.ok(result.openStores >= 3, `${result.id}/${result.difficulty}/${result.seed}: insufficient open stores`);
  assert.ok([result.cash,result.debt,result.value,result.annualProfit].every(Number.isFinite), `${result.id}: non-finite result`);
  if (result.debtStrategy) {
    assert.ok(result.borrowingAttempts.some(row => row.result), `${result.id}/${result.difficulty}: leveraged route must borrow`);
    assert.ok(result.debt > 0, `${result.id}/${result.difficulty}: leveraged route must retain debt at IPO audit`);
  } else assert.equal(result.debt, 0, `${result.id}/${result.difficulty}: bootstrap route must remain debt-free`);
  // Issue #294 fixed the executive-hiring API collision, so every difficulty must now reach IPO.
  assert.equal(result.ipo, true, `${result.id}/${result.difficulty}/${result.seed}: every matrix case must reach IPO`);
  assert.ok(result.ipoWeek <= 208, `${result.id}/${result.difficulty}: IPO must occur by week 208`);
  if (result.gameScenario === 'free') {
    assert.equal(result.scenarioStatus, 'free');
    assert.equal(result.scenarioTargetWeek, null);
    assert.equal(result.scenarioCompletedWeek, null);
    assert.equal(result.scenarioScore, null);
    assert.equal(result.scenarioGrade, null);
  } else {
    assert.equal(result.scenarioTargetWeek, 208);
    assert.equal(result.scenarioStatus, 'completed');
    assert.equal(result.scenarioCompletedWeek, result.ipoWeek);
    assert.equal(result.scenarioScore, expectedScore(result.ipoWeek));
    assert.equal(result.scenarioGrade, expectedGrade(result.ipoWeek));
  }
}
function validateAggregate(results) {
  assert.equal(results.length, 90, 'expected 90 aggregated difficulty/scenario cases');
  const keys = results.map(row => `${row.id}/${row.difficulty}/${row.gameScenario}/${row.seed}`);
  assert.equal(new Set(keys).size, 90, 'aggregated cases must not contain duplicates');
  results.forEach(validateIndividual);

  for (const strategy of strategies) for (const gameScenario of GAME_SCENARIOS) for (const difficulty of DIFFICULTIES) {
    const rows = results.filter(row => row.id === strategy.id && row.gameScenario === gameScenario && row.difficulty === difficulty);
    const passed = rows.filter(row => row.ipo).length;
    assert.equal(rows.length, 3, `${strategy.id}/${difficulty}/${gameScenario}: expected three seeds`);
    assert.equal(passed, 3, `${strategy.id}/${difficulty}/${gameScenario}: all seeds must reach IPO after Issue #294`);
  }

  for (const strategy of strategies) for (const difficulty of DIFFICULTIES) for (const seed of SEEDS) {
    const free = results.find(row => row.id === strategy.id && row.difficulty === difficulty && row.gameScenario === 'free' && row.seed === seed);
    const standard = results.find(row => row.id === strategy.id && row.difficulty === difficulty && row.gameScenario === 'standard' && row.seed === seed);
    assert.ok(free && standard, `${strategy.id}/${difficulty}/${seed}: missing scenario pair`);
    for (const key of ECONOMIC_KEYS) assert.deepEqual(standard[key], free[key], `${strategy.id}/${difficulty}/${seed}: scenario changed economic key ${key}`);
  }

  for (const strategy of strategies) for (const seed of SEEDS) {
    const rows = Object.fromEntries(DIFFICULTIES.map(difficulty => [difficulty, results.find(row => row.id === strategy.id && row.difficulty === difficulty && row.gameScenario === 'free' && row.seed === seed)]));
    assert.ok((rows.easy.ipoWeek || 209) <= (rows.normal.ipoWeek || 209), `${strategy.id}/${seed}: Easy must not progress slower than Normal`);
    assert.ok((rows.normal.ipoWeek || 209) <= (rows.hard.ipoWeek || 209), `${strategy.id}/${seed}: Normal must not progress slower than Hard`);
    assert.ok(close(rows.easy.calibratedDemand, rows.normal.calibratedDemand * 1.1), `${strategy.id}/${seed}: Easy demand multiplier mismatch`);
    assert.ok(close(rows.hard.calibratedDemand, rows.normal.calibratedDemand), `${strategy.id}/${seed}: Hard demand must match Normal`);
  }

  const economicCases = results.filter(row => row.gameScenario === 'free');
  // Issue #294 restored the legacy CEO/CFO hiring path; any future drop below 45/45 or 90/90 is a regression.
  assert.equal(economicCases.filter(row => row.ipo).length, 45, 'expected all 45 unique economic cases to reach IPO');
  assert.equal(results.filter(row => row.ipo).length, 90, 'expected all 90 scenario rows to reach IPO');
  assert.equal(results.filter(row => row.gameOver).length, 0, 'no matrix case may go bankrupt');
  console.log(JSON.stringify({cases:90,economicCases:45,ipoEconomicCases:45,ipoScenarioRows:90,bankruptcies:0,scenarioEconomicParityPairs:45},null,2));
}
function readAggregateDirectory(directory) {
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.json')).sort();
  assert.ok(files.length > 0, 'aggregate directory must contain shard JSON files');
  return files.flatMap(file => {
    const rows = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    assert.ok(Array.isArray(rows), `${file} must contain a JSON array`);
    return rows;
  });
}

const aggregateDirectory = process.env.DIFFICULTY_MATRIX_AGGREGATE_DIR;
if (aggregateDirectory) validateAggregate(readAggregateDirectory(aggregateDirectory));
else {
  const shardCount = integerEnv('DIFFICULTY_MATRIX_SHARD_COUNT', 1);
  const shardIndex = integerEnv('DIFFICULTY_MATRIX_SHARD_INDEX', 0);
  assert.ok(shardCount >= 1, 'DIFFICULTY_MATRIX_SHARD_COUNT must be at least 1');
  assert.ok(shardIndex >= 0 && shardIndex < shardCount, 'DIFFICULTY_MATRIX_SHARD_INDEX must be within shard count');
  const allCases = enumerateCases();
  const selectedCases = allCases.filter((_, caseIndex) => caseIndex % shardCount === shardIndex);
  assert.ok(selectedCases.length > 0, 'selected shard must contain at least one case');
  const results = selectedCases.map(testCase => {
    const result = runCase(testCase);
    validateIndividual(result);
    console.log(`DIFFICULTY_SCENARIO_RESULT ${JSON.stringify(result)}`);
    return result;
  });
  const outputFile = process.env.DIFFICULTY_MATRIX_OUTPUT;
  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), {recursive:true});
    fs.writeFileSync(outputFile, `${JSON.stringify(results)}\n`);
  }
  if (shardCount === 1) validateAggregate(results);
  else console.log(JSON.stringify({shardIndex,shardCount,cases:results.length,totalCases:allCases.length},null,2));
}
