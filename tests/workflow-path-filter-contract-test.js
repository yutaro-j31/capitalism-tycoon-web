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

assert.equal(workflowFiles.length, 7, 'Phase 2H plus CI Hygiene must retain exactly 7 workflow files');
for (const file of ['ceo-dashboard.yml', 'founding-tutorial.yml', 'ma-integration.yml', 'ma-board-approval.yml', 'iphone-playtest-remediation.yml', 'physical-iphone-playtest.yml', 'pages-publication-attestation.yml', 'published-save-quota-contract.yml', 'release-attestation-contract.yml']) {
  assert.equal(workflowFiles.includes(file), false, `${file} must remain absent after workflow consolidation`);
}
for (const file of ['test.yml', 'strategy-balance.yml', 'ma-acquisition-financing.yml', 'pages-deployment-smoke.yml', 'release-attestation-sync.yml', 'release-candidate-tag.yml', 'ci-hygiene.yml']) {
  assert(workflowFiles.includes(file), `${file} must remain after Phase 2H consolidation`);
}
for (const file of ['phase6b3-diagnostic.yml', 'exploration-1000-week.yml', 'issue-294-executive-hiring-diagnostic.yml', 'shareholder-activism.yml', 'ma-deal-room.yml', 'release-readiness.yml', 'iphone-webkit-smoke.yml']) {
  assert.equal(workflowFiles.includes(file), false, `${file} must be absent after Phase 2H consolidation`);
}
for (const file of workflowFiles) {
  assert(!readWorkflow(file).includes('js/pmi-100-day-loader.js'), `${file} must not reference the obsolete PMI loader`);
}
const hygiene = readWorkflow('ci-hygiene.yml');
assert(/^name: CI Hygiene$/m.test(hygiene), 'CI Hygiene must retain its workflow identity');
assert(hasTrigger(hygiene, 'pull_request'), 'CI Hygiene must react when a pull request closes');
assert(triggerBlock(hygiene, 'pull_request').includes('    types: [closed]'), 'CI Hygiene PR trigger must remain close-only');
assert(hasTrigger(hygiene, 'push') && isMainOnly(triggerBlock(hygiene, 'push')), 'CI Hygiene push trigger must remain main-only');
assert(hasTrigger(hygiene, 'schedule') && hasTrigger(hygiene, 'workflow_dispatch'), 'CI Hygiene must retain periodic and manual cleanup routes');
assert(hygiene.includes('actions: write'), 'CI Hygiene must retain Actions write permission for stale-run cancellation');
const canonicalTest = readWorkflow('test.yml');
assert(/^name: Test$/m.test(canonicalTest), 'Test must retain its public workflow name');
assert(hasTrigger(canonicalTest, 'pull_request'), 'Test must remain an always-run pull-request workflow');
assert.equal(pathsFor(canonicalTest, 'pull_request').length, 0, 'Test pull_request must not have a paths filter');
assert(hasTrigger(canonicalTest, 'push') && isMainOnly(triggerBlock(canonicalTest, 'push')), 'Test push must remain main-only');
assert(hasTrigger(canonicalTest, 'workflow_dispatch'), 'Test must inherit Release Readiness manual dispatch');
assert(hasTrigger(canonicalTest, 'schedule') && triggerBlock(canonicalTest, 'schedule').includes("    - cron: '35 2 * * *'"), 'Test must inherit the exact iPhone nightly schedule');
for (const mode of ['release-readiness', 'iphone-webkit']) {
  assert(triggerBlock(canonicalTest, 'workflow_dispatch').some(line => line.trim() === `- ${mode}`), `Test manual dispatch must retain ${mode}`);
}
assert(triggerBlock(canonicalTest, 'workflow_dispatch').includes('        default: release-readiness'), 'manual dispatch must default to release readiness');
for (const job of ['competitor-ai', 'product-innovation', 'capital-allocation', 'test-shard-contract', 'test-shards']) {
  const block = jobBlock(canonicalTest, job);
  assert(block.includes("github.event_name == 'push'") && block.includes("github.event_name == 'pull_request'"), `${job} must run on PR/main`);
  assert(!block.includes("github.event_name == 'schedule'") && !block.includes("github.event_name == 'workflow_dispatch'"), `${job} must skip schedule/manual events`);
}
const canonicalAggregate = jobBlock(canonicalTest, 'test');
assert(canonicalAggregate.includes('if: always()') && canonicalAggregate.includes("github.event_name == 'push'") && canonicalAggregate.includes("github.event_name == 'pull_request'"), 'canonical aggregate must run on PR/main only');
const readinessJob = jobBlock(canonicalTest, 'release-readiness');
assert(readinessJob.includes("github.event_name == 'pull_request'") && readinessJob.includes("github.event_name == 'workflow_dispatch'") && readinessJob.includes("inputs.mode == 'release-readiness'"), 'release-readiness must run on PR and its manual mode');
assert(!readinessJob.includes("github.event_name == 'push'") && !readinessJob.includes("github.event_name == 'schedule'") && !readinessJob.includes("inputs.mode == 'iphone-webkit'"), 'release-readiness must skip main, schedule, and iPhone manual mode');
for (const token of [
  'timeout-minutes: 30', 'contents: read', 'group: release-readiness-${{ github.event.pull_request.number || github.ref }}',
  'cancel-in-progress: true', 'node-version: 20', 'node scripts/release-gate.js',
  'node scripts/release-hardening-gate.js', 'node scripts/release-delivery-gate.js',
  'actions/upload-artifact@v4', 'if: always()', 'name: release-readiness-${{ github.sha }}',
  'path: artifacts/release-readiness', 'if-no-files-found: error', 'retention-days: 7'
]) assert(readinessJob.includes(token), `release-readiness job must retain ${token}`);
const iphoneJob = jobBlock(canonicalTest, 'iphone-webkit-smoke');
assert(iphoneJob.includes('name: iPhone WebKit Smoke'), 'iPhone job must retain its public identity');
assert(iphoneJob.includes("github.event_name == 'push'") && iphoneJob.includes("github.event_name == 'schedule'") && iphoneJob.includes("inputs.mode == 'iphone-webkit'"), 'iPhone job must run on main, schedule, and iPhone manual mode');
assert(!iphoneJob.includes("github.event_name == 'pull_request'") && !iphoneJob.includes("inputs.mode == 'release-readiness'"), 'iPhone job must skip PR and release-readiness manual mode');
for (const token of [
  'contents: read', 'group: iphone-webkit-smoke-${{ github.ref }}', 'cancel-in-progress: true',
  'timeout-minutes: 30', "node-version: '22'", 'playwright@1.61.0',
  'npx playwright install --with-deps webkit', 'node tests/iphone-playtest-webkit-test.js',
  'node tests/physical-iphone-playtest-test.js', 'node tests/iphone-webkit-smoke-test.js',
  'node tests/runtime-recovery-webkit-test.js', 'name: iphone-webkit-smoke-${{ github.sha }}',
  'if: always()', 'if-no-files-found: error', 'retention-days: 30'
]) assert(iphoneJob.includes(token), `iPhone WebKit job must retain ${token}`);
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
  'js/engine.js', 'js/expansion.js', 'tests/investor-offer-save-atomicity-test.js', 'tests/investor-offer-save-atomicity-webkit-test.js',
  'js/real-estate-mortgage-refinancing.js', 'tests/property-mortgage-refinance-conservation-test.js', 'tests/p4-aud-010-mortgage-shortfall-test.js', 'tests/property-mortgage-refinance-webkit-test.js',
  'tests/founder-share-sale-save-atomicity-test.js', 'tests/founder-share-sale-save-atomicity-webkit-test.js',
  'tests/stock-purchase-save-atomicity-test.js', 'tests/stock-purchase-save-atomicity-webkit-test.js',
  'tests/stock-sale-save-atomicity-test.js', 'tests/stock-sale-save-atomicity-webkit-test.js',
  'tests/stock-split-save-atomicity-test.js',
  'tests/stock-split-save-atomicity-webkit-test.js',
  'js/completion.js', 'tests/decline-buyout-ownership-save-atomicity-test.js', 'tests/decline-buyout-ownership-save-atomicity-webkit-test.js', 'tests/execute-mbo-save-atomicity-test.js', 'tests/execute-mbo-save-atomicity-webkit-test.js',
  'tests/earnings-confirm-read-only-test.js', 'tests/earnings-confirm-read-only-webkit-test.js',
  'tests/ma-share-swap-ownership-ratios-test.js', 'tests/ma-share-swap-ownership-ratios-webkit-test.js',
  'tests/competitor-stake-float-test.js', 'tests/competitor-stake-float-webkit-test.js', 'tests/activate-defense-ownership-ratios-test.js', 'tests/activate-defense-ownership-ratios-webkit-test.js',
  'tests/ma-equity-raise-ownership-ratios-test.js', 'tests/ma-equity-raise-ownership-ratios-webkit-test.js',
  'tests/ma-equity-raise-shadow-atomicity-test.js', 'tests/ma-equity-raise-shadow-atomicity-webkit-test.js',
  'js/shareholder-activism.js', 'tests/shareholder-activism-accept-save-atomicity-test.js', 'tests/shareholder-activism-accept-save-atomicity-webkit-test.js', 'tests/shareholder-activism-split-integration-test.js',
  'tests/stock-split-dividend-rescale-test.js', 'tests/stock-split-dividend-rescale-webkit-test.js',
  'tests/stock-split-price-floor-test.js', 'tests/stock-split-price-floor-webkit-test.js',
  'tests/p4-aud-004-personal-secured-repayment-webkit-test.js', 'tests/p4-aud-004-personal-secured-repayment-test.js', 'js/real-estate-complete-cycle.js', 'js/real-estate-complete-cycle-ui.js',
  'tests/founder-capital-atomicity-webkit-test.js',
  'tests/fixtures/stock-split-atomicity.js',
  'tests/property-debt-principal-sync-test.js', 'tests/property-debt-principal-sync-webkit-test.js', 'tests/fixtures/property-debt-principal-sync.js', 'js/treasury-prepayment.js', 'js/player-debt-service.js', 'js/real-estate-complete-cycle.js',
  'js/real-estate-property-disposals.js', 'tests/p4-aud-007-mortgage-disposal-debt-test.js', 'tests/p4-aud-007-option-a-mortgage-test.js', 'tests/p4-aud-007-mortgage-disposal-debt-webkit-test.js',
  'tests/debt-command-save-atomicity-test.js', 'tests/debt-command-save-atomicity-webkit-test.js', 'tests/fixtures/debt-command-atomicity.js',
  'tests/stock-split-price-history-test.js', 'tests/stock-split-price-history-webkit-test.js',
  'js/pe-acquisition.js', 'js/pe-value-creation.js',
  'tests/vc-secondary-sale-save-atomicity-test.js',
  'tests/vc-secondary-sale-save-false-red-probe.js',
  'tests/vc-secondary-sale-save-atomicity-webkit-test.js',
  'tests/found-new-company-save-atomicity-test.js',
  'tests/found-new-company-save-atomicity-webkit-test.js',
  'tests/fixtures/vc-secondary-sale-atomicity.js',
  'tests/vc-follow-on-save-atomicity-test.js',
  'tests/vc-follow-on-save-atomicity-webkit-test.js',
  'tests/fixtures/vc-follow-on-atomicity.js',
  'tests/vc-initial-investment-save-atomicity-test.js',
  'tests/vc-initial-investment-save-atomicity-webkit-test.js',
  'tests/angel-investment-save-atomicity-test.js',
  'tests/angel-investment-save-atomicity-webkit-test.js',
  'tests/make-subsidiary-save-atomicity-test.js',
  'tests/make-subsidiary-save-atomicity-webkit-test.js',
  'tests/subsidiary-quarter-close-test.js',
  'tests/subsidiary-quarter-close-save-atomicity-test.js',
  'tests/fixtures/subsidiary-quarter-close.js',
  'tests/subsidiary-quarter-close-webkit-test.js',
  'tests/listed-subsidiary-market-week-test.js',
  'tests/listed-subsidiary-quarter-save-atomicity-test.js',
  'tests/listed-subsidiary-quarter-close-webkit-test.js',
  'tests/subsidiary-disposal-accounting-test.js',
  'tests/subsidiary-disposal-save-atomicity-test.js',
  'tests/fixtures/subsidiary-disposal.js',
  'tests/subsidiary-disposal-webkit-test.js',
  'tests/group-capital-allocation-cash-exact-test.js',
  'tests/group-capital-allocation-save-atomicity-test.js',
  'tests/fixtures/capital-allocation-exact.js',
  'tests/group-capital-allocation-webkit-test.js',
  'tests/refounding-ledger-test.js',
  'tests/fixtures/refounding-ledger.js',
  'tests/refounding-ledger-webkit-test.js',
  'tests/fixtures/vc-initial-investment-atomicity.js',
  'tests/pe-fund-acquisition-save-atomicity-test.js',
  'tests/pe-fund-acquisition-save-atomicity-webkit-test.js',
  'tests/pe-portfolio-exit-save-atomicity-test.js',
  'tests/pe-portfolio-exit-save-atomicity-webkit-test.js',
  'tests/pe-create-deal-save-atomicity-test.js',
  'tests/pe-create-deal-save-atomicity-webkit-test.js',
  'tests/pe-exit-deal-save-atomicity-test.js',
  'tests/pe-exit-deal-save-atomicity-webkit-test.js',
  'tests/sold-company-pe-authority-test.js',
  'tests/sold-company-pe-authority-webkit-test.js',
  'tests/fixtures/pe-fund-acquisition-atomicity.js',
  'tests/fixtures/pe-fund-acquisition-faults.js',
  'js/pe-network-sourcing.js', 'js/pe-ui-adapter.js', 'js/pe-portfolio-operations.js',
  'js/completion.js', 'js/pe-fund.js', 'js/parity.js', 'js/shareholder-returns.js', 'js/play-runtime-compat.js', 'js/difficulty-scenario-balance.js', 'js/finance.js', 'js/ma-board-approval.js', 'js/ma-acquisition-financing.js', 'js/save*.js', 'js/subsidiary-*.js', 'js/listed-subsidiary-*.js',
  'js/player-crisis-actions.js', 'tests/sponsor-injection-save-atomicity-webkit-test.js', 'tests/shareholder-buyback-save-atomicity-webkit-test.js', 'tests/shareholder-dividend-declaration-save-atomicity-webkit-test.js', 'tests/shareholder-dividend-payment-save-atomicity-webkit-test.js', 'tests/vc-writeoff-week-save-atomicity-webkit-test.js', 'tests/vc-round-close-week-save-atomicity-webkit-test.js', 'tests/vc-listing-week-save-atomicity-webkit-test.js', 'tests/subsidiary-ipo-save-atomicity-webkit-test.js', 'tests/subsidiary-secondary-sale-save-atomicity-webkit-test.js', 'tests/subsidiary-control-save-atomicity-webkit-test.js', 'tests/subsidiary-follow-on-save-atomicity-webkit-test.js', 'tests/fixtures/sponsor-injection-atomicity.js', 'tests/fixtures/shareholder-buyback-atomicity.js', 'tests/fixtures/shareholder-dividend-declaration-atomicity.js', 'tests/fixtures/shareholder-dividend-payment-atomicity.js', 'tests/fixtures/vc-writeoff-week-atomicity.js', 'tests/fixtures/vc-round-close-week-atomicity.js', 'tests/fixtures/vc-listing-week-atomicity.js', 'tests/fixtures/subsidiary-ipo-atomicity.js', 'tests/fixtures/subsidiary-secondary-sale-atomicity.js', 'tests/fixtures/subsidiary-control-atomicity.js', 'tests/fixtures/subsidiary-follow-on-atomicity.js', 'js/player-crisis-turnaround-fund.js', 'tests/turnaround-fund-accept-save-atomicity-test.js', 'tests/turnaround-fund-accept-save-atomicity-webkit-test.js', 'tests/fixtures/turnaround-fund-accept-atomicity.js', 'js/player-turnaround-plan.js', 'tests/player-crisis-turnaround-ratchet-webkit-test.js', 'js/group-restructuring-candidates.js', 'js/group-restructuring-progress.js', 'js/group-capital-allocation-execution.js', 'js/internal-venture-business.js', 'js/pe-deal-supply.js', 'js/pe-network.js', 'js/personal-stock-margin.js', 'tests/personal-stock-margin-save-atomicity-test.js', 'tests/personal-stock-margin-save-atomicity-webkit-test.js', 'tests/fixtures/personal-stock-margin-atomicity.js', 'tests/helpers/transaction-fault-case.js', 'js/capital-allocation-score.js', 'js/ma-integration.js', 'js/pmi-100-day-plan.js', 'js/pmi-long-run-guard.js', 'js/group-holding-governance.js',
  'tests/parent-ipo-save-atomicity-test.js',
  'tests/parent-ipo-save-atomicity-webkit-test.js', 'tests/fixtures/parent-ipo-atomicity.js',
  'tests/ma-subsidiary-sale-save-atomicity-test.js', 'tests/ma-subsidiary-sale-save-atomicity-webkit-test.js',
  'tests/fixtures/ma-subsidiary-sale-atomicity.js',
  'js/ma-deal-room.js', 'js/ceo-dashboard.js', 'js/app.js', 'css/**', 'tests/ma-deal-room-test.js',
  'tests/ceo-dashboard-webkit-test.js', '.github/workflows/ma-acquisition-financing.yml'
], 'Deal Room PR paths and CEO Dashboard WebKit coverage must remain explicit in the consolidated workflow');
assert(hasTrigger(comprehensiveMa, 'push') && pathsFor(comprehensiveMa, 'push').length > 0, 'M&A comprehensive main push must use paths');
// Track A writer modules (#922 audit section 4): a change to any of them must run the atomicity WebKit gates on
// both PR and main push. Docs-only changes must not trigger this workflow.
const trackAWriterModules = ['js/completion.js', 'js/pe-fund.js', 'js/pe-value-creation.js', 'js/parity.js', 'js/shareholder-returns.js',
  'js/shareholder-activism.js', 'js/play-runtime-compat.js', 'js/difficulty-scenario-balance.js', 'js/expansion.js', 'js/engine.js', 'js/finance.js', 'js/app.js',
  'js/save-storage.js', 'js/save-storage-idb.js', 'js/subsidiary-ipo-preparation.js', 'js/subsidiary-ipo-secondary-sale.js', 'js/listed-subsidiary-market.js', 'js/listed-subsidiary-control-actions.js',
  // Remaining writer files named in the TRACK_A_WRITER_AUTHORITY_AUDIT.md Writer Matrix (sections 2.1-2.3).
  'js/pe-network-sourcing.js', 'js/ma-deal-room.js', 'js/pe-acquisition.js', 'js/ma-board-approval.js', 'js/ma-acquisition-financing.js', 'js/pe-portfolio-operations.js',
  'js/player-crisis-actions.js', 'js/player-crisis-turnaround-fund.js', 'js/player-turnaround-plan.js', 'js/listed-subsidiary-follow-on-offering.js', 'js/subsidiary-relisting-options.js',
  'js/group-restructuring-candidates.js', 'js/group-restructuring-progress.js', 'js/group-capital-allocation-execution.js', 'js/internal-venture-business.js', 'js/pe-deal-supply.js', 'js/pe-network.js', 'js/personal-stock-margin.js',
  'js/capital-allocation-score.js', 'js/ma-integration.js', 'js/pmi-100-day-plan.js', 'js/pmi-long-run-guard.js', 'js/group-holding-governance.js'];
