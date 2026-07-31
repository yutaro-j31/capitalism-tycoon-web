const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function seededRandom(seed) {
  let state = seed >>> 0;
  let calls = 0;
  const random = () => {
    calls += 1;
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  random.calls = () => calls;
  return random;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function snapshot(g, randomCalls) {
  const legacyWeeklySummary = clone(g.lastWeeklySummary);
  if (legacyWeeklySummary) {
    delete legacyWeeklySummary.crisis;
    delete legacyWeeklySummary.scenario;
  }
  return clone({
    randomCalls,
    week: g.week,
    month: g.month,
    companyCash: g.companyCash,
    personalCash: g.personalCash,
    stores: g.stores,
    businesses: g.businesses,
    companyStocks: g.companyStocks,
    personalStocks: g.personalStocks,
    personalInvestments: g.personalInvestments,
    subsidiaries: g.subsidiaries,
    maSubsidiaries: g.maSubsidiaries,
    lastReport: g.lastReport,
    history: g.history,
    reports: g.reports,
    news: g.news,
    lastWeeklySummary: legacyWeeklySummary,
    gameOver: g.gameOver,
    gameOverReason: g.gameOverReason,
    expandedWeeklyAdjustments: g.expandedWeeklyAdjustments,
    lastExpansionUpdateWeek: g.lastExpansionUpdateWeek,
    lastCompletionUpdateWeek: g.lastCompletionUpdateWeek,
    lastParityUpdateWeek: g.lastParityUpdateWeek,
    currentCompanySerial: g.currentCompanySerial,
    serialCompanyCount: g.serialCompanyCount,
    keyPersonnel: g.keyPersonnel,
  });
}
function assertCrisisSnapshot(engine, label) {
  const crisis = engine.g.playerCrisis;
  const summary = engine.g.lastWeeklySummary?.crisis;
  assert(crisis && summary, `${label}: crisis snapshot missing`);
  assert(summary.status === crisis.status, `${label}: crisis status mismatch`);
  for (const key of ['negativeCashWeeks','graceWeeksRemaining','recoveryWeeks','reserveThreshold','lastCash']) {
    assert(Number.isFinite(Number(summary[key])), `${label}: crisis ${key} is not finite`);
  }
  assert(summary.lastCash === engine.g.companyCash, `${label}: crisis snapshot does not use final cash`);
}
function runScenario() {
  const random = seededRandom(123456789);
  const { engineModule, modules } = loadGame({ random, isolatedLegacyIndex:true });
  const engine = new engineModule.TycoonEngine();
  const result = {};
  engine.configure({ playerName:'Tester', companyName:'Baseline Co', difficulty:'normal', scenario:'free' });
  result.configure = snapshot(engine.g, random.calls());
  for (const targetWeek of [1, 12, 52]) {
    while (engine.g.week < targetWeek + 1 && !engine.g.gameOver) engine.advanceWeek(false);
    assertCrisisSnapshot(engine, `week${targetWeek}`);
    result[`week${targetWeek}`] = snapshot(engine.g, random.calls());
  }
  return { snapshots: result, calibrations: modules.strategyBalance.DEMAND_CALIBRATIONS };
}
function migrateExpectedDemand(expected, calibrations) {
  for (const point of Object.values(expected)) {
    point.businesses = (point.businesses || []).filter(business => business && typeof business.id === 'string' && business.id.length > 0);
    for (const business of point.businesses) {
      const calibration = calibrations[business.id];
      if (calibration) business.demand *= calibration.to / calibration.from;
    }
  }
  return expected;
}
function firstDiff(a, b, at = '$') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || !a || typeof b !== 'object' || !b) return `${at}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const diff = firstDiff(a[key], b[key], `${at}.${key}`);
    if (diff) return diff;
  }
  return `${at}: values differ`;
}

const fixturePath = path.join(__dirname, 'fixtures', 'transaction-baseline-v1.json');
const run = runScenario();
const expected = migrateExpectedDemand(JSON.parse(fs.readFileSync(fixturePath, 'utf8')), run.calibrations);
const actual = run.snapshots;
const diff = firstDiff(actual, expected);
assert(!diff, `transaction deterministic regression mismatch: ${diff}`);
console.log(JSON.stringify({ deterministicRegression: 'passed', crisisSnapshot: 'passed', points: Object.keys(actual), randomCallsAtWeek52: actual.week52.randomCalls }, null, 2));
