'use strict';

const assert = require('node:assert/strict');
const { loadGame, findStateIssues } = require('./harness');

const { modules, engineModule: engine } = loadGame();
const { competitor, competitorStrategicAI } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);
assert.equal(competitor.__rivalryInstalled, true);
assert.equal(competitor.__strategicAIInstalled, true);
assert.equal(competitorStrategicAI.__installed, true);
assert.equal(competitorStrategicAI.SCHEMA_VERSION, 1);
assert.equal(competitorStrategicAI.MAX_MARKET_HISTORY, 104);
assert.equal(competitorStrategicAI.MAX_PLAN_HISTORY, 52);

const state = engine.createInitialState({ configured: true });
competitor.ensure(state);
assert.equal(state.saveVersion, 9);
assert.equal(state.competitorMarketStrategy.schemaVersion, 1);
assert.ok(state.competitorStates.length > 0);
for (const row of state.competitorStates) {
  assert.equal(row.marketStrategy.schemaVersion, 1);
  assert.ok(row.marketStrategy.targetShare >= 0.05 && row.marketStrategy.targetShare <= 0.60);
  assert.ok(row.marketStrategy.aggression >= 0 && row.marketStrategy.aggression <= 1);
  assert.ok(row.marketStrategy.adaptability >= 0 && row.marketStrategy.adaptability <= 1);
}

const company = state.competitorStates[0];
const presence = company.marketPresence.find(row => row.active);
assert.ok(presence);
company.strategyID = 'brand';
company.cash = 50_000_000;
company.status = 'active';
company.distressWeeks = 0;
const key = `${presence.businessID}::${presence.prefID}`;

function marketBatch(week, playerShare, competitorShare, lostDemand = 0, playerPrice = 900) {
  state.week = week;
  const potential = 1000;
  const fulfilled = potential * competitorShare;
  return {
    byMarket: {
      [key]: {
        marketKey: key,
        businessID: presence.businessID,
        prefID: presence.prefID,
        marketPotential: potential,
        ownMarketShare: playerShare,
        stores: {
          playerStore: { unitsSold: potential * playerShare, price: playerPrice }
        },
        competitorResults: {
          [presence.presenceID]: {
            presenceID: presence.presenceID,
            competitorID: company.competitorID,
            name: company.name,
            realizedMarketShare: competitorShare,
            marketShare: competitorShare,
            potentialDemand: fulfilled + lostDemand,
            fulfilledUnits: fulfilled,
            lostDemand,
            revenue: fulfilled * presence.price,
            variableCost: fulfilled * company.baseUnitCost,
            contributionMargin: fulfilled * (presence.price - company.baseUnitCost),
            storeCount: presence.storeCount
          }
        }
      }
    }
  };
}

competitor.receiveMarketResults(state, marketBatch(7, 0.28, 0.18));
competitor.receiveMarketResults(state, marketBatch(8, 0.36, 0.12, 15, 880));
const history = state.competitorMarketStrategy.marketHistoryByKey[key];
assert.equal(history.length, 2);
assert.equal(history.at(-1).playerShare, 0.36);
assert.ok(Math.abs(history.at(-1).playerShareChange - 0.08) < 1e-9);
assert.equal(history.at(-1).competitorShares[company.competitorID], 0.12);
assert.ok(history.at(-1).hhi > 0 && history.at(-1).hhi <= 1);

const signal = company.marketStrategy.signals[key];
assert.equal(signal.playerShare, 0.36);
assert.equal(signal.ownShare, 0.12);
assert.ok(signal.gapToPlayer > 0.20);
assert.ok(signal.playerShareChange > 0.07);
assert.ok(signal.ownShareChange < 0);
assert.ok(signal.lostDemandRate > 0);
const expectedUtilization = Math.min(1, 120 / Math.max(1, presence.totalCapacity));
assert.ok(Math.abs(signal.capacityUtilization - expectedUtilization) < 1e-9);

// Focus the next decision on market-share rivalry rather than capacity expansion.
signal.capacityUtilization = 0;
signal.lostDemandRate = 0;
company.marketStrategy.lastPlanWeek = 0;
company.rivalry.mode = 'neutral';
company.rivalry.pendingResponse = false;
state.competitorActions = [];
state.competitorProjects = [];
state.nextCompetitorActionSeq = 1;

