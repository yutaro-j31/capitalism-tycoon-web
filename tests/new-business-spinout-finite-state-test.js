'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const SEED = 0x83900001;
const PROJECT_ID = 'spinout-finite-project';
const NUMERIC_FIELDS = [
  'investmentBookValue',
  'enterpriseValue',
  'valuation',
  'operatingProfit',
  'sales',
  'weeklyProfit',
  'standaloneWeeklyProfit',
  'retainedEarnings',
  'risk',
  'quality',
  'growth'
];

function makeRuntime() {
  const loaded = loadGame();
  const engine = loaded.ctx.__ct_engine;
  engine.configure({
    playerName: 'Finite Founder',
    companyName: 'Finite Spinout Co',
    difficulty: 'normal',
    scenario: 'free',
    simulationSeed: SEED
  });
  engine.g.companyCash = 500_000_000;
  engine.g.personalCash = 10_000_000;
  engine.g.skipWeeklyValidation = true;
  engine.g.finance = loaded.ctx.__capitalismTycoonModules.finance.defaultFinanceState(engine.g);
  engine.g.newBusinessResearch = {
    projects: [{
      id: PROJECT_ID,
      name: '有限値事業',
      sector: 'software',
      status: 'ready',
      invested: 100_000_000,
      outcomeScore: 0.7
    }]
  };
  return { ...loaded, engine };
}

function spinout(engine) {
  const personalCash = engine.g.personalCash;
  const financeRows = engine.g.finance.transactions.length;
  const rngDraws = engine.g.simulationRng.draws;
  assert.equal(engine.commercializeNewBusiness(PROJECT_ID, 'spinout'), true);
  const sub = engine.g.maSubsidiaries.find(row => row.id === `spinout-${PROJECT_ID}`);
  assert(sub);
  for (const field of NUMERIC_FIELDS) assert(Number.isFinite(sub[field]), `${field} must be finite immediately after spinout`);
  assert.equal(sub.operatingProfit, 0);
  assert.equal(sub.sales, 0);
  assert.equal(sub.weeklyProfit, 0);
  assert.equal(sub.standaloneWeeklyProfit, 0);
  assert.equal(sub.retainedEarnings, 0);
  assert.equal(sub.valuation, sub.enterpriseValue);
  assert(Number.isFinite(engine.g.companyCash));
  assert(Number.isFinite(engine.companyValue()));
  assert.equal(engine.g.personalCash, personalCash);
  assert.equal(engine.g.finance.transactions.length, financeRows, 'GF2-001 must not add an accounting posting');
  assert.equal(engine.g.simulationRng.draws, rngDraws, 'spinout initialization must not consume RNG');
  return sub;
}

function assertFiniteWeek(engine, sub, label) {
  assert(Number.isFinite(engine.g.companyCash), `${label}: companyCash`);
  assert(Number.isFinite(engine.companyValue()), `${label}: companyValue`);
  for (const field of NUMERIC_FIELDS) assert(Number.isFinite(sub[field]), `${label}: ${field}`);
}

{
  const { engine } = makeRuntime();
  const sub = spinout(engine);
  engine.advanceWeek(false);
  assertFiniteWeek(engine, sub, 'week 1');
}

{
  const { engine } = makeRuntime();
  const sub = spinout(engine);
  for (let week = 1; week <= 52; week++) {
    engine.advanceWeek(false);
    assertFiniteWeek(engine, sub, `week ${week}`);
  }
}

{
  const { ctx, engine, engineModule } = makeRuntime();
  spinout(engine);
  engine.advanceWeek(false);
  assert.equal(engine.save(), true);
  const payload = ctx.__localStorageData.get(engineModule.SAVE_KEY);
  assert(payload);
  const parsed = JSON.parse(payload);
  assert.equal(typeof parsed.companyCash, 'number');
  assert(Number.isFinite(parsed.companyCash));
  assert.notEqual(parsed.companyCash, null);
  const loaded = loadGame({ localStorageInitial: { [engineModule.SAVE_KEY]: payload } });
  const reloaded = loaded.ctx.__ct_engine;
  const sub = reloaded.g.maSubsidiaries.find(row => row.id === `spinout-${PROJECT_ID}`);
  assertFiniteWeek(reloaded, sub, 'reload');
  reloaded.advanceWeek(false);
  assertFiniteWeek(reloaded, sub, 'reload week 1');
}

{
  const left = makeRuntime().engine;
  const right = makeRuntime().engine;
  const leftSub = spinout(left);
  const rightSub = spinout(right);
  for (let week = 1; week <= 52; week++) {
    left.advanceWeek(false);
    right.advanceWeek(false);
  }
  assert.equal(left.g.companyCash, right.g.companyCash);
  assert.equal(leftSub.valuation, rightSub.valuation);
  assert.equal(leftSub.weeklyProfit, rightSub.weeklyProfit);
  assert.equal(left.g.simulationRng.state, right.g.simulationRng.state);
  assert.equal(left.g.simulationRng.draws, right.g.simulationRng.draws);
}

console.log('new business spinout finite-state tests passed');