const globMatch = (pattern, file) => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$').test(file);
for (const event of ['pull_request', 'push']) {
  const patterns = pathsFor(comprehensiveMa, event);
  for (const file of trackAWriterModules) assert(patterns.some(pattern => globMatch(pattern, file)), `${event} must run the Track A atomicity gates on ${file}`);
  for (const file of ['docs/economic-engine/TRACK_A_WRITER_AUTHORITY_AUDIT.md', 'README.md', 'docs/GAME_OVERVIEW.md']) {
    assert(!patterns.some(pattern => globMatch(pattern, file)), `${event} must not run the M&A workflow for docs-only ${file}`);
  }
}
assert(isMainOnly(triggerBlock(comprehensiveMa, 'push')), 'M&A comprehensive push must be main-only');
for (const event of ['pull_request', 'push']) {
  for (const path of ['tests/stock-split-save-atomicity-test.js', 'tests/stock-split-save-atomicity-webkit-test.js', 'tests/stock-split-dividend-rescale-test.js', 'tests/stock-split-dividend-rescale-webkit-test.js', 'tests/stock-split-price-floor-test.js', 'tests/stock-split-price-floor-webkit-test.js', 'js/completion.js', 'tests/decline-buyout-ownership-save-atomicity-test.js', 'tests/decline-buyout-ownership-save-atomicity-webkit-test.js', 'tests/execute-mbo-save-atomicity-test.js', 'tests/execute-mbo-save-atomicity-webkit-test.js', 'tests/earnings-confirm-read-only-test.js', 'tests/earnings-confirm-read-only-webkit-test.js', 'tests/ma-share-swap-ownership-ratios-test.js', 'tests/ma-share-swap-ownership-ratios-webkit-test.js', 'tests/competitor-stake-float-test.js', 'tests/competitor-stake-float-webkit-test.js', 'tests/activate-defense-ownership-ratios-test.js', 'tests/activate-defense-ownership-ratios-webkit-test.js', 'tests/ma-equity-raise-ownership-ratios-test.js', 'tests/ma-equity-raise-ownership-ratios-webkit-test.js', 'tests/ma-equity-raise-shadow-atomicity-test.js', 'tests/ma-equity-raise-shadow-atomicity-webkit-test.js', 'tests/fixtures/stock-split-atomicity.js', 'tests/vc-secondary-sale-save-atomicity-test.js', 'tests/vc-secondary-sale-save-false-red-probe.js', 'tests/vc-secondary-sale-save-atomicity-webkit-test.js', 'tests/fixtures/vc-secondary-sale-atomicity.js', 'tests/vc-follow-on-save-atomicity-test.js', 'tests/vc-follow-on-save-atomicity-webkit-test.js', 'tests/fixtures/vc-follow-on-atomicity.js', 'tests/vc-initial-investment-save-atomicity-test.js', 'tests/vc-initial-investment-save-atomicity-webkit-test.js', 'tests/fixtures/vc-initial-investment-atomicity.js', 'tests/stock-split-price-history-test.js', 'tests/stock-split-price-history-webkit-test.js', 'tests/stock-sale-save-atomicity-test.js', 'tests/stock-sale-save-atomicity-webkit-test.js', 'js/engine.js', 'tests/stock-purchase-save-atomicity-test.js', 'tests/stock-purchase-save-atomicity-webkit-test.js', 'js/expansion.js', 'tests/investor-offer-save-atomicity-test.js', 'tests/investor-offer-save-atomicity-webkit-test.js', 'tests/founder-share-sale-save-atomicity-test.js', 'tests/founder-share-sale-save-atomicity-webkit-test.js', 'js/shareholder-activism.js', 'tests/shareholder-activism-accept-save-atomicity-test.js', 'tests/shareholder-activism-accept-save-atomicity-webkit-test.js']) {
    assert(pathsFor(comprehensiveMa, event).includes(path), `${event} must run economic-command WebKit on ${path}`);
  }
}
for (const path of ['js/ma-*.js', 'js/pmi-*.js', 'js/subsidiary-*.js', 'js/group-*.js', 'tests/ma-*.js', 'tests/accounting-invariants-test.js']) {
  assert(pathsFor(comprehensiveMa, 'push').includes(path), `M&A comprehensive push must retain ${path}`);
}
assert(hasTrigger(comprehensiveMa, 'schedule') && hasTrigger(comprehensiveMa, 'workflow_dispatch'), 'M&A comprehensive nightly/manual coverage must remain');
for (const mode of ['comprehensive', 'deal-room']) {
  assert(triggerBlock(comprehensiveMa, 'workflow_dispatch').some(line => line.trim() === `- ${mode}`), `M&A workflow_dispatch must retain ${mode}`);
}
for (const event of ['pull_request', 'push']) {
  for (const file of ['js/pe-acquisition.js', 'js/pe-value-creation.js', 'tests/pe-fund-acquisition-save-atomicity-test.js', 'tests/pe-fund-acquisition-save-atomicity-webkit-test.js', 'tests/fixtures/pe-fund-acquisition-atomicity.js', 'tests/fixtures/pe-fund-acquisition-faults.js', 'tests/ma-subsidiary-sale-save-atomicity-test.js', 'tests/ma-subsidiary-sale-save-atomicity-webkit-test.js', 'tests/fixtures/ma-subsidiary-sale-atomicity.js', 'js/pe-network-sourcing.js', 'tests/parent-ipo-save-atomicity-test.js', 'tests/parent-ipo-save-atomicity-webkit-test.js', 'tests/fixtures/parent-ipo-atomicity.js'])
    assert(pathsFor(comprehensiveMa, event).includes(file), `economic-command gate path required: ${event} ${file}`);
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
  'node tests/v1-progression-gate-test.js', 'node tests/executive-secretary-test.js',
  'node tests/ma-acquisition-financing-webkit-test.js', 'node tests/ma-board-approval-webkit-test.js',
  'node tests/ma-deal-room-webkit-test.js', 'node tests/ma-integration-webkit-test.js', 'node tests/ceo-dashboard-webkit-test.js',
  'ma-acquisition-financing-${{ github.sha }}', 'retention-days: 30', 'if-no-files-found: error'
]) assert(comprehensiveMaJob.includes(command), `M&A comprehensive gate must retain ${command}`);
// Phase 1B: strategy balance runs in a parallel job with comprehensive-ma's exact events, runtime,
// install step and cancellation; it must not also stay in comprehensive-ma.
const comprehensiveBalance = jobBlock(comprehensiveMa, 'comprehensive-ma-balance');
assert(jobCondition(comprehensiveMaJob), 'comprehensive M&A must keep an event condition');
assert.equal(jobCondition(comprehensiveBalance), jobCondition(comprehensiveMaJob), 'strategy balance job must use exactly the comprehensive M&A events');
assert(comprehensiveBalance.includes("node-version: '22'") && comprehensiveBalance.includes('timeout-minutes: 30') && comprehensiveBalance.includes('npm ci || npm install'), 'strategy balance job must keep Node 22, the install step and a bounded timeout');
assert(comprehensiveBalance.includes('group: ma-acquisition-financing-balance-${{ github.ref }}') && comprehensiveBalance.includes('cancel-in-progress: true'), 'strategy balance job must be cancelled with superseded comprehensive runs in its own group');
assert(comprehensiveBalance.includes('run: npm run test:strategy-balance'), 'strategy balance job must run the full matrix command');
assert(!comprehensiveMaJob.includes('npm run test:strategy-balance'), 'strategy balance moved to comprehensive-ma-balance and must not run twice');
const dealRoom = jobBlock(comprehensiveMa, 'deal-room');
// Phase 1A: PE acquisition moved to pe-acquisition-atomicity; its PR and main coverage is
// asserted per evaluated event below, together with the moved VC regressions.
for (const job of [comprehensiveMaJob,dealRoom]) {
  assert(job.includes('node tests/ma-subsidiary-sale-save-atomicity-webkit-test.js'), 'both PR and main gates must exercise actual subsidiary sale rollback/storage');
  assert(job.includes('node tests/parent-ipo-save-atomicity-webkit-test.js'), 'both PR and main gates must exercise actual IPO storage/rollback');
  assert(job.includes('node tests/stock-split-price-history-webkit-test.js'), 'both PR and main gates must exercise stock split history persistence');
}
assert(dealRoom.includes("github.event_name == 'pull_request'") && dealRoom.includes("inputs.mode == 'deal-room'"), 'Deal Room must run on PR and deal-room manual mode');
for (const forbidden of ["github.event_name == 'push'", "github.event_name == 'schedule'", "inputs.mode == 'comprehensive'", 'concurrency:']) {
  assert(!dealRoom.includes(forbidden), `Deal Room must not inherit ${forbidden}`);
}
assert(dealRoom.includes('timeout-minutes: 35') && dealRoom.includes("node-version: '20'"), 'Deal Room must retain Node 20 and timeout 35');
for (const command of [
  'npm run test:ma-deal-room', 'npm run test:ma-integration', 'npm run test:finance-ma-accounting',
  'npm run test:save', 'npm run test:migration', 'npm run test:save-v9', 'npm run test:week',
  'npm run test:transaction', 'npm run test:syntax', 'npm run test:javascript', 'npm run test:modules',
  'npm run test:static', 'npm run test:css', 'playwright@1.61.0', 'npx playwright install --with-deps webkit',
  'node tests/ma-deal-room-webkit-test.js', 'node tests/ceo-dashboard-webkit-test.js', 'actions/upload-artifact@v4',
  'name: ma-deal-room-webkit', 'path: artifacts/ma-deal-room-webkit', 'name: ceo-dashboard-webkit-pr',
  'path: artifacts/ceo-dashboard-webkit', 'if: always()', 'if-no-files-found: error'
]) assert(dealRoom.includes(command), `Deal Room must retain ${command}`);

