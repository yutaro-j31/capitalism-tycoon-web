const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame();
const { engine, competitor, finance } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

assert.equal(engine.TycoonEngine.prototype.__competitorParityCompatibilityInstalled, true);
assert.equal(competitor.__parityCompatibilityRegistered, true);

const state = engine.createInitialState({ configured: true });
const game = new engine.TycoonEngine(state);
const originalIDs = game.g.competitorStates.map(row => row.competitorID);
assert.ok(originalIDs.length > 0);

const counters = game.seedCompetitorCounterStates();
assert.equal(game.g.competitorStates.length, originalIDs.length, 'AI competitor rows must not be replaced by parity counters');
assert.deepEqual(game.g.competitorStates.map(row => row.competitorID), originalIDs);
assert.equal(counters.length, originalIDs.length);
assert.deepEqual(counters.map(row => row.competitorID), [...originalIDs].sort());

for (const company of game.g.competitorStates) {
  assert.equal(company.id, company.competitorID);
  assert.equal(company.industryID, company.businessID);
  assert.ok(Number.isFinite(company.strength));
  assert.ok(Number.isFinite(company.aggression));
  assert.ok(Number.isFinite(company.brandPower));
  assert.ok(Number.isFinite(company.pricePressure));
  assert.ok(Number.isFinite(company.lastActionWeek));
  assert.doesNotThrow(() => company.pricePressure.toFixed(1));
  assert.doesNotThrow(() => company.strength.toFixed(0));
  assert.doesNotThrow(() => company.brandPower.toFixed(0));
  assert.ok(game.business(company.industryID));
}

const legacyState = engine.createInitialState({ configured: true });
legacyState.competitorStates.push({
  id: 'legacy-counter-only',
  name: '旧カウンター',
  industryID: 'ramen',
  regionID: 'kanto',
  strength: 50,
  cash: 5_000_000,
  aggression: 0.5,
  brandPower: 40,
  pricePressure: 2,
  isDistressed: false,
  lastActionWeek: 3
});
const legacyGame = new engine.TycoonEngine(legacyState);
legacyGame.seedCompetitorCounterStates();
assert.equal(legacyGame.g.competitorStates.some(row => row.id === 'legacy-counter-only'), false, 'legacy counter row must leave AI state');
assert.equal(legacyGame.g.competitorCounterStates.some(row => row.id === 'legacy-counter-only'), false, 'orphan legacy counters must not survive without an AI company');
assert.ok(legacyGame.g.competitorStates.every(row => row.competitorID));

const target = game.g.competitorStates[0];
let counter = game.g.competitorCounterStates.find(row => row.competitorID === target.competitorID);
counter.pricePressure = 3;
game.g.companyCash = 100_000_000;
game.g.week = 20;
game.g.finance = finance.defaultFinanceState(game.g);
const cashBeforeAds = game.g.companyCash;
assert.equal(game.respondToCompetitor(target.competitorID, 'ads'), true);
counter = game.g.competitorCounterStates.find(row => row.competitorID === target.competitorID);
assert.equal(game.g.companyCash, cashBeforeAds - 2_000_000);
assert.equal(counter.pricePressure, 2);
assert.equal(target.pricePressure, 2);
assert.equal(game.g.rivalResponseHistory.length, 1);
const cashAfterAds = game.g.companyCash;
assert.equal(game.respondToCompetitor(target.competitorID, 'ads'), false, 'same-week duplicate response must be rejected');
assert.equal(game.g.companyCash, cashAfterAds);
assert.equal(game.g.rivalResponseHistory.length, 1);

const business = game.business(target.businessID);
const qualityBefore = business.quality;
game.g.week = 21;
assert.equal(game.respondToCompetitor(target.competitorID, 'quality'), true);
assert.equal(business.quality, Math.min(100, qualityBefore + 2));
assert.equal(game.g.rivalResponseHistory.length, 2);
assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join('\n'));

const weeklyState = engine.createInitialState({ configured: true });
const weeklyGame = new engine.TycoonEngine(weeklyState);
const weeklyIDs = weeklyGame.g.competitorStates.map(row => row.competitorID);
weeklyGame.g.lastCompetitorActionWeek = weeklyGame.g.week;
weeklyGame.g.lastKeyPersonnelEventWeek = weeklyGame.g.week;
weeklyGame.updateParityWeekly();
assert.deepEqual(weeklyGame.g.competitorStates.map(row => row.competitorID), weeklyIDs, 'weekly parity processing must restore AI competitor state');
assert.ok(weeklyGame.g.competitorCounterStates.every(row => Number.isFinite(row.pricePressure)));
assert.deepEqual(findStateIssues(weeklyGame.g), []);

