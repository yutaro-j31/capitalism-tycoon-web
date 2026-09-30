'use strict';

// #806: crisis restructuring (asset sales) and cost reduction validate the state after the change
// and throw when it is invalid. They ran outside runTransaction, so a failure there left the sale
// or cut, the cash and the action sequence in place. Each action must leave the game and the save
// exactly as they were when it fails part-way, and still work when nothing fails.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const SAVE_KEY = 'capitalism_tycoon_web_v1';
let seed = 0x80600001;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
const loaded = loadGame({ random });
const { data, engine, finance, workforce, playerCrisis } = loaded.modules;
const storage = loaded.ctx.__localStorageData;
// State compared by value: a rollback restores objects in place, which can change key order.
const canonical = value => JSON.stringify(value, (key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);

function forceCrisis(game) {
  game.g.week = 4;
  const delta = -1_000_000 - game.g.companyCash;
  game.g.companyCash = -1_000_000;
  finance.event(game.g, 'otherOperating', Math.abs(delta), { cashEffect: delta, profitEffect: delta, sourceType: 'crisisAtomicityTestLoss', sourceID: 'atomicity', operationID: 'atomicity', description: '危機アトミシティテスト用損失' });
  game.g.playerCrisis.lastEvaluationWeek = 0;
  playerCrisis.evaluate(game.g);
  assert.equal(game.g.playerCrisis.status, 'distressed', 'precondition: the company is in crisis');
}

function makeGame() {
  const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
  game.g.productVentures.push({ id: 'product-loss', name: '赤字プロダクト', valuation: 4_000_000, profit: -200_000, investedCost: 5_000_000 });
  const property = game.g.properties[0];
  property.owner = 'company';
  property.value = 20_000_000;
  const department = JSON.parse(JSON.stringify(data.MASTER.departments.find(row => row.id === 'operations')));
  game.g.departments.operations = { ...department, established: true };
  const team = workforce.createDepartmentTeam(game.g, 'operations', 2, { averageWeeklySalary: 70_000 });
  workforce.recompute(game.g);
  const project = workforce.startProject(game.g, 'store-standardization').project;
  project.status = 'active';
  project.spentBudget = 0;
  // The fixture edits the company's assets directly; open the ledger on the resulting state so it
  // starts consistent and only the action under test can break it.
  game.g.finance = finance.defaultFinanceState(game.g);
  finance.reconcileLegacyLedger(game.g);
  forceCrisis(game);
  assert.equal(finance.validate(game.g).ok, true, 'precondition: the fixture ledger is valid');
  assert.equal(game.save(), true);
  return { game, propertyID: property.id, teamID: team.teamID, projectID: project.projectID };
}

// Makes finance.validate() report an error for the duration of the action, as a real
// inconsistency would. The actions validate after they have changed the game.
function failNextValidation() {
  const real = finance.validate;
  finance.validate = state => ({ ...real(state), ok: false, errors: ['injected validation failure'] });
  return () => { finance.validate = real; };
}

const actions = [
  { label: 'asset sale: product', run: (game) => game.executeCrisisDisposition('product', 'product-loss') },
  { label: 'asset sale: property', run: (game, ids) => game.executeCrisisDisposition('property', ids.propertyID) },
  { label: 'cost cut: pause project', run: (game, ids) => game.executeCrisisCostReduction('pauseProject', ids.projectID) },
  { label: 'cost cut: department headcount', run: (game, ids) => game.executeCrisisCostReduction('reduceDepartmentHeadcount', ids.teamID) }
];

for (const action of actions) {
  // 1. Failure part-way: nothing changes, in memory or in the save.
  {
    const { game, ...ids } = makeGame();
    const before = canonical(game.g), savedBefore = storage.get(SAVE_KEY);
    const restore = failNextValidation();
    try {
      assert.throws(() => action.run(game, ids), /injected validation failure/, `${action.label}: the failure is reported`);
    } finally { restore(); }
    assert.equal(canonical(game.g), before, `${action.label}: the game state is exactly as before the failed action`);
    assert.equal(storage.get(SAVE_KEY), savedBefore, `${action.label}: the save is untouched`);
  }
  // 2. Without a failure the same action changes the game and is saved (the check above is not vacuous).
  {
    const { game, ...ids } = makeGame();
    const before = canonical(game.g);
    assert.equal(action.run(game, ids), true, `${action.label}: succeeds without a failure`);
    assert.notEqual(canonical(game.g), before, `${action.label}: a successful action changes the game`);
    assert.equal(JSON.parse(storage.get(SAVE_KEY)).playerCrisisRestructuring.nextActionSeq, game.g.playerCrisisRestructuring.nextActionSeq, `${action.label}: and is saved`);
    assert.equal(finance.validate(game.g).ok, true, `${action.label}: the ledger stays valid`);
  }
}

console.log('player crisis restructuring atomicity tests passed');
