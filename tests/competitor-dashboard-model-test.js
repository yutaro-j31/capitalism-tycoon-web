const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

const { modules } = loadGame();
const { engine, competitor } = modules;
const dashboard = competitor.dashboard;
const clone = value => JSON.parse(JSON.stringify(value));
const finiteTree = value => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteTree);
  if (value && typeof value === 'object') return Object.values(value).every(finiteTree);
  return true;
};

assert.ok(dashboard);
assert.deepEqual(Array.from(dashboard.HISTORY_WINDOWS), [4, 13]);
assert.equal(typeof dashboard.buildDashboard, 'function');
assert.equal(typeof dashboard.buildDetail, 'function');

const state = engine.createInitialState({ configured: true });
const before = JSON.stringify(state);
const first = dashboard.buildDashboard(state);
assert.equal(JSON.stringify(state), before, 'dashboard generation must be read-only');
assert.equal(first.generatedWeek, state.week);
assert.equal(first.total, state.competitorStates.length);
assert.ok(Object.isFrozen(first));
assert.ok(Object.isFrozen(first.rows));
assert.ok(finiteTree(first));
assert.ok(first.rows.every(row => row.competitorID && row.name && row.businessID));
assert.ok(first.rows.every(row => Number.isFinite(row.riskScore)));
assert.ok(first.rows.every(row => Object.isFrozen(row.financial) && Object.isFrozen(row.credit)));
assert.ok(first.rows.every(row => Object.isFrozen(row.markets) && Object.isFrozen(row.history)));

const target = state.competitorStates[0];
const targetID = target.competitorID;
const presence = target.marketPresence[0];
const plannedPresence = {
  ...clone(presence),
  presenceID: `${presence.presenceID}-planned`,
  prefID: state.prefs.find(pref => pref.id !== presence.prefID)?.id || `${presence.prefID}-next`,
  active: false,
  entryStatus: 'planned',
  entryWeek: state.week,
  openingWeek: state.week + 6,
  totalCapacity: 0,
  storeCount: 0,
  fulfilledUnits: 0
};
target.marketPresence.push(plannedPresence);
target.lifecycleStatus = 'turnaround';
target.status = 'turnaround';
target.lastDistressScore = 8;
target.lastLifecycleReason = '資金繰り悪化';
target.weeklyRevenue = 12_000_000;
target.weeklyProfit = -3_000_000;
target.cash = 2_000_000;
target.debt = 60_000_000;
target.creditLimit = 40_000_000;
target.creditScore = 28;
target.creditStatus = 'restricted';
target.missedDebtPayments = 2;
target.turnaroundPlan = { status: 'active', targetEndWeek: state.week + 8 };
target.lifecycleHistory = Array.from({ length: 15 }, (_, index) => ({
  week: state.week - 14 + index,
  status: index < 10 ? 'distressed' : 'turnaround',
  weeklyProfit: -1_500_000 + index * 100_000,
  revenue: 8_000_000 + index * 200_000,
  cashRunwayWeeks: 1 + index * 0.1,
  leverage: 1.5 - index * 0.02,
  marketShare: 0.12 + index * 0.001,
  cash: 2_000_000 + index * 50_000,
  debt: 60_000_000 - index * 100_000
}));
state.competitorProjects.push({
  projectID: 'dashboard-project',
  competitorID: targetID,
  status: 'inProgress',
  actionType: 'capacityExpansion'
});
state.competitorActions.push({
  actionID: 'dashboard-action',
  competitorID: targetID,
  status: 'pending',
  applied: false,
  actionType: 'marketExit'
});
const targetCounter = state.competitorCounterStates.find(row => row.competitorID === targetID);
targetCounter.pricePressure = 5;
targetCounter.strength = 88;
state.competitorEvents.push({ week: state.week, competitorID: targetID, text: '再建計画を開始。' });

const detailedBefore = JSON.stringify(state);
const detail = dashboard.buildDetail(state, targetID);
assert.equal(JSON.stringify(state), detailedBefore, 'detail generation must be read-only');
assert.equal(detail.status, 'turnaround');
assert.equal(detail.statusLabel, '再建中');
assert.equal(detail.severity, 'danger');
assert.equal(detail.statusReason, '資金繰り悪化');
assert.equal(detail.marketSummary.total, 2);
assert.equal(detail.marketSummary.active, 1);
assert.equal(detail.marketSummary.opening, 1);
assert.equal(detail.markets.find(row => row.presenceID === plannedPresence.presenceID).entryStatus, 'planned');
assert.equal(detail.operations.pendingProjects, 1);
assert.equal(detail.operations.pendingActions, 1);
assert.equal(detail.operations.turnaroundStatus, 'active');
assert.equal(detail.operations.turnaroundTargetWeek, state.week + 8);
assert.equal(detail.counter.pricePressure, 5);
assert.equal(detail.counter.strength, 88);
assert.equal(detail.credit.leverage, 1.5);
assert.ok(detail.credit.cashRunwayWeeks >= 0);
assert.equal(detail.latestEvent, '再建計画を開始。');
assert.equal(detail.history['4'].weeks, 4);
assert.equal(detail.history['13'].weeks, 13);
assert.ok(detail.riskScore >= 60);
assert.ok(finiteTree(detail));

const filtered = dashboard.buildDashboard(state, { businessID: target.businessID, statuses: ['turnaround'] });
assert.ok(filtered.rows.some(row => row.competitorID === targetID));
assert.ok(filtered.rows.every(row => row.businessID === target.businessID && row.status === 'turnaround'));

const reversed = clone(state);
reversed.competitorStates.reverse();
reversed.competitorCounterStates.reverse();
assert.deepEqual(
  dashboard.buildDashboard(reversed).rows.map(row => row.competitorID),
  dashboard.buildDashboard(state).rows.map(row => row.competitorID),
  'dashboard ordering must not depend on saved array order'
);

const corrupt = clone(state);
const broken = corrupt.competitorStates[0];
broken.cash = 'not-a-number';
broken.debt = Number.NaN;
broken.weeklyRevenue = Number.POSITIVE_INFINITY;
broken.weeklyProfit = undefined;
broken.creditLimit = null;
broken.marketPresence[0].totalCapacity = Number.NaN;
broken.marketPresence[0].price = 'bad';
corrupt.competitorCounterStates[0].pricePressure = Number.NaN;
const safe = dashboard.buildDashboard(corrupt);
assert.ok(finiteTree(safe), 'dashboard output must sanitize non-finite source values');

const terminal = clone(state);
const terminalCompany = terminal.competitorStates[0];
terminalCompany.active = false;
terminalCompany.acquiredByPlayer = true;
terminalCompany.status = 'inactive';
terminalCompany.lifecycleStatus = 'inactive';
const terminalDetail = dashboard.buildDetail(terminal, terminalCompany.competitorID);
assert.equal(terminalDetail.active, false);
assert.equal(terminalDetail.acquiredByPlayer, true);
assert.equal(terminalDetail.statusLabel, '事業停止');
assert.equal(dashboard.buildDetail(state, 'missing-competitor'), null);

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'competitor-dashboard.js'), 'utf8');
assert.equal(/Math\.random\s*\(/.test(source), false, 'dashboard model must remain deterministic');
assert.equal(/\bstate\.[A-Za-z0-9_$]+\s*=/.test(source), false, 'dashboard model must not assign to top-level state');

console.log('competitor dashboard model tests passed');
