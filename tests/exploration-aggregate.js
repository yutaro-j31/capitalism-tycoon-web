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
const runnerErrors = rows.flatMap(row => (row.runnerErrors || []).map(error => ({caseId:row.caseId,...error})));
const abnormal = rows.filter(row => !['completed', 'bankrupt'].includes(row.status));
const validation = {
  mode, expectedCases: expectedRows.length, recordedCases: rows.length, missingCases: missing.length,
  duplicateCases: duplicates.reduce((sum, row) => sum + row.count - 1, 0), engineFailures: engineFailures.length,
  abnormalTerminations: abnormal.length, validationPassed: rows.length === expectedRows.length && missing.length === 0 && duplicates.length === 0 && engineFailures.length === 0 && abnormal.length === 0,
  missing, duplicates, failedCases: engineFailures.map(row => ({ caseId: row.caseId, error: row.engineFailure }))
};
const bankruptcies = rows.filter(row => row.status === 'bankrupt');
const median = values => { const sorted=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b); if(!sorted.length)return null;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2; };
const survivalWeeks = [52,104,260,520,1000];
function statsFor(groupRows) {
  const ipoRows=groupRows.filter(row=>row.ipo),completed=groupRows.filter(row=>row.weeksPlayed===1000);
  return { cases:groupRows.length, bankruptcies:groupRows.filter(row=>row.status==='bankrupt').length,
    bankruptcyRate:groupRows.length?groupRows.filter(row=>row.status==='bankrupt').length/groupRows.length:0,
    survivalRates:Object.fromEntries(survivalWeeks.map(week=>[week,groupRows.length?groupRows.filter(row=>Number(row.weeksPlayed)>=week).length/groupRows.length:0])),
    ipoRate:groupRows.length?ipoRows.length/groupRows.length:0, medianIPOWeek:median(ipoRows.map(row=>row.ipoWeek)),
    medianCompanyValueAt1000:median(completed.map(row=>row.companyValue)),
    turnaroundCases:groupRows.filter(row=>row.crisisWeek!=null).length,
    turnaroundSuccessRate:groupRows.filter(row=>row.crisisWeek!=null).length?groupRows.filter(row=>row.turnaroundSucceeded).length/groupRows.filter(row=>row.crisisWeek!=null).length:null };
}
function grouped(key) { return Object.fromEntries([...new Set(rows.map(row=>row[key]))].sort().map(id=>[id,statsFor(rows.filter(row=>row[key]===id))])); }
function bankruptcyCause(row) {
  if(row.engineFailure)return 'エンジン異常';const h=row.preBankruptcyHistory||[],last=h.at(-1)||{},early=h.slice(0,-1),actions=h.flatMap(x=>x.actions||[]).map(x=>x.type);
  if(actions.includes('open-store')&&Number(last.stores)>=4)return '過剰出店';
  if(Number(last.debt)>Math.max(1,Number(last.cash))*3)return '借入過多';
  if(early.some(x=>Number(x.debt)>0&&Number(x.profit)<0))return '返済負担';
  const initial=Number(h[0]?.price||last.price||0);if(Number(last.price)<initial*.7)return '値下げしすぎ';
  if(Number(last.price)>initial*1.5&&Number(last.sales)<=0)return '高価格による需要不足';
  if(h.filter(x=>Number(x.profit)<0&&Number(x.stores)>0).length>=13)return '不採算店舗放置';
  if(Number(last.fixedCost)>Math.max(0,Number(last.sales)))return '固定費過多';
  if(row.playStyle==='turnaround'&&row.crisisWeek!=null&&row.turnaroundStartWeek-row.crisisWeek>4)return '再建開始遅れ';
  return '現金管理失敗';
}
const bankruptcyCases=[...bankruptcies,...engineFailures.filter(row=>!bankruptcies.includes(row))].map(row=>({...row,classifiedCause:bankruptcyCause(row)}));
const causeCounts=Object.fromEntries(['過剰出店','借入過多','返済負担','値下げしすぎ','高価格による需要不足','不採算店舗放置','固定費過多','現金管理失敗','再建開始遅れ','エンジン異常'].map(cause=>[cause,bankruptcyCases.filter(row=>row.classifiedCause===cause).length]));
const strategyStats=grouped('playStyle'),businessStats=grouped('businessID'),difficultyStats=grouped('difficulty');
const strategyRanking=Object.entries(strategyStats).map(([id,stats])=>({id,...stats})).sort((a,b)=>a.bankruptcyRate-b.bankruptcyRate||(b.medianCompanyValueAt1000||0)-(a.medianCompanyValueAt1000||0));
const businessBalance=Object.entries(businessStats).map(([id,stats])=>({id,...stats})).sort((a,b)=>(b.medianCompanyValueAt1000||0)-(a.medianCompanyValueAt1000||0));
const fastestIPO=[...strategyRanking].filter(row=>row.medianIPOWeek!=null).sort((a,b)=>a.medianIPOWeek-b.medianIPOWeek)[0]||null;
const balanceMedian=median(businessBalance.map(row=>row.medianCompanyValueAt1000));
const summary = { mode, generatedAt: new Date().toISOString(), cases: rows.length, completed: rows.filter(row => row.status === 'completed').length, bankruptcies: bankruptcies.length, engineFailures: engineFailures.length, maxRSSBytes: Math.max(0, ...rows.map(row => Number(row.maxRSSBytes || 0))),
  overall:statsFor(rows),byDifficulty:difficultyStats,byBusiness:businessStats,byStrategy:strategyStats,bankruptcyCauseCounts:causeCounts,
  mostStableStrategy:strategyRanking[0]?.id||null,fastestIPOStrategy:fastestIPO?.id||null,
  overpoweredBusinesses:businessBalance.filter(row=>row.medianCompanyValueAt1000!=null&&row.medianCompanyValueAt1000>balanceMedian*1.75).map(row=>row.id),
  weakBusinesses:businessBalance.filter(row=>row.medianCompanyValueAt1000!=null&&row.medianCompanyValueAt1000<balanceMedian*.5).map(row=>row.id) };