const splitAtomicity = jobBlock(comprehensiveMa, 'stock-split-atomicity');
assert(!/^    if:/m.test(splitAtomicity), 'stock split real WebKit must run on every workflow event including PR and main');
// The heavy WebKit family jobs run 8.5-12.5 min when healthy (2026-10-22: stock split 11m20s, VC secondary 12m30s,
// PE acquisition 9m35s, VC funding 8m36s), and the unpinned-cache `npm install playwright` step alone took 5-7 min in
// slow windows that day, cancelling all three of the longest at 15 min. 25 keeps them bounded with that headroom.
assert(splitAtomicity.includes('timeout-minutes: 40') && splitAtomicity.includes("node-version: '20'"), 'stock split WebKit must retain a bounded pinned runtime');
assert(splitAtomicity.includes("group: ma-acquisition-financing-stock-split-atomicity-${{ (github.event_name == 'pull_request' || inputs.mode == 'deal-room') && github.run_id || github.ref }}")
  && splitAtomicity.includes('cancel-in-progress: true'), 'stock split WebKit must be cancelled with superseded main/schedule/comprehensive runs, never for PR/deal-room');
for (const command of ['playwright@1.61.0', 'npx playwright install --with-deps webkit', 'node tests/stock-split-save-atomicity-webkit-test.js', 'node tests/stock-split-dividend-rescale-webkit-test.js', 'node tests/stock-split-price-floor-webkit-test.js', 'node tests/decline-buyout-ownership-save-atomicity-webkit-test.js', 'node tests/execute-mbo-save-atomicity-webkit-test.js', 'node tests/earnings-confirm-read-only-webkit-test.js', 'node tests/ma-share-swap-ownership-ratios-webkit-test.js', 'node tests/competitor-stake-float-webkit-test.js', 'node tests/activate-defense-ownership-ratios-webkit-test.js', 'node tests/ma-equity-raise-ownership-ratios-webkit-test.js', 'node tests/ma-equity-raise-shadow-atomicity-webkit-test.js', 'actions/upload-artifact@v4', 'path: artifacts/stock-split-atomicity-webkit', 'if: always()', 'if-no-files-found: error', 'node tests/shareholder-activism-accept-save-atomicity-webkit-test.js']) {
  assert(splitAtomicity.includes(command), `independent stock split gate must retain ${command}`);
}

