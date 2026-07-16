const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT, findStateIssues } = require('./harness');

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
assert.equal(balance.EASY_EXPANSION_RESERVE, 6_000_000);
assert.equal(balance.HARD_STARTUP_CREDIT_FLOOR, 5_000_000);
assert.equal(balance.STARTUP_GUARANTEE_END_WEEK, 26);
assert.equal(engineModule.SAVE_VERSION, 9);
assert.equal(engineModule.SAVE_KEY, 'capitalism_tycoon_web_v1');

for (const [difficulty, expected] of Object.entries({ easy:[12_000_000,70], normal:[8_000_000,60], hard:[6_000_000,50] })) {
  const game = new engineModule.TycoonEngine();
  game.configure({ playerName:`${difficulty}監査`, companyName:`${difficulty}監査`, difficulty, scenario:'free' });
  assert.equal(game.g.companyCash, expected[0], `${difficulty} company cash mismatch`);
  assert.equal(game.g.companyCredit, expected[1], `${difficulty} company credit mismatch`);
  assert.equal(game.g.finance.openingCash, expected[0], `${difficulty} opening cash mismatch`);
  assert.equal(game.g.finance.openingAssets, expected[0], `${difficulty} opening assets mismatch`);
  assert.equal(game.g.finance.openingEquity, expected[0], `${difficulty} opening equity mismatch`);
  assert.equal(game.g.finance.openingRetainedEarnings, expected[0], `${difficulty} opening retained earnings mismatch`);
  assert.equal(game.g.difficultyOpeningBalanceApplied, true);
  assert.equal(game.g.difficultyScenarioBalanceVersion, 1);
  assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join(' / '));
  assert.equal(balance.validate(game.g), true);
}

const hardGuarantee = new engineModule.TycoonEngine();
hardGuarantee.configure({ playerName:'保証', companyName:'保証', difficulty:'hard', scenario:'free' });
assert.equal(hardGuarantee.companyCreditLimit(), 5_000_000, 'hard startup credit floor must apply at founding');
hardGuarantee.g.week = 27;
assert.ok(hardGuarantee.companyCreditLimit() < 5_000_000, 'hard startup credit floor must expire after week 26');

const easySafety = new engineModule.TycoonEngine();
easySafety.configure({ playerName:'安全', companyName:'安全', difficulty:'easy', scenario:'free' });
const safetyTenant = easySafety.g.tenants[0];
const safetyBusiness = easySafety.business('cafe');
easySafety.g.stores.push({ id:'existing-store' });
const openingCost = balance.storeOpeningCost(safetyTenant, safetyBusiness);
easySafety.g.companyCash = openingCost + balance.EASY_EXPANSION_RESERVE - 1;
assert.equal(balance.canOpenStoreSafely(easySafety.g, safetyTenant, safetyBusiness).allowed, false);
easySafety.g.companyCash += 1;
assert.equal(balance.canOpenStoreSafely(easySafety.g, safetyTenant, safetyBusiness).allowed, true);

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
delete legacyEasy.difficultyScenarioBalanceVersion;
delete legacyEasy.difficultyOpeningBalanceApplied;
const migratedEasy = new engineModule.TycoonEngine(legacyEasy);
assert.equal(migratedEasy.g.finance.openingCash, 12_000_000, 'legacy easy opening cash must be repaired');
assert.equal(finance.validate(migratedEasy.g).ok, true, finance.validate(migratedEasy.g).errors.join(' / '));
const reloadedEasy = new engineModule.TycoonEngine(JSON.parse(JSON.stringify(migratedEasy.g)));
assert.equal(reloadedEasy.g.finance.openingCash, 12_000_000, 'reloaded easy save must not be repaired twice');
assert.equal(reloadedEasy.g.finance.openingEquity, migratedEasy.g.finance.openingEquity);

const freeGame = new engineModule.TycoonEngine();
freeGame.configure({ playerName:'自由', companyName:'自由', difficulty:'normal', scenario:'free' });
assert.deepEqual(balance.snapshot(freeGame.g), { scenario:'free', label:'自由プレイ', status:'free', targetIPOWeek:null, weeksRemaining:null, completedWeek:null, score:null, grade:null });
freeGame.advanceWeek(false);
assert.equal(freeGame.g.lastWeeklySummary.scenario.status, 'free');

const standardGame = new engineModule.TycoonEngine();
standardGame.configure({ playerName:'標準', companyName:'標準', difficulty:'normal', scenario:'standard' });
assert.equal(standardGame.g.scenarioProgress.status, 'active');
assert.equal(standardGame.g.scenarioProgress.targetIPOWeek, 208);
standardGame.g.week = 52;
standardGame.g.scenarioProgress.lastEvaluationWeek = 51;
const checkpoint = balance.evaluate(standardGame.g);
assert.equal(checkpoint.weeksRemaining, 156);
assert.equal(standardGame.g.scenarioProgress.history.length, 1);
balance.evaluate(standardGame.g);
assert.equal(standardGame.g.scenarioProgress.history.length, 1, 'same-week checkpoint must be idempotent');
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
