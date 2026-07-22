const { spawnSync } = require('node:child_process');

const commands = [
  'test:syntax','test:static','test:save','test:migration','test:save-v9',
  'test:player-crisis','test:player-crisis-actions','test:player-crisis-ui','test:player-crisis-restructuring','test:player-crisis-restructuring-ui','test:player-debt-service','test:player-turnaround-plan',
  'test:load','test:week','test:transaction','test:long','test:css','test:javascript','test:modules','test:stock',
  'test:market','test:market-migration','test:market-ui','test:market-capacity','test:market-cannibalization','test:market-calibration','test:market-order','test:market-opening','test:market-rng',
  'test:finance','test:statements','test:cashflow','test:working-capital','test:finance-migration','test:finance-ui','test:accounting-invariants','test:finance-advanced','test:finance-history','test:finance-rng','test:finance-user-action-snapshot','test:finance-cash-mutation-coverage','test:finance-book-value','test:finance-working-capital-integration','test:finance-archive-rollforward','test:finance-migrated-advanced-save','test:finance-product-venture','test:finance-startup-subsidiary','test:finance-subsidiary-ipo','test:finance-ma-accounting','test:finance-working-capital-rollforward','test:finance-store-close-deposit','test:finance-property-building-disposal',
  'test:supply','test:inventory','test:procurement','test:supply-finance','test:supply-migration','test:supply-ui','test:supply-rng','test:supply-calibration','test:supplier-coverage','test:supply-procurement-cash','test:supply-store-close','test:supply-spoilage-profit','test:supply-multi-store-spoilage','test:supply-long',
  'test:workforce','test:workforce-long',
  'test:competitor','test:competitor-market','test:competitor-finance','test:competitor-ai','test:competitor-entry-exit','test:competitor-migration','test:competitor-ui','test:competitor-rng','test:competitor-calibration','test:competitor-history','test:competitor-multi-presence','test:competitor-projects','test:competitor-market-entry','test:competitor-credit','test:competitor-distress-lifecycle','test:competitor-terminal-compat','test:competitor-media','test:competitor-parity','test:competitor-dashboard','test:competitor-long',
  'test:product-innovation'
];

for (const command of commands) {
  const result = spawnSync('npm', ['run', command, '--silent'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false
  });
  if (result.status) {
    console.error(`::error title=Test suite failed::${command}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

for (const [name, file] of [
  ['difficulty-scenario-balance', 'tests/difficulty-scenario-balance-test.js'],
  ['competitor-dashboard-ui', 'tests/competitor-dashboard-ui-test.js'],
  ['d-ui-context-tabs', 'tests/d-ui-context-tabs-test.js'],
  ['v1-progression-gate', 'tests/v1-progression-gate-test.js'],
  ['treasury-prepayment', 'tests/treasury-prepayment-test.js'],
  ['treasury-refinancing-policy', 'tests/treasury-refinancing-policy-test.js'],
  ['shareholder-returns', 'tests/shareholder-returns-test.js'],
  ['capital-allocation-score', 'tests/capital-allocation-score-test.js'],
  ['capital-allocation-policy', 'tests/capital-allocation-policy-test.js'],
  ['capital-allocation-comparison', 'tests/capital-allocation-comparison-test.js'],
  ['capital-allocation-actions', 'tests/capital-allocation-actions-test.js'],
  ['capital-allocation-breakdown', 'tests/capital-allocation-breakdown-test.js'],
  ['capital-allocation-recovery', 'tests/capital-allocation-recovery-test.js'],
  ['capital-allocation-decision-memo', 'tests/capital-allocation-decision-memo-test.js'],
  ['capital-allocation-stress-test', 'tests/capital-allocation-stress-test-test.js'],
  ['capital-allocation-resilience-memo', 'tests/capital-allocation-resilience-memo-test.js'],
  ['capital-allocation-recovery-audit', 'tests/capital-allocation-recovery-audit-test.js'],
  ['capital-allocation-recovery-funding', 'tests/capital-allocation-recovery-funding-test.js'],
  ['capital-allocation-recovery-funding-options', 'tests/capital-allocation-recovery-funding-options-test.js'],
  ['capital-allocation-recovery-funding-readiness', 'tests/capital-allocation-recovery-funding-readiness-test.js'],
  ['capital-allocation-recovery-funding-reconciliation', 'tests/capital-allocation-recovery-funding-reconciliation-test.js'],
  ['capital-allocation-recovery-target-selector', 'tests/capital-allocation-recovery-target-selector-test.js'],
  ['capital-allocation-recovery-funding-outcome', 'tests/capital-allocation-recovery-funding-outcome-test.js'],
  ['capital-allocation-management-guide', 'tests/capital-allocation-management-guide-test.js'],
  ['capital-allocation-section-nav', 'tests/capital-allocation-section-nav-test.js'],
  ['capital-allocation-recovery-save-reload', 'tests/capital-allocation-recovery-save-reload-test.js'],
  ['capital-allocation-production-wiring', 'tests/capital-allocation-production-wiring-test.js']
]) {
  const result = spawnSync('node', [file], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false
  });
  if (result.status) {
    console.error(`::error title=Test suite failed::${name}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

console.log(`all ${commands.length} test commands, difficulty/scenario balance, competitor dashboard UI, D UI context tabs, provisional v1 progression gate, treasury prepayment, refinancing policy, shareholder returns, capital allocation score, capital allocation policy, capital allocation comparison, capital allocation actions, capital allocation score breakdown, capital allocation recovery targets, capital allocation board decision memo, capital allocation board stress test, capital allocation resilience memo, capital allocation recovery audit, capital allocation recovery funding, capital allocation recovery funding options, capital allocation recovery funding readiness, capital allocation recovery funding reconciliation, capital allocation recovery target selector, capital allocation recovery funding outcome, capital allocation management guide, capital allocation recovery save reload, and capital allocation production wiring passed`);
