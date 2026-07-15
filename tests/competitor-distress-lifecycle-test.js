const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame();
const { engine, competitor, market } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

function stabilizeOtherCompanies(state, targetID) {
  for (const company of state.competitorStates) {
    if (company.competitorID === targetID) continue;
    company.active = true;
    company.status = 'active';
    company.lifecycleStatus = 'active';
    company.cash = 100_000_000;
    company.debt = 0;
    company.creditScore = 80;
    company.missedDebtPayments = 0;
    company.decisionCooldownWeeks = 1000;
    for (const presence of company.marketPresence || []) {
      if (!presence.active) continue;
      presence.fixedCost = 0;
      presence.totalCapacity = Math.max(1, Number(presence.totalCapacity) || 100);
      presence.revenue = 2_000_000;
      presence.variableCost = 100_000;
      presence.contributionMargin = 1_900_000;
      presence.profit = 1_900_000;
    }
  }
}

function makeState() {
  const state = engine.createInitialState({ configured: true });
  competitor.ensure(state);
  assert.equal(state.saveVersion, 9);
  assert.ok(competitor.__distressInstalled);
  return state;
}

const state = makeState();
const company = state.competitorStates[0];
const presence = company.marketPresence[0];
stabilizeOtherCompanies(state, company.competitorID);
company.decisionCooldownWeeks = 1000;
company.cash = 100_000;
company.debt = 80_000_000;
company.creditScore = 20;
company.missedDebtPayments = 2;
company.lossWeeks = 6;
company.distressWeeks = 4;
company.marketingBudget = 1_000_000;
company.rdBudget = 500_000;
presence.fixedCost = 1_000_000;
presence.totalCapacity = 100;
presence.revenue = 0;
presence.variableCost = 0;
presence.contributionMargin = 0;
presence.profit = -1_000_000;
state.week = 10;
competitor.processWeek(state);
assert.equal(company.lifecycleStatus, 'distressed');
assert.equal(company.status, 'distressed');
assert.ok(company.lastDistressScore >= 4);
assert.equal(company.distressEpisodes, 1);
assert.equal(company.lifecycleHistory.length, 1);
assert.equal(company.lifecycleHistory[0].week, 10);
assert.ok(state.competitorEvents.some(event => event.type === 'distressEntered' && event.competitorID === company.competitorID));

const marketingBefore = company.marketingBudget;
const rdBefore = company.rdBudget;
const plan = competitor.startTurnaroundPlan(state, company, 'focused lifecycle test');
assert.equal(company.lifecycleStatus, 'turnaround');
assert.equal(plan.status, 'active');
assert.equal(plan.targetEndWeek, state.week + 12);
assert.equal(company.marketingBudget, marketingBefore * 0.7);
assert.equal(company.rdBudget, rdBefore * 0.65);
const eventCountAfterPlan = state.competitorEvents.filter(event => event.type === 'turnaroundStarted').length;
const samePlan = competitor.startTurnaroundPlan(state, company, 'duplicate call');
assert.equal(samePlan.planID, plan.planID);
assert.equal(company.marketingBudget, marketingBefore * 0.7, 'turnaround cost reduction must apply once');
assert.equal(company.rdBudget, rdBefore * 0.65, 'turnaround R&D reduction must apply once');
assert.equal(state.competitorEvents.filter(event => event.type === 'turnaroundStarted').length, eventCountAfterPlan);

for (let week = 11; week <= 14; week += 1) {
  state.week = week;
  company.active = true;
  company.cash = 50_000_000;
  company.debt = 0;
  company.creditScore = 80;
  company.missedDebtPayments = 0;
  company.decisionCooldownWeeks = 1000;
  presence.active = true;
  presence.entryStatus = 'active';
  presence.storeCount = 1;
  presence.totalCapacity = 100;
  presence.fixedCost = 0;
  presence.revenue = 5_000_000;
  presence.variableCost = 500_000;
  presence.contributionMargin = 4_500_000;
  presence.profit = 4_500_000;
  stabilizeOtherCompanies(state, company.competitorID);
  competitor.processWeek(state);
}
assert.equal(company.lifecycleStatus, 'recovered');
assert.equal(company.status, 'recovered');
assert.equal(company.turnaroundPlan.status, 'completed');
assert.equal(company.turnaroundPlan.completedWeek, 14);
assert.ok(state.competitorEvents.some(event => event.type === 'recovered' && event.competitorID === company.competitorID));

