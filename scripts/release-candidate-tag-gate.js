'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function loadManifest(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'release-candidate.json'), 'utf8'));
}

function confirmationEnvName(checkID) {
  return `RC_CONFIRM_${String(checkID).replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`;
}

function isTrue(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('release-candidate.json must contain an object.');
  }
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported release candidate schema.');
  if (!/^2\.0\.0-rc\.\d+$/.test(String(manifest.version))) {
    throw new Error('Release candidate version must use 2.0.0-rc.N.');
  }
  if (manifest.tag !== `v${manifest.version}`) throw new Error('Release candidate tag does not match its version.');
  if (manifest.channel !== 'release-candidate') throw new Error('Release candidate channel is invalid.');
  if (manifest.sourceBranch !== 'main') throw new Error('Release candidate source branch must remain main.');
  if (!Array.isArray(manifest.manualSmokeChecks) || manifest.manualSmokeChecks.length === 0) {
    throw new Error('Release candidate manual smoke checks are required.');
  }
  if (new Set(manifest.manualSmokeChecks).size !== manifest.manualSmokeChecks.length) {
    throw new Error('Release candidate manual smoke checks must be unique.');
  }
  return manifest;
}

function buildEvidence({
  manifest = loadManifest(),
  env = process.env,
  now = () => new Date().toISOString()
} = {}) {
  validateManifest(manifest);

  const branch = requiredText(env.GITHUB_REF_NAME, 'GITHUB_REF_NAME');
  if (branch !== manifest.sourceBranch) {
    throw new Error(`Release candidate tags may only be created from ${manifest.sourceBranch}.`);
  }

  const commit = requiredText(env.GITHUB_SHA, 'GITHUB_SHA').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('GITHUB_SHA must be a full 40-character commit SHA.');

  const checks = manifest.manualSmokeChecks.map(checkID => {
    const envName = confirmationEnvName(checkID);
    return {
      id: checkID,
      env: envName,
      confirmed: isTrue(env[envName])
    };
  });
  const missing = checks.filter(check => !check.confirmed);
  if (missing.length) {
    throw new Error(`Manual smoke checks are incomplete: ${missing.map(check => check.id).join(', ')}`);
  }

  const device = requiredText(env.RC_TEST_DEVICE, 'RC_TEST_DEVICE');
  const safariVersion = requiredText(env.RC_SAFARI_VERSION, 'RC_SAFARI_VERSION');
  const actor = requiredText(env.GITHUB_ACTOR, 'GITHUB_ACTOR');
  const runID = requiredText(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const testedAt = String(env.RC_TESTED_AT ?? '').trim() || now();
  if (Number.isNaN(Date.parse(testedAt))) throw new Error('RC_TESTED_AT must be a valid ISO-8601 timestamp.');

  return {
    schemaVersion: 1,
    version: manifest.version,
    tag: manifest.tag,
    repository: manifest.repository,
    branch,
    commit,
    actor,
    workflowRunID: runID,
    testedAt: new Date(testedAt).toISOString(),
    device,
    safariVersion,
    notes: String(env.RC_TEST_NOTES ?? '').trim(),
    checks: checks.map(({ id, confirmed }) => ({ id, confirmed }))
  };
}

function writeEvidence(evidence, outputPath, root = ROOT) {
  const target = path.resolve(root, outputPath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('Release evidence output must remain inside the repository checkout.');
  }
  fs.writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return target;
}

function main() {
  const evidence = buildEvidence();
  const output = process.env.RC_EVIDENCE_PATH;
  if (output) writeEvidence(evidence, output);
  console.log(JSON.stringify(evidence, null, 2));
  console.log('Release candidate tag gate passed.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}

module.exports = {
  ROOT,
  loadManifest,
  confirmationEnvName,
  isTrue,
  validateManifest,
  buildEvidence,
  writeEvidence
};
