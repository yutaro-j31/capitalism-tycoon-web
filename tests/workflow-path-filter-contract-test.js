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

assert.equal(workflowFiles.length, 13, 'Phase 2D must retain exactly 13 workflow files');
for (const file of ['ceo-dashboard.yml', 'founding-tutorial.yml', 'ma-integration.yml', 'ma-board-approval.yml', 'iphone-playtest-remediation.yml', 'physical-iphone-playtest.yml', 'pages-publication-attestation.yml', 'published-save-quota-contract.yml', 'release-attestation-contract.yml']) {
  assert.equal(workflowFiles.includes(file), false, `${file} must remain absent after workflow consolidation`);
}
for (const file of ['test.yml', 'release-readiness.yml', 'strategy-balance.yml', 'phase6b3-diagnostic.yml', 'iphone-webkit-smoke.yml', 'ma-deal-room.yml', 'ma-acquisition-financing.yml', 'pages-deployment-smoke.yml', 'release-attestation-sync.yml', 'release-candidate-tag.yml', 'issue-294-executive-hiring-diagnostic.yml', 'shareholder-activism.yml', 'exploration-1000-week.yml']) {
  assert(workflowFiles.includes(file), `${file} must remain after Phase 2D consolidation`);
}
for (const file of workflowFiles) {
  assert(!readWorkflow(file).includes('js/pmi-100-day-loader.js'), `${file} must not reference the obsolete PMI loader`);
}
for (const file of ['test.yml', 'release-readiness.yml']) {
  const source = readWorkflow(file);
  assert(hasTrigger(source, 'pull_request'), `${file} must remain an always-run pull-request workflow`);
  assert.equal(pathsFor(source, 'pull_request').length, 0, `${file} pull_request must not have a paths filter`);
}
const strategy = readWorkflow('strategy-balance.yml');
assert(hasTrigger(strategy, 'pull_request'), 'Strategy Balance must retain PR full-matrix coverage');
assert(strategy.includes('npm run test:strategy-balance'), 'Strategy Balance must retain the full matrix command');
assert.deepEqual(triggerBlock(strategy, 'push').filter(line => /branches:/.test(line)), ['    branches: [main]'], 'Strategy Balance push must be main-only');
const difficulty = readWorkflow('phase6b3-diagnostic.yml');
assert(!hasTrigger(difficulty, 'pull_request'), 'Difficulty Scenario Balance must not duplicate Release Readiness on PRs');
assert(hasTrigger(difficulty, 'push') && hasTrigger(difficulty, 'schedule') && hasTrigger(difficulty, 'workflow_dispatch'), 'Difficulty full matrix must remain available on main, nightly, and manually');
const comprehensiveMa = readWorkflow('ma-acquisition-financing.yml');
assert(!hasTrigger(comprehensiveMa, 'pull_request'), 'M&A comprehensive gate must not duplicate canonical PR coverage');
assert(hasTrigger(comprehensiveMa, 'push') && pathsFor(comprehensiveMa, 'push').length > 0, 'M&A comprehensive main push must use paths');
assert(isMainOnly(triggerBlock(comprehensiveMa, 'push')), 'M&A comprehensive push must be main-only');
assert(hasTrigger(comprehensiveMa, 'schedule') && hasTrigger(comprehensiveMa, 'workflow_dispatch'), 'M&A comprehensive nightly/manual coverage must remain');
for (const command of [
  'npm run test:ma-board-approval',
  'npm run test:ma-integration',
  'node tests/ma-board-approval-webkit-test.js',
  'node tests/ma-integration-webkit-test.js',
]) assert(comprehensiveMa.includes(command), `M&A comprehensive gate must retain ${command}`);
const dealRoom = readWorkflow('ma-deal-room.yml');
assert(hasTrigger(dealRoom, 'pull_request') && pathsFor(dealRoom, 'pull_request').length > 0, 'M&A Deal Room must retain its path-scoped PR gate');
assert(hasTrigger(dealRoom, 'workflow_dispatch'), 'M&A Deal Room must remain manually runnable');
for (const command of ['playwright@1.61.0', 'npx playwright install --with-deps webkit', 'node tests/ma-deal-room-webkit-test.js', 'actions/upload-artifact@v4', 'if-no-files-found: error']) {
  assert(dealRoom.includes(command), `M&A Deal Room must retain ${command}`);
}

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
assert.equal(pullRequestWorkflows.length, 6, 'Phase 2D must retain six PR-triggered workflows after removing two duplicate contracts');
console.log(`workflow trigger architecture contract: ${workflowFiles.length} workflows, ${scheduledStartsPerDay} scheduled starts/day, ${pullRequestWorkflows.length} PR-triggered workflows`);
