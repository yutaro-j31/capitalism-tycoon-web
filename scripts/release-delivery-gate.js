'use strict';

const { spawnSync } = require('node:child_process');

const checks = [
  ['mobile release contract', 'tests/mobile-release-contract-test.js', 30_000],
  ['cache-safe play entry', 'tests/play-entry-contract-test.js', 30_000],
  ['WebKit week event yield', 'tests/webkit-week-yield-contract-test.js', 30_000],
  ['setup recovery UI', 'tests/setup-recovery-ui-test.js', 30_000],
  ['game-over settings recovery', 'tests/game-over-settings-ui-test.js', 30_000],
  ['Pages deployment verifier', 'tests/pages-deployment-smoke-test.js', 45_000],
  ['release candidate tag gate', 'tests/release-candidate-tag-gate-test.js', 30_000],
  ['iPhone WebKit smoke contract', 'tests/iphone-webkit-smoke-contract-test.js', 30_000],
  ['release attestation sync', 'tests/release-attestation-issue-test.js', 30_000],
  ['save storage budget', 'tests/save-storage-budget-test.js', 180_000]
];

for (const [label, script, timeout] of checks) {
  console.log(`\n=== Release delivery: ${label} ===`);
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: process.env,
    timeout
  });

  if (result.error) {
    console.error(`Unable to complete ${label}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Release delivery failed at ${label}.`);
    process.exit(result.status || 1);
  }
}

console.log('\nRelease delivery gate passed.');
