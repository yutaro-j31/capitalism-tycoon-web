'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

const SEED = 0x001c2026;
const INVESTED = 40_000_000;

function project(id, startWeek = 4) {
  return { id, candidateId: id, name: `${id}事業`, sector: 'software', startWeek, status: 'ready', invested: INVESTED, outcomeScore: .75 };
}

function prepare(id) {
  const loaded = loadGame();
  const engine = loaded.ctx.__ct_engine;
  engine.configure({ playerName: 'GF-001C Founder', companyName: 'GF-001C Co', difficulty: 'normal', scenario: 'free', simulationSeed: SEED });
  engine.g.companyCash = 500_000_000;
  engine.g.finance = loaded.modules.finance.defaultFinanceState(engine.g);
  engine.g.companyCash -= INVESTED;
  loaded.modules.finance.event(engine.g, 'researchAndDevelopment', INVESTED, {
    cashEffect: -INVESTED, profitEffect: -INVESTED, assetEffect: 0,
    sourceType: 'newBusinessResearch', sourceID: id,
    operationID: `new-business-research-${id}`, idempotencyKey: `new-business-research-${id}`
  });
  engine.g.newBusinessResearch = { projects: [project(id)], history: [] };
  return { loaded, engine, finance: loaded.modules.finance };
}

function rows(state) {
  return state.finance.transactions.filter(row => row.sourceType === 'newBusinessCommercialization');
}

function checkPosting(row, mode, cost, id) {
  const operationID = `new-business-commercialization-${mode}-${id}-w4`;
  assert.deepEqual({
    category: row.category, amount: row.amount, cashEffect: row.cashEffect,
    assetEffect: row.assetEffect, profitEffect: row.profitEffect,
    sourceType: row.sourceType, sourceID: row.sourceID,
    operationID: row.operationID, idempotencyKey: row.idempotencyKey
  }, {
    category: 'assetPurchase', amount: cost, cashEffect: -cost,
    assetEffect: cost, profitEffect: 0,
    sourceType: 'newBusinessCommercialization', sourceID: `${id}-w4`,
    operationID, idempotencyKey: operationID
  });
}

function checkCommon(mode, cost, assetKey) {
  const id = `gf-001c-${mode}`;
  const { loaded, engine, finance } = prepare(id);
  const cashBefore = engine.g.companyCash;
  const personalBefore = engine.g.personalCash;
  const rngBefore = JSON.stringify(engine.g.simulationRng);
  const before = finance.buildStatements(engine.g, 'week');
  assert.equal(engine.commercializeNewBusiness({ id, startWeek: 4 }, mode), true);
  assert.equal(engine.g.companyCash, cashBefore - cost);
  assert.equal(engine.g.personalCash, personalBefore);
  assert.equal(JSON.stringify(engine.g.simulationRng), rngBefore, 'commercialization consumes no simulation RNG');
  assert.equal(rows(engine.g).length, 1);
  checkPosting(rows(engine.g)[0], mode, cost, id);
  const created = assetKey === 'newBusinesses' ? engine.g.newBusinesses[0] : engine.g.maSubsidiaries[0];
  assert.equal(created.commercializationCarryingValue, cost);
  assert.equal(created.invested ?? created.investmentBookValue, INVESTED + cost, 'planning total remains available separately');
  const after = finance.buildStatements(engine.g, 'week');
  assert.equal(after.profitAndLoss.netIncome - before.profitAndLoss.netIncome, 0);
  assert.equal(after.cashFlow.investingCashFlow - before.cashFlow.investingCashFlow, -cost);
  assert.equal(after.balanceSheet.assets.cashAndDeposits - before.balanceSheet.assets.cashAndDeposits, -cost);
  assert.equal(after.balanceSheet.assets.totalAssets - before.balanceSheet.assets.totalAssets, 0);
  assert.equal(after.balanceSheet.balanceDifference, 0);
  assert.equal(finance.validate(engine.g).errors.length, 0);
  return { loaded, engine, finance, before, after, id };
}

const launchCost = INVESTED * .25;
const launch = checkCommon('launch', launchCost, 'newBusinesses');
assert.equal(launch.after.balanceSheet.assets.otherFixedAssets - launch.before.balanceSheet.assets.otherFixedAssets, launchCost);
assert.equal(launch.after.balanceSheet.assets.subsidiariesAndAffiliates - launch.before.balanceSheet.assets.subsidiariesAndAffiliates, 0);

const spinoutCost = INVESTED * .15;
const spinout = checkCommon('spinout', spinoutCost, 'maSubsidiaries');
const spinoutSub = spinout.engine.g.maSubsidiaries[0];
assert.equal(spinout.after.balanceSheet.assets.subsidiariesAndAffiliates - spinout.before.balanceSheet.assets.subsidiariesAndAffiliates, spinoutCost);
assert.equal(spinoutSub.valuation, 1_000_000, 'GF2-010 production valuation floor remains unchanged');
assert.notEqual(spinoutSub.enterpriseValue, spinoutSub.commercializationCarryingValue);
assert.notEqual(spinout.after.balanceSheet.assets.subsidiariesAndAffiliates - spinout.before.balanceSheet.assets.subsidiariesAndAffiliates, spinoutSub.enterpriseValue);

