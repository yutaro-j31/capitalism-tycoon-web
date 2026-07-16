const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a3b0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { ctx, modules } = loadGame({ random });
const { data, engine, finance, workforce, playerCrisis, playerCrisisUI, playerCrisisRestructuring } = modules;

assert.ok(playerCrisisUI?.__installed, 'player crisis UI must be registered');
assert.ok(playerCrisisRestructuring?.__installed, 'player crisis restructuring must be registered');
assert.equal(typeof playerCrisisUI.findCostReductionCandidate, 'function');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function forceCrisis(game, targetCash = -1_000_000) {
  game.g.week = 4;
  const delta = targetCash - game.g.companyCash;
  game.g.companyCash = targetCash;
  finance.event(game.g, 'otherOperating', Math.abs(delta), {
    cashEffect: delta,
    profitEffect: delta,
    sourceType: 'crisisCostUITestLoss',
    sourceID: `crisis-cost-ui-test-${game.g.week}`,
    operationID: `crisis-cost-ui-test-${game.g.week}`,
    description: '危機固定費削減UIテスト用損失'
  });
  game.g.playerCrisis.lastEvaluationWeek = 0;
  playerCrisis.evaluate(game.g);
  assert.equal(game.g.playerCrisis.status, 'distressed');
}

const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
const department = JSON.parse(JSON.stringify(data.MASTER.departments.find(row => row.id === 'operations')));
assert.ok(department, 'operations department required');
game.g.departments.operations = { ...department, established: true };
const team = workforce.createDepartmentTeam(game.g, 'operations', 2, { averageWeeklySalary: 70_000 });
assert.ok(team, 'operations workforce team required');
workforce.recompute(game.g);
assert.ok(team.utilization < 1, 'test team must be reducible');

const projectResult = workforce.startProject(game.g, 'store-standardization');
assert.equal(projectResult.ok, true);
const project = projectResult.project;
project.name = '<img src=x onerror=alert(1)>固定費案件';
project.status = 'active';
project.spentBudget = 0;
forceCrisis(game);

const beforeRender = JSON.stringify(game.g);
const html = playerCrisisUI.render(game.g, game);
assert.equal(JSON.stringify(game.g), beforeRender, 'cost-reduction UI render must be read-only after normalization');
assert.ok(html.includes('固定費削減候補'));
assert.ok(html.includes('最大週次削減'));
assert.ok(html.includes('data-player-crisis-action="reduce-cost"'));
assert.ok(html.includes(`data-cost-action-id="${project.projectID}"`));
assert.ok(html.includes('data-cost-action-type="pauseProject"'));
assert.ok(html.includes(`data-cost-action-id="${team.teamID}"`));
assert.ok(html.includes('data-cost-action-type="reduceDepartmentHeadcount"'));
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;固定費案件'));
assert.ok(!html.includes('<img src=x'), 'candidate names must be escaped');
for (const forbidden of ['NaN', 'Infinity', 'undefined', '[object Object]']) assert.ok(!html.includes(forbidden), `render output contains ${forbidden}`);

playerCrisisUI.bindEngine(game);
const projectCandidate = playerCrisisUI.findCostReductionCandidate('pauseProject', project.projectID);
assert.ok(projectCandidate);
assert.equal(projectCandidate.weeklySavings, project.weeklyBudget);

function costEvent(type, id) {
  return {
    target: {
      closest: selector => selector === '[data-player-crisis-action]' ? {
        dataset: {
          playerCrisisAction: 'reduce-cost',
          costActionType: type,
          costActionId: id
        }
      } : null
    },
    preventDefault(){ this.prevented = true; },
    stopPropagation(){ this.stopped = true; }
  };
}

const projectEvent = costEvent('pauseProject', project.projectID);
let confirmationText = '';
ctx.confirm = message => { confirmationText = String(message); return false; };
const beforeCancel = JSON.stringify(game.g);
assert.equal(playerCrisisUI.handleClick(projectEvent), false, 'cancelled project pause must not execute');
assert.equal(JSON.stringify(game.g), beforeCancel);
assert.ok(confirmationText.includes('週次削減額'));
assert.ok(confirmationText.includes('一時費用'));
assert.ok(confirmationText.includes('後で再開できます'));
assert.equal(projectEvent.prevented, true);
assert.equal(projectEvent.stopped, true);

ctx.confirm = message => { confirmationText = String(message); return true; };
const pauseCashBefore = game.g.companyCash;
assert.equal(playerCrisisUI.handleClick(projectEvent), true);
assert.equal(project.status, 'paused');
assert.equal(game.g.companyCash, pauseCashBefore);
assert.equal(game.g.playerCrisisRestructuring.costHistory.at(-1).type, 'pauseProject');
assert.equal(playerCrisisUI.findCostReductionCandidate('pauseProject', project.projectID), null, 'paused project must disappear');

const headcountCandidate = playerCrisisUI.findCostReductionCandidate('reduceDepartmentHeadcount', team.teamID);
assert.ok(headcountCandidate);
const headcountEvent = costEvent('reduceDepartmentHeadcount', team.teamID);
const payrollBefore = workforce.weeklyPayroll(game.g);
const cashBefore = game.g.companyCash;
assert.equal(playerCrisisUI.handleClick(headcountEvent), true);
assert.equal(team.headcount, 1);
assert.equal(game.g.departmentStaff.operations, 1);
assert.equal(cashBefore - game.g.companyCash, headcountCandidate.oneTimeCost);
assert.equal(payrollBefore - workforce.weeklyPayroll(game.g), headcountCandidate.weeklySavings);
assert.equal(game.g.playerCrisisRestructuring.costHistory.at(-1).type, 'reduceDepartmentHeadcount');
assert.ok(confirmationText.includes('元に戻せず'));
assert.equal(playerCrisisUI.findCostReductionCandidate('reduceDepartmentHeadcount', team.teamID), null, 'minimum staffing target must disappear');

const missingEvent = costEvent('pauseProject', 'missing');
assert.equal(playerCrisisUI.handleClick(missingEvent), false, 'missing candidate must not execute');
assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join(' / '));
assert.equal(workforce.validate(game.g).ok, true, workforce.validate(game.g).errors.join(' / '));
assert.deepEqual(findStateIssues(game.g), []);

const stable = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
assert.equal(playerCrisisUI.render(stable.g, stable), '', 'stable company must not expose cost-reduction UI');

console.log('player crisis cost restructuring UI tests passed');
