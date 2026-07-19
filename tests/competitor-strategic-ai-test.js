'use strict';

const assert = require('node:assert/strict');
const { loadGame, findStateIssues } = require('./harness');

const { modules, engineModule: engine } = loadGame();
const { competitor, competitorStrategicAI } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);
assert.equal(competitor.__strategicAIInstalled, true);
assert.equal(competitorStrategicAI.__installed, true);
assert.equal(competitorStrategicAI.SCHEMA_VERSION, 1);
assert.equal(competitorStrategicAI.MAX_MARKET_HISTORY, 104);
assert.equal(competitorStrategicAI.MAX_PLAN_HISTORY, 52);

const state = engine.createInitialState({ configured: true });
competitor.ensure(state);
assert.equal(state.saveVersion, 9);
assert.ok(state.competitorStates.length > 0);
assert.equal(state.competitorStrategicAI.schemaVersion, 1);
for (const company of state.competitorStates) {
  assert.equal(company.strategicAI.schemaVersion, 1);
  assert.ok(company.strategicAI.marketShareGoal >= 0.05 && company.strategicAI.marketShareGoal <= 0.60);
  assert.ok(company.strategicAI.aggression >= 0 && company.strategicAI.aggression <= 1);
  assert.ok(company.strategicAI.adaptability >= 0 && company.strategicAI.adaptability <= 1);
}

const company = state.competitorStates[0];
const presence = company.marketPresence.find(row => row.active);
assert.ok(presence);
const key = `${presence.businessID}::${presence.prefID}`;

function marketBatch(week, playerShare, competitorShare, playerPrice = 900) {
  state.week = week;
  const potential = 1000;
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
            potentialDemand: potential * competitorShare,
            fulfilledUnits: potential * competitorShare,
            lostDemand: 0,
            revenue: potential * competitorShare * presence.price,
            variableCost: potential * competitorShare * company.baseUnitCost,
            contributionMargin: potential * competitorShare * (presence.price - company.baseUnitCost),
            storeCount: presence.storeCount
          }
        }
      }
    }
  };
}

competitor.receiveMarketResults(state, marketBatch(7, 0.28, 0.18));
competitor.receiveMarketResults(state, marketBatch(8, 0.36, 0.12, 880));
const history = state.competitorStrategicAI.marketHistoryByKey[key];
assert.equal(history.length, 2);
assert.equal(history.at(-1).playerShare, 0.36);
assert.ok(Math.abs(history.at(-1).playerShareChange - 0.08) < 1e-9);
assert.equal(history.at(-1).competitorShares[company.competitorID], 0.12);
assert.ok(history.at(-1).hhi > 0 && history.at(-1).hhi <= 1);

const signal = company.strategicAI.marketSignals[key];
assert.equal(signal.playerShare, 0.36);
assert.equal(signal.ownShare, 0.12);
assert.ok(signal.gapToPlayer > 0.20);
assert.ok(signal.playerShareChange > 0.07);
assert.ok(signal.ownShareChange < 0);

// Keep this focused test on market-share reaction rather than capacity pressure.
signal.capacityUtilization = 0;
signal.lostDemandRate = 0;
company.cash = 50_000_000;
company.status = 'active';
company.distressWeeks = 0;
company.strategicAI.lastPlanWeek = 0;
company.decisionCooldownWeeks = 0;
state.competitorActions = [];
state.nextCompetitorActionSeq = 1;

const beforePlanning = clone(state);
competitorStrategicAI.planWeek(state);
assert.ok(['attack', 'defend'].includes(company.strategicAI.stance));
const strategicActions = state.competitorActions.filter(action => action.strategicAI);
assert.equal(strategicActions.length, 1);
const action = strategicActions[0];
assert.equal(action.effectiveWeek, state.week + 1);
assert.equal(action.marketKey, key);
assert.ok(action.reasonCodes.includes('strategicAI'));
assert.ok(action.reasonCodes.includes('marketShare'));
assert.ok(['priceDecrease', 'brandInvestment', 'qualityInvestment', 'capacityExpansion'].includes(action.actionType));
assert.ok(Number.isFinite(action.newValue));
assert.ok(Number.isFinite(action.cost));
assert.equal(company.strategicAI.planHistory.at(-1).actionType, action.actionType);

const repeatedCount = state.competitorActions.length;
competitorStrategicAI.planWeek(state);
assert.equal(state.competitorActions.length, repeatedCount, 'same-week planning must be idempotent');

const deterministicA = clone(beforePlanning);
const deterministicB = clone(beforePlanning);
competitorStrategicAI.planWeek(deterministicA);
competitorStrategicAI.planWeek(deterministicB);
const decisionA = deterministicA.competitorActions.find(row => row.strategicAI);
const decisionB = deterministicB.competitorActions.find(row => row.strategicAI);
assert.deepEqual(
  { stance: deterministicA.competitorStates[0].strategicAI.stance, actionType: decisionA.actionType, newValue: decisionA.newValue, cost: decisionA.cost },
  { stance: deterministicB.competitorStates[0].strategicAI.stance, actionType: decisionB.actionType, newValue: decisionB.newValue, cost: decisionB.cost }
);

for (let week = 9; week <= 125; week++) {
  competitor.receiveMarketResults(state, marketBatch(week, 0.30 + (week % 4) * 0.01, 0.15));
}
assert.equal(state.competitorStrategicAI.marketHistoryByKey[key].length, competitorStrategicAI.MAX_MARKET_HISTORY);
assert.equal(state.competitorStrategicAI.marketHistoryByKey[key].at(-1).week, 125);

for (let week = 126; week <= 190; week++) {
  state.week = week;
  const ai = company.strategicAI;
  ai.lastPlanWeek = week - competitorStrategicAI.PLAN_CADENCE_WEEKS;
  ai.marketSignals[key].capacityUtilization = 0;
  ai.marketSignals[key].lostDemandRate = 0;
  state.competitorActions = [];
  competitorStrategicAI.planWeek(state);
}
assert.ok(company.strategicAI.planHistory.length <= competitorStrategicAI.MAX_PLAN_HISTORY);

// The live market aggregator intentionally shares immutable result objects across indexes.
// Validate the exact JSON-serializable save shape to avoid treating shared references as cycles.
const serializedState = clone(state);
assert.deepEqual(findStateIssues(serializedState), []);
const beforeValidation = JSON.stringify(state);
assert.doesNotThrow(() => competitor.validate(state));
assert.equal(JSON.stringify(state), beforeValidation, 'validation must remain pure');
assert.equal(state.saveVersion, 9);

console.log('competitor strategic AI tests passed');
