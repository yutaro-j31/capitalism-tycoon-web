const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a3a0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { modules } = loadGame({ random });
const { data, engine, finance, workforce, playerCrisis, playerCrisisRestructuring } = modules;

assert.ok(playerCrisisRestructuring?.__installed, 'player crisis restructuring must be registered');
assert.deepEqual([...playerCrisisRestructuring.COST_ACTION_TYPES], ['pauseProject', 'reduceDepartmentHeadcount']);
assert.equal(typeof engine.TycoonEngine.prototype.crisisCostReductionOptions, 'function');
assert.equal(typeof engine.TycoonEngine.prototype.executeCrisisCostReduction, 'function');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function forceCrisis(game, targetCash = -1_000_000) {
  game.g.week = 4;
  const delta = targetCash - game.g.companyCash;
  game.g.companyCash = targetCash;
  finance.event(game.g, 'otherOperating', Math.abs(delta), {
    cashEffect: delta,
    profitEffect: delta,
    sourceType: 'crisisCostTestLoss',
    sourceID: `crisis-cost-test-${game.g.week}`,
    operationID: `crisis-cost-test-${game.g.week}`,
    description: '危機固定費削減テスト用損失'
  });
  game.g.playerCrisis.lastEvaluationWeek = 0;
  playerCrisis.evaluate(game.g);
  assert.equal(game.g.playerCrisis.status, 'distressed');
}

function makeGame() {
  const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
  const department = JSON.parse(JSON.stringify(data.MASTER.departments.find(row => row.id === 'operations')));
  assert.ok(department, 'operations department required');
  game.g.departments.operations = { ...department, established: true };
  const team = workforce.createDepartmentTeam(game.g, 'operations', 2, { averageWeeklySalary: 70_000 });
  assert.ok(team, 'operations workforce team required');
  workforce.recompute(game.g);
  assert.equal(team.headcount, 2);
  assert.ok(team.utilization < 1, 'test team must be reducible');

  const projectResult = workforce.startProject(game.g, 'store-standardization');
  assert.equal(projectResult.ok, true);
  projectResult.project.status = 'active';
  projectResult.project.spentBudget = 0;
  forceCrisis(game);
  return { game, team, project: projectResult.project };
}

const stable = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
assert.equal(stable.crisisCostReductionOptions().eligible, false);
assert.equal(stable.executeCrisisCostReduction('pauseProject', 'missing'), false);
assert.equal(stable.g.playerCrisisRestructuring.costHistory.length, 0);

const { game, team, project } = makeGame();
const beforeOptions = JSON.stringify(game.g);
const options = game.crisisCostReductionOptions();
assert.equal(JSON.stringify(game.g), beforeOptions, 'cost-reduction options must be read-only after normalization');
assert.equal(options.eligible, true);
assert.equal(options.projects.length, 1);
assert.equal(options.projects[0].id, project.projectID);
assert.equal(options.projects[0].weeklySavings, project.weeklyBudget);
assert.equal(options.headcount.length, 1);
assert.equal(options.headcount[0].id, team.teamID);
assert.equal(options.headcount[0].weeklySavings, 70_000);
assert.equal(options.headcount[0].oneTimeCost, 140_000);
assert.ok(options.totalPotentialWeeklySavings >= 190_000);
for (const row of options.recommended) {
  assert.ok(Number.isFinite(row.weeklySavings));
  assert.ok(Number.isFinite(row.oneTimeCost));
}

const pauseCashBefore = game.g.companyCash;
assert.equal(game.executeCrisisCostReduction('pauseProject', project.projectID), true);
assert.equal(project.status, 'paused');
assert.equal(game.g.companyCash, pauseCashBefore, 'pausing a project must not mutate current cash');
assert.equal(game.g.playerCrisisRestructuring.costHistory.at(-1).type, 'pauseProject');
assert.equal(game.g.playerCrisisRestructuring.costHistory.at(-1).weeklySavings, project.weeklyBudget);
assert.equal(game.executeCrisisCostReduction('pauseProject', project.projectID), false, 'paused project cannot be paused twice');

const headcountCandidate = game.crisisCostReductionOptions().headcount.find(row => row.id === team.teamID);
assert.ok(headcountCandidate);
const payrollBefore = workforce.weeklyPayroll(game.g);
const headcountCashBefore = game.g.companyCash;
assert.equal(game.executeCrisisCostReduction('reduceDepartmentHeadcount', team.teamID), true);
assert.equal(team.headcount, 1);
assert.equal(team.availableHeadcount, 1);
assert.equal(game.g.departmentStaff.operations, 1);
assert.equal(headcountCashBefore - game.g.companyCash, headcountCandidate.oneTimeCost);
assert.equal(payrollBefore - workforce.weeklyPayroll(game.g), headcountCandidate.weeklySavings);
assert.equal(game.g.playerCrisisRestructuring.costHistory.at(-1).type, 'reduceDepartmentHeadcount');
assert.equal(game.g.playerCrisisRestructuring.costHistory.at(-1).targetID, team.teamID);
assert.equal(game.executeCrisisCostReduction('reduceDepartmentHeadcount', team.teamID), false, 'minimum department staffing cannot be reduced again');

const financeResult = finance.validate(game.g);
assert.equal(financeResult.ok, true, financeResult.errors.join(' / '));
const workforceResult = workforce.validate(game.g);
assert.equal(workforceResult.ok, true, workforceResult.errors.join(' / '));
assert.deepEqual(findStateIssues(game.g), []);

const restored = new engine.TycoonEngine(JSON.parse(JSON.stringify(game.g)));
assert.equal(restored.g.playerCrisisRestructuring.costHistory.length, 2);
assert.doesNotThrow(() => playerCrisisRestructuring.validate(restored.g));

restored.g.playerCrisisRestructuring.costHistory = Array.from({ length: 60 }, (_, index) => ({
  actionID: `legacy-cost-${index}`,
  operationID: `legacy-cost-operation-${index}`,
  week: index + 1,
  type: 'pauseProject',
  targetID: `project-${index}`,
  targetName: `案件${index}`,
  weeklySavings: 100_000,
  oneTimeCost: 0,
  cashBefore: -1_000_000,
  cashAfter: -1_000_000,
  status: 'completed',
  detail: 'legacy'
}));
playerCrisisRestructuring.ensure(restored.g);
assert.equal(restored.g.playerCrisisRestructuring.costHistory.length, playerCrisisRestructuring.HISTORY_LIMIT);
assert.equal(restored.g.playerCrisisRestructuring.costHistory[0].actionID, 'legacy-cost-8');
assert.doesNotThrow(() => playerCrisisRestructuring.validate(restored.g));

console.log('player crisis cost restructuring tests passed');
