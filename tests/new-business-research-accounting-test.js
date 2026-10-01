'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

const SEED = 0x001b2026;
const CANDIDATE_ID = 'gf-001b-candidate';
const COST = 24_000_000;

function candidate(id = CANDIDATE_ID, cost = COST) {
  return { id, name: 'GF-001B検証事業', sector: 'software', requiredCapital: cost, attractiveness: 0.9, regulatoryRisk: 0.1 };
}

function prepare(loaded) {
  const engine = loaded.ctx.__ct_engine;
  engine.configure({ playerName: 'GF-001B Founder', companyName: 'GF-001B Co', difficulty: 'normal', scenario: 'free', simulationSeed: SEED });
  engine.g.companyCash = 500_000_000;
  engine.g.finance = loaded.modules.finance.defaultFinanceState(engine.g);
  engine.g.newBusinessAnalysis = { candidates: [candidate()] };
  return engine;
}

function researchRows(state) {
  return state.finance.transactions.filter(row => row.sourceType === 'newBusinessResearch');
}

const loaded = loadGame();
const engine = prepare(loaded);
const finance = loaded.modules.finance;
const cashBefore = engine.g.companyCash;
const personalBefore = engine.g.personalCash;
const drawsBefore = engine.g.simulationRng.draws;
const statementsBefore = finance.buildStatements(engine.g, 'week');

assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), true);
assert.equal(engine.g.companyCash, cashBefore - COST, 'research has exactly one economic cash deduction');
assert.equal(engine.g.personalCash, personalBefore, 'research never uses personal cash');
assert.equal(engine.g.simulationRng.draws, drawsBefore, 'research consumes no economic RNG draws');
const project = engine.g.newBusinessResearch.projects.find(row => row.candidateId === CANDIDATE_ID);
assert(project);
assert.equal(project.invested, COST);
assert.equal(project.status, 'researching');
assert.equal(engine.g.researchAssets, COST, 'researchAssets remains an informational cumulative-spend metric');

assert.equal(researchRows(engine.g).length, 1, 'one R&D row is posted per valid start');
const row = researchRows(engine.g)[0];
assert.deepEqual({
  category: row.category,
  amount: row.amount,
  cashEffect: row.cashEffect,
  profitEffect: row.profitEffect,
  assetEffect: row.assetEffect,
  sourceType: row.sourceType,
  operationID: row.operationID,
  idempotencyKey: row.idempotencyKey
}, {
  category: 'researchAndDevelopment',
  amount: COST,
  cashEffect: -COST,
  profitEffect: -COST,
  assetEffect: 0,
  sourceType: 'newBusinessResearch',
  operationID: `new-business-research-${engine.g.week}-${CANDIDATE_ID}`,
  idempotencyKey: `new-business-research-${engine.g.week}-${CANDIDATE_ID}`
});

const statementsAfter = finance.buildStatements(engine.g, 'week');
assert.equal(statementsAfter.profitAndLoss.researchAndDevelopment - statementsBefore.profitAndLoss.researchAndDevelopment, COST);
assert.equal(statementsAfter.profitAndLoss.operatingIncome - statementsBefore.profitAndLoss.operatingIncome, -COST);
assert.equal(statementsAfter.profitAndLoss.pretaxIncome - statementsBefore.profitAndLoss.pretaxIncome, -COST);
assert.equal(statementsAfter.profitAndLoss.netIncome - statementsBefore.profitAndLoss.netIncome, -COST);
assert.equal(statementsAfter.cashFlow.operatingCashFlow - statementsBefore.cashFlow.operatingCashFlow, -COST);
assert.equal(statementsAfter.cashFlow.investingCashFlow - statementsBefore.cashFlow.investingCashFlow, 0);
assert.equal(statementsAfter.cashFlow.financingCashFlow - statementsBefore.cashFlow.financingCashFlow, 0);
assert.equal(statementsAfter.balanceSheet.assets.cashAndDeposits, cashBefore - COST);
assert.equal(statementsAfter.balanceSheet.assets.otherFixedAssets, statementsBefore.balanceSheet.assets.otherFixedAssets, 'research creates no balance-sheet asset');
assert.equal(statementsAfter.balanceSheet.assets.totalAssets - statementsBefore.balanceSheet.assets.totalAssets, -COST);
assert.equal(statementsAfter.balanceSheet.balanceDifference, 0);
assert.equal(finance.validate(engine.g).errors.length, 0);

