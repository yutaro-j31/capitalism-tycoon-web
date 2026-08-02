const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a100001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { ctx, modules } = loadGame({ random, isolatedLegacyIndex:true });
const { engine, playerCrisis } = modules;

assert.ok(playerCrisis, 'player crisis module must be registered');
assert.equal(playerCrisis.__installed, true);
assert.equal(engine.TycoonEngine.prototype.__playerCrisisInstalled, true);
assert.equal(engine.SAVE_VERSION, 9, 'save version must remain 9');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1', 'SAVE_KEY must remain unchanged');
assert.deepEqual([...playerCrisis.STATUSES], ['stable','watch','distressed','turnaround','recovered','insolvent']);
assert.equal(playerCrisis.graceForDifficulty('easy'), 4);
assert.equal(playerCrisis.graceForDifficulty('normal'), 3);
assert.equal(playerCrisis.graceForDifficulty('hard'), 2);

const legacy = engine.createInitialState({ configured: true });
delete legacy.playerCrisis;
const migratedGame = new engine.TycoonEngine(legacy);
assert.ok(migratedGame.g.playerCrisis, 'old save must receive additive crisis defaults');
assert.equal(migratedGame.g.playerCrisis.status, 'stable');
assert.equal(migratedGame.g.saveVersion, 9);

const watchState = engine.createInitialState({ configured: true });
watchState.week = 2;
watchState.companyCash = 2_000_000;
const watch = playerCrisis.evaluate(watchState);
assert.equal(watch.status, 'watch');
assert.equal(watch.reserveThreshold, 3_000_000);
assert.equal(watchState.gameOver, false);

const direct = engine.createInitialState({ configured: true });
direct.week = 2;
direct.companyCash = -1;
const first = playerCrisis.evaluate(direct);
assert.equal(first.status, 'distressed');
assert.equal(first.negativeCashWeeks, 1);
assert.equal(first.graceWeeksRemaining, 3);
assert.equal(direct.gameOver, false, 'first negative week must not game over');
const idempotentBefore = JSON.stringify(direct);
const firstAgain = playerCrisis.evaluate(direct);
assert.deepEqual(firstAgain, first, 'same-week evaluation must be deterministic and idempotent');
assert.equal(JSON.stringify(direct), idempotentBefore, 'same-week evaluation must not mutate state');

direct.week += 1;
playerCrisis.evaluate(direct);
assert.equal(direct.playerCrisis.graceWeeksRemaining, 2);
assert.equal(direct.gameOver, false);
direct.week += 1;
playerCrisis.evaluate(direct);
assert.equal(direct.playerCrisis.graceWeeksRemaining, 1);
assert.equal(direct.gameOver, false);
direct.week += 1;
playerCrisis.evaluate(direct);
assert.equal(direct.playerCrisis.status, 'insolvent');
assert.equal(direct.playerCrisis.graceWeeksRemaining, 0);
assert.equal(direct.gameOver, true);
assert.equal(direct.gameOverReason, playerCrisis.INSOLVENCY_REASON);
playerCrisis.validate(direct);

const recovery = engine.createInitialState({ configured: true });
recovery.week = 2;
recovery.companyCash = -500_000;
playerCrisis.evaluate(recovery);
recovery.week += 1;
recovery.companyCash = 500_000;
playerCrisis.evaluate(recovery);
assert.equal(recovery.playerCrisis.status, 'turnaround');
assert.equal(recovery.playerCrisis.recoveryWeeks, 1);
recovery.week += 1;
recovery.companyCash = 4_000_000;
playerCrisis.evaluate(recovery);
assert.equal(recovery.playerCrisis.status, 'recovered');
assert.equal(recovery.playerCrisis.recoveryWeeks, 2);
assert.equal(recovery.playerCrisis.graceWeeksRemaining, 0);
recovery.week += 1;
playerCrisis.evaluate(recovery);
assert.equal(recovery.playerCrisis.status, 'stable');
assert.equal(recovery.playerCrisis.recoveryWeeks, 0);
assert.equal(recovery.consecutiveNegativeCashWeeks, 0);