// Phase 1A: PE / VC atomicity WebKit run in parallel family jobs. The moved regressions are a
// transfer of execution responsibility, not a removal: every event must still run exactly the
// WebKit set it ran before the split, and each moved regression exactly once.
const movedFamilyJobs = {
  'pe-acquisition-atomicity': ['tests/pe-fund-acquisition-save-atomicity-webkit-test.js', 'tests/pe-portfolio-exit-save-atomicity-webkit-test.js', 'tests/pe-create-deal-save-atomicity-webkit-test.js', 'tests/pe-exit-deal-save-atomicity-webkit-test.js', 'tests/sold-company-pe-authority-webkit-test.js'],
  'vc-secondary-atomicity': ['tests/vc-secondary-sale-save-atomicity-webkit-test.js', 'tests/found-new-company-save-atomicity-webkit-test.js', 'tests/subsidiary-quarter-close-webkit-test.js', 'tests/listed-subsidiary-quarter-close-webkit-test.js', 'tests/subsidiary-disposal-webkit-test.js', 'tests/group-capital-allocation-webkit-test.js', 'tests/refounding-ledger-webkit-test.js'],
  'vc-funding-atomicity': ['tests/vc-follow-on-save-atomicity-webkit-test.js', 'tests/vc-initial-investment-save-atomicity-webkit-test.js', 'tests/angel-investment-save-atomicity-webkit-test.js', 'tests/make-subsidiary-save-atomicity-webkit-test.js'],
  // Not a Phase 1A move: P3-4 canonical-week startup writers, split from stock-split-atomicity for its job budget.
  'vc-week-atomicity': ['tests/vc-writeoff-week-save-atomicity-webkit-test.js', 'tests/vc-round-close-week-save-atomicity-webkit-test.js', 'tests/vc-listing-week-save-atomicity-webkit-test.js'],
  // Not a Phase 1A move: P3-4 writer evidence, split from stock-split-atomicity for its job budget.
  'p3-writer-atomicity': ['tests/shareholder-dividend-declaration-save-atomicity-webkit-test.js', 'tests/shareholder-dividend-payment-save-atomicity-webkit-test.js', 'tests/shareholder-buyback-save-atomicity-webkit-test.js', 'tests/sponsor-injection-save-atomicity-webkit-test.js', 'tests/turnaround-fund-accept-save-atomicity-webkit-test.js', 'tests/player-crisis-turnaround-ratchet-webkit-test.js', 'tests/personal-stock-margin-save-atomicity-webkit-test.js', 'tests/p4-aud-004-personal-secured-repayment-webkit-test.js', 'tests/founder-capital-atomicity-webkit-test.js'],
  // Not a Phase 1A move: P3-4 listed-subsidiary writers, split from vc-secondary-atomicity for its job budget.
  'sub-listing-atomicity': ['tests/subsidiary-ipo-save-atomicity-webkit-test.js', 'tests/subsidiary-secondary-sale-save-atomicity-webkit-test.js', 'tests/subsidiary-control-save-atomicity-webkit-test.js', 'tests/subsidiary-follow-on-save-atomicity-webkit-test.js']
};
const legacyRuntime = "node-version: ${{ (github.event_name == 'pull_request' || inputs.mode == 'deal-room') && '20' || '22' }}";
for (const [job, tests] of Object.entries(movedFamilyJobs)) {
  const block = jobBlock(comprehensiveMa, job);
  assert(!/^    if:/m.test(block), `${job} must run on every workflow event including PR, main, schedule and both manual modes`);
  assert(block.includes('timeout-minutes: 40') && block.includes('runs-on: ubuntu-latest'), `${job} must keep a bounded hosted runner`);
  assert(block.includes(legacyRuntime), `${job} must keep the pre-split runtime per event (Node 20 PR/deal-room, Node 22 main/schedule/comprehensive)`);
  assert(block.includes(`group: ma-acquisition-financing-${job}-\${{ (github.event_name == 'pull_request' || inputs.mode == 'deal-room') && github.run_id || github.ref }}`)
    && block.includes('cancel-in-progress: true'), `${job} must keep pre-split cancellation: per-ref for main/schedule/comprehensive, never for PR/deal-room`);
  for (const command of ['playwright@1.61.0', 'npx playwright install --with-deps webkit', `MA_DEAL_ROOM_ARTIFACT_DIR: artifacts/${job}-webkit`,
    'actions/upload-artifact@v4', `name: ${job}-webkit-\${{ github.sha }}`, `path: artifacts/${job}-webkit`, 'if: always()', 'if-no-files-found: error', 'retention-days: 30']) {
    assert(block.includes(command), `${job} must retain ${command}`);
  }
  const commands = [...block.matchAll(/node (tests\/[\w.-]+-webkit-test\.js)/g)].map(match => match[1]);
  assert.deepEqual(commands, tests, `${job} must run exactly its moved regressions in their original order`);
  for (const legacy of [comprehensiveMaJob, dealRoom]) for (const test of tests)
    assert(!legacy.includes(`node ${test}`), `${test} moved to ${job} and must not also run in a legacy M&A job`);
}