const beforePlanning = clone(state);
competitorStrategicAI.planWeek(state);
assert.equal(company.marketStrategy.stance, 'attack');
const actions = state.competitorActions.filter(row => row.marketStrategy);
assert.equal(actions.length, 1);
const action = actions[0];
assert.equal(action.actionType, 'brandInvestment');
assert.equal(action.marketKey, key);
assert.equal(action.effectiveWeek, state.week + 1);
assert.ok(action.reasonCodes.includes('marketStrategy'));
assert.ok(action.reasonCodes.includes('marketShare'));
assert.ok(Number.isFinite(action.newValue));
assert.ok(Number.isFinite(action.cost));
assert.equal(company.marketStrategy.planHistory.at(-1).actionType, action.actionType);
assert.ok(state.competitorProjects.some(project => project.actionID === action.actionID));

const sameWeekCount = state.competitorActions.length;
competitorStrategicAI.planWeek(state);
assert.equal(state.competitorActions.length, sameWeekCount, 'same-week planning must remain idempotent');

const deterministicA = clone(beforePlanning);
const deterministicB = clone(beforePlanning);
competitorStrategicAI.planWeek(deterministicA);
competitorStrategicAI.planWeek(deterministicB);
const decisionA = deterministicA.competitorActions.find(row => row.marketStrategy);
const decisionB = deterministicB.competitorActions.find(row => row.marketStrategy);
assert.deepEqual(
  { stance: deterministicA.competitorStates[0].marketStrategy.stance, actionType: decisionA.actionType, newValue: decisionA.newValue, cost: decisionA.cost },
  { stance: deterministicB.competitorStates[0].marketStrategy.stance, actionType: decisionB.actionType, newValue: decisionB.newValue, cost: decisionB.cost }
);

// A rivalry response or any other pending action must win over the slower strategic layer.
const rivalryState = clone(beforePlanning);
const rivalryCompany = rivalryState.competitorStates[0];
rivalryCompany.rivalry.mode = 'price_war';
rivalryCompany.rivalry.pendingResponse = false;
rivalryCompany.marketStrategy.lastPlanWeek = 0;
rivalryState.competitorActions.push({
  actionID: 'ca-rivalry-existing', competitorID: rivalryCompany.competitorID,
  presenceID: rivalryCompany.marketPresence[0].presenceID, decisionWeek: rivalryState.week,
  effectiveWeek: rivalryState.week + 1, actionType: 'priceDecrease', status: 'pending', applied: false,
  operationID: 'rivalry-existing'
});
const rivalryCount = rivalryState.competitorActions.length;
competitorStrategicAI.planWeek(rivalryState);
assert.equal(rivalryState.competitorActions.length, rivalryCount);
assert.equal(rivalryCompany.marketStrategy.stance, 'defend');
assert.equal(rivalryCompany.marketStrategy.planHistory.at(-1).actionType, null);

for (let week = 9; week <= 125; week++) {
  competitor.receiveMarketResults(state, marketBatch(week, 0.30 + (week % 4) * 0.01, 0.15));
}
assert.equal(state.competitorMarketStrategy.marketHistoryByKey[key].length, competitorStrategicAI.MAX_MARKET_HISTORY);
assert.equal(state.competitorMarketStrategy.marketHistoryByKey[key].at(-1).week, 125);

for (let week = 126; week <= 190; week++) {
  state.week = week;
  company.marketStrategy.lastPlanWeek = week - competitorStrategicAI.PLAN_CADENCE_WEEKS;
  company.marketStrategy.signals[key].capacityUtilization = 0;
  company.marketStrategy.signals[key].lostDemandRate = 0;
  state.competitorActions = [];
  competitorStrategicAI.planWeek(state);
}
assert.ok(company.marketStrategy.planHistory.length <= competitorStrategicAI.MAX_PLAN_HISTORY);

const serializedState = clone(state);
assert.deepEqual(findStateIssues(serializedState), []);
const beforeValidation = JSON.stringify(state);
assert.doesNotThrow(() => competitor.validate(state));
assert.equal(JSON.stringify(state), beforeValidation, 'validation must remain pure');
assert.equal(state.saveVersion, 9);

console.log('competitor strategic AI tests passed');
