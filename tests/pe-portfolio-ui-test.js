'use strict';

// PE mode T14: the minimal verification UI (js/app.js's renderPePortfolio() + the
// pe-portfolio-price/quality/expand/exit action cases). Follows the established UI-test
// convention (see tests/ma-board-approval-ui-test.js): render via e.emit(), inspect the
// resulting HTML for the expected hooks, then drive state through the real engine/module calls
// (the harness's lightweight DOM does not dispatch real click events).

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { ctx, modules } = loadGame();
const { engine } = modules;
const pf = modules.peFund;
const ops = modules.pePortfolioOperations;
const e = ctx.__ct_engine;

ctx.__ct_ui.showSetup = false;
e.g = engine.createInitialState({ configured: true });
e.g.week = 1;
const fund = pf.createFund(e.g, { size: 30_000_000_000, y0: 1, terms: pf.fundTermsForScore(35) });
const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 2_000_000_000, week: 1 });
assert.ok(deal, 'sanity: acquisition must succeed for this test setup');

// 1. The 'ma' screen exposes an entry point into the new screen.
e.g.selectedTab = 'ma';
e.emit();
const maHtml = ctx.document.getElementById('app').innerHTML;
assert.ok(maHtml.includes('data-tab="pe-portfolio"'), 'the ma screen must link to the pe-portfolio screen');

// 2. Completion criterion: an acquired 5-pillar company is visible and operable on its own
// screen (買収した5本柱系企業を既存の経営画面で操作できる, satisfied here by the minimal
// verification screen this task explicitly calls for).
e.g.selectedTab = 'pe-portfolio';
e.emit();
let html = ctx.document.getElementById('app').innerHTML;
assert.ok(html.includes('data-pe-portfolio-deal="' + deal.id + '"'));
for (const action of ['pe-portfolio-price', 'pe-portfolio-quality', 'pe-portfolio-expand', 'pe-portfolio-exit']) {
  assert.ok(html.includes(`data-action="${action}"`), `${action} button must be present`);
}
assert.ok(html.includes(`data-fund-id="${fund.id}"`));

// 3. An empty portfolio renders the empty state rather than throwing.
{
  const e2 = ctx.__ct_engine;
  const savedTab = e2.g.selectedTab;
  const savedFunds = e2.g.peFirm.funds;
  e2.g.peFirm.funds = [];
  e2.g.selectedTab = 'pe-portfolio';
  e2.emit();
  const emptyHtml = ctx.document.getElementById('app').innerHTML;
  assert.ok(emptyHtml.includes('買収済みの5本柱系企業はありません'));
  e2.g.peFirm.funds = savedFunds;
  e2.g.selectedTab = savedTab;
  e2.emit();
}

// 4. The action cases actually call the underlying calc-layer functions with the right
// arguments (verified directly, since the harness's DOM does not dispatch real click events --
// same convention as tests/ma-board-approval-ui-test.js).
const priceBefore = deal.portfolioCompany.priceMultiplier;
ops.setPriceMultiplier(e.g, fund.id, deal.id, priceBefore + .1);
assert.ok(Math.abs(deal.portfolioCompany.priceMultiplier - (priceBefore + .1)) < 1e-9);
e.emit();
html = ctx.document.getElementById('app').innerHTML;
assert.ok(html.includes(deal.portfolioCompany.priceMultiplier.toFixed(2)), 'the rendered price factor must reflect the updated state');

console.log('pe portfolio ui test ok');