// Evaluate job-level `if:` per event instead of trusting string presence alone.
function jobNames(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.indexOf('jobs:');
  assert(start >= 0, 'workflow must declare jobs');
  return lines.slice(start + 1).filter(line => /^  [A-Za-z0-9_-]+:\s*$/.test(line)).map(line => line.trim().slice(0, -1));
}
function jobCondition(block) {
  const lines = block.split('\n');
  const index = lines.findIndex(line => /^    if:/.test(line));
  if (index < 0) return null;
  const inline = lines[index].replace(/^    if:\s*/, '');
  if (inline && inline !== '>-' && inline !== '>' && inline !== '|') return inline;
  const parts = [];
  for (let i = index + 1; i < lines.length && /^      /.test(lines[i]); i += 1) parts.push(lines[i].trim());
  return parts.join(' ');
}
function evaluateCondition(expression, context) {
  if (expression === null) return true;
  const replaced = expression
    .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
    .replace(/always\(\)/g, 'true')
    .replace(/github\.event_name\s*==\s*'([^']+)'/g, (_, value) => String(context.event === value))
    .replace(/inputs\.mode\s*==\s*'([^']+)'/g, (_, value) => String(context.mode === value));
  assert(/^[\s()!&|truefals]*$/.test(replaced), `unsupported job condition for event evaluation: ${expression}`);
  return Function(`"use strict"; return (${replaced});`)();
}
const webkitCommands = block => [...block.matchAll(/node (tests\/[\w.-]+-webkit-test\.js)/g)].map(match => match[1]);
const preSplitDealRoomWebkit = [
  // P4-AUD-008 adds this regression to both retained jobs; event checks still require every script exactly once.
  'tests/property-mortgage-refinance-webkit-test.js',
  'tests/ma-deal-room-webkit-test.js', 'tests/ma-share-swap-save-atomicity-webkit-test.js', 'tests/investor-offer-save-atomicity-webkit-test.js',
  'tests/founder-share-sale-save-atomicity-webkit-test.js', 'tests/stock-purchase-save-atomicity-webkit-test.js', 'tests/stock-sale-save-atomicity-webkit-test.js',
  'tests/stock-split-price-history-webkit-test.js', 'tests/parent-ipo-save-atomicity-webkit-test.js', 'tests/ma-subsidiary-sale-save-atomicity-webkit-test.js',
  'tests/pe-fund-acquisition-save-atomicity-webkit-test.js', 'tests/pe-portfolio-exit-save-atomicity-webkit-test.js', 'tests/vc-secondary-sale-save-atomicity-webkit-test.js', 'tests/vc-follow-on-save-atomicity-webkit-test.js',
  'tests/vc-initial-investment-save-atomicity-webkit-test.js', 'tests/ceo-dashboard-webkit-test.js', 'tests/stock-split-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #954 writer-specific WebKit, run by vc-funding-atomicity on every event.
  'tests/angel-investment-save-atomicity-webkit-test.js',
  'tests/make-subsidiary-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #971 subsidiary quarter close WebKit, run by vc-secondary-atomicity on every event.
  'tests/subsidiary-quarter-close-webkit-test.js',
  // Added after the Phase 1A split: #966 listed subsidiary quarter WebKit, run by vc-secondary-atomicity on every event.
  'tests/listed-subsidiary-quarter-close-webkit-test.js',
  // Added after the Phase 1A split: #975 subsidiary disposal WebKit, run by vc-secondary-atomicity on every event.
  'tests/subsidiary-disposal-webkit-test.js',
  // Added after the Phase 1A split: #978 group capital allocation WebKit, run by vc-secondary-atomicity on every event.
  'tests/group-capital-allocation-webkit-test.js',
  // Added after the Phase 1A split: #968 refounding ledger WebKit, run by vc-secondary-atomicity on every event.
  'tests/refounding-ledger-webkit-test.js',
  // Added after the Phase 1A split: #954 writer-specific WebKit, run by pe-acquisition-atomicity on every event.
  'tests/pe-create-deal-save-atomicity-webkit-test.js',
  'tests/pe-exit-deal-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #985 sold-company PE authority WebKit, run by pe-acquisition-atomicity on every event.
  'tests/sold-company-pe-authority-webkit-test.js',
  // Added after the Phase 1A split: #955 refounding WebKit, run by vc-secondary-atomicity on every event.
  'tests/found-new-company-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #955 hostile buyout decline WebKit, run by stock-split-atomicity on every event.
  'tests/decline-buyout-ownership-save-atomicity-webkit-test.js',
  // The installed MBO writer must retain actual WebKit failure/reload coverage.
  'tests/execute-mbo-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #988 read-only earnings view WebKit, run by stock-split-atomicity on every event.
  'tests/earnings-confirm-read-only-webkit-test.js',
  // Added after the Phase 1A split: D3 share-swap ownership ratios WebKit, run by stock-split-atomicity on every event.
  'tests/ma-share-swap-ownership-ratios-webkit-test.js',
  // Added after the Phase 1A split: D4 competitor stake WebKit, run by stock-split-atomicity on every event.
  'tests/competitor-stake-float-webkit-test.js',
  // Added after the Phase 1A split: M&A equity raise ownership ratios WebKit, run by stock-split-atomicity on every event.
  'tests/ma-equity-raise-ownership-ratios-webkit-test.js',
  'tests/activate-defense-ownership-ratios-webkit-test.js',
  // Added after the Phase 1A split: M&A equity raise shadow-state atomicity WebKit, run by stock-split-atomicity on every event.
  'tests/ma-equity-raise-shadow-atomicity-webkit-test.js',
  // Added after the Phase 1A split: activist proposal acceptance atomicity (#953), run by stock-split-atomicity on every event.
  'tests/shareholder-activism-accept-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: stock split dividend rescale, run by stock-split-atomicity on every event.
  'tests/stock-split-dividend-rescale-webkit-test.js', 'tests/stock-split-price-floor-webkit-test.js', 'tests/sponsor-injection-save-atomicity-webkit-test.js', 'tests/shareholder-buyback-save-atomicity-webkit-test.js', 'tests/shareholder-dividend-declaration-save-atomicity-webkit-test.js', 'tests/shareholder-dividend-payment-save-atomicity-webkit-test.js', 'tests/vc-writeoff-week-save-atomicity-webkit-test.js', 'tests/vc-round-close-week-save-atomicity-webkit-test.js', 'tests/vc-listing-week-save-atomicity-webkit-test.js', 'tests/subsidiary-ipo-save-atomicity-webkit-test.js', 'tests/subsidiary-secondary-sale-save-atomicity-webkit-test.js', 'tests/subsidiary-control-save-atomicity-webkit-test.js', 'tests/subsidiary-follow-on-save-atomicity-webkit-test.js', 'tests/turnaround-fund-accept-save-atomicity-webkit-test.js', 'tests/player-crisis-turnaround-ratchet-webkit-test.js', 'tests/personal-stock-margin-save-atomicity-webkit-test.js', 'tests/p4-aud-004-personal-secured-repayment-webkit-test.js', 'tests/founder-capital-atomicity-webkit-test.js', 'tests/debt-command-save-atomicity-webkit-test.js', 'tests/property-debt-principal-sync-webkit-test.js',
  // P4-AUD-007 D-1 mortgage disposal debt, run by property-debt-principal-sync on every event.
  'tests/p4-aud-007-mortgage-disposal-debt-webkit-test.js'
];
const preSplitComprehensiveWebkit = [
  // P4-AUD-008 adds this regression without moving or removing any existing family.
  'tests/property-mortgage-refinance-webkit-test.js',
  'tests/ma-acquisition-financing-webkit-test.js', 'tests/ma-board-approval-webkit-test.js', 'tests/ma-deal-room-webkit-test.js',
  'tests/ma-share-swap-save-atomicity-webkit-test.js', 'tests/investor-offer-save-atomicity-webkit-test.js', 'tests/founder-share-sale-save-atomicity-webkit-test.js',
  'tests/stock-purchase-save-atomicity-webkit-test.js', 'tests/stock-sale-save-atomicity-webkit-test.js', 'tests/stock-split-price-history-webkit-test.js',
  'tests/parent-ipo-save-atomicity-webkit-test.js', 'tests/ma-subsidiary-sale-save-atomicity-webkit-test.js', 'tests/pe-fund-acquisition-save-atomicity-webkit-test.js', 'tests/pe-portfolio-exit-save-atomicity-webkit-test.js',
  'tests/vc-secondary-sale-save-atomicity-webkit-test.js', 'tests/vc-follow-on-save-atomicity-webkit-test.js', 'tests/vc-initial-investment-save-atomicity-webkit-test.js',
  'tests/ma-integration-webkit-test.js', 'tests/ceo-dashboard-webkit-test.js', 'tests/stock-split-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #954 writer-specific WebKit, run by vc-funding-atomicity on every event.
  'tests/angel-investment-save-atomicity-webkit-test.js',
  'tests/make-subsidiary-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #971 subsidiary quarter close WebKit, run by vc-secondary-atomicity on every event.
  'tests/subsidiary-quarter-close-webkit-test.js',
  // Added after the Phase 1A split: #966 listed subsidiary quarter WebKit, run by vc-secondary-atomicity on every event.
  'tests/listed-subsidiary-quarter-close-webkit-test.js',
  // Added after the Phase 1A split: #975 subsidiary disposal WebKit, run by vc-secondary-atomicity on every event.
  'tests/subsidiary-disposal-webkit-test.js',
  // Added after the Phase 1A split: #978 group capital allocation WebKit, run by vc-secondary-atomicity on every event.
  'tests/group-capital-allocation-webkit-test.js',
  // Added after the Phase 1A split: #968 refounding ledger WebKit, run by vc-secondary-atomicity on every event.
  'tests/refounding-ledger-webkit-test.js',
  // Added after the Phase 1A split: #954 writer-specific WebKit, run by pe-acquisition-atomicity on every event.
  'tests/pe-create-deal-save-atomicity-webkit-test.js',
  'tests/pe-exit-deal-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #985 sold-company PE authority WebKit, run by pe-acquisition-atomicity on every event.
  'tests/sold-company-pe-authority-webkit-test.js',
  // Added after the Phase 1A split: #955 refounding WebKit, run by vc-secondary-atomicity on every event.
  'tests/found-new-company-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #955 hostile buyout decline WebKit, run by stock-split-atomicity on every event.
  'tests/decline-buyout-ownership-save-atomicity-webkit-test.js',
  // The installed MBO writer must retain actual WebKit failure/reload coverage.
  'tests/execute-mbo-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: #988 read-only earnings view WebKit, run by stock-split-atomicity on every event.
  'tests/earnings-confirm-read-only-webkit-test.js',
  // Added after the Phase 1A split: D3 share-swap ownership ratios WebKit, run by stock-split-atomicity on every event.
  'tests/ma-share-swap-ownership-ratios-webkit-test.js',
  // Added after the Phase 1A split: D4 competitor stake WebKit, run by stock-split-atomicity on every event.
  'tests/competitor-stake-float-webkit-test.js',
  // Added after the Phase 1A split: M&A equity raise ownership ratios WebKit, run by stock-split-atomicity on every event.
  'tests/ma-equity-raise-ownership-ratios-webkit-test.js',
  'tests/activate-defense-ownership-ratios-webkit-test.js',
  // Added after the Phase 1A split: M&A equity raise shadow-state atomicity WebKit, run by stock-split-atomicity on every event.
  'tests/ma-equity-raise-shadow-atomicity-webkit-test.js',
  // Added after the Phase 1A split: activist proposal acceptance atomicity (#953), run by stock-split-atomicity on every event.
  'tests/shareholder-activism-accept-save-atomicity-webkit-test.js',
  // Added after the Phase 1A split: stock split dividend rescale, run by stock-split-atomicity on every event.
  'tests/stock-split-dividend-rescale-webkit-test.js', 'tests/stock-split-price-floor-webkit-test.js', 'tests/sponsor-injection-save-atomicity-webkit-test.js', 'tests/shareholder-buyback-save-atomicity-webkit-test.js', 'tests/shareholder-dividend-declaration-save-atomicity-webkit-test.js', 'tests/shareholder-dividend-payment-save-atomicity-webkit-test.js', 'tests/vc-writeoff-week-save-atomicity-webkit-test.js', 'tests/vc-round-close-week-save-atomicity-webkit-test.js', 'tests/vc-listing-week-save-atomicity-webkit-test.js', 'tests/subsidiary-ipo-save-atomicity-webkit-test.js', 'tests/subsidiary-secondary-sale-save-atomicity-webkit-test.js', 'tests/subsidiary-control-save-atomicity-webkit-test.js', 'tests/subsidiary-follow-on-save-atomicity-webkit-test.js', 'tests/turnaround-fund-accept-save-atomicity-webkit-test.js', 'tests/player-crisis-turnaround-ratchet-webkit-test.js', 'tests/personal-stock-margin-save-atomicity-webkit-test.js', 'tests/p4-aud-004-personal-secured-repayment-webkit-test.js', 'tests/founder-capital-atomicity-webkit-test.js', 'tests/debt-command-save-atomicity-webkit-test.js', 'tests/property-debt-principal-sync-webkit-test.js',
  // P4-AUD-007 D-1 mortgage disposal debt, run by property-debt-principal-sync on every event.
  'tests/p4-aud-007-mortgage-disposal-debt-webkit-test.js'
];
// Node (non-WebKit) commands per event, compared against the pre-split jobs (Phase 1B).
const nodeCommands = block => [...block.matchAll(/(npm run test:[\w:-]+|node tests\/[\w.-]+\.js)/g)].map(match => match[1]).filter(command => !command.endsWith('-webkit-test.js'));
const preSplitDealRoomNode = ['ma-deal-room', 'ma-integration', 'finance-ma-accounting', 'save', 'migration', 'save-v9', 'week', 'transaction',
  'syntax', 'javascript', 'modules', 'static', 'css'].map(name => `npm run test:${name}`);
