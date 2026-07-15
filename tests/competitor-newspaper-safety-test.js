const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame();
const { engine, competitor } = modules;

const state = engine.createInitialState({ configured: true });
competitor.ensure(state);
state.week = 8;
state.lastNewspaperWeek = 4;
state.lastReport = { sales: 1_000_000, profit: 100_000 };
const lifecycleEvent = {
  week: 8,
  competitorID: state.competitorStates[0].competitorID,
  type: 'distressEntered',
  text: '競合企業が経営危機に移行しました。',
  operationID: 'newspaper-safety-event'
};
state.competitorEvents = [lifecycleEvent];

const game = new engine.TycoonEngine(state);
game.g.week = 8;
game.g.lastNewspaperWeek = 4;
game.g.competitorEvents = [lifecycleEvent];
game.generateMediaWeekly();
const issue = game.g.weeklyNewspaper[0];
assert.ok(issue);
const article = issue.articles.find(row => row.category === '競合');
assert.ok(article);
assert.equal(typeof article.detail, 'string');
assert.equal(article.detail, lifecycleEvent.text);
assert.notEqual(article.detail, lifecycleEvent);
assert.deepEqual(findStateIssues(game.g), []);
assert.doesNotThrow(() => JSON.stringify(game.g));

const sharedEvent = {
  week: 9,
  competitorID: state.competitorStates[0].competitorID,
  type: 'bankruptcy',
  text: '競合企業が倒産しました。',
  operationID: 'shared-newspaper-event'
};
const sharedState = engine.createInitialState({ configured: true });
sharedState.competitorEvents = [sharedEvent];
sharedState.weeklyNewspaper = [{
  id: 'legacy-shared-newspaper',
  week: 9,
  name: '共有参照を持つ旧新聞',
  articles: [{ category: '競合', title: '競争環境アップデート', detail: sharedEvent }]
}];
competitor.sanitizeNewspapers(sharedState);
assert.equal(sharedState.weeklyNewspaper[0].articles[0].detail, sharedEvent.text);
assert.equal(typeof sharedState.weeklyNewspaper[0].articles[0].detail, 'string');
assert.deepEqual(findStateIssues(sharedState), []);
assert.doesNotThrow(() => JSON.stringify(sharedState));

const fallbackState = engine.createInitialState({ configured: true });
fallbackState.weeklyNewspaper = [{
  id: 'fallback-newspaper',
  week: 10,
  name: '本文欠落イベント',
  articles: [{ category: '競合', title: '競争環境アップデート', detail: { competitorID: 'cs-x', type: 'turnaroundStarted', nested: {} } }]
}];
competitor.sanitizeNewspapers(fallbackState);
assert.equal(typeof fallbackState.weeklyNewspaper[0].articles[0].detail, 'string');
assert.match(fallbackState.weeklyNewspaper[0].articles[0].detail, /cs-x|turnaroundStarted/);
assert.deepEqual(findStateIssues(fallbackState), []);

console.log('competitor newspaper safety tests passed');
