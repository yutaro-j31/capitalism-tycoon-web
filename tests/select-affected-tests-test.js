'use strict';
// The local affected-test selector must stay a safe superset of what a change needs: contracts always,
// acceptance gates on any production source change, and every workflow step guarded by a matching path.
const assert = require('node:assert/strict');
const { select, globToRegExp, camel, canonicalTests, envOf, envFor } = require('../scripts/select-affected-tests');

assert.equal(globToRegExp('js/**').test('js/a/b.js'), true);
assert.equal(globToRegExp('js/*.js').test('js/a/b.js'), false);
assert.equal(globToRegExp('js/*.js').test('js/engine.js'), true);
assert.equal(globToRegExp('index.html').test('indexXhtml'), false, 'dots are literal');
assert.equal(camel('phase3-control-eligibility'), 'phase3ControlEligibility');

const names = plan => [...plan.node, ...plan.webkit].map(row => row.test);
const contracts = ['tests/test-registration-contract-test.js', 'tests/shard-matrix-contract.js', 'tests/workflow-path-filter-contract-test.js'];

const docs = select(['docs/README.md']);
assert.deepEqual(names(docs).sort(), [...contracts].sort(), 'docs-only change selects only the always-on contracts');

const production = select(['js/store-equipment.js']);
for (const gate of ['tests/phase0-5-acceptance-gate-test.js', 'tests/phase1-acceptance-gate-test.js', 'tests/economic-settlement-store-renovation-test.js', 'tests/store-equipment-test.js'])
  assert.ok(names(production).includes(gate), `production change selects ${gate}`);
assert.ok(production.node.every(row => !row.test.endsWith('-webkit-test.js')));
assert.ok(production.webkit.every(row => row.test.endsWith('-webkit-test.js')));

const changedTest = select(['tests/store-equipment-test.js']);
assert.ok(names(changedTest).includes('tests/store-equipment-test.js'), 'a changed test selects itself');

// A path guarded by the M&A workflow selects that workflow's Node and WebKit steps.
const guarded = select(['js/ma-acquisition-financing.js']);
assert.ok(guarded.node.some(row => row.reasons.some(r => r.startsWith('ma-acquisition-financing.yml paths'))));
assert.ok(guarded.webkit.length > 0, 'workflow WebKit steps are listed for a WebKit-capable run');

// Workflow steps that call `npm run <script>` expand to the node tests inside that script.
for (const test of ['tests/ma-acquisition-financing-test.js', 'tests/ma-acquisition-financing-capacity-test.js'])
  assert.ok(guarded.node.some(row => row.test === test), `npm-run workflow step expands to ${test}`);

// Canonical tests reached only through package.json scripts count as module references.
assert.ok(canonicalTests().includes('tests/market-engine-test.js'), 'test:market expands into the canonical corpus');
assert.ok(names(select(['js/market.js'])).includes('tests/market-engine-test.js'), 'market module change selects its npm-script test');

// A changed canonical executable is selected even without the -test.js suffix.
const probe = 'tests/vc-secondary-sale-save-false-red-probe.js';
assert.ok(canonicalTests().includes(probe), 'probe is canonical');
assert.ok(names(select([probe])).includes(probe), 'a changed canonical probe selects itself');

