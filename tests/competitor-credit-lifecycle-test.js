const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame();
const { engine, competitor } = modules;

function neutralizeCompany(company) {
  company.marketingBudget = 0;
  company.rdBudget = 0;
  company.decisionCooldownWeeks = 100000;
  company.lastDecisionWeek = 100000;
  for (const presence of company.marketPresence || []) {
    if (!presence.active) continue;
    presence.fixedCost = 0;
    presence.variableCost = 0;
    presence.totalCapacity = Math.max(1, Number(presence.totalCapacity) || 500);
    presence.revenue = presence.totalCapacity * 12;
    presence.fulfilledUnits = presence.totalCapacity;
    presence.lostDemand = 0;
    presence.contributionMargin = presence.revenue;
    presence.profit = presence.revenue;
  }
}

function makeState() {
  const state = engine.createInitialState({ configured: true });
  competitor.ensure(state);
  for (const company of state.competitorStates) {
    company.status = 'active';
    company.cash = 20_000_000;
    company.debt = 0;
    company.creditScore = 62;
    company.lastCreditReviewWeek = 0;
    company.lastPrincipalPaymentWeek = 0;
    neutralizeCompany(company);
  }
  competitor.ensure(state);
  return state;
}

function addBorrow(state, company, amount, suffix) {
  const action = {
    actionID: `borrow-${suffix}`,
    competitorID: company.competitorID,
    presenceID: null,
    decisionWeek: state.week - 1,
    effectiveWeek: state.week,
    actionType: 'borrow',
    targetBusinessID: 'ramen',
    targetPrefID: null,
    previousValue: company.debt,
    newValue: amount,
    cost: 0,
    reasonCodes: ['cash'],
    reasonText: 'credit lifecycle test',
    status: 'pending',
    applied: false,
    appliedWeek: null,
    operationID: `borrow-operation-${suffix}`
  };
  state.competitorActions.push(action);
  return action;
}

const initial = makeState();
const initialCompany = initial.competitorStates[0];
assert.ok(initialCompany.creditLimit >= 1_000_000);
assert.ok(initialCompany.availableCredit >= 0);
assert.ok(initialCompany.cashRunwayWeeks >= 0);
assert.ok(competitor.CREDIT_STATUSES.includes(initialCompany.creditStatus));
assert.ok(Array.isArray(initialCompany.creditHistory));

const borrowState = makeState();
const borrower = borrowState.competitorStates[0];
borrowState.week = 5;
borrower.cash = 0;
borrower.debt = 0;
borrower.lastCreditReviewWeek = 0;
neutralizeCompany(borrower);
competitor.refreshCreditMetrics(borrowState, borrower);
const availableBefore = borrower.availableCredit;
assert.ok(availableBefore >= 100_000, 'borrow test requires usable credit');
const borrowAction = addBorrow(borrowState, borrower, availableBefore * 3, 'partial');
competitor.processWeek(borrowState);
assert.equal(borrowAction.applied, true);
assert.ok(['partial', 'approved'].includes(borrowAction.creditDecision));
assert.equal(borrowAction.approvedValue, availableBefore);
assert.equal(borrower.debt, availableBefore, 'debt increase must be capped by available credit');
assert.equal(borrowAction.requestedValue, availableBefore * 3);
const debtAfterBorrow = borrower.debt;
const approvalEvents = borrowState.competitorEvents.filter(event => event.operationID === `credit-borrow-${borrowAction.actionID}`);
assert.equal(approvalEvents.length, 1);
competitor.processWeek(borrowState);
assert.equal(borrower.debt, debtAfterBorrow, 'same-week reprocessing must not apply borrow twice');
assert.equal(borrowState.competitorEvents.filter(event => event.operationID === `credit-borrow-${borrowAction.actionID}`).length, 1, 'approval event must be idempotent');

