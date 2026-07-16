const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCENARIOS, SEEDS } = require('./strategy-balance-runner');

const STRATEGY_IDS = Object.freeze(['ramen-bootstrap','cafe-bootstrap','conveni-leverage','real-estate-agency','web-agency']);
const DIFFICULTIES = Object.freeze(['easy','normal','hard']);
const GAME_SCENARIOS = Object.freeze(['free','standard']);
const strategies = STRATEGY_IDS.map(id => SCENARIOS.find(row => row.id === id));
const caseScript = path.join(__dirname, 'difficulty-scenario-case.js');
const results = [];

for (const strategy of strategies) {
  for (const difficulty of DIFFICULTIES) {
    for (const gameScenario of GAME_SCENARIOS) {
      for (const seed of SEEDS) {
        const child = spawnSync(process.execPath, [caseScript, strategy.id, difficulty, gameScenario, String(seed)], {
          encoding:'utf8',
          maxBuffer:16 * 1024 * 1024,
          timeout:180_000
        });
        if (child.error || child.status !== 0) {
          process.stderr.write(child.stdout || '');
          process.stderr.write(child.stderr || '');
          throw child.error || new Error(`case failed: ${strategy.id}/${difficulty}/${gameScenario}/${seed}`);
        }
        const result = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
        results.push(result);
        console.log(`DIFFICULTY_SCENARIO_RESULT ${JSON.stringify(result)}`);
      }
    }
  }
}

const summary = [];
for (const strategy of strategies) {
  for (const difficulty of DIFFICULTIES) {
    for (const gameScenario of GAME_SCENARIOS) {
      const rows = results.filter(row => row.id === strategy.id && row.difficulty === difficulty && row.gameScenario === gameScenario);
      summary.push({
        id:strategy.id,
        difficulty,
        gameScenario,
        passed:rows.filter(row => row.ipo).length,
        total:rows.length,
        gameOvers:rows.filter(row => row.gameOver).length,
        startingCash:[...new Set(rows.map(row => row.startingCash))],
        startingCredit:[...new Set(rows.map(row => row.startingCredit))],
        ipoWeeks:rows.map(row => row.ipoWeek),
        profitRange:[Math.min(...rows.map(row => row.annualProfit)),Math.max(...rows.map(row => row.annualProfit))],
        valueRange:[Math.min(...rows.map(row => row.value)),Math.max(...rows.map(row => row.value))],
        debtRange:[Math.min(...rows.map(row => row.debt)),Math.max(...rows.map(row => row.debt))],
        failures:rows.filter(row => !row.ipo).map(row => ({seed:row.seed,week:row.week,reason:row.reason,stores:row.stores,cash:row.cash,debt:row.debt,missing:row.missing}))
      });
    }
  }
}
console.log(`DIFFICULTY_SCENARIO_SUMMARY ${JSON.stringify(summary)}`);

const identicalScenarioPairs = [];
for (const strategy of strategies) {
  for (const difficulty of DIFFICULTIES) {
    for (const seed of SEEDS) {
      const free = results.find(row => row.id === strategy.id && row.difficulty === difficulty && row.gameScenario === 'free' && row.seed === seed);
      const standard = results.find(row => row.id === strategy.id && row.difficulty === difficulty && row.gameScenario === 'standard' && row.seed === seed);
      const keys = ['ipo','ipoWeek','gameOver','week','stores','cash','debt','value','annualProfit','reports'];
      if (keys.every(key => JSON.stringify(free[key]) === JSON.stringify(standard[key]))) identicalScenarioPairs.push({id:strategy.id,difficulty,seed});
    }
  }
}
console.log(`IDENTICAL_SCENARIO_PAIRS ${JSON.stringify({count:identicalScenarioPairs.length,total:strategies.length*DIFFICULTIES.length*SEEDS.length,pairs:identicalScenarioPairs})}`);
