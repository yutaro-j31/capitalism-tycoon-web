const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function configuredEngine() {
  const loaded = loadGame({ random: () => 0.42 });
  const e = new loaded.modules.engine.TycoonEngine();
  e.g.configured = true;
  e.g.companyName = 'Weekly Impact Holdings';
  return { e, modules: loaded.modules, storage: loaded.ctx.__localStorageHistory };
}
function snapshot(g){return JSON.stringify({reports:g.reports,finance:g.finance,companyValueHistory:g.companyValueHistory,companyCash:g.companyCash});}
function metric(model,id){return model.metrics.find(x=>x.id===id);}

{
  const { e, modules, storage } = configuredEngine();
  const before = snapshot(e.g);
  const first = modules.ceoDashboard.weeklyImpact(e.g, { companyValue: e.companyValue() });
  assert.equal(first.hasPrevious, false, 'empty reports must not claim previous data');
  assert.equal(first.highlights.length, 0, 'first week highlights must be empty');
  for (const row of first.metrics) assert.equal(row.hasDelta, false, `${row.id} must show no previous comparison`);
  assert.equal(snapshot(e.g), before, 'empty/old save fallback must not mutate save JSON');
  assert.equal(storage.setItem.length, 0, 'weekly impact must not write localStorage');
}

{
  const { e, modules, storage } = configuredEngine();
  e.advanceWeek(false);
  const firstReportOnly = modules.ceoDashboard.weeklyImpact(e.g, { companyValue: e.companyValue() });
  assert.equal(firstReportOnly.hasPrevious, false, 'first generated report must show no previous comparison');
  assert.equal(firstReportOnly.highlights.length, 0, 'first generated report must not show full sales/profit as delta');
  for (const row of firstReportOnly.metrics) assert.equal(row.hasDelta, false, `${row.id} must still show no previous comparison`);
  e.advanceWeek(false);
  const latestReports = e.g.reports.slice(-2);
  const latestWeek = latestReports[1].week;
  const previousWeek = latestReports[0].week;
  const latestCashSnapshot = e.g.finance.weeklySnapshots.find(x => x.week === latestWeek);
  const previousCashSnapshot = e.g.finance.weeklySnapshots.find(x => x.week === previousWeek);
  assert.ok(latestCashSnapshot, 'latest finance weekly snapshot must exist');
  assert.ok(previousCashSnapshot, 'previous finance weekly snapshot must exist');
  assert.ok(!('companyCash' in latestReports[1]), 'reports must not include companyCash in production data');
  assert.ok(!('companyValue' in latestReports[1]), 'reports must not include companyValue in production data');
  const before = snapshot(e.g);
  const financeBefore = JSON.stringify(e.g.finance);
  const valueBefore = e.companyValue();
  const a = modules.ceoDashboard.weeklyImpact(e.g, { companyValue: e.companyValue() });
  const b = modules.ceoDashboard.weeklyImpact(e.g, { companyValue: e.companyValue() });
  assert.deepEqual(a, b, 'weekly impact must be deterministic');
  assert.equal(a.hasPrevious, true, 'second report must compare against previous report');
  assert.equal(metric(a,'sales').delta, latestReports[1].sales - latestReports[0].sales, 'sales delta must use reports');
  assert.equal(metric(a,'profit').delta, latestReports[1].profit - latestReports[0].profit, 'profit delta must use reports');
  const expectedCashDelta = (latestCashSnapshot.actualCompanyCash ?? latestCashSnapshot.endingCash) - (previousCashSnapshot.actualCompanyCash ?? previousCashSnapshot.endingCash);
  assert.equal(metric(a,'cash').delta, expectedCashDelta, 'cash delta must use finance weekly snapshots');
  const history = e.g.companyValueHistory;
  assert.equal(metric(a,'value').delta, history[history.length - 1] - history[history.length - 2], 'company value delta must use companyValueHistory');
  assert.equal(metric(a,'cash').hasDelta, true, 'cash delta must be available when snapshots exist');
  assert.equal(metric(a,'value').hasDelta, true, 'company value delta must be available when history exists');
  assert.equal(snapshot(e.g), before, 'weekly impact must not mutate state');
  assert.equal(JSON.stringify(e.g.finance), financeBefore, 'weekly impact must not mutate finance JSON');
  assert.equal(e.companyValue(), valueBefore, 'weekly impact must not change company value calculation');
  assert.equal(storage.setItem.length >= 1, true, 'engine actions may save, establishing localStorage baseline');
  const localStorageWrites = storage.setItem.length;
  modules.ceoDashboard.weeklyImpact(e.g, { companyValue: e.companyValue() });
  assert.equal(storage.setItem.length, localStorageWrites, 'weekly impact must not add localStorage writes');
}

{
  const { e, modules } = configuredEngine();
  e.g.reports = [{ week: 2, sales: 100, profit: 10 }, { week: 3, sales: 100, profit: 10 }];
  e.g.finance.weeklySnapshots = [
    { week: 2, actualCompanyCash: 500 },
    { week: 3, actualCompanyCash: 500 }
  ];
  e.g.companyValueHistory = [1000, 1000];
  const unchanged = modules.ceoDashboard.weeklyImpact(e.g, { companyValue: 1000 });
  assert.equal(unchanged.hasPrevious, true, 'unchanged reports still have a valid previous comparison');
  assert.deepEqual(unchanged.highlights.map(x => x.id), ['no-change'], 'unchanged comparison must not be mistaken for missing data');
  assert.equal(modules.ceoDashboard.deltaLabel(0, value => `${value}円`), '変化なし', 'zero delta label must describe an unchanged metric');
  assert.equal(unchanged.metrics.every(x => x.tone === 'neutral'), true, 'unchanged metrics use neutral tone');
}

{
  const { e, modules } = configuredEngine();
  e.g.reports = [{ week: 2, sales: 100, profit: 10 }, { week: 3, sales: 120, profit: 15 }];
  e.g.finance.weeklySnapshots = [];
  e.g.companyValueHistory = [1000];
  const oldSave = modules.ceoDashboard.weeklyImpact(e.g, { companyValue: e.companyValue() });
  assert.equal(oldSave.hasPrevious, true, 'old save with reports can compare sales/profit');
  assert.equal(metric(oldSave,'cash').hasDelta, false, 'missing finance snapshots must safely disable cash delta');
  assert.equal(metric(oldSave,'value').hasDelta, false, 'single value history entry must safely disable company value delta');
}

const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
assert.match(app, /weekly-impact-grid/, 'weekly impact render markup exists');
assert.match(app, /aria-label="週送り後の変化"/, 'weekly impact modal is labelled');
assert.match(app, /比較できる前週データがありません/, 'first week no-previous message is rendered');
assert.match(app, /次の優先タスクを見る/, 'weekly impact connects back to CEO dashboard');
assert.doesNotMatch(app, /localStorage\.setItem\([^)]*weekly-impact/, 'weekly recap must not add localStorage keys');
const css = fs.readFileSync(path.join(__dirname, '../css/app.css'), 'utf8');
assert.match(css, /weekly-impact-card/, 'weekly impact cards are styled');
assert.match(css, /min-height:44px/, 'weekly impact touch target is at least 44px');
assert.match(css, /env\(safe-area-inset-bottom\)/, 'weekly impact respects safe area in modal');
console.log('Weekly Impact recap production-data tests passed: first week, second week, unchanged comparison, sales/profit/cash/value deltas, snapshots/history integration, old save fallback, deterministic, read-only, localStorage unchanged');