const preSplitComprehensiveNode = [...['ma-acquisition-financing', 'ma-board-approval', 'ma-deal-room', 'ma-integration', 'ma-portfolio-summary',
  'ma-portfolio-summary-ui', 'ceo-dashboard', 'finance', 'finance-ma-accounting', 'accounting-invariants', 'save', 'migration', 'save-v9', 'week',
  'transaction', 'syntax', 'javascript', 'modules', 'static', 'css', 'progression-balance', 'strategy-balance'].map(name => `npm run test:${name}`),
  'node tests/v1-progression-gate-test.js', 'node tests/executive-secretary-test.js'];
const maJobs = jobNames(comprehensiveMa);
for (const [label, context, expected, expectedJobs] of [
  ['pull_request', {event: 'pull_request', mode: ''}, preSplitDealRoomWebkit, ['deal-room']],
  ['workflow_dispatch deal-room', {event: 'workflow_dispatch', mode: 'deal-room'}, preSplitDealRoomWebkit, ['deal-room']],
  ['push main', {event: 'push', mode: ''}, preSplitComprehensiveWebkit, ['comprehensive-ma', 'comprehensive-ma-balance']],
  ['schedule', {event: 'schedule', mode: ''}, preSplitComprehensiveWebkit, ['comprehensive-ma', 'comprehensive-ma-balance']],
  ['workflow_dispatch comprehensive', {event: 'workflow_dispatch', mode: 'comprehensive'}, preSplitComprehensiveWebkit, ['comprehensive-ma', 'comprehensive-ma-balance']]
]) {
  const running = maJobs.filter(job => evaluateCondition(jobCondition(jobBlock(comprehensiveMa, job)), context));
  for (const job of [...expectedJobs, 'debt-command-atomicity', 'stock-split-atomicity', ...Object.keys(movedFamilyJobs), 'ma-economic-gate'])
    assert(running.includes(job), `${label} must run ${job}`);
  for (const job of ['comprehensive-ma', 'comprehensive-ma-balance', 'deal-room'].filter(job => !expectedJobs.includes(job)))
    assert(!running.includes(job), `${label} must not run ${job}`);
  const executed = running.flatMap(job => webkitCommands(jobBlock(comprehensiveMa, job)));
  assert.deepEqual([...executed].sort(), [...expected].sort(), `${label} must execute exactly the pre-split WebKit set, each regression once`);
  const nodeExecuted = running.flatMap(job => nodeCommands(jobBlock(comprehensiveMa, job)));
  const nodeExpected = expectedJobs.includes('deal-room') ? preSplitDealRoomNode : preSplitComprehensiveNode;
  assert.deepEqual([...nodeExecuted].sort(), [...nodeExpected].sort(), `${label} must execute exactly the pre-split Node command set, each command once`);
}

