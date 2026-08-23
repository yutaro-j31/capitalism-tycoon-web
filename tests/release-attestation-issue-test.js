'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT } = require('./harness');
const {
  MARKER,
  buildAttestation,
  buildComment,
  updateTrackingBody,
  resolveInsideRoot,
  writeText
} = require('../scripts/release-attestation-issue');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-candidate.json'), 'utf8'));
const commit = '5a788fd60289ce9df62da0ecf1066c2068b459fe';
const runID = '29530000000';
const baseEnv = {
  GITHUB_REPOSITORY: manifest.repository,
  RC_ATTESTATION_COMMIT: commit,
  RC_ATTESTATION_RUN_ID: runID,
  RC_ATTESTATION_RUN_URL: `https://github.com/${manifest.repository}/actions/runs/${runID}`,
  RC_ATTESTATION_ARTIFACT: `published-iphone-webkit-smoke-${commit}`,
  RC_ATTESTATION_COMPLETED_AT: '2026-07-17T05:00:00+09:00',
  RC_TRACKING_ISSUE: '63'
};

const attestation = buildAttestation({ manifest, env: baseEnv });
assert.equal(attestation.schemaVersion, 1);
assert.equal(attestation.candidate, '2.0.0-rc.1');
assert.equal(attestation.tag, 'v2.0.0-rc.1');
assert.equal(attestation.repository, manifest.repository);
assert.equal(attestation.commit, commit);
assert.equal(attestation.runID, runID);
assert.equal(attestation.artifact, `published-iphone-webkit-smoke-${commit}`);
assert.equal(attestation.completedAt, '2026-07-16T20:00:00.000Z');
assert.equal(attestation.issueNumber, 63);
assert.equal(attestation.saveKey, 'capitalism_tycoon_web_v1');
assert.equal(attestation.saveVersion, 9);

const comment = buildComment(attestation);
assert.ok(comment.startsWith(MARKER));
assert.match(comment, /RC1 automated Pages attestation/);
assert.match(comment, new RegExp(commit));
assert.match(comment, /Every published HTML, CSS, and JavaScript byte matched/);
assert.match(comment, /Physical iPhone Safari confirmation/);

const physicalChecks = [
  'Fresh visit reaches the founder setup screen',
  'JSON save recovery works before creating a replacement company',
  'One-week advance produces a weekly report and remains responsive',
  'Four-week advance completes and presents the final weekly summary',
  'Save, export, reset, and import remain reachable and functional',
  'Safe areas, horizontal navigation, buttons, forms, and modals remain usable'
];
const originalBody = `## Target

- Candidate: \`2.0.0-rc.1\`
- Planned tag: \`v2.0.0-rc.1\`
- Target main commit: \`cd826322c4bb6d98e697e7da0fb67d190fe3782a\`

## Automated release evidence

- [x] Existing matrix passed

## Required physical iPhone Safari smoke checks

${physicalChecks.map(check => `- [ ] ${check}`).join('\n')}
`;

const updatedBody = updateTrackingBody(originalBody, attestation);
assert.ok(updatedBody.includes(`Target main commit: \`${commit}\``));
assert.equal((updatedBody.match(/Published Pages bytes and iPhone WebKit smoke passed for main/g) || []).length, 1);
assert.ok(updatedBody.includes(`Published Pages bytes and iPhone WebKit smoke passed for main \`${commit}\``));
for (const check of physicalChecks) {
  assert.ok(updatedBody.includes(`- [ ] ${check}`), `physical check must remain unchecked: ${check}`);
}
assert.equal(updateTrackingBody(updatedBody, attestation), updatedBody, 'tracking-body update must be idempotent');

