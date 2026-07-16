const assert = require('node:assert');
const { loadGame } = require('./harness');

let seed = 0x6a5b0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { ctx, modules } = loadGame({ random });
const { engine, playerCrisis, playerTurnaroundPlanUI } = modules;
assert.ok(playerTurnaroundPlanUI?.__installed);
for (const name of ['renderSection','standalone','enhance','bindEngine','handleClick','startPreview','latestHistory']) assert.equal(typeof playerTurnaroundPlanUI[name], 'function');

const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
game.g.week = 12;
game.g.companyCash = 1_000_000;
game.g.companyDebt = 2_000_000;
game.g.playerCrisis.lastEvaluationWeek = 0;
playerCrisis.evaluate(game.g);
assert.equal(game.g.playerCrisis.status, 'watch');
playerTurnaroundPlanUI.bindEngine(game);

const beforeRender = JSON.stringify(game.g);
const initial = playerTurnaroundPlanUI.renderSection(game);
assert.equal(JSON.stringify(game.g), beforeRender, 'inactive rendering must remain read-only');
assert.ok(initial.includes('再建計画'));
assert.ok(initial.includes('8週間の再建計画を開始'));
assert.ok(initial.includes('次回の現金目標'));
assert.ok(initial.includes('次回の負債目標'));
assert.ok(!/(NaN|Infinity|undefined|\[object Object\])/.test(initial));

const startEvent = { target: { closest: () => ({ disabled: false, dataset: { playerTurnaroundAction: 'start' } }) }, preventDefault(){}, stopPropagation(){} };
let confirmation = '';
ctx.confirm = message => { confirmation = String(message); return false; };
assert.equal(playerTurnaroundPlanUI.handleClick(startEvent), false);
assert.equal(JSON.stringify(game.g), beforeRender, 'cancelled start confirmation must be state-neutral');
assert.ok(confirmation.includes('現金目標'));
assert.ok(confirmation.includes('負債目標'));
assert.ok(confirmation.includes('自動で資産売却や借入を実行しません'));

ctx.confirm = () => true;
assert.equal(playerTurnaroundPlanUI.handleClick(startEvent), true);
assert.equal(game.g.playerTurnaroundPlan.status, 'active');
const active = playerTurnaroundPlanUI.renderSection(game);
assert.ok(active.includes('残り8週'));
assert.ok(active.includes('現金改善'));
assert.ok(active.includes('債務削減'));
assert.ok(active.includes('総合進捗'));
assert.ok(active.includes('data-player-turnaround-action="cancel"'));
assert.ok(!/(NaN|Infinity|undefined|\[object Object\])/.test(active));

const plan = game.g.playerTurnaroundPlan;
game.g.companyCash = (plan.startingCash + plan.targetCash) / 2;
game.g.companyDebt = (plan.startingDebt + plan.targetDebt) / 2;
const live = playerTurnaroundPlanUI.renderSection(game);
assert.ok(live.includes('現金改善 50%'));
assert.ok(live.includes('債務削減 50%'));
assert.ok(live.includes('総合進捗 50%'));
assert.equal(plan.progress, 0, 'rendering live progress must not mutate saved progress');

game.g.playerCrisis.status = 'stable';
const stableActive = playerTurnaroundPlanUI.renderSection(game);
assert.ok(stableActive.includes('再建計画'));
assert.ok(playerTurnaroundPlanUI.standalone(stableActive).includes('data-player-turnaround-standalone="1"'));
assert.ok(playerTurnaroundPlanUI.standalone(stableActive).includes('危機状態が解除された後も'));

const cancelEvent = { target: { closest: () => ({ disabled: false, dataset: { playerTurnaroundAction: 'cancel' } }) }, preventDefault(){}, stopPropagation(){} };
const beforeCancel = JSON.stringify(game.g);
ctx.confirm = () => false;
assert.equal(playerTurnaroundPlanUI.handleClick(cancelEvent), false);
assert.equal(JSON.stringify(game.g), beforeCancel, 'cancelled plan cancellation must be state-neutral');
ctx.confirm = () => true;
assert.equal(playerTurnaroundPlanUI.handleClick(cancelEvent), true);
assert.equal(game.g.playerTurnaroundPlan.status, 'cancelled');
assert.equal(game.g.playerTurnaroundPlan.history.at(-1).status, 'cancelled');
const result = playerTurnaroundPlanUI.renderSection(game);
assert.ok(result.includes('中止'));
assert.ok(result.includes('終了時現金'));
assert.ok(result.includes('終了時負債'));
assert.ok(result.includes('disabled'), 'stable company must not immediately start another plan');

const afterCancel = JSON.stringify(game.g);
assert.equal(playerTurnaroundPlanUI.handleClick(cancelEvent), false, 'stale cancel action must be rejected');
assert.equal(JSON.stringify(game.g), afterCancel);
console.log('player turnaround plan UI tests passed');