// The aggregate verdict must cover every other M&A job, so a skipped, cancelled or failed
// family job cannot leave the workflow looking green.
const economicGate = jobBlock(comprehensiveMa, 'ma-economic-gate');
assert(/^    if: always\(\)\s*$/m.test(economicGate), 'M&A economic gate must evaluate even when a needed job failed');
assert(economicGate.includes('timeout-minutes: 5'), 'M&A economic gate must be bounded');
const gateNeeds = (economicGate.match(/^    needs: \[([^\]]+)\]/m) || [])[1];
assert(gateNeeds, 'M&A economic gate must declare needs');
assert.deepEqual(gateNeeds.split(',').map(job => job.trim()).sort(), maJobs.filter(job => job !== 'ma-economic-gate').sort(), 'M&A economic gate must need every other M&A job');
for (const fragment of ['NEEDS_JSON: ${{ toJSON(needs) }}', 'EVENT_NAME: ${{ github.event_name }}', 'DISPATCH_MODE: ${{ inputs.mode }}',
  "const expected = required ? 'success' : 'skipped';", 'if (problems.length)', 'process.exit(1)', 'unclassified needs']) {
  assert(economicGate.includes(fragment), `M&A economic gate must retain ${fragment}`);
}
for (const job of maJobs.filter(job => job !== 'ma-economic-gate'))
  assert(economicGate.includes(`'${job}':`), `M&A economic gate must classify ${job} per event`);
