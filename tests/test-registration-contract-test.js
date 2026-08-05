'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const RUN_ALL = path.join(TESTS_DIR, 'run-all.js');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

// These are source helpers, not independently executable tests.
const HELPER_EXCLUSIONS = Object.freeze([
  { pattern: /(^|\/)fixtures\//, reason: 'fixture data is loaded by standalone tests and is not executed directly' },
  { pattern: /(^|\/)harness\.js$/, reason: 'shared VM/browser harness imported by standalone tests' },
  { pattern: /-case\.js$/, reason: 'scenario case definition consumed by a runner' },
  { pattern: /-runner\.js$/, reason: 'shared runner invoked by registered test entry points' }
]);

// Standalone tests intentionally outside the direct file list must name a verifiable canonical route.
const ALTERNATIVE_EXECUTION_PATHS = Object.freeze({
  'tests/test-registration-contract-test.js': 'tests/syntax-check.js via test:syntax in tests/run-all.js'
});

function normalize(file) {
  return file.split(path.sep).join('/');
}

function walk(dir) {
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

function scriptTestFiles(packageJson, runAllSource) {
  const commandNames = new Set([...runAllSource.matchAll(/['"](test:[^'"]+)['"]/g)].map(match => match[1]));
  const files = new Set();
  for (const command of commandNames) {
    const script = packageJson.scripts?.[command];
    assert.equal(typeof script, 'string', `run-all references missing package script: ${command}`);
    for (const match of script.matchAll(/(?:^|\s)(tests\/[\w./-]+-test\.js)(?:\s|$)/g)) files.add(match[1]);
  }
  return files;
}

function directTestFiles(runAllSource) {
  return new Set([...runAllSource.matchAll(/['"](tests\/[\w./-]+-test\.js)['"]/g)].map(match => match[1]));
}

function findUnregistered(allFiles, registered) {
  return allFiles
    .filter(file => file.startsWith('tests/') && file.endsWith('-test.js'))
    .filter(file => !helperReason(file))
    .filter(file => !registered.has(file))
    .filter(file => !Object.hasOwn(ALTERNATIVE_EXECUTION_PATHS, file))
    .sort();
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
const runAllSource = fs.readFileSync(RUN_ALL, 'utf8');
const allFiles = walk(TESTS_DIR);
const registered = new Set([...scriptTestFiles(packageJson, runAllSource), ...directTestFiles(runAllSource)]);

for (const [file, route] of Object.entries(ALTERNATIVE_EXECUTION_PATHS)) {
  assert(file.endsWith('-test.js'), `alternative route must name a standalone test: ${file}`);
  assert.equal(typeof route, 'string');
  assert(route.trim().length > 0, `alternative route needs a named workflow or registry: ${file}`);
  assert(fs.existsSync(path.join(ROOT, file)), `alternative-route test does not exist: ${file}`);
  const routeTarget = route.match(/(tests\/[\w./-]+\.js)/)?.[1];
  assert(routeTarget && fs.existsSync(path.join(ROOT, routeTarget)), `alternative route target does not exist: ${file} -> ${route}`);
  assert(runAllSource.includes('test:syntax'), `alternative route is not connected to run-all: ${file} -> ${route}`);
}

// Contract behavior checks: an added standalone test fails; registered tests and helpers pass.
assert.deepEqual(findUnregistered(['tests/new-feature-test.js'], new Set()), ['tests/new-feature-test.js']);
assert.deepEqual(findUnregistered(['tests/new-feature-test.js'], new Set(['tests/new-feature-test.js'])), []);
assert.deepEqual(findUnregistered(['tests/fixtures/sample-test.js'], new Set()), []);

const unregistered = findUnregistered(allFiles, registered);
if (unregistered.length) {
  console.error('Unregistered standalone test files:');
  for (const file of unregistered) console.error(`- ${file}`);
  console.error('Register each file in tests/run-all.js, or document a verified alternative route in ALTERNATIVE_EXECUTION_PATHS.');
  process.exit(1);
}

const helpers = allFiles.filter(file => helperReason(file)).map(file => ({ file, reason: helperReason(file) }));
console.log(`test-registration-contract-test: ok (registered=${registered.size}, helpers=${helpers.length}, alternatives=${Object.keys(ALTERNATIVE_EXECUTION_PATHS).length})`);
