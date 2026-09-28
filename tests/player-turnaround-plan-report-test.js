const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a5c0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { modules } = loadGame({ random });
const { engine, playerCrisis, playerEngineBridge, playerTurnaroundPlan, playerTurnaroundPlanUI, playerTurnaroundPlanReport } = modules;
assert.ok(playerEngineBridge?.__installed);
assert.ok(playerTurnaroundPlanReport?.__installed);
assert.equal(typeof playerTurnaroundPlanReport.buildReport, 'function');
assert.equal(typeof playerTurnaroundPlanReport.renderSummarySection, 'function');
assert.equal(engine.TycoonEngine.prototype.__playerTurnaroundPlanReportInstalled, true);

const live = playerEngineBridge.getEngine();
assert.ok(live instanceof engine.TycoonEngine, 'bridge must expose the app-created engine');
live.g.companyCash = 1_000_000;
live.g.companyDebt = 10_000_000;
playerCrisis.ensure(live.g).lastEvaluationWeek = 0;
playerCrisis.evaluate(live.g);
assert.notEqual(live.g.playerCrisis.status, 'stable');
assert.equal(live.startTurnaroundPlan(), true);
assert.ok(playerTurnaroundPlanUI.renderSection().includes('再建計画'), 'late turnaround UI must bind to the app engine');

function makePlanGame() {
  const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
  game.g.skipWeeklyValidation = true;
  game.g.companyCash = 1_000_000;
  game.g.companyDebt = 10_000_000;
  playerCrisis.ensure(game.g).lastEvaluationWeek = 0;
  playerCrisis.evaluate(game.g);
  assert.notEqual(game.g.playerCrisis.status, 'stable');
  assert.equal(game.startTurnaroundPlan(), true);
  return game;
}

const progressGame = makePlanGame();
const beforeCapture = playerTurnaroundPlanReport.capture(progressGame.g);
const beforeBuild = JSON.stringify(progressGame.g);
const preview = playerTurnaroundPlanReport.buildReport(progressGame.g, beforeCapture);
assert.equal(preview.kind, 'progress');
assert.equal(JSON.stringify(progressGame.g), beforeBuild, 'report construction must be read-only');
assert.equal(progressGame.advanceWeek(false), true);
const progressReport = progressGame.g.lastWeeklySummary.turnaroundPlanReport;
assert.ok(progressReport);
assert.equal(progressReport.kind, 'progress');
assert.ok(progressReport.progress >= 0 && progressReport.progress <= 1);
assert.ok(progressGame.g.lastWeeklySummary.newNews.includes(playerTurnaroundPlanReport.message(progressReport)),
  'ordinary turnaround progress remains visible in the weekly summary even when later final-phase news is prepended');
assert.ok(progressGame.g.history[0].includes('再建計画'));
assert.ok(!progressGame.g.news.includes(playerTurnaroundPlanReport.message(progressReport)), 'ordinary progress must not flood news');
const progressState = JSON.stringify(progressGame.g);
assert.equal(playerTurnaroundPlanReport.applyReport(progressGame.g, progressReport), false, 'same report must be idempotent');
assert.equal(JSON.stringify(progressGame.g), progressState);

const deadlineGame = makePlanGame();
deadlineGame.g.playerTurnaroundPlan.deadlineWeek = deadlineGame.g.week + 2;
assert.equal(deadlineGame.advanceWeek(false), true);
const deadlineReport = deadlineGame.g.lastWeeklySummary.turnaroundPlanReport;
assert.equal(deadlineReport.kind, 'deadline');
assert.equal(deadlineReport.weeksRemaining, 1);
assert.ok(deadlineGame.g.news.includes(playerTurnaroundPlanReport.message(deadlineReport)),
  'deadline report remains in persistent news regardless of same-week final-phase notification ordering');
assert.ok(deadlineGame.g.lastWeeklySummary.newNews.includes(playerTurnaroundPlanReport.message(deadlineReport)),
  'deadline report remains visible in the weekly summary');

const completedGame = makePlanGame();
completedGame.g.companyCash = completedGame.g.playerTurnaroundPlan.targetCash + 100_000_000;
completedGame.g.companyDebt = 0;
assert.equal(completedGame.advanceWeek(false), true);
const completedReport = completedGame.g.lastWeeklySummary.turnaroundPlanReport;
assert.equal(completedReport.kind, 'completed');
assert.equal(completedGame.g.playerTurnaroundPlan.status, 'completed');
assert.ok(completedGame.g.news.includes(playerTurnaroundPlanReport.message(completedReport)),
  'completed turnaround report remains in persistent news even when final crisis evaluation adds a later same-week transition');
assert.equal(completedGame.g.lastWeeklySummary.newNews[0], completedGame.g.news[0],
  'weekly summary starts with the authoritative final-state news ordering');
assert.ok(completedGame.g.lastWeeklySummary.newNews.includes(playerTurnaroundPlanReport.message(completedReport)),
  'weekly summary retains the completed turnaround report alongside the final crisis transition');
const restoredCompleted = new engine.TycoonEngine(JSON.parse(JSON.stringify(completedGame.g)));
assert.equal(restoredCompleted.g.playerTurnaroundPlan.status, 'completed');
assert.equal(restoredCompleted.g.lastWeeklySummary.turnaroundPlanReport.kind, 'completed');

const failedGame = makePlanGame();
failedGame.g.playerTurnaroundPlan.deadlineWeek = failedGame.g.week + 1;
assert.equal(failedGame.advanceWeek(false), true);
const failedReport = failedGame.g.lastWeeklySummary.turnaroundPlanReport;
assert.equal(failedReport.kind, 'failed');
assert.equal(failedGame.g.playerTurnaroundPlan.status, 'failed');
assert.ok(failedGame.g.news.includes(playerTurnaroundPlanReport.message(failedReport)),
  'failed turnaround report remains in persistent news regardless of same-week final-phase notification ordering');
assert.ok(failedGame.g.lastWeeklySummary.newNews.includes(playerTurnaroundPlanReport.message(failedReport)),
  'failed turnaround report remains visible in the weekly summary');

const hostile = { ...failedReport, reportID: '<img src=x onerror=alert(1)>', kind: 'failed' };
const html = playerTurnaroundPlanReport.renderSummarySection(hostile);
assert.ok(html.includes('再建計画レポート'));
assert.ok(html.includes('&lt;img'));
assert.ok(!html.includes('<img src=x'));
assert.ok(!/NaN|Infinity|undefined|\[object Object\]/.test(html));

for (const game of [progressGame, deadlineGame, completedGame, failedGame]) {
  const issues = findStateIssues(game.g).filter(x => !x.startsWith('g.finance.lastStatements.ratios.'));
  assert.deepEqual(issues, []);
  assert.equal(playerTurnaroundPlan.validate(game.g), true);
}

console.log('player turnaround plan weekly report tests passed');