// Codex P2: `**/` matches zero directories, as in GitHub Actions path filters.
assert.equal(globToRegExp('tests/**/*strategy*').test('tests/gym-membership-strategy-test.js'), true);
assert.equal(globToRegExp('tests/**/*strategy*').test('tests/a/b/x-strategy-test.js'), true);
assert.equal(globToRegExp('tests/**/*strategy*').test('js/x-strategy.js'), false);
// Codex P2: a test run only by workflows without a paths block still counts as a changed test.
const smoke = select(['tests/iphone-webkit-smoke-test.js']);
assert.ok([...names(smoke), ...smoke.ciOnly.map(row => row.test)].includes('tests/iphone-webkit-smoke-test.js'));
// Codex P2: commands of matrix jobs (shard runners) need their matrix environment; they are listed
// as CI-only and never run locally.
const strategy = select(['tests/gym-membership-strategy-test.js']);
assert.ok(strategy.ciOnly.some(row => row.test === 'tests/difficulty-scenario-shard-runner.js'), 'matrix shard runner is CI-only');
assert.ok(!strategy.node.some(row => /shard-runner/.test(row.test)), 'matrix shard runners are not run locally');
// Codex P2: a core-module change reaches tests that boot the game through the harness.
assert.ok(names(select(['js/simulation-rng.js'])).includes('tests/personal-investment-risk-model-test.js'), 'harness tests follow core modules');
assert.ok(!names(select(['js/store-equipment.js'])).includes('tests/personal-investment-risk-model-test.js'), 'non-core modules keep the narrow plan');
// Codex P2: tests run through aggregator scripts (tests/test-execution-registry.json) count as tests.
assert.ok(names(select(['tests/release-gate-wiring-test.js'])).includes('tests/release-gate-wiring-test.js'), 'registry-executed test selects itself');
// Codex P2: jobs whose `if:` cannot hold on pull_request, or that consume upstream artifacts, are CI-only.
assert.ok(strategy.ciOnly.some(row => row.test === 'tests/exploration-aggregate.js'), 'dispatch-only artifact aggregate is CI-only');
assert.ok(!strategy.node.some(row => row.test === 'tests/exploration-aggregate.js'), 'dispatch-only artifact aggregate is not run locally');
// Jobs without a guard stay runnable, while the push/schedule-only comprehensive M&A job is CI-only.
assert.ok(guarded.webkit.some(row => row.test === 'tests/vc-follow-on-save-atomicity-webkit-test.js'), 'PR-run WebKit gate stays listed');
assert.ok(guarded.ciOnly.some(row => row.test === 'tests/ma-acquisition-financing-webkit-test.js'), 'push-only WebKit gate is CI-only');
assert.ok(!guarded.webkit.some(row => row.test === 'tests/ma-acquisition-financing-webkit-test.js'), 'CI-only tests are not listed again as WebKit');
// Codex P2: harness users are found through local helper requires (test -> fixture -> ./harness).
assert.ok(names(select(['js/simulation-rng.js'])).includes('tests/ma-acquisition-financing-test.js'), 'harness use is followed through fixtures');
// Codex P2: an inputs-dependent job whose condition has a top-level pull_request alternative stays
// PR-capable (strategy-balance focused-diagnostics runs its diagnostics on pull requests).
const diagnostics = select(['tests/gym-membership-strategy-test.js']);
for (const test of ['tests/prototype-overwrite-audit.js', 'tests/shareholder-activism-reachability-test.js']) {
  assert.ok(diagnostics.node.some(row => row.test === test), `PR diagnostics job runs ${test}`);
  assert.ok(!diagnostics.ciOnly.some(row => row.test === test), `${test} is not CI-only`);
}
// Codex P2: workflows no pull-request event triggers (workflow_run here) run in CI context only.
const attestation = select(['.github/workflows/release-attestation-sync.yml', 'scripts/release-attestation-issue.js']);
assert.ok(!attestation.node.some(row => row.test === 'scripts/release-attestation-issue.js'), 'workflow_run job is not run locally');
assert.ok(attestation.ciOnly.some(row => row.test === 'scripts/release-attestation-issue.js'), 'workflow_run job is listed as CI-only');
// Codex P2: a changed support file (helper or fixture) selects every test that requires it, transitively.
const helper = select(['tests/helpers/transaction-fault-case.js']);
assert.ok(helper.node.some(row => row.test === 'tests/transaction-fault-harness-test.js'), 'helper change selects its requiring test');
assert.ok(!names(helper).includes('tests/helpers/transaction-fault-case.js'), 'the helper itself is not run');
// Codex P2: a production module with no focused test (it extends a shared namespace) falls back to every
// canonical test that boots the game through the harness.
assert.ok(names(select(['js/competitor-media.js'])).includes('tests/competitor-newspaper-safety-test.js'), 'shared-namespace module falls back to harness tests');
console.log('select-affected-tests PASS');

// A comment-only filename mention does not suppress the fallback; code references by binding are focused (Codex 4332158094).
{
  const plan = names(select(['js/player-crisis-restructuring.js']));
  assert.ok(plan.includes('tests/player-crisis-restructuring-test.js'), 'destructured module binding selects the dedicated test');
}
// Reverse dependents follow a changed runnable test and a deleted helper (Codex 4332158097).
assert.ok(names(select(['tests/financial-statements-test.js'])).includes('tests/cash-flow-test.js'), 'a test that extends another test is selected');
// Computed requires and source reads of a changed script select the reading test (Codex 4332698750).
assert.ok(names(select(['scripts/pages-deployment-smoke.js'])).includes('tests/map-phase2-lazy-load-recovery-test.js'), 'computed require of a changed script selects its test');
// Map sources and assets outside tests/ and scripts/ select the tests that load them (Codex 4333790171).
for (const file of ['prototypes/map-world-preview.js', 'assets/map-sprites/phase2/sprites.json'])
  assert.ok(names(select([file])).includes('tests/map-phase2-environment-micro-props-test.js'), `${file} selects the map test that loads it`);
// A workflow step's literal env is passed to the command; a CI-context env value makes it CI-only.
// Changing tests/run-all.js selects tests/run-all-shard.js, which the shard-contract step runs with
// TEST_SHARD=A and TEST_SHARD_CONTRACT=1; without them it exits with `Unknown TEST_SHARD`.
{
  assert.deepEqual(envOf('      - name: x\n        env:\n          A: 1\n          B: \'two\'\n        run: node tests/x.js\n'), { env: { A: '1', B: 'two' }, ci: false });
  assert.equal(envOf('      - name: x\n        env:\n          TEST_SHARD: ${{ matrix.shard }}\n        run: node tests/x.js\n').ci, true);
  const plan = select(['tests/run-all.js']);
  assert.ok(plan.node.some(row => row.test === 'tests/run-all-shard.js'), 'run-all-shard.js stays runnable through the contract step');
  assert.deepEqual(envFor('tests/run-all-shard.js'), { TEST_SHARD: 'A', TEST_SHARD_CONTRACT: '1' }, 'it runs with the contract step env');
  assert.equal(envFor('tests/store-equipment-test.js'), undefined, 'a canonical test gets no workflow env');
}
