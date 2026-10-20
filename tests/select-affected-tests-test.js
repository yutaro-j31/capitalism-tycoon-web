'use strict';
// The local affected-test selector must stay a safe superset of what a change needs: contracts always,
// acceptance gates on any production source change, and every workflow step guarded by a matching path.
const assert = require('node:assert/strict');
const { select, globToRegExp, camel, canonicalTests } = require('../scripts/select-affected-tests');

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
assert.ok(names(select(['tests/iphone-webkit-smoke-test.js'])).includes('tests/iphone-webkit-smoke-test.js'));
// Codex P2: commands of matrix jobs (shard runners) need their matrix environment; they are listed
// as CI-only and never run locally.
const strategy = select(['tests/gym-membership-strategy-test.js']);
assert.ok(strategy.ciOnly.some(row => row.test === 'tests/difficulty-scenario-shard-runner.js'), 'matrix shard runner is CI-only');
assert.ok(!strategy.node.some(row => /shard-runner/.test(row.test)), 'matrix shard runners are not run locally');
// Codex P2: a core-module change reaches tests that boot the game through the harness.
assert.ok(names(select(['js/simulation-rng.js'])).includes('tests/personal-investment-risk-model-test.js'), 'harness tests follow core modules');
assert.ok(!names(select(['js/store-equipment.js'])).includes('tests/personal-investment-risk-model-test.js'), 'non-core modules keep the narrow plan');
console.log('select-affected-tests PASS');
