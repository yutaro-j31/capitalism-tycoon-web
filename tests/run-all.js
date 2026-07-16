const { spawnSync } = require('node:child_process');

const commands = [
  'test:syntax','test:static','test:save','test:migration','test:save-v9',
  'test:player-crisis','test:player-crisis-actions','test:player-crisis-ui','test:player-crisis-restructuring','test:player-crisis-restructuring-ui','test:player-debt-service',
  'test:load','test:week','test:transaction','test:long','test:css','test:javascript','test:modules','test:stock',
  'test:market','test:market-migration','test:market-ui','test:market-capacity','test:market-cannibalization','test:market-calibration','test:market-order','test:market-opening','test:market-rng',
  'test:finance','test:statements','test:cashflow','test:working-capital','test:finance-migration','test:finance-ui','test:accounting-invariants','test:finance-advanced','test:finance-history','test:finance-rng','test:finance-user-action-snapshot','test:finance-cash-mutation-coverage','test:finance-book-value','test:finance-working-capital-integration','test:finance-archive-rollforward','test:finance-migrated-advanced-save','test:finance-product-venture','test:finance-startup-subsidiary','test:finance-subsidiary-ipo','test:finance-ma-accounting','test:finance-working-capital-rollforward','test:finance-store-close-deposit','test:finance-property-building-disposal',
  'test:supply','test:inventory','test:procurement','test:supply-finance','test:supply-migration','test:supply-ui','test:supply-rng','test:supply-calibration','test:supplier-coverage','test:supply-procurement-cash','test:supply-store-close','test:supply-spoilage-profit','test:supply-multi-store-spoilage','test:supply-long',
  'test:workforce','test:workforce-long',
  'test:competitor','test:competitor-market','test:competitor-finance','test:competitor-ai','test:competitor-entry-exit','test:competitor-migration','test:competitor-ui','test:competitor-rng','test:competitor-calibration','test:competitor-history','test:competitor-multi-presence','test:competitor-projects','test:competitor-market-entry','test:competitor-credit','test:competitor-distress-lifecycle','test:competitor-terminal-compat','test:competitor-media','test:competitor-parity','test:competitor-dashboard','test:competitor-long'
];

for (const command of commands) {
  const result = spawnSync('npm', ['run', command, '--silent'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
  if (result.status) {
    console.error(`::error title=Test suite failed::${command}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

for (const [name, file] of [
  ['competitor-dashboard-ui', 'tests/competitor-dashboard-ui-test.js'],
  ['v1-progression-gate', 'tests/v1-progression-gate-test.js']
]) {
  const result = spawnSync('node', [file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
  if (result.status) {
    console.error(`::error title=Test suite failed::${name}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

console.log(`all ${commands.length} test commands, competitor dashboard UI, and provisional v1 progression gate passed`);
