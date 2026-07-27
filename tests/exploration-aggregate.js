'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { cases, shardCases } = require('./exploration-case-matrix');

const inputRoot = process.argv[2] || 'artifacts/shards';
const outputRoot = process.argv[3] || 'artifacts/exploratory-playtest';
const mode = process.env.EXPLORATION_MODE || 'full';
const expectedRows = mode === 'smoke' ? shardCases(0) : cases();
const expectedIds = new Set(expectedRows.map(row => row.caseId));

function filesBelow(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(target) : target.endsWith('.jsonl') ? [target] : [];
  });
}
function readRows() {
  return filesBelow(inputRoot).flatMap(file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch (error) { return { caseId: `parse-error:${file}:${index + 1}`, status: 'engine-failure', engineFailure: error.message }; }
  }));
}
function write(name, value) { fs.writeFileSync(path.join(outputRoot, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`); }
function csv(rows) {
  const keys = ['caseId','businessID','difficulty','playStyle','seed','status','weeksPlayed','finalGameWeek','cash','debt','stores','employees','sales','profit','companyValue','ipo','crisisStatus','maxRSSBytes'];
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `${keys.join(',')}\n${rows.map(row => keys.map(key => quote(row[key])).join(',')).join('\n')}\n`;
}

const rows = readRows();
const counts = new Map();
for (const row of rows) counts.set(row.caseId, (counts.get(row.caseId) || 0) + 1);
const missing = [...expectedIds].filter(id => !counts.has(id));
const duplicates = [...counts].filter(([, count]) => count > 1).map(([caseId, count]) => ({ caseId, count }));
const engineFailures = rows.filter(row => row.status === 'engine-failure' || row.engineFailure);
const abnormal = rows.filter(row => !['completed', 'bankrupt'].includes(row.status));
const validation = {
  mode, expectedCases: expectedRows.length, recordedCases: rows.length, missingCases: missing.length,
  duplicateCases: duplicates.reduce((sum, row) => sum + row.count - 1, 0), engineFailures: engineFailures.length,
  abnormalTerminations: abnormal.length, validationPassed: rows.length === expectedRows.length && missing.length === 0 && duplicates.length === 0 && engineFailures.length === 0 && abnormal.length === 0,
  missing, duplicates, failedCases: engineFailures.map(row => ({ caseId: row.caseId, error: row.engineFailure }))
};
const bankruptcies = rows.filter(row => row.status === 'bankrupt');
const group = (key, metric) => Object.values(rows.reduce((out, row) => {
  const id = row[key]; const item = out[id] ||= { id, cases: 0, bankruptcies: 0, total: 0 };
  item.cases++; item.bankruptcies += row.status === 'bankrupt' ? 1 : 0; item.total += Number(row[metric] || 0); return out;
}, {})).map(item => ({ ...item, average: item.cases ? Math.round(item.total / item.cases) : 0 })).sort((a, b) => b.average - a.average);
const strategyRanking = group('playStyle', 'companyValue');
const businessBalance = group('businessID', 'profit');
const summary = { mode, generatedAt: new Date().toISOString(), cases: rows.length, completed: rows.filter(row => row.status === 'completed').length, bankruptcies: bankruptcies.length, engineFailures: engineFailures.length, maxRSSBytes: Math.max(0, ...rows.map(row => Number(row.maxRSSBytes || 0))) };

fs.mkdirSync(outputRoot, { recursive: true });
write('completion-validation.json', validation); write('summary.json', summary);
write('all-case-summary.csv', csv(rows)); write('all-case-summary.jsonl', rows.map(row => JSON.stringify(row)).join('\n') + '\n');
write('bankruptcy-analysis.json', { count: bankruptcies.length, cases: bankruptcies });
write('bankruptcy-report.md', `# Bankruptcy report\n\nBankruptcies: ${bankruptcies.length}/${rows.length}\n`);
write('strategy-ranking.json', strategyRanking); write('strategy-report.md', `# Strategy report\n\n${strategyRanking.map((row, i) => `${i + 1}. ${row.id}: average company value ${row.average}`).join('\n')}\n`);
write('business-balance.json', businessBalance); write('balance-report.md', `# Balance report\n\n${businessBalance.map(row => `- ${row.id}: average profit ${row.average}`).join('\n')}\n`);
write('bug-report.md', `# Bug report\n\nEngine failures: ${engineFailures.length}\n\n${engineFailures.map(row => `- ${row.caseId}: ${row.engineFailure}`).join('\n')}\n`);
write('final-report.md', `# Exploratory playtest final report\n\nMode: ${mode}\nCases: ${rows.length}/${expectedRows.length}\nValidation: ${validation.validationPassed ? 'PASSED' : 'FAILED'}\n`);
console.log(JSON.stringify(validation));
if (!validation.validationPassed) process.exitCode = 1;
