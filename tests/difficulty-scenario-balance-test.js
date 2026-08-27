const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT, findStateIssues } = require('./harness');
const { SCENARIOS, SEEDS, MAX_WEEKS, runScenario } = require('./strategy-balance-runner');

let seed = 0x6b300001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { engineModule, modules } = loadGame({ random });
const balance = modules.difficultyScenarioBalance;
const finance = modules.finance;
assert.ok(balance?.__installed, 'difficulty scenario balance module must be installed');
assert.equal(engineModule.TycoonEngine.prototype.__difficultyScenarioBalanceInstalled, true);
assert.equal(balance.VERSION, 1);
assert.equal(balance.STANDARD_TARGET_WEEK, 208);
assert.equal(balance.EASY_DEMAND_VERSION, 1);
assert.equal(balance.EASY_DEMAND_MULTIPLIER, 1.1);
assert.equal(balance.WEEKLY_CASH_ROUNDING_LIMIT, .05);
assert.equal(balance.ROUNDING_HISTORY_LIMIT, 52);
assert.equal(balance.ROUNDING_ADJUSTMENT_PER_52_WEEKS, 1);
assert.equal(balance.HARD_IPO_ANNUAL_PROFIT, 20_000_000);
assert.equal(engineModule.SAVE_VERSION, 9);
assert.equal(engineModule.SAVE_KEY, 'capitalism_tycoon_web_v1');

for (const [difficulty, expected] of Object.entries({ easy:[12_000_000,70,715], normal:[8_000_000,60,650], hard:[6_000_000,50,650] })) {
  const game = new engineModule.TycoonEngine();
  game.configure({ playerName:`${difficulty}監査`, companyName:`${difficulty}監査`, difficulty, scenario:'free' });
  assert.equal(game.g.companyCash, expected[0], `${difficulty} company cash mismatch`);
  assert.equal(game.g.companyCredit, expected[1], `${difficulty} company credit mismatch`);
  assert.equal(game.g.finance.openingCash, expected[0], `${difficulty} opening cash mismatch`);
  assert.equal(game.g.finance.openingAssets, expected[0], `${difficulty} opening assets mismatch`);
  assert.equal(game.g.finance.openingEquity, expected[0], `${difficulty} opening equity mismatch`);
  assert.equal(game.g.finance.openingRetainedEarnings, expected[0], `${difficulty} opening retained earnings mismatch`);
  assert.ok(Math.abs(game.business('cafe').demand - expected[2]) < 1e-9, `${difficulty} cafe demand mismatch`);
  assert.equal(game.g.difficultyOpeningBalanceApplied, true);
  assert.equal(game.g.difficultyScenarioBalanceVersion, 1);
  assert.equal(game.g.finance.roundingAdjustmentTotal, 0);
  assert.equal(game.g.finance.roundingAdjustmentAbsoluteTotal, 0);
  assert.equal(game.g.finance.roundingAdjustmentCount, 0);
  assert.equal(game.g.finance.roundingAdjustmentHistory.length, 0);
  if (difficulty === 'easy') assert.equal(game.g.easyDifficultyDemandVersion, 1);
  else assert.equal(game.g.easyDifficultyDemandVersion, undefined);
  assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join(' / '));
  assert.equal(balance.validate(game.g), true);
}

const hardProfitGate = new engineModule.TycoonEngine();
hardProfitGate.configure({ playerName:'Hard IPO監査', companyName:'Hard IPO監査', difficulty:'hard', scenario:'free' });
hardProfitGate.g.reports = Array.from({ length:52 }, (_, index) => ({ week:index + 1, profit:300_000 }));
assert.ok(hardProfitGate.ipoMissingReasons().includes('Hard：直近52週利益2,000万円'), 'Hard must keep the stronger IPO profit gate below 2,000万円');
hardProfitGate.g.reports = Array.from({ length:52 }, (_, index) => ({ week:index + 1, profit:400_000 }));
assert.equal(hardProfitGate.ipoMissingReasons().includes('Hard：直近52週利益2,000万円'), false, 'Hard IPO profit gate must clear at or above 2,000万円');
const normalProfitGate = new engineModule.TycoonEngine();
normalProfitGate.configure({ playerName:'Normal IPO監査', companyName:'Normal IPO監査', difficulty:'normal', scenario:'free' });
normalProfitGate.g.reports = Array.from({ length:52 }, (_, index) => ({ week:index + 1, profit:400_000 }));
assert.equal(normalProfitGate.ipoMissingReasons().includes('Hard：直近52週利益2,000万円'), false, 'Normal must retain the existing IPO contract');