{
  const { engine, finance } = prepare('gf-001c-abandon');
  const assetsBefore = finance.buildStatements(engine.g, 'week').balanceSheet.assets.totalAssets;
  const before = JSON.stringify({ companyCash: engine.g.companyCash, personalCash: engine.g.personalCash, finance: engine.g.finance });
  assert.equal(engine.commercializeNewBusiness({ id: 'gf-001c-abandon', startWeek: 4 }, 'abandon'), true);
  assert.equal(engine.g.newBusinessResearch.projects[0].status, 'abandoned');
  assert.equal(rows(engine.g).length, 0);
  assert.equal(finance.buildStatements(engine.g, 'week').balanceSheet.assets.totalAssets, assetsBefore);
  assert.equal(JSON.stringify({ companyCash: engine.g.companyCash, personalCash: engine.g.personalCash, finance: engine.g.finance }), before);
}

{
  const { engine } = prepare('gf-001c-reject');
  const unchanged = action => {
    const before = JSON.stringify(engine.g);
    assert.equal(action(), false);
    assert.equal(JSON.stringify(engine.g), before);
  };
  unchanged(() => engine.commercializeNewBusiness({ id: 'missing', startWeek: 4 }, 'launch'));
  engine.g.newBusinessResearch.projects[0].status = 'researching';
  unchanged(() => engine.commercializeNewBusiness({ id: 'gf-001c-reject', startWeek: 4 }, 'launch'));
  engine.g.newBusinessResearch.projects[0].status = 'ready';
  engine.g.companyCash = launchCost - 1;
  unchanged(() => engine.commercializeNewBusiness({ id: 'gf-001c-reject', startWeek: 4 }, 'launch'));
}

{
  const { engine } = prepare('gf-001c-duplicate');
  assert.equal(engine.commercializeNewBusiness({ id: 'gf-001c-duplicate', startWeek: 4 }, 'launch'), true);
  const after = JSON.stringify(engine.g);
  assert.equal(engine.commercializeNewBusiness({ id: 'gf-001c-duplicate', startWeek: 4 }, 'launch'), false);
  assert.equal(JSON.stringify(engine.g), after, 'duplicate action has no second debit, posting, or mutation');
}

{
  const { loaded, engine, finance } = prepare('gf-001c-rollback');
  const originalEvent = finance.event;
  finance.event = function postThenThrow(...args) { originalEvent(...args); throw new Error('forced post-ledger failure'); };
  const before = JSON.stringify(engine.g);
  assert.throws(() => engine.commercializeNewBusiness({ id: 'gf-001c-rollback', startWeek: 4 }, 'spinout'), /forced post-ledger failure/);
  assert.equal(JSON.stringify(engine.g), before, 'rollback restores all economic, finance, RNG, and ID state');
  assert.equal(engine.g.newBusinesses.length, 0);
  assert.equal(engine.g.maSubsidiaries.length, 0);
  assert.equal(rows(engine.g).length, 0);
  loaded.modules.finance.event = originalEvent;
}

{
  const { loaded, engine, finance } = prepare('gf-001c-save');
  const cashBefore = engine.g.companyCash;
  assert.equal(engine.commercializeNewBusiness({ id: 'gf-001c-save', startWeek: 4 }, 'launch'), true);
  assert.equal(engine.save(), true);
  const payload = loaded.ctx.__localStorageData.get(loaded.engineModule.SAVE_KEY);
  const reloaded = loadGame({ localStorageInitial: { [loaded.engineModule.SAVE_KEY]: payload } });
  const restored = reloaded.ctx.__ct_engine;
  assert.equal(restored.g.companyCash, cashBefore - launchCost);
  assert.equal(rows(restored.g).length, 1);
  assert.equal(restored.g.newBusinesses[0].commercializationCarryingValue, launchCost);
  assert.equal(reloaded.modules.finance.buildStatements(restored.g, 'week').balanceSheet.assets.otherFixedAssets, finance.buildStatements(engine.g, 'week').balanceSheet.assets.otherFixedAssets);
  assert.equal(reloaded.modules.finance.validate(restored.g).errors.length, 0);
  const snapshot = JSON.stringify(restored.g);
  assert.equal(restored.commercializeNewBusiness({ id: 'gf-001c-save', startWeek: 4 }, 'launch'), false);
  assert.equal(JSON.stringify(restored.g), snapshot, 'reload does not repost commercialization');
}

{
  const first = prepare('gf-001c-deterministic');
  const second = prepare('gf-001c-deterministic');
  assert.equal(first.engine.commercializeNewBusiness({ id: 'gf-001c-deterministic', startWeek: 4 }, 'spinout'), true);
  assert.equal(second.engine.commercializeNewBusiness({ id: 'gf-001c-deterministic', startWeek: 4 }, 'spinout'), true);
  const relevant = state => JSON.stringify({ companyCash: state.companyCash, personalCash: state.personalCash, project: state.newBusinessResearch.projects[0], newBusinesses: state.newBusinesses, maSubsidiaries: state.maSubsidiaries, history: state.newBusinessCommercializationHistory, finance: state.finance, simulationRng: state.simulationRng });
  assert.equal(relevant(first.engine.g), relevant(second.engine.g), 'same seed and input produce identical economic state');
}

const source = fs.readFileSync('js/new-business-commercialization.js', 'utf8');
assert(!source.includes('Math.random'));
assert(!source.includes('Date.now'));
assert.equal(launch.engine.g.saveVersion, 9);
assert.equal(launch.loaded.engineModule.SAVE_KEY, 'capitalism_tycoon_web_v1');

console.log('new business commercialization accounting tests passed');
