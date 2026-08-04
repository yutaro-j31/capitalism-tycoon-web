'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('.github/workflows');
const alwaysRun = new Set(['test.yml', 'release-readiness.yml']);
const shared = [
  'js/engine.js',
  'js/finance.js',
  'js/save-v9.js',
  'js/save-storage.js',
  'js/save-storage-ui.js',
  'js/save-import-atomic-guard.js',
  'js/**/*normalize*.js',
  'index.html',
  'package.json',
  'tests/harness.js',
  'tests/run-all.js',
];

function escapeRegex(value) { return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&'); }
function globRegex(pattern) {
  let output = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') { output += '.*'; index += 1; }
      else output += '[^/]*';
    } else if (char === '?') output += '[^/]';
    else output += escapeRegex(char);
  }
  return new RegExp(`${output}$`);
}
function covers(paths, file) { return paths.some(pattern => globRegex(pattern).test(file)); }
function pullRequestInfo(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(line => /^  pull_request:\s*$/.test(line));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^  [A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(lines[i]) || /^jobs:\s*$/.test(lines[i]) || /^permissions:\s*$/.test(lines[i])) { end = i; break; }
  }
  const pathsLine = lines.findIndex((line, index) => index > start && index < end && /^    paths:\s*$/.test(line));
  const paths = [];
  if (pathsLine >= 0) {
    for (let i = pathsLine + 1; i < end; i += 1) {
      const match = lines[i].match(/^      -\s+['"]?(.+?)['"]?\s*$/);
      if (!match) break;
      paths.push(match[1]);
    }
  }
  return { lines, start, end, pathsLine, paths };
}

const report = { audited: [], modified: [] };
for (const file of fs.readdirSync(root).filter(name => /\.ya?ml$/.test(name)).sort()) {
  if (file === 'temporary-path-filter-audit.yml') continue;
  const full = path.join(root, file);
  const source = fs.readFileSync(full, 'utf8');
  const info = pullRequestInfo(source);
  if (!info) continue;
  report.audited.push(file);
  if (alwaysRun.has(file)) continue;
  const required = [`.github/workflows/${file}`, ...shared];
  const missing = required.filter(item => !covers(info.paths, item));
  if (!missing.length) continue;
  const lines = info.lines;
  if (info.pathsLine < 0) {
    lines.splice(info.start + 1, 0, '    paths:', ...required.map(item => `      - '${item}'`));
  } else {
    let insertAt = info.pathsLine + 1;
    while (insertAt < lines.length && /^      -\s+/.test(lines[insertAt])) insertAt += 1;
    lines.splice(insertAt, 0, ...missing.map(item => `      - '${item}'`));
  }
  fs.writeFileSync(full, lines.join('\n'));
  report.modified.push({ file, missing });
}
fs.writeFileSync('workflow-path-filter-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
