const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame({ random: () => 0.42 });
const { engine, competitor, competitorNews } = modules;

const state = engine.createInitialState({ configured: true });
state.competitorEvents = [
  '第1週：旧形式の競合イベント',
  { week: 2, competitorID: state.competitorStates[0].competitorID, type: 'credit', text: '構造化された競合イベント', operationID: 'news-compat-1' }
];
competitor.ensure(state);
assert.equal(state.competitorEvents.length, 2, 'legacy and structured competitor events must both survive normalization');
assert.equal(state.competitorEvents[0], '第1週：旧形式の競合イベント');
assert.equal(state.competitorEvents[1].operationID, 'news-compat-1');

const company = state.competitorStates[0];
company.weeklyProfit = -500000;
company.lossWeeks = 5;
company.distressWeeks = 5;
company.cash = 100000;
competitor.refreshCreditMetrics(state, company);
state.week = 4;
company.lastLifecycleReviewWeek = 3;
competitor.reviewCompanyLifecycle(state, company);
assert.ok(state.competitorEvents.some(event => event && typeof event === 'object' && event.type === 'distress'));
assert.ok(state.competitorEvents.includes('第1週：旧形式の競合イベント'));

const game = new engine.TycoonEngine(state);
game.g.week = 8;
game.g.lastNewspaperWeek = 0;
game.generateMediaWeekly();
const paper = game.g.weeklyNewspaper[0];
assert.ok(paper, 'weekly newspaper must be generated');
const competitorArticle = paper.articles.find(article => article.category === '競合');
assert.ok(competitorArticle, 'competitor article must exist');
assert.equal(typeof competitorArticle.detail, 'string', 'structured event must be rendered as text');
assert.ok(competitorArticle.detail.length > 0);
assert.doesNotThrow(() => JSON.stringify(game.g));
assert.deepEqual(findStateIssues(game.g), []);

const shared = { text: '共有参照テスト', operationID: 'shared-reference' };
const sample = { weeklyNewspaper: [{ articles: [{ category: '競合', detail: shared }] }] };
competitorNews.normalizeNewspaperDetails(sample);
assert.equal(sample.weeklyNewspaper[0].articles[0].detail, '共有参照テスト');

console.log('competitor newspaper compatibility tests passed');
