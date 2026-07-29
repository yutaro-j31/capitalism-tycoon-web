'use strict';

const assert = require('node:assert/strict');
const { loadGame, findStateIssues } = require('./harness');

const { modules, engineModule: engine } = loadGame();
const { competitor, competitorStrategicAI } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function buildPriceDecisionState(price) {
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
  company.strategyID = 'low_price';
  company.baseUnitCost = 1_000;
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
    playerAveragePrice: 900,
    lostDemandRate: 0,
    capacityUtilization: 0,
    contributionMarginRate: 0.20
  };
  presence.price = price;

  return { state, company, presence };
}

function financialSnapshot(state) {
  return JSON.stringify({
    competitorCash: state.competitorStates[0].cash,
    companyCash: state.companyCash,
    personalCash: state.personalCash,
    cumulativeProfit: state.cumulativeProfit,
    buildings: state.buildings,
    companyStocks: state.companyStocks,
    personalStocks: state.personalStocks,
    luxuryAssets: state.luxuryAssets,
    properties: state.properties,
    subsidiaries: state.subsidiaries,
    finance: state.finance,
    weeklyProfitHistory: state.weeklyProfitHistory
  });
}

const belowFloor = buildPriceDecisionState(500);
const beforeBelowFloor = financialSnapshot(belowFloor.state);
competitorStrategicAI.planWeek(belowFloor.state);
const belowFloorAction = belowFloor.state.competitorActions.find(row => row.marketStrategy);
assert.ok(belowFloorAction);
assert.equal(belowFloorAction.actionType, 'priceDecrease');
assert.equal(belowFloorAction.previousValue, 500);
assert.ok(belowFloorAction.newValue <= belowFloorAction.previousValue);
assert.ok(belowFloorAction.newValue > 0);
assert.ok(Number.isFinite(belowFloorAction.newValue));
assert.equal(belowFloorAction.cost, 0);
assert.ok(belowFloorAction.operationID.endsWith(`-${belowFloorAction.actionType}`));
assert.equal(financialSnapshot(belowFloor.state), beforeBelowFloor);
assert.equal(belowFloor.state.saveVersion, 9);

const sameWeekCount = belowFloor.state.competitorActions.length;
competitorStrategicAI.planWeek(belowFloor.state);
assert.equal(belowFloor.state.competitorActions.length, sameWeekCount);

const replayA = buildPriceDecisionState(500).state;
const replayB = JSON.parse(JSON.stringify(replayA));
competitorStrategicAI.planWeek(replayA);
competitorStrategicAI.planWeek(replayB);
assert.deepEqual(
  replayA.competitorActions.find(row => row.marketStrategy),
  replayB.competitorActions.find(row => row.marketStrategy)
);
const normalized = new engine.TycoonEngine(replayB).g;
assert.equal(normalized.saveVersion, 9);
assert.deepEqual(findStateIssues(normalized), []);

const normalPrice = buildPriceDecisionState(2_000);
competitorStrategicAI.planWeek(normalPrice.state);
const normalAction = normalPrice.state.competitorActions.find(row => row.marketStrategy);
assert.ok(normalAction);
assert.equal(normalAction.actionType, 'priceDecrease');
assert.ok(normalAction.newValue < normalAction.previousValue);
assert.ok(normalAction.newValue >= Math.round(normalPrice.company.baseUnitCost * 1.10));
assert.ok(Number.isFinite(normalAction.newValue));

console.log('competitor price direction guard tests passed');
