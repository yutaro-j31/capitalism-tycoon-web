const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x5b5b2001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { ctx, modules } = loadGame({ random });
const { engine, competitor } = modules;
const dashboardUI = competitor.dashboardUI;

assert.ok(dashboardUI, 'dashboard UI module must be registered');
assert.equal(typeof dashboardUI.render, 'function');
assert.equal(typeof dashboardUI.enhance, 'function');

const state = engine.createInitialState({ configured: true });
competitor.ensure(state);
const company = state.competitorStates[0];
company.name = '<img src=x onerror=alert(1)>危険企業';
company.lifecycleStatus = 'distressed';
company.status = 'distressed';
company.active = true;
company.lastDistressScore = 8;
company.weeklyRevenue = 2_000_000;
company.weeklyProfit = -400_000;
company.cash = 3_000_000;
company.debt = 8_000_000;
company.creditLimit = 10_000_000;
company.creditScore = 42;
company.cashRunwayWeeks = 1.5;
company.missedDebtPayments = 1;
company.nextDebtRepaymentWeek = 26;
state.competitorEvents.push({ week: state.week, competitorID: company.competitorID, type: 'distressed', text: '構造化イベント', operationID: 'dashboard-ui-event' });
competitor.ensureCounterStates(state);
const counter = state.competitorCounterStates.find(row => row.competitorID === company.competitorID);
counter.pricePressure = 3;
counter.isDistressed = true;

const before = JSON.stringify(state);
const html = dashboardUI.render(state);
assert.equal(JSON.stringify(state), before, 'dashboard render must be read-only');
assert.match(html, /競合ダッシュボード/);
assert.match(html, /監視企業/);
assert.match(html, /信用・資金繰り/);
assert.match(html, /進行中案件/);
assert.match(html, /市場別状況/);
assert.match(html, /業績トレンド/);
assert.match(html, /data-action="respond-rival"/);
assert.match(html, new RegExp(`data-id="${company.competitorID}"`));
assert.match(html, /data-kind="ads"/);
assert.match(html, /data-kind="quality"/);
assert.match(html, /data-kind="acquire"/);
assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'company name must be escaped');
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
for (const forbidden of ['NaN', 'Infinity', 'undefined', '[object Object]']) assert.ok(!html.includes(forbidden), `rendered HTML contains ${forbidden}`);
assert.match(html, new RegExp(`data-kind="acquire"(?![^>]*disabled)`), 'distressed active competitor should be acquirable');

company.lifecycleStatus = 'bankrupt';
company.status = 'bankrupt';
company.active = false;
company.acquiredByPlayer = false;
competitor.ensureCounterStates(state);
const bankruptHtml = dashboardUI.render(state);
const acquireButton = bankruptHtml.match(/<button[^>]+data-kind="acquire"[^>]*>/)?.[0] || '';
assert.match(acquireButton, /disabled/, 'bankrupt competitor acquisition must be disabled');

const linked = new Set(state.competitorStates.map(row => row.legacyCompetitorID).filter(Boolean));
const extraLegacy = state.competitors.find(row => !linked.has(row.id) && Number(row.stores) > 0);
if (extraLegacy) assert.match(html, new RegExp(extraLegacy.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.deepEqual(findStateIssues(state), []);

const screen = { dataset: {}, innerHTML: '' };
const originalGetElementById = ctx.document.getElementById.bind(ctx.document);
ctx.document.getElementById = id => id === 'screen' ? screen : originalGetElementById(id);
const game = new engine.TycoonEngine(state);
game.g.selectedTab = 'rivals';
dashboardUI.bindEngine(game);
assert.equal(dashboardUI.enhance(), true, 'enhance should replace the rivals screen');
assert.equal(screen.dataset.competitorDashboardUi, '1');
assert.match(screen.innerHTML, /競合ダッシュボード/);
const enhancedOnce = screen.innerHTML;
assert.equal(dashboardUI.enhance(), false, 'enhance must be idempotent for the current screen');
assert.equal(screen.innerHTML, enhancedOnce);
ctx.document.getElementById = originalGetElementById;

console.log('competitor dashboard UI tests passed');
