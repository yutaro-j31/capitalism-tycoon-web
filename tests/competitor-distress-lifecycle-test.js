const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame({ random: () => 0.42 });
const { engine, competitor, market } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

function makeState() {
  const state = engine.createInitialState({ configured: true });
  competitor.ensure(state);
  for (const company of state.competitorStates) {
    company.active = true;
    company.status = 'active';
    company.cash = 20_000_000;
    company.debt = 0;
    company.creditScore = 65;
    company.weeklyFixedCost = 100_000;
    company.weeklyMarketingCost = 0;
    company.weeklyRDCost = 0;
    company.weeklyInterestCost = 0;
    company.weeklyCapacityCost = 50_000;
    company.weeklyProfit = 100_000;
    company.lossWeeks = 0;
    company.distressWeeks = 0;
    company.missedDebtPayments = 0;
    company.lastLifecycleReviewWeek = 0;
    competitor.refreshCreditMetrics(state, company);
  }
  return state;
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  assert.equal(state.saveVersion, 9);
  assert.ok(Array.isArray(company.turnaroundPlans));
  assert.equal(company.turnaroundAttempts, 0);
  assert.equal(company.failedTurnaroundAttempts, 0);
  assert.equal(company.bankruptcyWeek, null);
  assert.doesNotThrow(() => competitor.validate(state));
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  state.week = 10;
  company.weeklyProfit = -500_000;
  company.lossWeeks = 5;
  company.distressWeeks = 5;
  company.cash = 100_000;
  competitor.refreshCreditMetrics(state, company);
  const beforeEvents = state.competitorEvents.length;
  competitor.reviewCompanyLifecycle(state, company);
  assert.equal(company.status, 'distressed');
  assert.equal(company.distressEpisodeActive, true);
  assert.equal(company.distressEpisodeCount, 1);
  assert.equal(state.competitorEvents.length, beforeEvents + 1);
  competitor.reviewCompanyLifecycle(state, company);
  assert.equal(state.competitorEvents.length, beforeEvents + 1, 'same-week review must not duplicate distress events');
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  state.week = 20;
  competitor.enterDistress(state, company, { score: 5 }, 'test distress');
  const action = { actionID: 'turnaround-success', appliedWeek: 20, reasonText: 'recovery test' };
  const plan = competitor.startTurnaroundPlan(state, company, action);
  assert.equal(plan.status, 'active');
  assert.equal(company.turnaroundAttempts, 1);
  for (let week = 21; week <= 23; week += 1) {
    state.week = week;
    company.lastLifecycleReviewWeek = week - 1;
    company.weeklyProfit = 300_000;
    company.cash = 25_000_000;
    company.debt = 0;
    company.lossWeeks = 0;
    company.missedDebtPayments = 0;
    competitor.refreshCreditMetrics(state, company);
    competitor.reviewCompanyLifecycle(state, company);
  }
  const completed = company.turnaroundPlans.find(row => row.planID === plan.planID);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.outcome, 'recovered');
  assert.equal(company.status, 'recovering');
  assert.equal(company.distressEpisodeActive, false);
  assert.equal(company.turnaroundWeeks, 0);
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  state.week = 30;
  competitor.enterDistress(state, company, { score: 4 }, 'first failure setup');
  const plan = competitor.startTurnaroundPlan(state, company, { actionID: 'turnaround-fail-1', appliedWeek: 30 });
  plan.deadlineWeek = 31;
  state.week = 31;
  company.lastLifecycleReviewWeek = 30;
  company.weeklyProfit = -100_000;
  company.cash = 5_000_000;
  company.debt = 0;
  company.lossWeeks = 5;
  company.distressWeeks = 6;
  company.missedDebtPayments = 0;
  competitor.refreshCreditMetrics(state, company);
  competitor.reviewCompanyLifecycle(state, company);
  assert.equal(plan.status, 'failed');
  assert.equal(company.status, 'distressed');
  assert.equal(company.active, true);
  assert.equal(company.failedTurnaroundAttempts, 1);
  assert.equal(company.turnaroundRetryEligibleWeek, 31 + competitor.TURNAROUND_RETRY_COOLDOWN_WEEKS);
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  const presence = company.marketPresence[0];
  state.week = 40;
  company.failedTurnaroundAttempts = 1;
  competitor.enterDistress(state, company, { score: 4 }, 'second failure setup');
  const plan = competitor.startTurnaroundPlan(state, company, { actionID: 'turnaround-fail-2', appliedWeek: 40 });
  plan.deadlineWeek = 41;
  const pendingAction = {
    actionID: 'pending-quality-before-bankruptcy', competitorID: company.competitorID, presenceID: presence.presenceID,
    decisionWeek: 40, effectiveWeek: 45, actionType: 'qualityInvestment', targetBusinessID: 'ramen', targetPrefID: presence.prefID,
    previousValue: presence.quality, newValue: presence.quality + 5, cost: 500_000, reasonCodes: ['test'], reasonText: 'must cancel',
    status: 'pending', applied: false, appliedWeek: null, operationID: 'pending-quality-before-bankruptcy-op'
  };
  state.competitorActions.push(pendingAction);
  competitor.migrateProjectsFromActions(state);
  state.week = 41;
  company.lastLifecycleReviewWeek = 40;
  company.weeklyProfit = -100_000;
  company.cash = 5_000_000;
  company.debt = 0;
  company.lossWeeks = 5;
  company.distressWeeks = 6;
  company.missedDebtPayments = 0;
  competitor.refreshCreditMetrics(state, company);
  competitor.reviewCompanyLifecycle(state, company);
  assert.equal(company.status, 'bankrupt');
  assert.equal(company.active, false);
  assert.equal(company.bankruptcyWeek, 41);
  assert.equal(pendingAction.applied, true);
  assert.equal(pendingAction.status, 'skipped');
  assert.equal(pendingAction.cancellationReason, 'bankruptcy');
  const project = state.competitorProjects.find(row => row.operationID === pendingAction.operationID);
  assert.equal(project.status, 'failed');
  assert.equal(project.failureReason, 'bankruptcy');
  assert.ok(company.marketPresence.every(row => !row.active && row.totalCapacity === 0));
  const remainingOffers = market.competitorOffers(state, 'ramen', presence.prefID);
  assert.ok(!remainingOffers.some(offer => offer.id === presence.presenceID || offer.presenceID === presence.presenceID || offer.competitorID === company.competitorID), 'bankrupt competitor offers must leave the market');
  const cashBefore = company.cash;
  const eventsBefore = state.competitorEvents.length;
  competitor.reviewCompanyLifecycle(state, company);
  assert.equal(company.cash, cashBefore);
  assert.equal(state.competitorEvents.length, eventsBefore, 'bankruptcy must be same-week idempotent');
  assert.doesNotThrow(() => competitor.validate(state));
  assert.deepEqual(findStateIssues(state), []);
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  company.turnaroundPlans = Array.from({ length: 12 }, (_, index) => ({
    planID: `old-plan-${index}`, competitorID: company.competitorID, actionID: null, status: 'completed',
    startWeek: index, deadlineWeek: index + 8, completedWeek: index + 3, recoveryStreak: 3, targetRecoveryWeeks: 3,
    initialCash: 1, initialDebt: 0, initialCreditScore: 60, initialActivePresenceCount: 1,
    finalCash: 2, finalDebt: 0, finalCreditScore: 62, outcome: 'recovered', reason: ''
  }));
  competitor.ensure(state);
  assert.equal(company.turnaroundPlans.length, competitor.MAX_TURNAROUND_PLANS);
  const restored = clone(state);
  competitor.ensure(restored);
  competitor.ensure(restored);
  assert.equal(restored.competitorStates[0].turnaroundPlans.length, competitor.MAX_TURNAROUND_PLANS);
  const beforeValidate = JSON.stringify(restored);
  assert.doesNotThrow(() => competitor.validate(restored));
  assert.equal(JSON.stringify(restored), beforeValidate, 'distress validation must be read-only');
  assert.ok(!beforeValidate.includes('NaN'));
  assert.ok(!beforeValidate.includes('Infinity'));
}

console.log('competitor distress lifecycle tests passed');
