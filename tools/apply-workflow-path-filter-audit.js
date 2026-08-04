'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('.github/workflows');
const alwaysRun = new Set(['test.yml', 'release-readiness.yml']);
const shared = [
  'js/engine.js',
  'js/finance.js',
  'js/save*.js',
  'js/**/*normalize*.js',
  'index.html',
  'package.json',
  'tests/harness.js',
  'tests/run-all.js',
];

function uniq(values) {
  return [...new Set(values)];
}

function referencedTests(source) {
  return uniq([...source.matchAll(/(?:node\s+|npm\s+run\s+[^\n]*?)(tests\/[A-Za-z0-9_./*-]+\.js)/g)].map(match => match[1]));
}

function domainPatterns(file, source) {
  const stem = file.replace(/\.ya?ml$/, '');
  const tests = referencedTests(source);
  const patterns = [
    `.github/workflows/${file}`,
    ...tests,
    `tests/${stem}*.js`,
    `js/${stem}.js`,
    `js/${stem}-*.js`,
  ];

  const tokens = stem.split('-').filter(token => token.length >= 3 && !['contract', 'test', 'gate'].includes(token));
  if (tokens.length) {
    const prefix = tokens.slice(0, Math.min(2, tokens.length)).join('-');
    patterns.push(`js/${prefix}*.js`, `tests/${prefix}*.js`);
  }
  return uniq([...patterns, ...shared]);
}

function hasPullRequest(source) {
  return /^  pull_request:\s*$/m.test(source);
}

function hasPullRequestPaths(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(line => /^  pull_request:\s*$/.test(line));
  if (start < 0) return false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^  [A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(line) || /^jobs:\s*$/.test(line) || /^permissions:\s*$/.test(line)) break;
    if (/^    paths:\s*$/.test(line)) return true;
  }
  return false;
}

const modified = [];
const audited = [];
for (const file of fs.readdirSync(root).filter(name => /\.ya?ml$/.test(name)).sort()) {
  const full = path.join(root, file);
  let source = fs.readFileSync(full, 'utf8');
  if (!hasPullRequest(source)) continue;
  audited.push(file);
  if (alwaysRun.has(file) || hasPullRequestPaths(source)) continue;
  const paths = domainPatterns(file, source);
  const block = `  pull_request:\n    paths:\n${paths.map(item => `      - '${item}'`).join('\n')}`;
  source = source.replace(/^  pull_request:\s*$/m, block);
  fs.writeFileSync(full, source);
  modified.push({ file, paths });
}

console.log(JSON.stringify({ audited, modified }, null, 2));
