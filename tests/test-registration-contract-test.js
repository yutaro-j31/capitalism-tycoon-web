'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const RUN_ALL = path.join(TESTS_DIR, 'run-all.js');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

// Source helpers are not independently executable tests. Every exclusion has a reason.
const HELPER_EXCLUSIONS = Object.freeze([
  { pattern: /(^|\/)fixtures\//, reason: 'fixture data is loaded by standalone tests and is not executed directly' },
  { pattern: /(^|\/)harness\.js$/, reason: 'shared VM/browser harness imported by standalone tests' },
  { pattern: /-case\.js$/, reason: 'scenario case definition consumed by a runner' },
  { pattern: /-runner\.js$/, reason: 'shared runner invoked by registered test entry points' }
]);

function normalize(file) {
  return file.split(path.sep).join('/');
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute));
    else result.push(normalize(path.relative(ROOT, absolute)));
  }
  return result;
}

function helperReason(file) {
  return HELPER_EXCLUSIONS.find(rule => rule.pattern.test(file))?.reason || null;
}

function extractTestFiles(source) {
  return new Set([...source.matchAll(/(?:^|[\s'"`])(tests\/[\w./-]+-test\.js)(?=[\s'"`]|$)/gm)].map(match => match[1]));
}

function extractNpmCommands(source) {
  return new Set([...source.matchAll(/(?:npm\s+run|npm\s+test\s+--\s+)(test:[\w:-]+)/g)].map(match => match[1]));
}

function filesFromPackageCommands(packageJson, commands) {
  const files = new Set();
  for (const command of commands) {
    const script = packageJson.scripts?.[command];
    assert.equal(typeof script, 'string', `execution route references missing package script: ${command}`);
    for (const file of extractTestFiles(script)) files.add(file);
  }
  return files;
}

function canonicalRoutes(packageJson, runAllSource) {
  const files = extractTestFiles(runAllSource);
  const commands = new Set([...runAllSource.matchAll(/['"](test:[^'"]+)['"]/g)].map(match => match[1]));
  for (const file of filesFromPackageCommands(packageJson, commands)) files.add(file);
  return files;
}

function workflowRoutes(packageJson) {
  const routes = new Map();
  for (const workflow of walk(WORKFLOWS_DIR).filter(file => /\.ya?ml$/.test(file))) {
    const source = fs.readFileSync(path.join(ROOT, workflow), 'utf8');
    const files = extractTestFiles(source);
    for (const file of filesFromPackageCommands(packageJson, extractNpmCommands(source))) files.add(file);
    for (const file of files) {
      if (!routes.has(file)) routes.set(file, []);
      routes.get(file).push(workflow);
    }
  }
  return routes;
}

function findUnregistered(allFiles, canonical, workflows) {
  return allFiles
    .filter(file => file.startsWith('tests/') && file.endsWith('-test.js'))
    .filter(file => !helperReason(file))
    .filter(file => !canonical.has(file))
    .filter(file => !workflows.has(file))
    .sort();
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
const runAllSource = fs.readFileSync(RUN_ALL, 'utf8');
const allFiles = walk(TESTS_DIR);
const canonical = canonicalRoutes(packageJson, runAllSource);
const workflows = workflowRoutes(packageJson);

// Contract behavior: an orphan fails, canonical registration passes, workflow registration passes, helpers are excluded.
assert.deepEqual(findUnregistered(['tests/new-feature-test.js'], new Set(), new Map()), ['tests/new-feature-test.js']);
assert.deepEqual(findUnregistered(['tests/new-feature-test.js'], new Set(['tests/new-feature-test.js']), new Map()), []);
assert.deepEqual(findUnregistered(['tests/new-feature-test.js'], new Set(), new Map([['tests/new-feature-test.js', ['.github/workflows/example.yml']]])), []);
assert.deepEqual(findUnregistered(['tests/fixtures/sample-test.js'], new Set(), new Map()), []);

const unregistered = findUnregistered(allFiles, canonical, workflows);
if (unregistered.length) {
  console.error('Standalone test files with no execution route:');
  for (const file of unregistered) console.error(`- ${file}`);
  console.error('Register each file in tests/run-all.js or in an existing .github/workflows/*.yml execution path.');
  process.exit(1);
}

const standalone = allFiles.filter(file => file.endsWith('-test.js') && !helperReason(file));
const workflowOnly = standalone.filter(file => !canonical.has(file) && workflows.has(file)).sort();
const helpers = allFiles.filter(file => helperReason(file)).map(file => ({ file, reason: helperReason(file) }));
console.log(`test-registration-contract-test: ok (standalone=${standalone.length}, canonical=${canonical.size}, workflowOnly=${workflowOnly.length}, helpers=${helpers.length})`);
if (workflowOnly.length) {
  console.log('workflow-only test routes:');
  for (const file of workflowOnly) console.log(`- ${file}: ${workflows.get(file).join(', ')}`);
}
