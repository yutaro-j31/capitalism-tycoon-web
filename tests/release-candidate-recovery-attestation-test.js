'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  SAVE_KEY,
  SAVE_VERSION,
  REPOSITORY,
  PUBLIC_URL,
  safePath,
  readJson,
  validateOutcome,
  buildAttestation,
  writeAttestation
} = require('../scripts/release-candidate-recovery-attestation');

function outcomeFixture(published) {
  return {
    status:'passed',
    stage:'evidence',
    device:'iPhone 13',
    browser:'WebKit',
    browserVersion:'26.0',
    targetUrl:published ? PUBLIC_URL : 'http://127.0.0.1:43123/',
    published,
    scenario:'liquid-heavy',
    targetScore:60,
    pinnedOption:'recommended',
    executedStepKinds:['securities'],
    outcome:{
      status:'verified',
      verified:true,
      targetReached:true,
      transactionCount:1,
      cashVariance:0,
      debtVariance:0,
      scoreVariance:1
    },
    saveKey:SAVE_KEY,
    saveVersion:SAVE_VERSION
  };
}

const local = outcomeFixture(false);
const published = outcomeFixture(true);
const env = {
  GITHUB_SHA:'51c7bcfad548c1f708736ad86d4ef7d1d4f676f2',
  GITHUB_REPOSITORY:REPOSITORY,
  GITHUB_RUN_ID:'987654321'
};

const normalizedLocal = validateOutcome(local, { published:false, label:'local fixture' });
const normalizedPublished = validateOutcome(published, { published:true, label:'published fixture' });
assert.equal(normalizedLocal.published, false);
assert.equal(normalizedPublished.published, true);
assert.equal(normalizedPublished.targetUrl, PUBLIC_URL);
assert.equal(normalizedPublished.outcome.transactionCount, 1);

const attestation = buildAttestation({
  local,
  published,
  env,
  now:() => '2026-07-22T03:30:00.000Z'
});
assert.equal(attestation.schemaVersion, 1);
assert.equal(attestation.repository, REPOSITORY);
assert.equal(attestation.commit, env.GITHUB_SHA);
assert.equal(attestation.workflowRunID, env.GITHUB_RUN_ID);
assert.equal(attestation.createdAt, '2026-07-22T03:30:00.000Z');
assert.equal(attestation.saveKey, SAVE_KEY);
assert.equal(attestation.saveVersion, SAVE_VERSION);
assert.equal(attestation.deterministicMatch, true);
assert.deepEqual(attestation.executedStepKinds, ['securities']);
assert.equal(attestation.local.published, false);
assert.equal(attestation.published.published, true);

assert.throws(
  () => validateOutcome({ ...published, published:false }, { published:true, label:'published fixture' }),
  /published flag is invalid/
);
assert.throws(
  () => validateOutcome({ ...published, saveVersion:10 }, { published:true, label:'published fixture' }),
  /save version changed/
);
assert.throws(
  () => validateOutcome({ ...published, outcome:{ ...published.outcome, verified:false } }, { published:true, label:'published fixture' }),
  /outcome is not verified/
);
assert.throws(
  () => validateOutcome({ ...published, outcome:{ ...published.outcome, cashVariance:1 } }, { published:true, label:'published fixture' }),
  /cash variance exceeds tolerance/
);
assert.throws(
  () => validateOutcome({ ...published, outcome:{ ...published.outcome, debtVariance:-1 } }, { published:true, label:'published fixture' }),
  /debt variance exceeds tolerance/
);
assert.throws(
  () => validateOutcome({ ...published, executedStepKinds:['policy'] }, { published:true, label:'published fixture' }),
  /accounting transaction step/
);
assert.throws(
  () => validateOutcome({ ...published, targetUrl:'https://example.com/' }, { published:true, label:'published fixture' }),
  /public GitHub Pages URL/
);
assert.throws(
  () => buildAttestation({ local, published:{ ...published, scenario:'other' }, env }),
  /differ for scenario/
);
assert.throws(
  () => buildAttestation({ local, published:{ ...published, executedStepKinds:['borrowing'] }, env }),
  /differ for executedStepKinds/
);
assert.throws(
  () => buildAttestation({ local, published, env:{ ...env, GITHUB_SHA:'abc123' } }),
  /full 40-character commit SHA/
);
assert.throws(
  () => buildAttestation({ local, published, env:{ ...env, GITHUB_REPOSITORY:'other/repository' } }),
  /must run for/
);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-recovery-attestation-'));
try {
  const localPath = path.join(temporaryRoot, 'local.json');
  const publishedPath = path.join(temporaryRoot, 'published.json');
  fs.writeFileSync(localPath, JSON.stringify(local));
  fs.writeFileSync(publishedPath, JSON.stringify(published));
  assert.deepEqual(readJson('local.json', 'local evidence', temporaryRoot), local);
  assert.deepEqual(readJson('published.json', 'published evidence', temporaryRoot), published);
  const output = writeAttestation(attestation, 'attestation.json', temporaryRoot);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), attestation);
  assert.equal(safePath('attestation.json', 'output', temporaryRoot), output);
  assert.throws(() => safePath('../escape.json', 'output', temporaryRoot), /inside the repository checkout/);
  assert.throws(() => readJson('../escape.json', 'input', temporaryRoot), /inside the repository checkout/);
  assert.throws(() => readJson('missing.json', 'input', temporaryRoot), /is missing/);
  fs.writeFileSync(path.join(temporaryRoot, 'invalid.json'), '{bad');
  assert.throws(() => readJson('invalid.json', 'input', temporaryRoot), /valid JSON/);
  assert.throws(() => writeAttestation(attestation, '../escape.json', temporaryRoot), /inside the repository checkout/);
} finally {
  fs.rmSync(temporaryRoot, { recursive:true, force:true });
}

console.log('release candidate local/published recovery attestation tests passed');
