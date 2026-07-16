'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = '<!-- rc-pages-attestation -->';

function fail(message) {
  throw new Error(message);
}

function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) fail(`${name} is required`);
  return value;
}

function resolveInsideRoot(filePath, root = ROOT) {
  const resolved = path.resolve(root, filePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    fail(`${filePath} must remain inside the repository checkout`);
  }
  return resolved;
}

function buildAttestation({ manifest, env = process.env }) {
  if (!manifest || typeof manifest !== 'object') fail('release candidate manifest is required');

  const repository = required(env, 'GITHUB_REPOSITORY');
  if (repository !== manifest.repository) {
    fail(`GITHUB_REPOSITORY must equal ${manifest.repository}`);
  }

  const commit = required(env, 'RC_ATTESTATION_COMMIT').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    fail('RC_ATTESTATION_COMMIT must be a full 40-character commit SHA');
  }

  const runID = required(env, 'RC_ATTESTATION_RUN_ID');
  if (!/^\d+$/.test(runID)) fail('RC_ATTESTATION_RUN_ID must be numeric');

  const runURL = required(env, 'RC_ATTESTATION_RUN_URL');
  const expectedRunURL = `https://github.com/${repository}/actions/runs/${runID}`;
  let parsedRunURL;
  try {
    parsedRunURL = new URL(runURL);
  } catch (_) {
    fail('RC_ATTESTATION_RUN_URL must be a valid URL');
  }
  if (parsedRunURL.toString() !== expectedRunURL) {
    fail(`RC_ATTESTATION_RUN_URL must equal ${expectedRunURL}`);
  }

  const artifact = required(env, 'RC_ATTESTATION_ARTIFACT');
  const expectedArtifact = `published-iphone-webkit-smoke-${commit}`;
  if (artifact !== expectedArtifact) {
    fail(`RC_ATTESTATION_ARTIFACT must equal ${expectedArtifact}`);
  }

  const completedRaw = required(env, 'RC_ATTESTATION_COMPLETED_AT');
  const completedDate = new Date(completedRaw);
  if (!Number.isFinite(completedDate.getTime())) {
    fail('RC_ATTESTATION_COMPLETED_AT must be a valid date');
  }

  const issueNumber = Number(required(env, 'RC_TRACKING_ISSUE'));
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    fail('RC_TRACKING_ISSUE must be a positive integer');
  }

  return {
    schemaVersion: 1,
    candidate: manifest.version,
    tag: manifest.tag,
    repository,
    commit,
    runID,
    runURL,
    artifact,
    completedAt: completedDate.toISOString(),
    issueNumber,
    deploymentURL: manifest.deployment.url,
    saveKey: manifest.save.key,
    saveVersion: manifest.save.version
  };
}

function buildComment(attestation) {
  return `${MARKER}\n## RC1 automated Pages attestation\n\n` +
    `- Candidate: \`${attestation.candidate}\`\n` +
    `- Planned tag: \`${attestation.tag}\`\n` +
    `- Verified main commit: \`${attestation.commit}\`\n` +
    `- Published site: ${attestation.deploymentURL}\n` +
    `- Workflow run: ${attestation.runURL}\n` +
    `- Evidence artifact: \`${attestation.artifact}\`\n` +
    `- Completed: \`${attestation.completedAt}\`\n\n` +
    `### Automated gates passed\n\n` +
    `- Every published HTML, CSS, and JavaScript byte matched the checked-out main commit.\n` +
    `- The published site completed fresh setup, one-week and four-week reports, save/export/reset/import, and JSON recovery in iPhone-profiled WebKit.\n` +
    `- Mobile navigation, control reachability, modal width, browser errors, console errors, and failed requests were checked.\n\n` +
    `Physical iPhone Safari confirmation in the issue checklist is still required before \`${attestation.tag}\` may be created.\n`;
}

function updateTrackingBody(body, attestation) {
  if (typeof body !== 'string' || !body.trim()) fail('existing issue body is required');

  const targetPattern = /- Target main commit: `[0-9a-f]{40}`/;
  if (!targetPattern.test(body)) fail('tracking issue target commit line is missing');

  const evidencePrefix = '- [x] Published Pages bytes and iPhone WebKit smoke passed for main ';
  const evidenceLine = `${evidencePrefix}\`${attestation.commit}\``;
  const lines = body
    .replace(targetPattern, `- Target main commit: \`${attestation.commit}\``)
    .split(/\r?\n/)
    .filter(line => !line.startsWith(evidencePrefix));

  const headingIndex = lines.indexOf('## Automated release evidence');
  if (headingIndex < 0) fail('tracking issue automated evidence section is missing');

  let insertIndex = headingIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex] === '') insertIndex += 1;
  lines.splice(insertIndex, 0, evidenceLine);

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function writeText(relativePath, content, root = ROOT) {
  const target = resolveInsideRoot(relativePath, root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-candidate.json'), 'utf8'));
  const attestation = buildAttestation({ manifest, env: process.env });
  const existingPath = resolveInsideRoot(required(process.env, 'RC_EXISTING_ISSUE_BODY_PATH'));
  const existingBody = fs.readFileSync(existingPath, 'utf8');
  const updatedBody = updateTrackingBody(existingBody, attestation);
  const comment = buildComment(attestation);

  writeText(required(process.env, 'RC_UPDATED_ISSUE_BODY_PATH'), updatedBody);
  writeText(required(process.env, 'RC_ATTESTATION_COMMENT_PATH'), comment);

  console.log(JSON.stringify({
    issueNumber: attestation.issueNumber,
    commit: attestation.commit,
    runID: attestation.runID,
    artifact: attestation.artifact
  }));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exit(1);
  }
}

module.exports = {
  ROOT,
  MARKER,
  buildAttestation,
  buildComment,
  updateTrackingBody,
  resolveInsideRoot,
  writeText
};