const acquireState = engine.createInitialState({ configured: true });
const acquireGame = new engine.TycoonEngine(acquireState);
const acquired = acquireGame.g.competitorStates[0];
acquired.lifecycleStatus = 'distressed';
acquired.status = 'distressed';
acquired.lastDistressScore = 8;
acquireGame.g.week = 30;
acquireGame.g.companyCash = 1_000_000_000;
acquireGame.g.finance = finance.defaultFinanceState(acquireGame.g);
const presence = acquired.marketPresence[0];
acquireGame.g.competitorActions.push({
  actionID: `ca-${acquireGame.g.nextCompetitorActionSeq++}`,
  competitorID: acquired.competitorID,
  presenceID: presence.presenceID,
  decisionWeek: 30,
  effectiveWeek: 40,
  actionType: 'capacityExpansion',
  targetBusinessID: acquired.businessID,
  targetPrefID: presence.prefID,
  previousValue: presence.totalCapacity,
  newValue: presence.totalCapacity + 100,
  cost: 700_000,
  reasonCodes: ['test'],
  reasonText: 'pending before acquisition',
  status: 'pending',
  applied: false,
  appliedWeek: null,
  operationID: `acquire-pending-${acquired.competitorID}`
});
competitor.ensure(acquireGame.g);
acquireGame.seedCompetitorCounterStates();
const acquireCounter = acquireGame.g.competitorCounterStates.find(row => row.competitorID === acquired.competitorID);
assert.equal(acquireCounter.isDistressed, true);
const competitorCountBefore = acquireGame.g.competitorStates.length;
assert.equal(acquireGame.respondToCompetitor(acquired.competitorID, 'acquire'), true);
assert.equal(acquireGame.g.competitorStates.length, competitorCountBefore, 'acquisition must preserve competitor references');
assert.equal(acquired.active, false);
assert.equal(acquired.status, 'inactive');
assert.equal(acquired.lifecycleStatus, 'inactive');
assert.equal(acquired.acquiredByPlayer, true);
assert.ok(acquired.marketPresence.every(row => !row.active && row.totalCapacity === 0));
const pending = acquireGame.g.competitorActions.find(row => row.operationID === `acquire-pending-${acquired.competitorID}`);
const project = acquireGame.g.competitorProjects.find(row => row.operationID === pending.operationID);
assert.equal(pending.applied, true);
assert.equal(pending.status, 'skipped');
assert.equal(project.status, 'failed');
assert.equal(project.spentCost, 0);
assert.ok(acquireGame.g.subsidiaries.some(row => row.sourceCompetitorID === acquired.competitorID));
assert.equal(acquireGame.g.competitorCounterStates.find(row => row.competitorID === acquired.competitorID).active, false);
assert.doesNotThrow(() => competitor.validate(acquireGame.g));
assert.equal(finance.validate(acquireGame.g).ok, true, finance.validate(acquireGame.g).errors.join('\n'));
assert.deepEqual(findStateIssues(acquireGame.g), []);

const eventState = engine.createInitialState({ configured: true });
eventState.competitorEvents = [{ week: 7, competitorID: eventState.competitorStates[0]?.competitorID, type: 'turnaroundStarted', text: '競合が再建を開始。', operationID: 'compat-event' }];
const eventGame = new engine.TycoonEngine(eventState);
assert.ok(eventGame.g.competitorEventLog.some(line => line.includes('競合が再建を開始。')));
assert.ok(eventGame.g.competitorEventLog.every(line => typeof line === 'string'));

const beforeValidate = JSON.stringify(game.g);
assert.doesNotThrow(() => competitor.validate(game.g));
assert.equal(JSON.stringify(game.g), beforeValidate, 'competitor parity validation must be read-only');

const corrupt = clone(game.g);
corrupt.competitorCounterStates[0].pricePressure = Number.NaN;
assert.throws(() => competitor.validate(corrupt), /pricePressure非有限/);

console.log('competitor parity compatibility tests passed');
