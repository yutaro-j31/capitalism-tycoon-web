'use strict';

const { spawnSync } = require('node:child_process');

const commands = [
  ['node', ['tests/normal-start-ipo-balance-audit-test.js']],
  ['node', ['tests/strategy-balance-calibration-test.js']],
  ['node', ['tests/strategy-balance-matrix-test.js']],
  ['node', ['tests/difficulty-scenario-balance-test.js']],
  ['node', ['tests/difficulty-scenario-matrix-test.js']],
];

for (const [command, args] of commands) {
  const label = [command, ...args].join(' ');
  console.log(`\n[release-gate] ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`[release-gate] failed to start: ${label}`);
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[release-gate] failed: ${label} (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}

console.log('\n[release-gate] progression, strategy, difficulty, and scenario gates passed.');