const pagesSmoke = readWorkflow('pages-deployment-smoke.yml');
assert(/^name: Pages Deployment Smoke$/m.test(pagesSmoke), 'Pages Deployment Smoke name is a workflow_run contract');
assert(hasTrigger(pagesSmoke, 'push') && hasTrigger(pagesSmoke, 'schedule') && hasTrigger(pagesSmoke, 'workflow_dispatch'), 'Pages Deployment Smoke triggers must remain intact');
assert(pagesSmoke.includes("cron: '17 4 * * *'"), 'Pages Deployment Smoke must inherit the daily publication attestation schedule');
assert(pagesSmoke.includes("if: github.event_name != 'schedule'"), 'scheduled Pages checks must skip the full WebKit job');
assert(pagesSmoke.includes('node scripts/verify-published-pages.js'), 'Pages Deployment Smoke must retain publication verification');
assert(readWorkflow('release-attestation-sync.yml').includes('Pages Deployment Smoke'), 'Release Attestation Sync must still reference Pages Deployment Smoke');
for (const command of ['node tests/iphone-playtest-webkit-test.js', 'node tests/physical-iphone-playtest-test.js']) {
  assert(iphoneJob.includes(command), `iPhone consolidated executor must retain ${command}`);
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
assert.equal(scheduledStartsPerDay, 5, 'CI Hygiene adds one lightweight daily cleanup to the four established scheduled starts');
for (const file of workflowFiles) {
  const source = readWorkflow(file);
  if (hasTrigger(source, 'push')) assert(isMainOnly(triggerBlock(source, 'push')), `${file} must not run on feature-branch pushes`);
}
const pullRequestWorkflows = workflowFiles.filter(file => hasTrigger(readWorkflow(file), 'pull_request'));
assert.equal(pullRequestWorkflows.length, 4, 'Phase 2H retains three PR validation workflows plus close-only CI Hygiene');
console.log(`workflow trigger architecture contract: ${workflowFiles.length} workflows, ${scheduledStartsPerDay} scheduled starts/day, ${pullRequestWorkflows.length} PR-triggered workflows`);

// Phase 1A: VC follow-on / initial investment WebKit moved from comprehensive-ma and deal-room to
// vc-funding-atomicity. Re-check the PR gate and main gate runs here by evaluated event.
for (const context of [{event: 'pull_request', mode: ''}, {event: 'push', mode: ''}]) {
  const running = maJobs.filter(job => evaluateCondition(jobCondition(jobBlock(comprehensiveMa, job)), context));
  const executed = running.flatMap(job => webkitCommands(jobBlock(comprehensiveMa, job)));
  assert(executed.includes('tests/vc-follow-on-save-atomicity-webkit-test.js'), `VC follow-on real WebKit must run on ${context.event}`);
  assert(executed.includes('tests/vc-initial-investment-save-atomicity-webkit-test.js'), `VC initial investment real WebKit must run on ${context.event}`);
}