for (const [id, cash] of [['unknown-candidate', engine.g.companyCash], [CANDIDATE_ID, engine.g.companyCash]]) {
  const projectsBefore = engine.g.newBusinessResearch.projects.length;
  const rowsBefore = researchRows(engine.g).length;
  assert.equal(engine.startNewBusinessResearch(id), false);
  assert.equal(engine.g.companyCash, cash);
  assert.equal(engine.g.newBusinessResearch.projects.length, projectsBefore);
  assert.equal(researchRows(engine.g).length, rowsBefore);
}
engine.g.newBusinessAnalysis.candidates.push(candidate('too-expensive', engine.g.companyCash + 1));
const rejectionSnapshot = JSON.stringify({ cash: engine.g.companyCash, projects: engine.g.newBusinessResearch.projects, finance: engine.g.finance });
assert.equal(engine.startNewBusinessResearch('too-expensive'), false);
assert.equal(JSON.stringify({ cash: engine.g.companyCash, projects: engine.g.newBusinessResearch.projects, finance: engine.g.finance }), rejectionSnapshot);

assert.equal(engine.save(), true);
const savePayload = loaded.ctx.__localStorageData.get(loaded.engineModule.SAVE_KEY);
const reloaded = loadGame({ localStorageInitial: { [loaded.engineModule.SAVE_KEY]: savePayload } });
const reloadedEngine = reloaded.ctx.__ct_engine;
assert(reloadedEngine.g.newBusinessResearch.projects.some(item => item.candidateId === CANDIDATE_ID));
assert.equal(reloadedEngine.g.companyCash, cashBefore - COST);
assert.equal(researchRows(reloadedEngine.g).length, 1);
assert.equal(reloaded.modules.finance.buildStatements(reloadedEngine.g, 'week').balanceSheet.balanceDifference, 0);
assert.equal(reloaded.modules.finance.validate(reloadedEngine.g).errors.length, 0);
reloadedEngine.g.week += 1;
reloaded.modules.newBusinessResearchProjects.progress(reloadedEngine.g);
assert.equal(researchRows(reloadedEngine.g).length, 1, 'weekly processing after reload does not repost research');

const reloadedProject = reloadedEngine.g.newBusinessResearch.projects.find(item => item.candidateId === CANDIDATE_ID);
for (let elapsed = 1; elapsed <= reloadedProject.durationWeeks; elapsed++) {
  reloadedEngine.g.week = reloadedProject.startWeek + elapsed;
  reloaded.modules.newBusinessResearchProjects.progress(reloadedEngine.g);
}
assert.notEqual(reloadedProject.status, 'researching');
const restartCash = reloadedEngine.g.companyCash;
const restartDraws = reloadedEngine.g.simulationRng.draws;
assert.equal(reloadedEngine.startNewBusinessResearch(CANDIDATE_ID), true);
const restartedRows = researchRows(reloadedEngine.g);
assert.equal(restartedRows.length, 2, 'same candidate restart posts a second legitimate R&D row');
assert.equal(new Set(restartedRows.map(item => item.operationID)).size, 2);
assert.equal(new Set(restartedRows.map(item => item.idempotencyKey)).size, 2);
assert.equal(reloadedEngine.g.companyCash, restartCash - COST);
assert.equal(reloadedEngine.g.simulationRng.draws, restartDraws);

const rollbackLoaded = loadGame();
const rollbackEngine = prepare(rollbackLoaded);
rollbackEngine.g.newBusinessAnalysis.candidates.push(candidate('rollback-candidate', COST));
const originalFinance = rollbackLoaded.modules.finance;
const originalEvent = originalFinance.event;
originalFinance.event = function throwingEvent(...args) {
  originalEvent(...args);
  throw new Error('forced post-ledger failure');
};
const rollbackBefore = JSON.stringify({
  companyCash: rollbackEngine.g.companyCash,
  projects: rollbackEngine.g.newBusinessResearch.projects,
  researchAssets: rollbackEngine.g.researchAssets,
  finance: rollbackEngine.g.finance,
  simulationRng: rollbackEngine.g.simulationRng
});
assert.throws(() => rollbackEngine.startNewBusinessResearch('rollback-candidate'), /forced post-ledger failure/);
assert.equal(JSON.stringify({
  companyCash: rollbackEngine.g.companyCash,
  projects: rollbackEngine.g.newBusinessResearch.projects,
  researchAssets: rollbackEngine.g.researchAssets,
  finance: rollbackEngine.g.finance,
  simulationRng: rollbackEngine.g.simulationRng
}), rollbackBefore, 'transaction rollback restores cash, projects, metric, complete finance state, and RNG state');
originalFinance.event = originalEvent;

const financeSource = fs.readFileSync('js/finance.js', 'utf8');
assert(!financeSource.includes('researchAssets'), 'researchAssets must not feed balance-sheet construction');
const engineSource = fs.readFileSync('js/engine.js', 'utf8');
const companyValueBody = engineSource.slice(engineSource.indexOf('companyValue()'), engineSource.indexOf('personalNetWorth()'));
assert(!companyValueBody.includes('researchAssets'), 'researchAssets must not feed companyValue');
assert.equal(loaded.engineModule.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.g.saveVersion, 9);

console.log('new business research accounting tests passed');
