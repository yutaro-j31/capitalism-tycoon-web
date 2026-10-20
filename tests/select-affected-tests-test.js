'use strict';
// The local affected-test selector must stay a safe superset of what a change needs: contracts always,
// acceptance gates on any production source change, and every workflow step guarded by a matching path.
const assert = require('node:assert/strict');
const { select, globToRegExp, camel } = require('../scripts/select-affected-tests');

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
console.log('select-affected-tests PASS');
