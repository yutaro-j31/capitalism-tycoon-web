const { SCENARIOS, runMatrix } = require('./strategy-balance-runner');

const results = runMatrix();
for (const result of results) {
  const { state, modules, ...summary } = result;
  console.log(`STRATEGY_RESULT ${JSON.stringify(summary)}`);
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
