const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

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
    lastWeeklySummary: g.lastWeeklySummary,
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
function runScenario() {
  const random = seededRandom(123456789);
  const { engineModule } = loadGame({ random });
  const engine = new engineModule.TycoonEngine();
  const result = {};
  engine.configure({ playerName:'Tester', companyName:'Baseline Co', difficulty:'normal', scenario:'free' });
  result.configure = snapshot(engine.g, random.calls());
  for (const targetWeek of [1, 12, 52]) {
    while (engine.g.week < targetWeek + 1 && !engine.g.gameOver) engine.advanceWeek(false);
    result[`week${targetWeek}`] = snapshot(engine.g, random.calls());
  }
  return result;
}

const output = path.join(__dirname, 'transaction-baseline-generated.json');
fs.writeFileSync(output, JSON.stringify(runScenario(), null, 2) + '\n');
console.log(output);