fs.mkdirSync(outputRoot, { recursive: true });
write('completion-validation.json', validation); write('summary.json', summary);
write('all-case-summary.csv', csv(rows)); write('all-case-summary.jsonl', rows.map(row => JSON.stringify(row)).join('\n') + '\n');
write('bankruptcy-analysis.json', { count: bankruptcies.length, causeCounts, cases: bankruptcyCases });
write('bankruptcy-report.md', `# Bankruptcy report\n\nBankruptcies: ${bankruptcies.length}/${rows.length}\n\n${Object.entries(causeCounts).map(([cause,count])=>`- ${cause}: ${count}`).join('\n')}\n`);
write('strategy-ranking.json', strategyRanking); write('strategy-report.md', `# Strategy report\n\nMost stable: ${summary.mostStableStrategy||'n/a'}\nFastest IPO: ${summary.fastestIPOStrategy||'n/a'}\n\n${strategyRanking.map((row, i) => `${i + 1}. ${row.id}: bankruptcy ${(row.bankruptcyRate*100).toFixed(1)}%, median value ${row.medianCompanyValueAt1000??'n/a'}, median IPO week ${row.medianIPOWeek??'n/a'}`).join('\n')}\n\n## 攻略法\n\n- 現金余力を確保し、黒字店舗を確認してから追加出店する。\n- 危機時は不採算店と固定費を先に削減し、回復後に借入を返済する。\n- 値下げ・高価格戦略は需要と利益の両方を52週中央値で確認する。\n`);
write('business-balance.json', businessBalance); write('balance-report.md', `# Balance report\n\nStrong: ${summary.overpoweredBusinesses.join(', ')||'none'}\nWeak: ${summary.weakBusinesses.join(', ')||'none'}\n\n${businessBalance.map(row => `- ${row.id}: bankruptcy ${(row.bankruptcyRate*100).toFixed(1)}%, median value ${row.medianCompanyValueAt1000??'n/a'}`).join('\n')}\n`);
write('bug-report.md', `# Bug report\n\nEngine failures: ${engineFailures.length}\nRunner action errors: ${runnerErrors.length}\n\n${engineFailures.map(row => `- ${row.caseId}: ${row.engineFailure}`).concat(runnerErrors.map(row=>`- ${row.caseId} week ${row.week} ${row.type}: ${row.error}`)).join('\n')}\n`);
write('final-report.md', `# Exploratory playtest final report\n\nMode: ${mode}\nCases: ${rows.length}/${expectedRows.length}\nValidation: ${validation.validationPassed ? 'PASSED' : 'FAILED'}\n`);
console.log(JSON.stringify(validation));
if (!validation.validationPassed) process.exitCode = 1;
