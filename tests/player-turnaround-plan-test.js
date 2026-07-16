const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');
const { modules } = loadGame();
const { engine, playerCrisis, playerTurnaroundPlan } = modules;
assert.ok(playerTurnaroundPlan?.__installed);
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);
assert.equal(playerTurnaroundPlan.TERM_WEEKS, 8);

const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
game.g.companyCash = 1_000_000;
game.g.playerCrisis.lastEvaluationWeek = 0;
playerCrisis.evaluate(game.g);
assert.equal(game.g.playerCrisis.status, 'watch');
assert.equal(game.startTurnaroundPlan(), true);
const started = game.turnaroundPlanSnapshot();
assert.equal(started.status, 'active');
assert.equal(started.deadlineWeek, started.startedWeek + 8);
assert.equal(game.startTurnaroundPlan(), false);
assert.ok(started.targetCash >= 3_000_000);
assert.ok(started.targetDebt <= game.g.playerTurnaroundPlan.startingDebt);

const before = JSON.stringify(game.g);
const snap = game.turnaroundPlanSnapshot();
assert.equal(JSON.stringify(game.g), before, 'snapshot must remain read-only');
assert.ok(snap.progress >= 0 && snap.progress <= 1);

game.g.companyCash = game.g.playerTurnaroundPlan.targetCash;
game.g.companyDebt = game.g.playerTurnaroundPlan.targetDebt;
game.g.week += 1;
playerTurnaroundPlan.evaluate(game.g);
assert.equal(game.g.playerTurnaroundPlan.status, 'completed');
assert.equal(game.g.playerTurnaroundPlan.history.at(-1).status, 'completed');
assert.equal(playerTurnaroundPlan.validate(game.g), true);

const failed = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
failed.g.companyCash = 1_000_000;
failed.g.playerCrisis.lastEvaluationWeek = 0;
playerCrisis.evaluate(failed.g);
assert.equal(failed.startTurnaroundPlan(), true);
failed.g.week = failed.g.playerTurnaroundPlan.deadlineWeek;
playerTurnaroundPlan.evaluate(failed.g);
assert.equal(failed.g.playerTurnaroundPlan.status, 'failed');
assert.equal(failed.g.playerTurnaroundPlan.history.at(-1).status, 'failed');

const cancelled = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
cancelled.g.companyCash = 1_000_000;
cancelled.g.playerCrisis.lastEvaluationWeek = 0;
playerCrisis.evaluate(cancelled.g);
assert.equal(cancelled.startTurnaroundPlan(), true);
assert.equal(cancelled.cancelTurnaroundPlan(), true);
assert.equal(cancelled.g.playerTurnaroundPlan.status, 'cancelled');
assert.equal(cancelled.cancelTurnaroundPlan(), false);

const restored = new engine.TycoonEngine(JSON.parse(JSON.stringify(game.g)));
assert.equal(restored.g.playerTurnaroundPlan.status, 'completed');
assert.equal(restored.g.playerTurnaroundPlan.history.length, 1);
assert.deepEqual(findStateIssues(restored.g).filter(x => !x.startsWith('g.finance.lastStatements.ratios.')), []);
console.log('player turnaround plan tests passed');