// This exact route/seed family has failed the push-only aggregate on main since PR #553:
// Hard opened stores much later, landed in a favorable macro phase, then cleared the same IPO gate
// before Normal. A first fix (2,500万円) overshot: cafe-bootstrap's trailing-52-week profit under Hard
// plateaus around 1,800万円〜2,100万円 for this route and never reaches 2,500万円 within MAX_WEEKS, so Hard could
// never IPO at all. 2,000万円 is calibrated against the actual per-seed profit trajectories (see
// docs/feature-requests.md) to sit above every seed's pre-Normal-IPO-week profit level while still being
// reached comfortably before MAX_WEEKS. Keep the production difficulty ordering pinned without weakening
// the aggregate test.
const cafeScenario = SCENARIOS.find(row => row.id === 'cafe-bootstrap');
assert.ok(cafeScenario, 'cafe-bootstrap strategy scenario must exist');
for (const matrixSeed of SEEDS) {
  const normal = runScenario(cafeScenario, matrixSeed, { difficulty:'normal', gameScenario:'free' });
  const hard = runScenario(cafeScenario, matrixSeed, { difficulty:'hard', gameScenario:'free' });
  assert.equal(normal.ipo, true, `cafe-bootstrap/${matrixSeed}: Normal must still reach IPO`);
  assert.equal(hard.ipo, true, `cafe-bootstrap/${matrixSeed}: Hard must still reach IPO`);
  assert.ok(normal.ipoWeek <= hard.ipoWeek, `cafe-bootstrap/${matrixSeed}: Normal must not progress slower than Hard (${normal.ipoWeek} > ${hard.ipoWeek})`);
  assert.ok(hard.ipoWeek <= MAX_WEEKS, `cafe-bootstrap/${matrixSeed}: Hard must still reach IPO by ${MAX_WEEKS}`);
}

const custom = engineModule.createInitialState({ configured:true, difficulty:'normal', scenario:'free' });
custom.week = 2;
custom.companyCash = -1_000_000;
custom.finance = finance.defaultFinanceState(custom);
delete custom.difficultyScenarioBalanceVersion;
delete custom.difficultyOpeningBalanceApplied;
const customGame = new engineModule.TycoonEngine(custom);
assert.equal(customGame.g.finance.openingCash, -1_000_000, 'custom opening cash must not be rewritten');
assert.equal(customGame.g.difficultyOpeningBalanceApplied, false, 'custom state must not be marked as repaired');
assert.equal(finance.validate(customGame.g).ok, true, finance.validate(customGame.g).errors.join(' / '));
assert.equal(balance.validate(customGame.g), true);

const legacyEasy = engineModule.createInitialState({ configured:true, difficulty:'easy', scenario:'free' });
legacyEasy.companyCash = 12_000_000;
legacyEasy.businesses.find(row => row.id === 'cafe').demand = 374;
delete legacyEasy.strategyBalanceVersion;
delete legacyEasy.difficultyScenarioBalanceVersion;
delete legacyEasy.difficultyOpeningBalanceApplied;
delete legacyEasy.easyDifficultyDemandVersion;
const migratedEasy = new engineModule.TycoonEngine(legacyEasy);
const expectedMigratedCafe = 374 * 650 / 340 * 1.1;
assert.equal(migratedEasy.g.finance.openingCash, 12_000_000, 'legacy easy opening cash must be repaired');
assert.ok(Math.abs(migratedEasy.business('cafe').demand - expectedMigratedCafe) < 1e-9, 'legacy Easy demand upgrades must preserve ratios');
assert.equal(migratedEasy.g.easyDifficultyDemandVersion, 1);
assert.equal(finance.validate(migratedEasy.g).ok, true, finance.validate(migratedEasy.g).errors.join(' / '));
const reloadedEasy = new engineModule.TycoonEngine(JSON.parse(JSON.stringify(migratedEasy.g)));
assert.equal(reloadedEasy.g.finance.openingCash, 12_000_000, 'reloaded easy save must not be repaired twice');
assert.equal(reloadedEasy.g.finance.openingEquity, migratedEasy.g.finance.openingEquity);
assert.ok(Math.abs(reloadedEasy.business('cafe').demand - migratedEasy.business('cafe').demand) < 1e-9, 'Easy demand must not be multiplied twice');
assert.equal(balance.applyEasyDemand(reloadedEasy.g), false, 'current Easy demand version must be idempotent');

