const assert = require('node:assert');
const { loadGame } = require('./harness');

const ctx = loadGame();
const { engine, competitor } = ctx.modules;
const state = engine.createInitialState({ configured: true });
competitor.ensure(state);

assert.equal(state.saveVersion, 8, 'project foundation must remain additive to version 8 saves');
assert.ok(Array.isArray(state.competitorProjects));
assert.ok(Number.isInteger(state.nextCompetitorProjectSeq));

const company = state.competitorStates[0];
const presence = company.marketPresence[0];
company.strategyID = 'convenience';
company.cash = 1_000_000_000;
company.decisionCooldownWeeks = 0;
company.lastDecisionWeek = 0;
presence.brandAwareness = 100;
presence.quality = 100;
presence.fulfilledUnits = presence.totalCapacity;
presence.lostDemand = 100;
presence.revenue = 1_000_000;
presence.variableCost = 200_000;
presence.contributionMargin = 800_000;
presence.profit = 730_000;

state.week = 13;
competitor.processWeek(state);

const action = state.competitorActions.find(row => row.competitorID === company.competitorID && row.actionType === 'capacityExpansion');
assert.ok(action, 'capacity pressure must schedule a capacity project');
const project = state.competitorProjects.find(row => row.operationID === action.operationID);
assert.ok(project, 'project must be created with the action');
assert.equal(project.status, 'inProgress');
assert.equal(project.startWeek, action.decisionWeek);
assert.equal(project.completionWeek, action.effectiveWeek);
assert.equal(project.committedCost, action.cost);

const initialCapacity = presence.totalCapacity;
const cashAfterDecision = company.cash;
company.active = false;
for (let week = 14; week < project.completionWeek; week += 1) {
  state.week = week;
  competitor.processWeek(state);
  assert.equal(project.status, 'inProgress');
  assert.equal(presence.totalCapacity, initialCapacity, 'project effect must wait for completion');
  assert.equal(company.cash, cashAfterDecision, 'project cost must not be deducted before completion');
}

state.week = project.completionWeek;
competitor.processWeek(state);
assert.equal(project.status, 'completed');
assert.equal(project.completedWeek, state.week);
assert.equal(project.spentCost, project.committedCost);
assert.ok(presence.totalCapacity > initialCapacity, 'capacity must increase on completion');
assert.equal(company.cash, cashAfterDecision - project.committedCost, 'project cost must be deducted exactly once');
assert.equal(action.status, 'applied');
assert.equal(action.appliedWeek, state.week);

const completedCapacity = presence.totalCapacity;
const completedCash = company.cash;
competitor.processWeek(state);
assert.equal(presence.totalCapacity, completedCapacity, 'same-week reprocessing must not apply the project twice');
assert.equal(company.cash, completedCash, 'same-week reprocessing must not deduct project cost twice');

const restored = JSON.parse(JSON.stringify(state));
competitor.ensure(restored);
competitor.ensure(restored);
assert.equal(restored.competitorProjects.filter(row => row.operationID === action.operationID).length, 1, 'save restore must not duplicate projects');
assert.doesNotThrow(() => competitor.validate(restored));

const migrated = engine.createInitialState({ configured: true });
competitor.ensure(migrated);
const migratedCompany = migrated.competitorStates[0];
const migratedPresence = migratedCompany.marketPresence[0];
migrated.competitorProjects = [];
migrated.nextCompetitorProjectSeq = 1;
migrated.competitorActions.push({
  actionID: 'legacy-project-action',
  competitorID: migratedCompany.competitorID,
  presenceID: migratedPresence.presenceID,
  decisionWeek: 20,
  effectiveWeek: 24,
  actionType: 'qualityInvestment',
  targetBusinessID: 'ramen',
  targetPrefID: migratedPresence.prefID,
  previousValue: null,
  newValue: 70,
  cost: 500000,
  reasonCodes: ['migration'],
  reasonText: 'legacy pending investment',
  status: 'pending',
  applied: false,
  appliedWeek: null,
  operationID: 'legacy-project-operation'
});
migrated.week = 21;
competitor.ensure(migrated);
const backfilled = migrated.competitorProjects.find(row => row.operationID === 'legacy-project-operation');
assert.ok(backfilled, 'pending version 8 actions must be backfilled into projects');
assert.equal(backfilled.status, 'inProgress');
competitor.ensure(migrated);
assert.equal(migrated.competitorProjects.filter(row => row.operationID === 'legacy-project-operation').length, 1);

const beforeValidate = JSON.stringify(migrated);
assert.doesNotThrow(() => competitor.validate(migrated));
assert.equal(JSON.stringify(migrated), beforeValidate, 'validate must remain read-only');
assert.ok(!JSON.stringify(restored).includes('NaN'));
assert.ok(!JSON.stringify(restored).includes('Infinity'));

console.log('competitor project lifecycle tests passed');