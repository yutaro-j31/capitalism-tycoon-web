'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const SAVE_VERSION = 9;
const REPOSITORY = 'yutaro-j31/capitalism-tycoon-web';
const PUBLIC_URL = 'https://yutaro-j31.github.io/capitalism-tycoon-web/';
const TRANSACTION_KINDS = new Set(['securities', 'properties', 'borrowing']);

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function safePath(value, label, root = ROOT) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, requiredText(value, label));
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} must remain inside the repository checkout.`);
  }
  return target;
}

function readJson(value, label, root = ROOT) {
  const target = safePath(value, label, root);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`${label} is missing: ${path.relative(path.resolve(root), target)}`);
  }
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    throw new Error(`${label} must contain valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeUrl(value, label) {
  let url;
  try {
    url = new URL(requiredText(value, label));
  } catch (_) {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use http or https.`);
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be finite.`);
  return number;
}

function validateOutcome(record, { published, publicUrl = PUBLIC_URL, label = 'recovery outcome' } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${label} must contain an object.`);
  if (record.status !== 'passed') throw new Error(`${label} did not pass.`);
  if (record.stage !== 'evidence') throw new Error(`${label} did not reach the evidence stage.`);
  if (record.saveKey !== SAVE_KEY) throw new Error(`${label} save key changed.`);
  if (record.saveVersion !== SAVE_VERSION) throw new Error(`${label} save version changed.`);
  if (record.browser !== 'WebKit') throw new Error(`${label} must be produced by WebKit.`);
  if (Boolean(record.published) !== Boolean(published)) throw new Error(`${label} published flag is invalid.`);

  const targetUrl = normalizeUrl(record.targetUrl, `${label} targetUrl`);
  if (published && targetUrl !== normalizeUrl(publicUrl, 'public URL')) {
    throw new Error(`${label} must target the public GitHub Pages URL.`);
  }

  const scenario = requiredText(record.scenario, `${label} scenario`);
  const targetScore = Math.round(finite(record.targetScore, `${label} targetScore`));
  const pinnedOption = requiredText(record.pinnedOption, `${label} pinnedOption`);
  const executedStepKinds = Array.isArray(record.executedStepKinds)
    ? record.executedStepKinds.map(kind => requiredText(kind, `${label} executedStepKind`))
    : [];
  if (!executedStepKinds.some(kind => TRANSACTION_KINDS.has(kind))) {
    throw new Error(`${label} must include an accounting transaction step.`);
  }

  const outcome = record.outcome;
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) throw new Error(`${label} outcome is missing.`);
  if (outcome.status !== 'verified' || outcome.verified !== true || outcome.targetReached !== true) {
    throw new Error(`${label} outcome is not verified.`);
  }
  const transactionCount = Math.floor(finite(outcome.transactionCount, `${label} transactionCount`));
  if (transactionCount < 1) throw new Error(`${label} must include accounting evidence.`);
  const cashVariance = finite(outcome.cashVariance, `${label} cashVariance`);
  const debtVariance = finite(outcome.debtVariance, `${label} debtVariance`);
  if (Math.abs(cashVariance) > .5) throw new Error(`${label} cash variance exceeds tolerance.`);
  if (Math.abs(debtVariance) > .5) throw new Error(`${label} debt variance exceeds tolerance.`);

  return {
    published:Boolean(published),
    targetUrl,
    scenario,
    targetScore,
    pinnedOption,
    executedStepKinds,
    device:requiredText(record.device, `${label} device`),
    browser:record.browser,
    browserVersion:requiredText(record.browserVersion, `${label} browserVersion`),
    outcome:{
      status:outcome.status,
      verified:true,
      targetReached:true,
      transactionCount,
      cashVariance,
      debtVariance,
      scoreVariance:Number.isFinite(Number(outcome.scoreVariance)) ? Number(outcome.scoreVariance) : null
    }
  };
}

function buildAttestation({ local, published, env = process.env, now = () => new Date().toISOString() } = {}) {
  const localEvidence = validateOutcome(local, { published:false, label:'local recovery outcome' });
  const publishedEvidence = validateOutcome(published, { published:true, label:'published recovery outcome' });
  const commit = requiredText(env.GITHUB_SHA, 'GITHUB_SHA').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('GITHUB_SHA must be a full 40-character commit SHA.');
  const repository = requiredText(env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
  if (repository !== REPOSITORY) throw new Error(`Recovery attestation must run for ${REPOSITORY}.`);
  const workflowRunID = requiredText(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');

  for (const field of ['scenario', 'targetScore', 'pinnedOption']) {
    if (localEvidence[field] !== publishedEvidence[field]) {
      throw new Error(`Local and published recovery evidence differ for ${field}.`);
    }
  }
  if (JSON.stringify(localEvidence.executedStepKinds) !== JSON.stringify(publishedEvidence.executedStepKinds)) {
    throw new Error('Local and published recovery evidence differ for executedStepKinds.');
  }

  return {
    schemaVersion:1,
    repository,
    commit,
    workflowRunID,
    createdAt:new Date(now()).toISOString(),
    saveKey:SAVE_KEY,
    saveVersion:SAVE_VERSION,
    deterministicMatch:true,
    scenario:localEvidence.scenario,
    targetScore:localEvidence.targetScore,
    pinnedOption:localEvidence.pinnedOption,
    executedStepKinds:localEvidence.executedStepKinds,
    local:localEvidence,
    published:publishedEvidence
  };
}

function writeAttestation(attestation, outputPath, root = ROOT) {
  const target = safePath(outputPath, 'RC_RECOVERY_ATTESTATION_PATH', root);
  fs.writeFileSync(target, `${JSON.stringify(attestation, null, 2)}\n`, 'utf8');
  return target;
}

function main() {
  const local = readJson(process.env.RC_LOCAL_RECOVERY_OUTCOME_PATH, 'RC_LOCAL_RECOVERY_OUTCOME_PATH');
  const published = readJson(process.env.RC_PUBLISHED_RECOVERY_OUTCOME_PATH, 'RC_PUBLISHED_RECOVERY_OUTCOME_PATH');
  const attestation = buildAttestation({ local, published });
  const output = writeAttestation(attestation, process.env.RC_RECOVERY_ATTESTATION_PATH);
  console.log(JSON.stringify(attestation, null, 2));
  console.log(`Recovery outcome attestation passed: ${path.relative(ROOT, output)}`);
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
  SAVE_KEY,
  SAVE_VERSION,
  REPOSITORY,
  PUBLIC_URL,
  safePath,
  readJson,
  normalizeUrl,
  validateOutcome,
  buildAttestation,
  writeAttestation
};
