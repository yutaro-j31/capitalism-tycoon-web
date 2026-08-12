'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const workflowRoot = path.resolve('.github/workflows');
const alwaysRun = Object.freeze([
  'test.yml',
  'release-readiness.yml',
]);
// Workflows that still run on their own because they are either too slow for the
// canonical suite or exercise a real WebKit browser. Everything else was absorbed
// into the canonical suite, which runs unconditionally and therefore needs no path
// filter to guarantee coverage.
const scoped = Object.freeze([
  'strategy-balance.yml',
  'phase6b3-diagnostic.yml',
  'founding-tutorial.yml',
  'ma-integration.yml',
  'ma-board-approval.yml',
  'ma-acquisition-financing.yml',
]);

const sharedDependencyFiles = Object.freeze([
  'js/engine.js',
  'js/finance.js',
  'js/save-v9.js',
  'js/save-storage.js',
  'js/save-storage-ui.js',
  'js/save-import-atomic-guard.js',
  // Virtual representative path: workflows must include js/** or a normalize glob.
  'js/state-normalize.js',
  'index.html',
  'package.json',
  'tests/harness.js',
  'tests/run-all.js',
]);

function readWorkflow(file) {
  const full = path.join(workflowRoot, file);
  assert(fs.existsSync(full), `workflow missing: ${file}`);
  return fs.readFileSync(full, 'utf8');
}

function pullRequestBlock(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(line => /^  pull_request:\s*$/.test(line));
  assert(start >= 0, 'pull_request trigger missing');
  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^  [A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(line) || /^jobs:\s*$/.test(line) || /^permissions:\s*$/.test(line)) break;
    block.push(line);
  }
  return block;
}

function pullRequestPaths(source) {
  const block = pullRequestBlock(source);
  const pathsIndex = block.findIndex(line => /^    paths:\s*$/.test(line));
  if (pathsIndex < 0) return [];
  const paths = [];
  for (let index = pathsIndex + 1; index < block.length; index += 1) {
    const match = block[index].match(/^      -\s+['"]?(.+?)['"]?\s*$/);
    if (!match) break;
    paths.push(match[1]);
  }
  return paths;
}

function globRegex(pattern) {
  let output = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        output += '.*';
        index += 1;
      } else {
        output += '[^/]*';
      }
    } else if (char === '?') {
      output += '[^/]';
    } else {
      output += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${output}$`);
}

function covers(paths, file) {
  return paths.some(pattern => globRegex(pattern).test(file));
}

const allWorkflowFiles = fs.readdirSync(workflowRoot).filter(file => /\.ya?ml$/.test(file));
for (const file of allWorkflowFiles) {
  const source = readWorkflow(file);
  assert(
    !source.includes('js/pmi-100-day-loader.js'),
    `${file} must not inspect or depend on the obsolete pmi-100-day-loader.js compatibility file`,
  );
}

for (const file of alwaysRun) {
  const source = readWorkflow(file);
  const paths = pullRequestPaths(source);
  assert.equal(paths.length, 0, `${file} must remain an always-run pull-request check`);
}

const scopedPaths = new Map();
for (const file of scoped) {
  const source = readWorkflow(file);
  const paths = pullRequestPaths(source);
  assert(paths.length > 0, `${file} must define pull_request.paths`);
  assert(covers(paths, `.github/workflows/${file}`), `${file} must trigger when its own YAML changes`);
  for (const dependency of sharedDependencyFiles) {
    assert(covers(paths, dependency), `${file} must cover shared dependency ${dependency}`);
  }
  scopedPaths.set(file, paths);
}

function workflowsFor(changedFile) {
  return [
    ...alwaysRun,
    ...scoped.filter(file => covers(scopedPaths.get(file), changedFile)),
  ];
}

const representative = {
  docs: workflowsFor('docs/DEVELOPMENT_ROADMAP.md'),
  ma: workflowsFor('js/ma-integration.js'),
  dui: workflowsFor('css/d-ui.css'),
  finance: workflowsFor('js/finance.js'),
};

assert(representative.docs.length <= 4, `docs-only PR should start at most four workflows, got ${representative.docs.length}`);
assert(representative.ma.length <= 10, `M&A PR should start at most ten workflows, got ${representative.ma.length}`);
assert(representative.dui.length <= 10, `D UI PR should start at most ten workflows, got ${representative.dui.length}`);
assert.equal(representative.finance.length, alwaysRun.length + scoped.length, 'shared finance changes must run every scoped workflow');

for (const file of [
  'founding-tutorial.yml',
  'ma-integration.yml',
  'ma-board-approval.yml',
  'ma-acquisition-financing.yml',
]) {
  const source = readWorkflow(file);
  assert(source.includes("if: github.event_name != 'pull_request'"), `${file} must keep WebKit execution off pull requests`);
  assert(/^  push:\s*$/m.test(source), `${file} must retain main push coverage`);
  assert(/^  schedule:\s*$/m.test(source), `${file} must retain nightly coverage`);
  assert(/^  workflow_dispatch:\s*$/m.test(source), `${file} must retain manual coverage`);
}

console.log(`WORKFLOW_PATH_FILTER_COUNTS ${JSON.stringify(representative)}`);
console.log(`workflow path filter contract: ${scoped.length} scoped + ${alwaysRun.length} always-run workflows verified`);