const deterministicA = engine.createInitialState({ configured: true });
deterministicA.week = 9;
deterministicA.companyCash = -2_500_000;
const deterministicB = JSON.parse(JSON.stringify(deterministicA));
assert.deepEqual(playerCrisis.evaluate(deterministicA), playerCrisis.evaluate(deterministicB));
assert.deepEqual(deterministicA.playerCrisis, deterministicB.playerCrisis, 'crisis lifecycle must not use runtime randomness');

const bounded = engine.createInitialState({ configured: true });
bounded.playerCrisis = {
  status: 'stable',
  history: Array.from({ length: 90 }, (_, index) => ({
    week: index + 1,
    from: index % 2 ? 'watch' : 'stable',
    to: index % 2 ? 'stable' : 'watch',
    reason: `history-${index}`,
    operationID: `history-${index}`
  }))
};
playerCrisis.ensure(bounded);
assert.equal(bounded.playerCrisis.history.length, playerCrisis.HISTORY_LIMIT, 'crisis history must remain bounded');
const validateBefore = JSON.stringify(bounded);
playerCrisis.validate(bounded);
assert.equal(JSON.stringify(bounded), validateBefore, 'validation must be read-only');

const longState = engine.createInitialState({ configured: true });
playerCrisis.ensure(longState);
for (let index = 0; index < 1200; index += 1) {
  longState.week += 1;
  longState.companyCash = index % 4 === 0 ? -250_000 : 5_000_000;
  playerCrisis.evaluate(longState);
  assert.equal(longState.gameOver, false, `short recurring shocks must remain recoverable at iteration ${index}`);
}
assert.ok(longState.playerCrisis.history.length <= playerCrisis.HISTORY_LIMIT);
assert.deepEqual(findStateIssues(longState), []);

const integrated = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
integrated.g.companyCash = -100_000_000;
integrated.g.skipWeeklyValidation = true;
let weekEvents = 0;
integrated.addEventListener('week', () => { weekEvents += 1; });
for (let index = 1; index <= 4; index += 1) {
  const beforeEvents = weekEvents;
  assert.equal(integrated.advanceWeek(false), true);
  assert.equal(weekEvents, beforeEvents + 1, 'each advance must emit exactly one final week event');
  assert.equal(integrated.g.playerCrisis.lastCash, integrated.g.companyCash, 'crisis must evaluate final post-adjustment cash');
  if (index < 4) {
    assert.equal(integrated.g.gameOver, false, `legacy two-week game over must be suppressed at negative week ${index}`);
    assert.notEqual(integrated.g.gameOverReason, playerCrisis.LEGACY_GAME_OVER_REASON);
  }
}
assert.equal(integrated.g.gameOver, true);
assert.equal(integrated.g.playerCrisis.status, 'insolvent');
assert.equal(integrated.g.gameOverReason, playerCrisis.INSOLVENCY_REASON);
assert.equal(integrated.g.lastWeeklySummary.crisis.status, 'insolvent');
const insolvencyIssues = findStateIssues(integrated.g);
const expectedDistressRatios = new Set([
  'g.finance.lastStatements.ratios.equityRatio: suspicious ratio -0.08',
  'g.finance.lastStatements.ratios.netDeRatio: suspicious ratio 12.5'
]);
assert.ok(insolvencyIssues.every(issue => expectedDistressRatios.has(issue)), `unexpected insolvency state issue: ${insolvencyIssues.join(' / ')}`);
for (const issue of expectedDistressRatios) assert.ok(insolvencyIssues.includes(issue), `expected finite distress ratio was not observed: ${issue}`);

const saveGame = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
saveGame.g.week = 7;
saveGame.g.companyCash = 2_000_000;
playerCrisis.evaluate(saveGame.g);
assert.equal(saveGame.save(), true);
const raw = JSON.parse(ctx.__localStorageData.get(engine.SAVE_KEY));
assert.equal(raw.saveVersion, 9);
assert.ok(raw.playerCrisis);
assert.ok(JSON.stringify(raw).length < 5_000_000, 'crisis metadata must not make the save unbounded');
const restored = new engine.TycoonEngine(raw);
assert.deepEqual(restored.g.playerCrisis, raw.playerCrisis, 'crisis state must survive save round-trip');
assert.deepEqual(findStateIssues(restored.g), []);

console.log('player crisis lifecycle tests passed');
