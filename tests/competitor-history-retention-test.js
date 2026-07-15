const assert = require('node:assert');
const { loadGame } = require('./harness');

const ctx = loadGame();
const { engine, competitor } = ctx.modules;
const state = engine.createInitialState({ configured: true });
competitor.ensure(state);

assert.ok(state.competitorStates.length > 0, 'expected migrated competitor states');
const target = state.competitorStates[0];
const presence = target.marketPresence[0];

state.competitorActions = Array.from({ length: 220 }, (_, index) => ({
  actionID: `history-${index + 1}`,
  competitorID: target.competitorID,
  presenceID: presence.presenceID,
  decisionWeek: index + 1,
  effectiveWeek: state.week + 1000 + index,
  actionType: index % 2 === 0 ? 'priceIncrease' : 'priceDecrease',
  targetBusinessID: 'ramen',
  targetPrefID: presence.prefID,
  previousValue: 900 + index,
  newValue: 901 + index,
  cost: 0,
  reasonCodes: ['retention-test'],
  reasonText: 'history retention regression gate',
  status: 'pending',
  applied: false,
  appliedWeek: null,
  operationID: `history-op-${index + 1}`
}));

target.actionHistory = state.competitorActions.slice(-20).map(action => JSON.parse(JSON.stringify(action)));
target.decisionCooldownWeeks = 1000;

competitor.processWeek(state);

assert.equal(state.competitorActions.length, 160, 'global competitor action history must stay bounded');
assert.equal(state.competitorActions[0].actionID, 'history-61', 'retention must keep the newest actions');
assert.equal(state.competitorActions.at(-1).actionID, 'history-220');
assert.ok(target.actionHistory.length <= 20, 'per-competitor history must stay bounded');
assert.doesNotThrow(() => competitor.validate(state));

const serialized = JSON.stringify(state);
assert.ok(serialized.length > 0);
assert.ok(!serialized.includes('NaN'));
assert.ok(!serialized.includes('Infinity'));

const restored = JSON.parse(serialized);
assert.equal(restored.competitorActions.length, 160);
assert.equal(restored.competitorStates[0].actionHistory.length, target.actionHistory.length);
assert.doesNotThrow(() => competitor.validate(restored));

console.log('competitor history retention tests passed');
