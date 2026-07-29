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

assert.deepEqual(stateA.competitorActions, stateB.competitorActions, 'processWeek actions must remain deterministic');
assert.deepEqual(stateA.competitorProjects, stateB.competitorProjects, 'processWeek projects must remain deterministic');
assert.equal(stateA.saveVersion, 9);
assert.deepEqual(findStateIssues(stateA), []);

const companyID = stateA.competitorStates[0].competitorID;
const pendingForCompany = stateA.competitorActions.filter(row =>
  row?.competitorID === companyID && row.status === 'pending' && !row.applied
);
assert.ok(pendingForCompany.length > 0, 'the real processWeek path must leave an actionable pending decision');

const strategicAction = pendingForCompany.find(row => row.marketStrategy);
if (strategicAction) {
  assert.equal(strategicAction.actionType, 'priceDecrease');
  assert.equal(strategicAction.cost, 0);
  assert.match(strategicAction.operationID, /-priceDecrease$/);
  assert.ok(strategicAction.newValue > 0 && Number.isFinite(strategicAction.newValue));
  assert.ok(strategicAction.newValue <= strategicAction.previousValue);
} else {
  assert.ok(
    pendingForCompany.some(row => !row.marketStrategy),
    'an existing core/rivalry pending action must own the decision slot when the strategic fallback yields'
  );
  assert.equal(
    stateA.competitorStates[0].marketStrategy.planHistory.at(-1).actionType,
    null,
    'strategic planning must record that it yielded instead of duplicating the pending action'
  );
}

const reloadedA = JSON.parse(JSON.stringify(buildState()));
const reloadedB = JSON.parse(JSON.stringify(buildState()));
competitor.processWeek(reloadedA);
competitor.processWeek(reloadedB);
assert.deepEqual(reloadedA.competitorActions, reloadedB.competitorActions, 'JSON reload must preserve processWeek arbitration');
assert.deepEqual(findStateIssues(reloadedA), []);

console.log('competitor processWeek arbitration tests passed');
