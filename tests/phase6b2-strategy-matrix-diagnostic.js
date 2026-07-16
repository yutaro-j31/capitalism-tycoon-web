const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCENARIOS, SEEDS } = require('./strategy-balance-runner');

const caseScript = path.join(__dirname, 'strategy-balance-case.js');
const results = [];
for (const scenario of SCENARIOS) {
  for (const seed of SEEDS) {
    const child = spawnSync(process.execPath, [caseScript, scenario.id, String(seed)], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024
    });
    if (child.status !== 0) {
      process.stderr.write(child.stdout || '');
      process.stderr.write(child.stderr || '');
      throw new Error(`strategy case failed: ${scenario.id} seed ${seed}`);
    }
    const result = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
    results.push(result);
    console.log(`STRATEGY_RESULT ${JSON.stringify(result)}`);
  }
}
const summary = SCENARIOS.map(scenario => {
  const rows = results.filter(result => result.id === scenario.id);
  return {
    id: scenario.id,
    passed: rows.filter(result => result.ipo).length,
    total: rows.length,
    ipoWeeks: rows.filter(result => result.ipoWeek).map(result => result.ipoWeek),
    annualProfitRange: [Math.min(...rows.map(result => result.annualProfit)), Math.max(...rows.map(result => result.annualProfit))],
    valueRange: [Math.min(...rows.map(result => result.value)), Math.max(...rows.map(result => result.value))],
    debtRange: [Math.min(...rows.map(result => result.debt)), Math.max(...rows.map(result => result.debt))],
    failures: rows.filter(result => !result.ipo).map(result => ({
      seed: result.seed,
      gameOver: result.gameOver,
      reason: result.reason,
      missing: result.missing,
      value: result.value,
      annualProfit: result.annualProfit
    }))
  };
});
console.log(`STRATEGY_SUMMARY ${JSON.stringify(summary)}`);
