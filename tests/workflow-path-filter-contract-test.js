'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowRoot = path.resolve('.github/workflows');
const workflowFiles = fs.readdirSync(workflowRoot).filter(file => /\.ya?ml$/.test(file)).sort();
const readWorkflow = file => fs.readFileSync(path.join(workflowRoot, file), 'utf8');
const hasTrigger = (source, trigger) => new RegExp(`^  ${trigger}:\\s*$`, 'm').test(source);
const isMainOnly = block => block.some((line, index) =>
  /branches:\s*\[\s*main\s*\]/.test(line)
  || (/^    branches:\s*$/.test(line) && /^      -\s+main\s*$/.test(block[index + 1] || ''))
);

function triggerBlock(source, trigger) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(line => new RegExp(`^  ${trigger}:\\s*$`).test(line));
  if (start < 0) return [];
  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(lines[index]) || /^[A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(lines[index])) break;
    block.push(lines[index]);
  }
  return block;
}

function pathsFor(source, trigger) {
  const block = triggerBlock(source, trigger);
  const start = block.findIndex(line => /^    paths:\s*$/.test(line));
  if (start < 0) return [];
  const paths = [];
  for (let index = start + 1; index < block.length; index += 1) {
    const match = block[index].match(/^      -\s+['"]?(.+?)['"]?\s*$/);
    if (!match) break;
    paths.push(match[1]);
  }
  return paths;
}

function jobBlock(source, job) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(line => line === `  ${job}:`);
  assert(start >= 0, `missing job: ${job}`);
  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) break;
    block.push(lines[index]);
  }
  return block.join('\n');
}

