'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const orchestrator = fs.readFileSync(path.join(root, 'scripts', 'release-all-gates.js'), 'utf8');
const hardeningGate = fs.readFileSync(path.join(root, 'scripts', 'release-hardening-gate.js'), 'utf8');

assert.equal(
  packageJson.scripts['test:release'],
  'node scripts/release-all-gates.js',
  'test:release must remain the canonical release command'
);
assert.equal(
  packageJson.scripts['test:release:balance'],
  'node scripts/release-gate.js',
  'the focused balance gate alias must remain available'
);
assert.equal(
  packageJson.scripts['test:release:hardening'],
  'node scripts/release-hardening-gate.js',
  'the focused hardening gate alias must remain available'
);

for (const requiredScript of ['scripts/release-gate.js', 'scripts/release-hardening-gate.js']) {
  assert.match(
    orchestrator,
    new RegExp(requiredScript.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `release orchestrator must invoke ${requiredScript}`
  );
}

assert.match(
  hardeningGate,
  /test:release-wiring/,
  'release hardening must validate canonical release command wiring'
);

console.log('Release gate wiring test passed.');
