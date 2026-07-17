'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ROOT,
  loadManifest,
  confirmationEnvName,
  buildEvidence,
  writeEvidence
} = require('../scripts/release-candidate-tag-gate');

const manifest = loadManifest(ROOT);
const fullSHA = '51c7bcfad548c1f708736ad86d4ef7d1d4f676f2';
const baseEnv = {
  GITHUB_REF_NAME: 'main',
  GITHUB_SHA: fullSHA,
  GITHUB_ACTOR: 'release-tester',
  GITHUB_RUN_ID: '123456789',
  RC_TEST_DEVICE: 'iPhone 17',
  RC_SAFARI_VERSION: 'Safari 26.0',
  RC_TESTED_AT: '2026-07-17T03:00:00+09:00',
  RC_TEST_NOTES: 'Portrait and landscape smoke completed.'
};
for (const checkID of manifest.manualSmokeChecks) {
  baseEnv[confirmationEnvName(checkID)] = 'true';
}

const evidence = buildEvidence({ manifest, env: baseEnv });
assert.equal(evidence.version, '2.0.0-rc.1');
assert.equal(evidence.tag, 'v2.0.0-rc.1');
assert.equal(evidence.branch, 'main');
assert.equal(evidence.commit, fullSHA);
assert.equal(evidence.checks.length, manifest.manualSmokeChecks.length);
assert.ok(evidence.checks.every(check => check.confirmed));
assert.equal(evidence.testedAt, '2026-07-16T18:00:00.000Z');
assert.equal(evidence.device, 'iPhone 17');
assert.equal(evidence.safariVersion, 'Safari 26.0');

const missingEnv = { ...baseEnv, RC_CONFIRM_JSON_SAVE_RECOVERY: 'false' };
assert.throws(
  () => buildEvidence({ manifest, env: missingEnv }),
  /Manual smoke checks are incomplete: json-save-recovery/
);
assert.throws(
  () => buildEvidence({ manifest, env: { ...baseEnv, GITHUB_REF_NAME: 'feature' } }),
  /may only be created from main/
);
assert.throws(
  () => buildEvidence({ manifest, env: { ...baseEnv, GITHUB_SHA: 'abc123' } }),
  /full 40-character commit SHA/
);
assert.throws(
  () => buildEvidence({ manifest, env: { ...baseEnv, RC_TEST_DEVICE: '' } }),
  /RC_TEST_DEVICE is required/
);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-tag-gate-'));
try {
  const written = writeEvidence(evidence, 'release-candidate-evidence.json', temporaryRoot);
  const stored = JSON.parse(fs.readFileSync(written, 'utf8'));
  assert.deepEqual(stored, evidence);
  assert.throws(
    () => writeEvidence(evidence, '../escaped.json', temporaryRoot),
    /must remain inside the repository checkout/
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release-candidate-tag.yml'), 'utf8');
assert.match(workflow, /^name: Release Candidate Tag$/m);
assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s*push:/m, 'release tag creation must never run automatically on push');
assert.doesNotMatch(workflow, /^\s*schedule:/m, 'release tag creation must never run on a schedule');
assert.match(workflow, /contents: write/, 'tag workflow needs explicit contents write permission');
assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/, 'tag workflow must be restricted to main');
assert.match(workflow, /gh pr list[^\n]*--state open/, 'tag workflow must reject open pull requests');
assert.match(workflow, /node scripts\/release-candidate-tag-gate\.js/);
assert.match(workflow, /npm run test:release/);
assert.match(workflow, /node scripts\/pages-deployment-smoke\.js/);
assert.match(workflow, /node tests\/runtime-recovery-webkit-test\.js/,
  'RC tagging must exercise runtime recovery in WebKit');
const localSmokeIndex = workflow.indexOf('node tests/iphone-webkit-smoke-test.js');
const recoveryIndex = workflow.indexOf('node tests/runtime-recovery-webkit-test.js');
const tagIndex = workflow.indexOf('git tag -a');
assert.ok(localSmokeIndex !== -1 && recoveryIndex > localSmokeIndex,
  'runtime recovery WebKit must run after the local iPhone smoke');
assert.ok(tagIndex > recoveryIndex, 'runtime recovery WebKit must pass before tag creation');
assert.match(workflow, /git tag -a/);
assert.match(workflow, /git push origin "refs\/tags\/\$TAG"/);
assert.match(workflow, /actions\/upload-artifact@v4/, 'manual evidence must be retained as an artifact');

const deliveryGate = fs.readFileSync(path.join(ROOT, 'scripts', 'release-delivery-gate.js'), 'utf8');
assert.match(deliveryGate, /tests\/release-candidate-tag-gate-test\.js/, 'tag gate contract must remain in release delivery');

console.log('release candidate tag gate checks passed.');