assert.equal(workflowFiles.length, 7, 'Phase 2G must retain exactly 7 workflow files');
for (const file of ['ceo-dashboard.yml', 'founding-tutorial.yml', 'ma-integration.yml', 'ma-board-approval.yml', 'iphone-playtest-remediation.yml', 'physical-iphone-playtest.yml', 'pages-publication-attestation.yml', 'published-save-quota-contract.yml', 'release-attestation-contract.yml']) {
  assert.equal(workflowFiles.includes(file), false, `${file} must remain absent after workflow consolidation`);
}
for (const file of ['test.yml', 'strategy-balance.yml', 'iphone-webkit-smoke.yml', 'ma-acquisition-financing.yml', 'pages-deployment-smoke.yml', 'release-attestation-sync.yml', 'release-candidate-tag.yml']) {
  assert(workflowFiles.includes(file), `${file} must remain after Phase 2G consolidation`);
}
for (const file of ['phase6b3-diagnostic.yml', 'exploration-1000-week.yml', 'issue-294-executive-hiring-diagnostic.yml', 'shareholder-activism.yml', 'ma-deal-room.yml', 'release-readiness.yml']) {
  assert.equal(workflowFiles.includes(file), false, `${file} must be absent after Phase 2G consolidation`);
}
for (const file of workflowFiles) {
  assert(!readWorkflow(file).includes('js/pmi-100-day-loader.js'), `${file} must not reference the obsolete PMI loader`);
}
const canonicalTest = readWorkflow('test.yml');
assert(/^name: Test$/m.test(canonicalTest), 'Test must retain its public workflow name');
assert(hasTrigger(canonicalTest, 'pull_request'), 'Test must remain an always-run pull-request workflow');
assert.equal(pathsFor(canonicalTest, 'pull_request').length, 0, 'Test pull_request must not have a paths filter');
assert(hasTrigger(canonicalTest, 'push') && isMainOnly(triggerBlock(canonicalTest, 'push')), 'Test push must remain main-only');
assert(hasTrigger(canonicalTest, 'workflow_dispatch'), 'Test must inherit Release Readiness manual dispatch');
for (const job of ['competitor-ai', 'product-innovation', 'capital-allocation', 'test-shard-contract', 'test-shards']) {
  const block = jobBlock(canonicalTest, job);
  assert(block.includes("if: github.event_name != 'workflow_dispatch'"), `${job} must skip manual readiness dispatches while retaining PR/main coverage`);
}
const canonicalAggregate = jobBlock(canonicalTest, 'test');
assert(canonicalAggregate.includes("if: always() && github.event_name != 'workflow_dispatch'"), 'canonical aggregate must skip manual readiness dispatches');
const readinessJob = jobBlock(canonicalTest, 'release-readiness');
assert(readinessJob.includes("github.event_name == 'pull_request'") && readinessJob.includes("github.event_name == 'workflow_dispatch'"), 'release-readiness must run on PR and manual dispatch');
assert(!readinessJob.includes("github.event_name == 'push'"), 'release-readiness must skip main pushes');
for (const token of [
  'timeout-minutes: 15', 'contents: read', 'group: release-readiness-${{ github.event.pull_request.number || github.ref }}',
  'cancel-in-progress: true', 'node-version: 20', 'node scripts/release-gate.js',
  'node scripts/release-hardening-gate.js', 'node scripts/release-delivery-gate.js',
  'actions/upload-artifact@v4', 'if: always()', 'name: release-readiness-${{ github.sha }}',
  'path: artifacts/release-readiness', 'if-no-files-found: error', 'retention-days: 7'
]) assert(readinessJob.includes(token), `release-readiness job must retain ${token}`);
const strategy = readWorkflow('strategy-balance.yml');
assert(/^name: Strategy Balance$/m.test(strategy), 'consolidated workflow must preserve its public name');
assert(hasTrigger(strategy, 'pull_request'), 'Strategy Balance must retain PR full-matrix coverage');
assert(strategy.includes('npm run test:strategy-balance'), 'Strategy Balance must retain the full matrix command');
assert.deepEqual(triggerBlock(strategy, 'push').filter(line => /branches:/.test(line)), ['    branches: [main]'], 'Strategy Balance push must be main-only');
assert(hasTrigger(strategy, 'push') && hasTrigger(strategy, 'schedule') && hasTrigger(strategy, 'workflow_dispatch'), 'consolidated balance workflow must retain main, nightly, and manual coverage');
for (const mode of ['difficulty', 'strategy', 'diagnostics', 'exploration-smoke', 'exploration-full', 'core']) {
  assert(triggerBlock(strategy, 'workflow_dispatch').some(line => line.trim() === `- ${mode}`), `workflow_dispatch must retain ${mode}`);
}
const strategyJob = jobBlock(strategy, 'strategy');
assert(strategyJob.includes("github.event_name == 'push'") && strategyJob.includes("github.event_name == 'pull_request'"), 'strategy must run on main push and PR');
assert(strategyJob.includes("inputs.mode == 'strategy'") && strategyJob.includes("inputs.mode == 'core'"), 'strategy/core manual modes must run strategy');
assert(!strategyJob.includes("github.event_name == 'schedule'"), 'schedule must not run strategy');
const diagnosticsJob = jobBlock(strategy, 'focused-diagnostics');
assert(diagnosticsJob.includes("github.event_name == 'pull_request'") && diagnosticsJob.includes("inputs.mode == 'diagnostics'") && diagnosticsJob.includes("inputs.mode == 'core'"), 'PR and diagnostics/core manual modes must run focused diagnostics');
assert(!diagnosticsJob.includes("github.event_name == 'push'") && !diagnosticsJob.includes("github.event_name == 'schedule'"), 'push and schedule must not run focused diagnostics');
for (const job of ['difficulty-balance-contract', 'difficulty-matrix-shard']) {
  const block = jobBlock(strategy, job);
  assert(!block.includes("github.event_name == 'pull_request'"), `${job} must not run on PRs`);
  assert(block.includes("github.event_name == 'push'") && block.includes("github.event_name == 'schedule'"), `${job} must run on main and schedule`);
  assert(block.includes("inputs.mode == 'difficulty'") && block.includes("inputs.mode == 'core'"), `${job} must run in difficulty/core modes`);
}
const difficultyShard = jobBlock(strategy, 'difficulty-matrix-shard');
assert.match(difficultyShard, /shard: \[0, 1, 2, 3, 4, 5\]/, 'difficulty must retain six shards');
assert(difficultyShard.includes('DIFFICULTY_MATRIX_SHARD_COUNT: 6'), 'difficulty shard count env must remain six');
const difficultyAggregate = jobBlock(strategy, 'difficulty-matrix-aggregate');
assert(difficultyAggregate.includes('needs: difficulty-matrix-shard') && difficultyAggregate.includes("needs.difficulty-matrix-shard.result == 'success'"), 'difficulty aggregate must require successful shards');
assert(difficultyAggregate.includes('merge-multiple: true') && difficultyAggregate.includes('node tests/difficulty-scenario-matrix-test.js'), 'difficulty aggregate must merge and validate all shards');
const exploration = jobBlock(strategy, 'exploration');
assert(exploration.includes("github.event_name == 'workflow_dispatch'") && exploration.includes("inputs.mode == 'exploration-smoke'") && exploration.includes("inputs.mode == 'exploration-full'"), 'exploration must be manual-only');
assert(!exploration.includes("inputs.mode == 'core'") && !exploration.includes("github.event_name == 'push'") && !exploration.includes("github.event_name == 'pull_request'") && !exploration.includes("github.event_name == 'schedule'"), 'core, PR, main, and schedule must not run exploration');
assert(exploration.includes("|| '[0]'") && exploration.includes('SHARD_COUNT: 39'), 'exploration smoke must allocate only shard zero out of 39');
const explorationAggregate = jobBlock(strategy, 'exploration-aggregate');
assert(explorationAggregate.includes('needs: exploration') && explorationAggregate.includes("needs.exploration.result == 'success'"), 'exploration aggregate must require successful shards');
assert(explorationAggregate.includes("inputs.mode == 'exploration-full' && 'full' || 'smoke'"), 'exploration input must map explicitly to full/smoke artifacts');
assert(explorationAggregate.includes('node tests/exploration-aggregate.js') && explorationAggregate.includes('exploratory-playtest-${{'), 'exploration aggregate and established artifact names must remain');
for (const command of ['node tests/executives-department-assignments-test.js', 'node tests/prototype-overwrite-audit.js', 'npm run test:progression-balance --silent', 'node tests/shareholder-activism-test.js', 'node tests/shareholder-activism-reachability-test.js']) {
  assert(diagnosticsJob.includes(command), `focused diagnostics must retain ${command}`);
}
assert(diagnosticsJob.includes('if: always()') && diagnosticsJob.includes('artifacts/prototype-overwrite-audit.json'), 'Issue #294 artifact must always be retained');
const comprehensiveMa = readWorkflow('ma-acquisition-financing.yml');
assert(/^name: M&A Acquisition Financing$/m.test(comprehensiveMa), 'M&A Acquisition Financing must retain its public name');
assert(hasTrigger(comprehensiveMa, 'pull_request'), 'consolidated M&A workflow must inherit the Deal Room PR gate');
assert.deepEqual(pathsFor(comprehensiveMa, 'pull_request'), [
  'js/ma-deal-room.js', 'js/app.js', 'css/**', 'tests/ma-deal-room-test.js', '.github/workflows/ma-acquisition-financing.yml'
], 'Deal Room PR paths must move intact to the consolidated workflow');
assert(hasTrigger(comprehensiveMa, 'push') && pathsFor(comprehensiveMa, 'push').length > 0, 'M&A comprehensive main push must use paths');
assert(isMainOnly(triggerBlock(comprehensiveMa, 'push')), 'M&A comprehensive push must be main-only');
for (const path of ['js/ma-*.js', 'js/pmi-*.js', 'js/subsidiary-*.js', 'js/group-*.js', 'tests/ma-*.js', 'tests/accounting-invariants-test.js']) {
  assert(pathsFor(comprehensiveMa, 'push').includes(path), `M&A comprehensive push must retain ${path}`);
}
assert(hasTrigger(comprehensiveMa, 'schedule') && hasTrigger(comprehensiveMa, 'workflow_dispatch'), 'M&A comprehensive nightly/manual coverage must remain');
for (const mode of ['comprehensive', 'deal-room']) {
  assert(triggerBlock(comprehensiveMa, 'workflow_dispatch').some(line => line.trim() === `- ${mode}`), `M&A workflow_dispatch must retain ${mode}`);
}
const comprehensiveMaJob = jobBlock(comprehensiveMa, 'comprehensive-ma');
assert(comprehensiveMaJob.includes("github.event_name == 'push'") && comprehensiveMaJob.includes("github.event_name == 'schedule'"), 'comprehensive M&A must run on push and schedule');
assert(comprehensiveMaJob.includes("inputs.mode == 'comprehensive'") && !comprehensiveMaJob.includes("github.event_name == 'pull_request'"), 'comprehensive M&A must run only in comprehensive manual mode, never PR');
assert(comprehensiveMaJob.includes('timeout-minutes: 45') && comprehensiveMaJob.includes("node-version: '22'"), 'comprehensive M&A must retain Node 22 and timeout 45');
assert(comprehensiveMaJob.includes('concurrency:') && comprehensiveMaJob.includes('cancel-in-progress: true'), 'comprehensive M&A must retain cancellation semantics at job scope');
for (const command of [
  'npm run test:ma-acquisition-financing', 'npm run test:ma-board-approval', 'npm run test:ma-deal-room',
  'npm run test:ma-integration', 'npm run test:ma-portfolio-summary', 'npm run test:ma-portfolio-summary-ui',
  'npm run test:ceo-dashboard', 'npm run test:finance', 'npm run test:finance-ma-accounting',
  'npm run test:accounting-invariants', 'npm run test:save', 'npm run test:migration', 'npm run test:save-v9',
  'npm run test:week', 'npm run test:transaction', 'npm run test:syntax', 'npm run test:javascript',
  'npm run test:modules', 'npm run test:static', 'npm run test:css', 'npm run test:progression-balance',
  'npm run test:strategy-balance', 'node tests/v1-progression-gate-test.js', 'node tests/executive-secretary-test.js',
  'node tests/ma-acquisition-financing-webkit-test.js', 'node tests/ma-board-approval-webkit-test.js',
  'node tests/ma-deal-room-webkit-test.js', 'node tests/ma-integration-webkit-test.js', 'node tests/ceo-dashboard-webkit-test.js',
  'ma-acquisition-financing-${{ github.sha }}', 'retention-days: 30', 'if-no-files-found: error'
]) assert(comprehensiveMaJob.includes(command), `M&A comprehensive gate must retain ${command}`);
const dealRoom = jobBlock(comprehensiveMa, 'deal-room');
assert(dealRoom.includes("github.event_name == 'pull_request'") && dealRoom.includes("inputs.mode == 'deal-room'"), 'Deal Room must run on PR and deal-room manual mode');
for (const forbidden of ["github.event_name == 'push'", "github.event_name == 'schedule'", "inputs.mode == 'comprehensive'", 'concurrency:']) {
  assert(!dealRoom.includes(forbidden), `Deal Room must not inherit ${forbidden}`);
}
assert(dealRoom.includes('timeout-minutes: 15') && dealRoom.includes("node-version: '20'"), 'Deal Room must retain Node 20 and timeout 15');
for (const command of [
  'npm run test:ma-deal-room', 'npm run test:ma-integration', 'npm run test:finance-ma-accounting',
  'npm run test:save', 'npm run test:migration', 'npm run test:save-v9', 'npm run test:week',
  'npm run test:transaction', 'npm run test:syntax', 'npm run test:javascript', 'npm run test:modules',
  'npm run test:static', 'npm run test:css', 'playwright@1.61.0', 'npx playwright install --with-deps webkit',
  'node tests/ma-deal-room-webkit-test.js', 'actions/upload-artifact@v4', 'name: ma-deal-room-webkit',
  'path: artifacts/ma-deal-room-webkit', 'if: always()', 'if-no-files-found: error'
]) assert(dealRoom.includes(command), `Deal Room must retain ${command}`);

