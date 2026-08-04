'use strict';

const { spawnSync } = require('node:child_process');

const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';
const strategyMatrixTest = isPullRequest
  ? 'tests/strategy-balance-pr-smoke-test.js'
  : 'tests/strategy-balance-matrix-test.js';
const difficultyMatrixTest = isPullRequest
  ? 'tests/difficulty-scenario-pr-smoke-test.js'
  : 'tests/difficulty-scenario-matrix-test.js';

const commands = [
  ['node', ['tests/workflow-path-filter-contract-test.js']],
  ['node', ['tests/normal-start-ipo-balance-audit-test.js']],
  ['node', ['tests/strategy-balance-calibration-test.js']],
  ['node', [strategyMatrixTest]],
  ['node', ['tests/difficulty-scenario-balance-test.js']],
  ['node', [difficultyMatrixTest]],
];

console.log(`[release-gate] mode=${isPullRequest ? 'pull-request-representative' : 'full-release'} strategyMatrix=${strategyMatrixTest} difficultyMatrix=${difficultyMatrixTest}`);

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

console.log(`\n[release-gate] workflow filters, progression, strategy, difficulty, and scenario gates passed (${isPullRequest ? 'representative PR matrices' : 'full matrices'}).`);
