const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame();
const { engine, competitor } = modules;

function neutralizeCompany(company) {
  company.marketingBudget = 0;
  company.rdBudget = 0;
  company.debt = 0;
  company.decisionCooldownWeeks = 100000;
  for (const presence of company.marketPresence || []) {
    if (!presence.active) continue;
    presence.fixedCost = 0;
    presence.variableCost = 0;
    presence.totalCapacity = Math.max(1, Number(presence.totalCapacity) || 500);
    presence.revenue = presence.totalCapacity * 12;
  }
}

function makeState() {
  const state = engine.createInitialState({ configured: true });
  competitor.ensure(state);
  for (const company of state.competitorStates) {
    company.cash = 1_000_000_000;
    company.status = 'active';
    company.lastEntryDecisionWeek = state.week;
    neutralizeCompany(company);
  }
  return state;
}

const state = makeState();
const company = state.competitorStates[0];
state.week = 26;
company.lastEntryDecisionWeek = 0;

const orderBefore = competitor.evaluateEntryCandidates(state, company).map(row => row.prefID);
state.prefs.reverse();
const orderAfter = competitor.evaluateEntryCandidates(state, company).map(row => row.prefID);
assert.deepEqual(orderAfter, orderBefore, 'entry candidate order must not depend on source array order');
state.prefs.reverse();

const candidate = competitor.evaluateEntryCandidates(state, company)[0];
assert.ok(candidate, 'an unrepresented market is required');
const action = competitor.scheduleMarketEntry(state, company, candidate.prefID, 'test entry');
assert.ok(action, 'market entry action should be scheduled');
assert.equal(action.actionType, 'marketEntry');
assert.equal(action.effectiveWeek, state.week + competitor.ENTRY_LEAD_WEEKS);

const presence = company.marketPresence.find(row => row.presenceID === action.presenceID);
assert.ok(presence, 'planned presence must exist');
assert.equal(presence.active, false);
assert.equal(presence.entryStatus, 'planned');
assert.equal(presence.totalCapacity, 0, 'planned market must not supply capacity');

let project = state.competitorProjects.find(row => row.actionID === action.actionID);
assert.ok(project, 'market entry project must be created');
assert.equal(project.projectType, 'marketEntry');
assert.equal(project.status, 'inProgress');
assert.equal(project.committedCost, action.cost);
assert.equal(project.spentCost, 0);

for (let week = action.decisionWeek + 1; week < action.effectiveWeek; week += 1) {
  state.week = week;
  neutralizeCompany(company);
  competitor.processWeek(state);
  assert.equal(presence.active, false, `presence must stay inactive during lead time at week ${week}`);
}

state.week = action.effectiveWeek;
neutralizeCompany(company);
const cashBeforeCompletion = company.cash;
competitor.processWeek(state);
assert.equal(presence.active, true, 'presence activates on completion week');
assert.equal(presence.entryStatus, 'active');
assert.ok(presence.totalCapacity > 0);
assert.ok(presence.storeCount >= 1);
assert.equal(cashBeforeCompletion - company.cash, action.cost, 'entry cost is deducted exactly once');
project = state.competitorProjects.find(row => row.actionID === action.actionID);
assert.equal(project.status, 'completed');
assert.equal(project.spentCost, action.cost);
assert.equal(action.entryLifecycleApplied, true);

neutralizeCompany(company);
const cashBeforeRepeat = company.cash;
competitor.processWeek(state);
assert.equal(company.cash, cashBeforeRepeat, 'same-week reprocessing must not deduct entry cost twice');
assert.equal(company.marketPresence.filter(row => row.prefID === candidate.prefID && row.active).length, 1, 'entry completion must not duplicate presences');

const restored = JSON.parse(JSON.stringify(state));
const projectsBeforeRestore = restored.competitorProjects.length;
const presencesBeforeRestore = restored.competitorStates[0].marketPresence.length;
competitor.ensure(restored);
competitor.ensure(restored);
assert.equal(restored.competitorProjects.length, projectsBeforeRestore, 'save normalization must not duplicate projects');
assert.equal(restored.competitorStates[0].marketPresence.length, presencesBeforeRestore, 'save normalization must not duplicate presences');
const beforeValidate = JSON.stringify(restored);
assert.doesNotThrow(() => competitor.validate(restored));
assert.equal(JSON.stringify(restored), beforeValidate, 'entry validation must be read-only');
assert.deepEqual(findStateIssues(restored), []);

const failedState = makeState();
const failedCompany = failedState.competitorStates[0];
failedState.week = 40;
const failedCandidate = competitor.evaluateEntryCandidates(failedState, failedCompany)[0];
const failedAction = competitor.scheduleMarketEntry(failedState, failedCompany, failedCandidate.prefID, 'insufficient cash test');
const failedPresence = failedCompany.marketPresence.find(row => row.presenceID === failedAction.presenceID);
failedState.week = failedAction.effectiveWeek;
failedCompany.cash = 0;
neutralizeCompany(failedCompany);
competitor.processWeek(failedState);
assert.equal(failedAction.status, 'skipped');
assert.equal(failedPresence.active, false);
assert.equal(failedPresence.entryStatus, 'failed');
const failedProject = failedState.competitorProjects.find(row => row.actionID === failedAction.actionID);
assert.equal(failedProject.status, 'failed');
assert.equal(failedProject.spentCost, 0);
assert.doesNotThrow(() => competitor.validate(failedState));

console.log('competitor market entry project tests passed');