const pagesSmoke = readWorkflow('pages-deployment-smoke.yml');
assert(/^name: Pages Deployment Smoke$/m.test(pagesSmoke), 'Pages Deployment Smoke name is a workflow_run contract');
assert(hasTrigger(pagesSmoke, 'push') && hasTrigger(pagesSmoke, 'schedule') && hasTrigger(pagesSmoke, 'workflow_dispatch'), 'Pages Deployment Smoke triggers must remain intact');
assert(pagesSmoke.includes("cron: '17 4 * * *'"), 'Pages Deployment Smoke must inherit the daily publication attestation schedule');
assert(pagesSmoke.includes("if: github.event_name != 'schedule'"), 'scheduled Pages checks must skip the full WebKit job');
assert(pagesSmoke.includes('node scripts/verify-published-pages.js'), 'Pages Deployment Smoke must retain publication verification');
assert(readWorkflow('release-attestation-sync.yml').includes('Pages Deployment Smoke'), 'Release Attestation Sync must still reference Pages Deployment Smoke');
const iphone = readWorkflow('iphone-webkit-smoke.yml');
assert(!hasTrigger(iphone, 'pull_request'), 'iPhone consolidated executor must not consume pull-request runners');
assert(hasTrigger(iphone, 'push') && isMainOnly(triggerBlock(iphone, 'push')), 'iPhone consolidated executor push must be main-only');
assert.equal(pathsFor(iphone, 'push').length, 0, 'iPhone consolidated executor must retain broad main coverage');
assert(hasTrigger(iphone, 'schedule') && hasTrigger(iphone, 'workflow_dispatch'), 'iPhone consolidated executor must retain nightly/manual coverage');
for (const command of ['node tests/iphone-playtest-webkit-test.js', 'node tests/physical-iphone-playtest-test.js']) {
  assert(iphone.includes(command), `iPhone consolidated executor must retain ${command}`);
}
let scheduledStartsPerDay = 0;
for (const file of workflowFiles) {
  for (const line of triggerBlock(readWorkflow(file), 'schedule')) {
    const match = line.match(/cron:\s*['"]([^'"]+)['"]/);
    if (!match) continue;
    const [minute, hour] = match[1].split(/\s+/);
    assert.notEqual(minute, '*', `${file} must not run more than hourly`);
    scheduledStartsPerDay += hour === '*' ? 24 : hour.includes(',') ? hour.split(',').length : 1;
  }
}
assert(scheduledStartsPerDay <= 6, `scheduled starts/day must be at most 6, got ${scheduledStartsPerDay}`);
assert.equal(scheduledStartsPerDay, 4, 'Phase 1 architecture must schedule exactly four starts/day');
for (const file of workflowFiles) {
  const source = readWorkflow(file);
  if (hasTrigger(source, 'push')) assert(isMainOnly(triggerBlock(source, 'push')), `${file} must not run on feature-branch pushes`);
}
const pullRequestWorkflows = workflowFiles.filter(file => hasTrigger(readWorkflow(file), 'pull_request'));
assert.equal(pullRequestWorkflows.length, 3, 'Phase 2G must retain three PR-triggered workflows');
console.log(`workflow trigger architecture contract: ${workflowFiles.length} workflows, ${scheduledStartsPerDay} scheduled starts/day, ${pullRequestWorkflows.length} PR-triggered workflows`);
