'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const orchestrator = fs.readFileSync(path.join(root, 'scripts', 'release-all-gates.js'), 'utf8');

assert.equal(packageJson.scripts['test:release'], 'node scripts/release-all-gates.js');
assert.equal(packageJson.scripts['test:release:balance'], 'node scripts/release-gate.js');
assert.equal(packageJson.scripts['test:release:hardening'], 'node scripts/release-hardening-gate.js');

for (const requiredScript of ['scripts/release-gate.js', 'scripts/release-hardening-gate.js']) {
  assert.ok(orchestrator.includes(requiredScript), `release orchestrator must invoke ${requiredScript}`);
}

console.log('Release gate wiring test passed.');
