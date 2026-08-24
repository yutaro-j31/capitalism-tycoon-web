'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const orchestrator = fs.readFileSync(path.join(root, 'scripts', 'release-all-gates.js'), 'utf8');
const iphoneWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'test.yml'), 'utf8');
const recoveryWebKitTest = path.join(root, 'tests', 'capital-allocation-recovery-webkit-test.js');
const recoveryOutcomeWebKitTest = path.join(root, 'tests', 'capital-allocation-recovery-outcome-webkit-test.js');

assert.equal(packageJson.scripts['test:release'], 'node scripts/release-all-gates.js');
assert.equal(packageJson.scripts['test:release:balance'], 'node scripts/release-gate.js');
assert.equal(packageJson.scripts['test:release:hardening'], 'node scripts/release-hardening-gate.js');

for (const requiredScript of [
  'scripts/release-gate.js',
  'scripts/release-hardening-gate.js',
  'scripts/release-delivery-gate.js'
]) {
  assert.ok(orchestrator.includes(requiredScript), `release orchestrator must invoke ${requiredScript}`);
}

assert.ok(fs.existsSync(recoveryWebKitTest), 'recovery funding iPhone WebKit test must exist');
assert.ok(fs.existsSync(recoveryOutcomeWebKitTest), 'recovery outcome iPhone WebKit test must exist');
// The step may carry extra keys such as timeout-minutes between its name and its
// run command. Match across them, but never across a following step boundary, so a
// run command belonging to a different step cannot satisfy this assertion.
assert.match(
  iphoneWorkflow,
  /name: Verify recovery funding workflow on iPhone(?:(?!- name:)[\s\S])*?run: node tests\/capital-allocation-recovery-webkit-test\.js/,
  'iPhone WebKit workflow must execute the recovery funding interaction smoke'
);
assert.match(
  iphoneWorkflow,
  /name: Verify recovery funding outcome on iPhone(?:(?!- name:)[\s\S])*?run: node tests\/capital-allocation-recovery-outcome-webkit-test\.js/,
  'iPhone WebKit workflow must execute the recovery funding outcome smoke'
);
assert.match(iphoneWorkflow, /IPHONE_WEBKIT_ARTIFACT_DIR: artifacts\/iphone-webkit-smoke/,
  'recovery workflow evidence must be retained with the iPhone WebKit artifacts');

console.log('Release gate wiring test passed.');