assert.throws(
  () => buildAttestation({ manifest, env: { ...baseEnv, RC_ATTESTATION_COMMIT: 'abc123' } }),
  /full 40-character commit SHA/
);
assert.throws(
  () => buildAttestation({ manifest, env: { ...baseEnv, RC_ATTESTATION_RUN_URL: `${baseEnv.RC_ATTESTATION_RUN_URL}?x=1` } }),
  /must equal/
);
assert.throws(
  () => buildAttestation({ manifest, env: { ...baseEnv, RC_ATTESTATION_ARTIFACT: 'other-artifact' } }),
  /must equal published-iphone-webkit-smoke/
);
assert.throws(
  () => buildAttestation({ manifest, env: { ...baseEnv, GITHUB_REPOSITORY: 'other/repository' } }),
  /GITHUB_REPOSITORY must equal/
);
assert.throws(
  () => updateTrackingBody('## Missing target\n', attestation),
  /target commit line is missing/
);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-release-attestation-'));
try {
  const written = writeText('artifacts/attestation.md', comment, temporaryRoot);
  assert.equal(fs.readFileSync(written, 'utf8'), comment);
  assert.throws(() => resolveInsideRoot('../escape.md', temporaryRoot), /must remain inside/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

const pagesWorkflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages-deployment-smoke.yml'), 'utf8');
assert.match(pagesWorkflow, /^name: Pages Deployment Smoke$/m, 'workflow_run depends on the Pages Deployment Smoke name');
const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release-attestation-sync.yml'), 'utf8');
assert.match(workflow, /^name: Release Attestation Sync$/m);
assert.match(workflow, /^  workflow_run:$/m);
assert.match(workflow, /workflows: \[ Pages Deployment Smoke \]/);
assert.match(workflow, /types: \[ completed \]/);
assert.match(workflow, /^  contents: read$/m);
assert.match(workflow, /^  actions: read$/m);
assert.match(workflow, /^  issues: write$/m);
assert.doesNotMatch(workflow, /contents: write/, 'attestation sync must not write repository contents');
assert.match(workflow, /workflow_run\.conclusion == 'success'/);
assert.match(workflow, /workflow_run\.event == 'push'/);
assert.match(workflow, /workflow_run\.head_branch == 'main'/);
assert.match(workflow, /workflow_run\.head_repository\.full_name == github\.repository/);
assert.match(workflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
assert.match(workflow, /commits\/main/);
assert.match(workflow, /published-iphone-webkit-smoke-\$ATTESTED_SHA/);
assert.match(workflow, /if \[ "\$ARTIFACT_COUNT" != "1" \]/,
  'attestation sync must require exactly one published evidence artifact');
assert.doesNotMatch(workflow, /ARTIFACT_COUNT[^\n]*(?:-ge|-gt)\s+1|ARTIFACT_COUNT[^\n]*!=\s*"0"/,
  'attestation sync must not weaken exactly-one artifact validation');
assert.match(workflow, /expired == false/);
assert.match(workflow, /gh issue view/);
assert.match(workflow, /node scripts\/release-attestation-issue\.js/);
assert.match(workflow, /gh issue edit/);
assert.match(workflow, /rc-pages-attestation/);
assert.match(workflow, /gh issue comment/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.doesNotMatch(workflow, /git tag|git push/, 'attestation sync must never create or move a release tag');

const deliveryGate = fs.readFileSync(path.join(ROOT, 'scripts', 'release-delivery-gate.js'), 'utf8');
const readiness = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release-readiness.yml'), 'utf8');
assert.equal(fs.existsSync(path.join(ROOT, '.github', 'workflows', 'release-attestation-contract.yml')), false,
  'dedicated release attestation workflow must remain consolidated');
assert.equal((deliveryGate.match(/tests\/release-attestation-issue-test\.js/g) || []).length, 1,
  'release attestation contract must run exactly once in the canonical delivery gate');
assert.match(readiness, /node scripts\/release-delivery-gate\.js 2>&1 \| tee artifacts\/release-readiness\/delivery\.log/,
  'Release Readiness must retain release attestation diagnostics in delivery.log');
assert.match(readiness, /actions\/upload-artifact@v4/);
assert.match(readiness, /artifacts\/release-readiness/);
assert.match(readiness, /if-no-files-found: error/,
  'Release Readiness diagnostics must fail if their prepared artifact directory disappears');

console.log('release attestation issue synchronization checks passed');
