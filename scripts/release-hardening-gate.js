'use strict';

const { spawnSync } = require('node:child_process');

const gates = [
  'test:syntax',
  'test:static',
  'test:save',
  'test:migration',
  'test:save-v9',
  'test:load',
  'test:css',
  'test:javascript',
  'test:modules',
  'test:player-crisis-ui',
  'test:player-crisis-restructuring-ui',
  'test:market-ui',
  'test:finance-ui',
  'test:workforce-ui',
  'test:competitor-ui',
  'test:stock-chart'
];

for (const gate of gates) {
  console.log(`\n=== Release hardening: ${gate} ===`);
  const result = spawnSync('npm', ['run', gate], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.error) {
    console.error(`Unable to start ${gate}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Release hardening failed at ${gate}.`);
    process.exit(result.status || 1);
  }
}

console.log('\nRelease hardening gate passed.');