const bankruptcyState = makeState();
const bankruptCompany = bankruptcyState.competitorStates[0];
const bankruptPresence = bankruptCompany.marketPresence[0];
stabilizeOtherCompanies(bankruptcyState, bankruptCompany.competitorID);
bankruptCompany.decisionCooldownWeeks = 1000;
competitor.enterDistress(bankruptcyState, bankruptCompany, 'bankruptcy test');
bankruptcyState.competitorActions.push({
  actionID: `ca-${bankruptcyState.nextCompetitorActionSeq++}`,
  competitorID: bankruptCompany.competitorID,
  presenceID: bankruptPresence.presenceID,
  decisionWeek: 20,
  effectiveWeek: 40,
  actionType: 'capacityExpansion',
  targetBusinessID: 'ramen',
  targetPrefID: bankruptPresence.prefID,
  previousValue: bankruptPresence.totalCapacity,
  newValue: bankruptPresence.totalCapacity * 1.2,
  cost: 700_000,
  reasonCodes: ['test'],
  reasonText: 'pending project before bankruptcy',
  status: 'pending',
  applied: false,
  appliedWeek: null,
  operationID: `bankruptcy-pending-${bankruptCompany.competitorID}`
});
competitor.ensure(bankruptcyState);
const pendingAction = bankruptcyState.competitorActions.find(action => action.operationID === `bankruptcy-pending-${bankruptCompany.competitorID}`);
const pendingProject = bankruptcyState.competitorProjects.find(project => project.operationID === pendingAction.operationID);
assert.ok(pendingProject);

for (let week = 20; week <= 23; week += 1) {
  bankruptcyState.week = week;
  bankruptCompany.active = true;
  bankruptCompany.cash = 0;
  bankruptCompany.debt = 100_000_000;
  bankruptCompany.creditScore = 20;
  bankruptCompany.missedDebtPayments = 0;
  bankruptCompany.decisionCooldownWeeks = 1000;
  bankruptPresence.active = true;
  bankruptPresence.entryStatus = 'active';
  bankruptPresence.storeCount = 1;
  bankruptPresence.totalCapacity = 10;
  bankruptPresence.fixedCost = 1_000_000;
  bankruptPresence.revenue = 0;
  bankruptPresence.variableCost = 0;
  bankruptPresence.contributionMargin = 0;
  bankruptPresence.profit = -1_000_000;
  stabilizeOtherCompanies(bankruptcyState, bankruptCompany.competitorID);
  competitor.processWeek(bankruptcyState);
}
assert.equal(bankruptCompany.lifecycleStatus, 'bankrupt');
assert.equal(bankruptCompany.status, 'bankrupt');
assert.equal(bankruptCompany.active, false);
assert.equal(bankruptCompany.bankruptcyWeek, 23);
assert.ok(bankruptCompany.marketPresence.every(row => !row.active && row.totalCapacity === 0));
assert.equal(pendingAction.status, 'skipped');
assert.equal(pendingAction.applied, true);
assert.equal(pendingProject.status, 'failed');
assert.ok(pendingProject.completedWeek <= bankruptCompany.bankruptcyWeek, 'growth project must fail no later than bankruptcy');
assert.equal(pendingAction.appliedWeek, pendingProject.completedWeek, 'action and linked project must close together');
assert.equal(pendingProject.spentCost, 0);
assert.equal(market.competitorOffers(bankruptcyState, 'ramen', bankruptPresence.prefID).some(offer => offer.competitorID === bankruptCompany.competitorID), false);

const bankruptcyEvents = bankruptcyState.competitorEvents.filter(event => event.type === 'bankruptcy' && event.competitorID === bankruptCompany.competitorID).length;
const historyLength = bankruptCompany.lifecycleHistory.length;
competitor.processWeek(bankruptcyState);
assert.equal(bankruptcyState.competitorEvents.filter(event => event.type === 'bankruptcy' && event.competitorID === bankruptCompany.competitorID).length, bankruptcyEvents, 'same-week bankruptcy event must not duplicate');
assert.equal(bankruptCompany.lifecycleHistory.length, historyLength, 'same-week lifecycle history must not duplicate');

const retentionState = makeState();
const retentionCompany = retentionState.competitorStates[0];
retentionCompany.lifecycleHistory = Array.from({ length: 110 }, (_, index) => ({
  week: index + 1,
  status: 'active',
  distressScore: 0,
  cashRunwayWeeks: 5,
  leverage: 0,
  weeklyProfit: 1,
  cash: 1,
  debt: 0,
  lossWeeks: 0,
  insolvencyWeeks: 0,
  recoveryStreak: 0,
  activePresenceCount: 1
}));
competitor.ensure(retentionState);
assert.equal(retentionCompany.lifecycleHistory.length, competitor.MAX_LIFECYCLE_HISTORY);
assert.equal(retentionCompany.lifecycleHistory[0].week, 7);

const beforeValidate = JSON.stringify(bankruptcyState);
assert.doesNotThrow(() => competitor.validate(bankruptcyState));
assert.equal(JSON.stringify(bankruptcyState), beforeValidate, 'lifecycle validation must remain read-only');
assert.deepEqual(findStateIssues(bankruptcyState), []);

const corrupt = clone(retentionState);
corrupt.competitorStates[0].lifecycleHistory = [
  { week: 1, status: 'active', distressScore: 0 },
  { week: 1, status: 'active', distressScore: 0 }
];
assert.throws(() => competitor.validate(corrupt), /lifecycleHistory週重複/);

console.log('competitor distress lifecycle tests passed');
