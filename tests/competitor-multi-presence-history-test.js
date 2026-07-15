const assert = require('node:assert');
const { loadGame } = require('./harness');

const ctx = loadGame();
const { engine, competitor } = ctx.modules;
const state = engine.createInitialState({ configured: true });
competitor.ensure(state);

const company = state.competitorStates[0];
const primary = company.marketPresence[0];
const alternativePref = state.prefs.find(pref => pref.id !== primary.prefID);
assert.ok(alternativePref, 'test requires a second valid prefecture');

const secondary = JSON.parse(JSON.stringify(primary));
Object.assign(secondary, {
  presenceID: `${primary.presenceID}-secondary`,
  prefID: alternativePref.id,
  areaID: alternativePref.areaID,
  fulfilledUnits: 520,
  lostDemand: 480,
  totalCapacity: 560,
  currentWeekShare: 0.05,
  previousWeekShare: 0.06,
  revenue: 680000,
  variableCost: 250000,
  contributionMargin: 430000,
  fixedCost: 70000,
  profit: 360000
});
Object.assign(primary, {
  fulfilledUnits: 120,
  lostDemand: 0,
  totalCapacity: 500,
  currentWeekShare: 0.42,
  previousWeekShare: 0.41,
  revenue: 520000,
  variableCost: 210000,
  contributionMargin: 310000,
  fixedCost: 70000,
  profit: 240000
});
company.marketPresence.push(secondary);

const evaluated = competitor.evaluatePresences(state, company);
assert.deepEqual(new Set(evaluated.map(row => row.presenceID)), new Set(company.marketPresence.map(row => row.presenceID)), 'all active presences must be evaluated');
const selectedBeforeReverse = competitor.selectDecisionPresence(state, company).presenceID;
assert.equal(selectedBeforeReverse, secondary.presenceID, 'the higher-priority second presence must be selected');
company.marketPresence.reverse();
const selectedAfterReverse = competitor.selectDecisionPresence(state, company).presenceID;
assert.equal(selectedAfterReverse, selectedBeforeReverse, 'selection must not depend on source array order');

company.cash = 1e12;
company.decisionCooldownWeeks = 100000;
for (const competitorState of state.competitorStates) {
  competitorState.cash = Math.max(1e12, competitorState.cash);
  competitorState.decisionCooldownWeeks = 100000;
}

for (let week = 1; week <= 120; week += 1) {
  state.week = week;
  competitor.processWeek(state);
}

const companyHistory = state.competitorPerformanceHistoryByID[company.competitorID];
const primaryHistory = state.competitorPresenceHistoryByID[primary.presenceID];
const secondaryHistory = state.competitorPresenceHistoryByID[secondary.presenceID];
assert.equal(companyHistory.length, competitor.MAX_HISTORY);
assert.equal(primaryHistory.length, competitor.MAX_HISTORY);
assert.equal(secondaryHistory.length, competitor.MAX_HISTORY);
assert.equal(companyHistory[0].week, 17, '104-week retention must keep the newest weeks');
assert.equal(companyHistory.at(-1).week, 120);
assert.equal(new Set(companyHistory.map(row => row.week)).size, companyHistory.length, 'company history weeks must be unique');
assert.equal(new Set(secondaryHistory.map(row => row.week)).size, secondaryHistory.length, 'presence history weeks must be unique');

const beforeDuplicateWrite = companyHistory.length;
competitor.recordHistories(state, company);
competitor.recordHistories(state, company);
assert.equal(state.competitorPerformanceHistoryByID[company.competitorID].length, beforeDuplicateWrite, 'same-week history writes must replace rather than append');
assert.equal(state.competitorPerformanceHistoryByID[company.competitorID].filter(row => row.week === state.week).length, 1);

const beforeValidate = JSON.stringify(state);
assert.doesNotThrow(() => competitor.validate(state));
assert.equal(JSON.stringify(state), beforeValidate, 'validate must be read-only');
const restored = JSON.parse(JSON.stringify(state));
assert.doesNotThrow(() => competitor.validate(restored));
assert.ok(!JSON.stringify(restored).includes('NaN'));
assert.ok(!JSON.stringify(restored).includes('Infinity'));

console.log('competitor multi-presence history tests passed');
