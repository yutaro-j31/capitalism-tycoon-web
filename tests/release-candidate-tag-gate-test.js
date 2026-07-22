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

assert.ok(
  manifest.manualSmokeChecks.includes('market-capital-allocation-cards'),
  'RC1 must require physical verification of the market capital allocation cards'
);
assert.equal(
  confirmationEnvName('market-capital-allocation-cards'),
  'RC_CONFIRM_MARKET_CAPITAL_ALLOCATION_CARDS'
);

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
const missingMarketCardEnv = { ...baseEnv, RC_CONFIRM_MARKET_CAPITAL_ALLOCATION_CARDS: 'false' };
assert.throws(
  () => buildEvidence({ manifest, env: missingMarketCardEnv }),
  /Manual smoke checks are incomplete: market-capital-allocation-cards/
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
assert.match(workflow, /market_capital_allocation_cards:/,
  'tag workflow must expose the physical market-card confirmation input');
assert.match(workflow, /description: Market capital allocation, recovery funding, reconciliation, and outcome cards are usable without horizontal overflow/,
  'physical market-card confirmation must cover the complete recovery funding workflow');
assert.match(workflow, /RC_CONFIRM_MARKET_CAPITAL_ALLOCATION_CARDS: \$\{\{ inputs\.market_capital_allocation_cards \}\}/,
  'tag workflow must pass the market-card confirmation to the generic evidence gate');
assert.match(workflow, /node scripts\/release-candidate-tag-gate\.js/);
assert.match(workflow, /npm run test:release/);
assert.match(workflow, /node scripts\/pages-deployment-smoke\.js/);
assert.match(workflow, /node tests\/playtest-report-webkit-test\.js/,
  'RC tagging must exercise playtest report download in WebKit');
assert.match(workflow, /node tests\/boot-recovery-webkit-test\.js/,
  'RC tagging must exercise boot recovery in WebKit');
assert.match(workflow, /node tests\/runtime-recovery-webkit-test\.js/,
  'RC tagging must exercise runtime recovery in WebKit');
const outcomeRuns = workflow.match(/node tests\/capital-allocation-recovery-outcome-webkit-test\.js/g) || [];
assert.equal(outcomeRuns.length, 2, 'RC tagging must run recovery outcome verification locally and against published Pages');
const targetSyncRuns = workflow.match(/node tests\/capital-allocation-recovery-webkit-test\.js/g) || [];
assert.equal(targetSyncRuns.length, 2, 'RC tagging must run recovery target synchronization locally and against published Pages');
assert.match(workflow, /CAPITAL_ALLOCATION_RECOVERY_TARGET_URL: https:\/\/yutaro-j31\.github\.io\/capitalism-tycoon-web\//,
  'published recovery verification must target the public Pages URL');
assert.match(workflow, /node scripts\/release-candidate-recovery-attestation\.js/,
  'RC tagging must consolidate the local and published recovery evidence');
assert.match(workflow, /RC_LOCAL_RECOVERY_OUTCOME_PATH: artifacts\/iphone-webkit-smoke\/capital-allocation-recovery-outcome-workflow\.json/);
assert.match(workflow, /RC_PUBLISHED_RECOVERY_OUTCOME_PATH: artifacts\/published-iphone-webkit-smoke\/capital-allocation-recovery-outcome-workflow\.json/);
assert.match(workflow, /RC_RECOVERY_ATTESTATION_PATH: release-candidate-recovery-attestation\.json/);
assert.match(workflow, /release-candidate-recovery-attestation\.json/,
  'consolidated recovery evidence must be retained with release candidate evidence');

const localSmokeIndex = workflow.indexOf('node tests/iphone-webkit-smoke-test.js');
const localTargetSyncIndex = workflow.indexOf('node tests/capital-allocation-recovery-webkit-test.js');
const localOutcomeIndex = workflow.indexOf('node tests/capital-allocation-recovery-outcome-webkit-test.js');
const playtestIndex = workflow.indexOf('node tests/playtest-report-webkit-test.js');
const bootIndex = workflow.indexOf('node tests/boot-recovery-webkit-test.js');
const recoveryIndex = workflow.indexOf('node tests/runtime-recovery-webkit-test.js');
const pagesBytesIndex = workflow.indexOf('node scripts/pages-deployment-smoke.js');
const publishedSmokeIndex = workflow.lastIndexOf('node tests/iphone-webkit-smoke-test.js');
const publishedTargetSyncIndex = workflow.lastIndexOf('node tests/capital-allocation-recovery-webkit-test.js');
const publishedOutcomeIndex = workflow.lastIndexOf('node tests/capital-allocation-recovery-outcome-webkit-test.js');
const attestationIndex = workflow.indexOf('node scripts/release-candidate-recovery-attestation.js');
const tagIndex = workflow.indexOf('git tag -a');
assert.ok(localSmokeIndex !== -1 && localTargetSyncIndex > localSmokeIndex,
  'local recovery target synchronization must run after the local iPhone smoke');
assert.ok(localOutcomeIndex > localTargetSyncIndex,
  'local recovery outcome WebKit must run after local target synchronization');
assert.ok(playtestIndex > localOutcomeIndex, 'playtest report WebKit must run after local recovery outcome verification');
assert.ok(bootIndex > playtestIndex, 'boot recovery WebKit must run after playtest reporting');
assert.ok(recoveryIndex > bootIndex, 'runtime recovery WebKit must run after boot recovery');
assert.ok(pagesBytesIndex > recoveryIndex, 'published byte attestation must run after local support checks');
assert.ok(publishedSmokeIndex > pagesBytesIndex, 'published iPhone smoke must run after published byte attestation');
assert.ok(publishedTargetSyncIndex > publishedSmokeIndex,
  'published recovery target synchronization must run after the published iPhone smoke');
assert.ok(publishedOutcomeIndex > publishedTargetSyncIndex,
  'published recovery outcome must run after the published target synchronization');
assert.ok(attestationIndex > publishedOutcomeIndex, 'local and published recovery evidence must be consolidated after both runs');
assert.ok(tagIndex > attestationIndex, 'the recovery attestation must pass before tag creation');
assert.match(workflow, /git tag -a/);
assert.match(workflow, /git push origin "refs\/tags\/\$TAG"/);
assert.match(workflow, /actions\/upload-artifact@v4/, 'manual evidence must be retained as an artifact');

const deliveryGate = fs.readFileSync(path.join(ROOT, 'scripts', 'release-delivery-gate.js'), 'utf8');
assert.match(deliveryGate, /tests\/release-candidate-tag-gate-test\.js/, 'tag gate contract must remain in release delivery');
assert.match(deliveryGate, /tests\/release-candidate-recovery-attestation-test\.js/,
  'recovery attestation contract must remain in release delivery');

console.log('release candidate tag gate checks passed.');
