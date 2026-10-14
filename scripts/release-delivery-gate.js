'use strict';

const { spawnSync } = require('node:child_process');

const checks = [
  ['mobile release contract', 'tests/mobile-release-contract-test.js', 30_000],
  ['cache-safe play entry', 'tests/play-entry-contract-test.js', 30_000],
  ['crisis UI observer composition', 'tests/crisis-ui-observer-contract-test.js', 30_000],
  ['setup recovery UI', 'tests/setup-recovery-ui-test.js', 30_000],
  ['game-over settings recovery', 'tests/game-over-settings-ui-test.js', 30_000],
  ['Pages deployment verifier', 'tests/pages-deployment-smoke-test.js', 45_000],
  ['published save quota contract', 'tests/published-save-quota-contract-test.js', 30_000],
  ['release candidate tag gate', 'tests/release-candidate-tag-gate-test.js', 30_000],
  ['recovery outcome attestation', 'tests/release-candidate-recovery-attestation-test.js', 30_000],
  ['iPhone WebKit smoke contract', 'tests/iphone-webkit-smoke-contract-test.js', 30_000],
  ['published WebKit transient retry contract', 'tests/published-webkit-transient-retry-test.js', 30_000],
  ['release attestation sync', 'tests/release-attestation-issue-test.js', 30_000],
  // 520-week CPU-bound audit. Measured on GitHub-hosted runners (17 passing PR runs, 2026-10-12):
  // 164.5-294.0 s, median 241 s, in three runner-speed clusters (~165 / ~235 / ~292 s); four runs were
  // killed at the old 300 s limit. 480 s keeps ~1.6x headroom over the slow cluster and stays well inside
  // the 30-minute release-readiness job limit. The test itself (weeks, assertions) is unchanged.
  ['save storage budget', 'tests/save-storage-budget-test.js', 480_000]
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
