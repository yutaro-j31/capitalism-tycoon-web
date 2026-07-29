'use strict';

const assert = require('node:assert/strict');
const { loadGame, findStateIssues } = require('./harness');

const { modules, engineModule: engine } = loadGame();
const { competitor } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function buildState() {
  const state = engine.createInitialState({ configured: true });
  competitor.ensure(state);
  state.week = 8;
  state.competitorActions = [];
  state.competitorProjects = [];
  state.nextCompetitorActionSeq = 1;

  const company = state.competitorStates[0];
  const presence = company.marketPresence.find(row => row.active);
  assert.ok(presence);

  const key = `${presence.businessID}::${presence.prefID}`;
  company.active = true;
  company.status = 'active';
  company.distressWeeks = 0;
  company.cash = 1;
  company.strategyID = 'brand';
  company.rivalry.mode = 'neutral';
  company.rivalry.pendingResponse = false;
  company.marketStrategy.lastPlanWeek = 0;
  company.marketStrategy.signals[key] = {
    week: state.week,
    marketKey: key,
    businessID: presence.businessID,
    prefID: presence.prefID,
    ownShare: 0.10,
    ownShareChange: -0.04,
    playerShare: 0.40,
    playerShareChange: 0.05,
    gapToPlayer: 0.30,
    leaderShare: 0.40,
    hhi: 0.20,
    marketPotential: 10_000,
    playerAveragePrice: Math.max(1, Number(presence.price) || 900),
    lostDemandRate: 0,
    capacityUtilization: 0,
    contributionMarginRate: 0.20
  };

  return state;
}

const stateA = buildState();
const stateB = clone(stateA);

competitor.processWeek(stateA);
competitor.processWeek(stateB);

const actionA = stateA.competitorActions.find(row => row.marketStrategy);
const actionB = stateB.competitorActions.find(row => row.marketStrategy);
assert.ok(actionA, 'processWeek must queue a strategic fallback action');
assert.equal(actionA.actionType, 'priceDecrease');
assert.equal(actionA.cost, 0);
assert.match(actionA.operationID, /-priceDecrease$/);
assert.ok(actionA.newValue > 0 && Number.isFinite(actionA.newValue));
assert.ok(actionA.newValue <= actionA.previousValue);
assert.deepEqual(actionA, actionB, 'processWeek fallback must remain deterministic');
assert.equal(stateA.competitorStates[0].cash, 1, 'zero-cost fallback must not spend competitor cash');
assert.equal(stateA.saveVersion, 9);
assert.deepEqual(findStateIssues(stateA), []);

const actionCount = stateA.competitorActions.length;
competitor.processWeek(stateA);
assert.equal(stateA.competitorActions.length, actionCount, 'same-week processWeek rerun must not duplicate fallback actions');

const reloaded = JSON.parse(JSON.stringify(buildState()));
competitor.processWeek(reloaded);
assert.deepEqual(
  reloaded.competitorActions.find(row => row.marketStrategy),
  actionB,
  'JSON reload must preserve the processWeek fallback decision'
);

console.log('competitor processWeek fallback tests passed');
