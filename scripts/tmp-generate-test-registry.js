'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const RUN_ALL = path.join(TESTS, 'run-all.js');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const EXISTING_REGISTRY = path.join(TESTS, 'test-execution-registry.json');
const OUT_DIR = path.join(ROOT, 'tmp-test-registry-output');

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

function extractTestFiles(source) {
  return new Set([...source.matchAll(/tests\/[\w./-]+-test\.js/g)].map(match => match[0]));
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
const runAllSource = fs.readFileSync(RUN_ALL, 'utf8');
const existing = JSON.parse(fs.readFileSync(EXISTING_REGISTRY, 'utf8'));
const canonical = extractTestFiles(runAllSource);
const runAllCommands = new Set([...runAllSource.matchAll(/['"](test:[^'"]+)['"]/g)].map(match => match[1]));
for (const command of runAllCommands) {
  const script = packageJson.scripts?.[command] || '';
  for (const file of extractTestFiles(script)) canonical.add(file);
}

const workflows = walk(WORKFLOWS).filter(file => /\.ya?ml$/.test(file));
const workflowSources = new Map(workflows.map(file => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]));
const scriptFiles = new Map();
for (const [name, script] of Object.entries(packageJson.scripts || {})) {
  scriptFiles.set(name, extractTestFiles(script));
}

const allTests = walk(TESTS)
  .filter(file => file.endsWith('-test.js'))
  .filter(file => !file.includes('/fixtures/'))
  .sort();

const registry = { ...existing };
const unresolved = [];
const evidence = {};

for (const testFile of allTests) {
  if (canonical.has(testFile) || Object.prototype.hasOwnProperty.call(registry, testFile)) continue;

  const directWorkflows = workflows.filter(file => workflowSources.get(file).includes(testFile));
  const npmCommands = [...scriptFiles.entries()]
    .filter(([, files]) => files.has(testFile))
    .map(([name]) => name);
  const npmWorkflows = workflows.filter(file => {
    const source = workflowSources.get(file);
    return npmCommands.some(command => source.includes(`npm run ${command}`) || source.includes(`npm test -- ${command}`));
  });
  const routes = [...new Set([...directWorkflows, ...npmWorkflows])].sort();

  evidence[testFile] = { directWorkflows, npmCommands, npmWorkflows, routes };
  if (routes.length) {
    registry[testFile] = {
      reason: `Executed outside the canonical run-all suite by ${routes.join(', ')}.`,
      executedBy: routes[0]
    };
  } else {
    unresolved.push({ testFile, npmCommands });
  }
}

const sortedRegistry = Object.fromEntries(Object.entries(registry).sort(([a], [b]) => a.localeCompare(b)));
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'test-execution-registry.generated.json'), `${JSON.stringify(sortedRegistry, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, 'unresolved.json'), `${JSON.stringify(unresolved, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);

console.log(`registry-migration: allTests=${allTests.length} canonical=${canonical.size} existing=${Object.keys(existing).length} generated=${Object.keys(sortedRegistry).length} unresolved=${unresolved.length}`);
for (const item of unresolved) console.log(`UNRESOLVED ${item.testFile} npm=${item.npmCommands.join(',') || '-'}`);