const roundingGame = new engineModule.TycoonEngine();
roundingGame.configure({ playerName:'丸め監査', companyName:'丸め監査', difficulty:'normal', scenario:'free' });
roundingGame.g.week = 52;
const cashBeforeRounding = roundingGame.g.companyCash;
roundingGame.g.finance.weeklySnapshots = [{ week:52, openingCash:cashBeforeRounding, endingCash:cashBeforeRounding-.02, actualCompanyCash:cashBeforeRounding, cashDifference:.02, operatingCashFlow:-.02, investingCashFlow:0, financingCashFlow:0, netCashChange:-.02 }];
assert.equal(balance.reconcileWeeklyCashRounding(roundingGame.g), true, 'sub-five-cent difference must be reconciled');
assert.equal(roundingGame.g.companyCash, cashBeforeRounding-.02);
assert.equal(roundingGame.g.finance.roundingAdjustmentTotal, -.02);
assert.equal(roundingGame.g.finance.roundingAdjustmentAbsoluteTotal, .02);
assert.equal(roundingGame.g.finance.roundingAdjustmentCount, 1);
assert.equal(roundingGame.g.finance.roundingAdjustmentHistory.length, 1);
assert.deepEqual(roundingGame.g.finance.roundingAdjustmentHistory[0], { week:52, adjustment:-.02, differenceBefore:.02 });
assert.equal(balance.roundingAdjustmentLimit(roundingGame.g), 1);
assert.equal(finance.validate(roundingGame.g).ok, true, finance.validate(roundingGame.g).errors.join(' / '));
const roundingReloaded = new engineModule.TycoonEngine(JSON.parse(JSON.stringify(roundingGame.g)));
assert.equal(roundingReloaded.g.finance.roundingAdjustmentTotal, -.02, 'rounding audit total must survive JSON reload');
assert.equal(roundingReloaded.g.finance.roundingAdjustmentHistory.length, 1, 'rounding audit history must survive JSON reload');
roundingReloaded.g.finance.roundingAdjustmentAbsoluteTotal = 1.01;
const excessiveRounding = finance.validate(roundingReloaded.g);
assert.equal(excessiveRounding.ok, false, 'excessive cumulative rounding must fail finance validation');
assert.ok(excessiveRounding.errors.some(message => message.includes('週次現金丸め補正の累積が許容値を超過')));

const freeGame = new engineModule.TycoonEngine();
freeGame.configure({ playerName:'自由', companyName:'自由', difficulty:'normal', scenario:'free' });
assert.deepEqual(balance.snapshot(freeGame.g), { scenario:'free', label:'自由プレイ', status:'free', targetIPOWeek:null, weeksRemaining:null, completedWeek:null, score:null, grade:null });
freeGame.advanceWeek(false);
assert.equal(freeGame.g.lastWeeklySummary.scenario.status, 'free');

const standardGame = new engineModule.TycoonEngine();
standardGame.configure({ playerName:'標準', companyName:'標準', difficulty:'normal', scenario:'standard' });
assert.equal(standardGame.g.scenarioProgress.status, 'active');
assert.equal(standardGame.g.scenarioProgress.targetIPOWeek, 208);
assert.equal(standardGame.g.scenarioProgress.history.length, 1);
assert.equal(standardGame.g.scenarioProgress.history[0].kind, 'started');
assert.ok(standardGame.g.news[0].includes('第208週までのIPO'));
standardGame.g.week = 52;
standardGame.g.scenarioProgress.lastEvaluationWeek = 51;
const checkpoint = balance.evaluate(standardGame.g);
assert.equal(checkpoint.weeksRemaining, 156);
assert.equal(standardGame.g.scenarioProgress.history.length, 2);
balance.evaluate(standardGame.g);
assert.equal(standardGame.g.scenarioProgress.history.length, 2, 'same-week checkpoint must be idempotent');
standardGame.g.week = 209;
standardGame.g.scenarioProgress.lastEvaluationWeek = 208;
const overdue = balance.evaluate(standardGame.g);
assert.equal(overdue.status, 'overdue');
assert.ok(standardGame.g.scenarioProgress.history.some(row => row.kind === 'overdue'));
standardGame.g.publicCompany = true;
standardGame.g.week = 100;
standardGame.g.scenarioProgress.completedWeek = null;
standardGame.g.scenarioProgress.lastEvaluationWeek = 100;
const completed = balance.evaluate(standardGame.g);
assert.equal(completed.status, 'completed');
assert.equal(completed.completedWeek, 100);
assert.equal(completed.grade, 'A');
assert.equal(completed.score, 69);
assert.ok(standardGame.g.scenarioProgress.history.some(row => row.kind === 'completed'), 'same-week IPO completion must be recorded');
assert.equal(balance.validate(standardGame.g), true);
assert.deepEqual(findStateIssues(standardGame.g), []);

const source = fs.readFileSync(path.join(ROOT, 'js', 'difficulty-scenario-balance.js'), 'utf8');
assert.equal(/Math\.random\s*\(/.test(source), false, 'difficulty scenario module must not add runtime randomness');
assert.equal(/capitalism_tycoon_web_v1/.test(fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8')), true, 'save key must remain unchanged');
console.log('difficulty and scenario balance checks passed');
