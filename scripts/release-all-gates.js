'use strict';

require('../tests/release-gate-wiring-test.js');

const { spawnSync } = require('node:child_process');

const gates = [
  ['release readiness', 'scripts/release-gate.js'],
  ['release hardening', 'scripts/release-hardening-gate.js'],
];

for (const [label, script] of gates) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`Unable to start ${label}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${label} failed.`);
    process.exit(result.status || 1);
  }
}

console.log('\nAll release gates passed.');