const deniedState = makeState();
const deniedCompany = deniedState.competitorStates[0];
deniedState.week = 7;
deniedCompany.cash = 0;
neutralizeCompany(deniedCompany);
competitor.refreshCreditMetrics(deniedState, deniedCompany);
deniedCompany.debt = deniedCompany.creditLimit;
competitor.refreshCreditMetrics(deniedState, deniedCompany);
assert.equal(deniedCompany.availableCredit, 0);
const deniedAction = addBorrow(deniedState, deniedCompany, 1_000_000, 'denied');
const debtBeforeDenied = deniedCompany.debt;
competitor.processWeek(deniedState);
assert.equal(deniedAction.status, 'skipped');
assert.equal(deniedAction.creditDecision, 'denied');
assert.equal(deniedAction.approvedValue, 0);
assert.equal(deniedCompany.debt, debtBeforeDenied);
assert.equal(deniedState.competitorEvents.filter(event => event.operationID === `credit-borrow-${deniedAction.actionID}`).length, 1);

const repaymentState = makeState();
const payer = repaymentState.competitorStates[0];
repaymentState.week = 13;
payer.cash = 50_000_000;
payer.debt = 4_000_000;
payer.lastCreditReviewWeek = 0;
payer.lastPrincipalPaymentWeek = 0;
neutralizeCompany(payer);
competitor.refreshCreditMetrics(repaymentState, payer);
const requiredPayment = payer.scheduledPrincipalPayment;
const debtBeforePayment = payer.debt;
assert.ok(requiredPayment >= 100_000);
competitor.processWeek(repaymentState);
assert.equal(payer.debt, debtBeforePayment - requiredPayment, 'quarterly principal payment must reduce debt once');
assert.equal(payer.lastPrincipalPaymentWeek, 13);
assert.equal(payer.missedDebtPayments, 0);
const debtAfterPayment = payer.debt;
competitor.processWeek(repaymentState);
assert.equal(payer.debt, debtAfterPayment, 'same-week reprocessing must not repay principal twice');
assert.equal(repaymentState.competitorEvents.filter(event => event.operationID === `credit-payment-${payer.competitorID}-13`).length, 1);

const missedState = makeState();
const missedCompany = missedState.competitorStates[0];
missedState.week = 13;
missedCompany.cash = 0;
missedCompany.debt = 4_000_000;
missedCompany.creditScore = 62;
missedCompany.lastCreditReviewWeek = 0;
missedCompany.lastPrincipalPaymentWeek = 0;
neutralizeCompany(missedCompany);
const scoreBeforeMiss = missedCompany.creditScore;
competitor.processWeek(missedState);
assert.equal(missedCompany.debt, 4_000_000);
assert.equal(missedCompany.missedDebtPayments, 1);
assert.ok(missedCompany.creditScore < scoreBeforeMiss);
assert.equal(missedCompany.lastPrincipalPaymentWeek, 13);
competitor.processWeek(missedState);
assert.equal(missedCompany.missedDebtPayments, 1, 'same-week reprocessing must not add another missed payment');

const retained = makeState();
const retainedCompany = retained.competitorStates[0];
retainedCompany.creditHistory = Array.from({ length: 120 }, (_, index) => ({
  week: index + 1,
  creditScore: 60,
  creditLimit: 2_000_000,
  availableCredit: 1_000_000,
  debt: 1_000_000,
  cash: 2_000_000,
  cashRunwayWeeks: 10,
  scheduledPrincipalPayment: 100_000,
  missedDebtPayments: 0,
  status: 'standard'
}));
competitor.ensure(retained);
assert.equal(retainedCompany.creditHistory.length, competitor.MAX_CREDIT_HISTORY);
assert.equal(retainedCompany.creditHistory[0].week, 17);
assert.equal(retainedCompany.creditHistory.at(-1).week, 120);

const restored = JSON.parse(JSON.stringify(repaymentState));
const historyLength = restored.competitorStates[0].creditHistory.length;
competitor.ensure(restored);
competitor.ensure(restored);
assert.equal(restored.competitorStates[0].creditHistory.length, historyLength, 'save normalization must not grow credit history');
const beforeValidate = JSON.stringify(restored);
assert.doesNotThrow(() => competitor.validate(restored));
assert.equal(JSON.stringify(restored), beforeValidate, 'credit validation must be read-only');
assert.deepEqual(findStateIssues(restored), []);
assert.ok(!JSON.stringify(restored).includes('NaN'));
assert.ok(!JSON.stringify(restored).includes('Infinity'));

console.log('competitor credit lifecycle tests passed');
