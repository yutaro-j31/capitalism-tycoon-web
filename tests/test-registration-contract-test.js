'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const RUN_ALL = path.join(TESTS_DIR, 'run-all.js');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const REGISTRY = path.join(TESTS_DIR, 'test-execution-registry.json');

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

function canonicalRoutes(packageJson, runAllSource) {
  const files = extractTestFiles(runAllSource);
  const commands = new Set([...runAllSource.matchAll(/['"](test:[^'"]+)['"]/g)].map(match => match[1]));
  for (const command of commands) {
    const script = packageJson.scripts?.[command];
    assert.equal(typeof script, 'string', `run-all.js references missing package script: ${command}`);
    for (const file of extractTestFiles(script)) files.add(file);
  }
  return files;
}

function validateRegistry(registry) {
  assert.ok(registry && typeof registry === 'object' && !Array.isArray(registry), 'test execution registry must be an object');
  for (const [testFile, entry] of Object.entries(registry)) {
    assert.ok(testFile.startsWith('tests/') && testFile.endsWith('-test.js'), `registry key must be a test file: ${testFile}`);
    assert.ok(fs.existsSync(path.join(ROOT, testFile)), `registry test file does not exist: ${testFile}`);
    assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), `registry entry must be an object: ${testFile}`);
    assert.ok(typeof entry.reason === 'string' && entry.reason.trim(), `registry reason is required: ${testFile}`);
    assert.ok(typeof entry.executedBy === 'string' && entry.executedBy.trim(), `registry executedBy is required: ${testFile}`);
    assert.ok(fs.existsSync(path.join(ROOT, entry.executedBy)), `registry executedBy does not exist for ${testFile}: ${entry.executedBy}`);
  }
}

function findUnclassified(allFiles, canonical, registry) {
  return allFiles
    .filter(file => file.startsWith('tests/') && file.endsWith('-test.js'))
    .filter(file => !helperReason(file))
    .filter(file => !canonical.has(file))
    .filter(file => !Object.prototype.hasOwnProperty.call(registry, file))
    .sort();
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
const runAllSource = fs.readFileSync(RUN_ALL, 'utf8');
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const allFiles = walk(TESTS_DIR);
const canonical = canonicalRoutes(packageJson, runAllSource);

validateRegistry(registry);

assert.deepEqual(findUnclassified(['tests/new-feature-test.js'], new Set(), {}), ['tests/new-feature-test.js']);
assert.deepEqual(findUnclassified(['tests/new-feature-test.js'], new Set(['tests/new-feature-test.js']), {}), []);
assert.deepEqual(findUnclassified(['tests/new-feature-test.js'], new Set(), {
  'tests/new-feature-test.js': { reason: 'example', executedBy: 'tests/syntax-check.js' }
}), []);
assert.deepEqual(findUnclassified(['tests/fixtures/sample-test.js'], new Set(), {}), []);

const unclassified = findUnclassified(allFiles, canonical, registry);
if (unclassified.length) {
  console.error('Standalone test files missing from canonical run-all execution and tests/test-execution-registry.json:');
  for (const file of unclassified) console.error(`- ${file}`);
  process.exit(1);
}

const standalone = allFiles.filter(file => file.endsWith('-test.js') && !helperReason(file));
const helpers = allFiles.filter(file => helperReason(file));
console.log(`test-registration-contract-test: ok (standalone=${standalone.length}, canonical=${canonical.size}, alternative=${Object.keys(registry).length}, helpers=${helpers.length}, unclassified=0)`);
