const { spawnSync } = require('node:child_process');

const commands = [
  'test:syntax','test:static','test:save','test:migration','test:save-v9',
  'test:player-crisis','test:player-crisis-actions','test:player-crisis-ui','test:player-crisis-restructuring','test:player-crisis-restructuring-ui','test:player-debt-service','test:player-turnaround-plan',
  'test:load','test:week','test:transaction','test:long','test:css','test:javascript','test:modules','test:stock',
  'test:market','test:market-migration','test:market-ui','test:market-capacity','test:market-cannibalization','test:market-calibration','test:market-order','test:market-opening','test:market-rng',
  'test:finance','test:statements','test:cashflow','test:working-capital','test:finance-migration','test:finance-ui','test:accounting-invariants','test:finance-advanced','test:finance-history','test:finance-rng','test:finance-user-action-snapshot','test:finance-cash-mutation-coverage','test:finance-book-value','test:finance-working-capital-integration','test:finance-archive-rollforward','test:finance-migrated-advanced-save','test:finance-product-venture','test:finance-startup-subsidiary','test:finance-subsidiary-ipo','test:finance-ma-accounting','test:finance-working-capital-rollforward','test:finance-store-close-deposit','test:finance-property-building-disposal',
  'test:vertical-integration-determinism','test:supply','test:inventory','test:procurement','test:supply-finance','test:supply-migration','test:supply-ui','test:supply-rng','test:supply-calibration','test:supplier-coverage','test:supply-procurement-cash','test:supply-store-close','test:supply-spoilage-profit','test:supply-multi-store-spoilage','test:supply-long',
  'test:workforce','test:workforce-long',
  'test:competitor','test:competitor-market','test:competitor-finance','test:competitor-ai','test:competitor-entry-exit','test:competitor-migration','test:competitor-ui','test:competitor-rng','test:competitor-calibration','test:competitor-history','test:competitor-multi-presence','test:competitor-projects','test:competitor-market-entry','test:competitor-credit','test:competitor-distress-lifecycle','test:competitor-terminal-compat','test:competitor-media','test:competitor-parity','test:competitor-dashboard','test:competitor-long',
  'test:product-innovation','test:ceo-dashboard','test:ma-acquisition-financing','test:weekly-impact','test:founding-tutorial','test:ma-deal-room','test:ma-integration','test:ma-portfolio-summary','test:ma-portfolio-summary-ui','test:ma-board-approval'

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
  ['save-storage-quota', 'tests/save-storage-quota-test.js'],
  ['save-storage-recovery-actions', 'tests/save-storage-recovery-actions-test.js'],
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
  ['capital-allocation-production-wiring', 'tests/capital-allocation-production-wiring-test.js'],
  ['ma-exit-readiness', 'tests/ma-exit-readiness-test.js'],
  ['internal-venture-business', 'tests/internal-venture-business-test.js'],
  ['subsidiary-ipo-preparation', 'tests/subsidiary-ipo-preparation-test.js'],
  ['listed-subsidiary-market', 'tests/listed-subsidiary-market-test.js'],
  ['listed-subsidiary-portfolio-dashboard', 'tests/listed-subsidiary-portfolio-dashboard-test.js'],
  ['listed-subsidiary-control-actions', 'tests/listed-subsidiary-control-actions-test.js'],
  ['subsidiary-integration-synergy', 'tests/subsidiary-integration-synergy-test.js'],
  ['inter-subsidiary-synergy-allocation', 'tests/inter-subsidiary-synergy-allocation-test.js'],
  ['inter-subsidiary-synergy-performance', 'tests/inter-subsidiary-synergy-performance-test.js'],
  ['group-capital-allocation-actions', 'tests/group-capital-allocation-actions-test.js'],
  ['group-restructuring-candidates', 'tests/group-restructuring-candidates-test.js'],
  ['group-restructuring-progress', 'tests/group-restructuring-progress-test.js'],
  ['subsidiary-relisting-options', 'tests/subsidiary-relisting-options-test.js'],
  ['listed-subsidiary-follow-on-offering', 'tests/listed-subsidiary-follow-on-offering-test.js'],
  ['executive-secretary', 'tests/executive-secretary-test.js'],
  ['executive-secretary-ui', 'tests/executive-secretary-ui-test.js'],
  ['executive-secretary-purity', 'tests/executive-secretary-purity-test.js']
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

console.log(`all ${commands.length} test commands including save storage quota recovery, save storage recovery actions, M&A board approval, M&A deal room, M&A integration, M&A portfolio summary, M&A exit readiness, internal venture funding and spin-off, staged subsidiary IPO preparation, listed subsidiary market operations, listed subsidiary portfolio dashboard, listed subsidiary TOB and squeeze-out control actions, wholly owned subsidiary integration synergy investments, inter-subsidiary synergy allocation and performance, group capital allocation actions, subsidiary relisting strategies, listed subsidiary follow-on offering capital policy, vertical integration determinism, difficulty/scenario balance, competitor dashboard UI, D UI context tabs, provisional v1 progression gate, treasury prepayment, refinancing policy, shareholder returns, capital allocation score, capital allocation policy, capital allocation comparison, capital allocation actions, capital allocation score breakdown, capital allocation recovery targets, capital allocation board decision memo, capital allocation board stress test, capital allocation resilience memo, capital allocation recovery audit, capital allocation recovery funding, capital allocation recovery funding options, capital allocation recovery funding readiness, capital allocation recovery funding reconciliation, capital allocation recovery target selector, capital allocation recovery funding outcome, capital allocation management guide, capital allocation recovery save reload, capital allocation production wiring, executive secretary, executive secretary UI, executive secretary purity, and CEO dashboard passed`);
console.log('Weekly Impact recap is registered in run-all and all tests passed');
