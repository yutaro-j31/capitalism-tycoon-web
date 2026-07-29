'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Engine {
  constructor(g) { this.g = g; }
  normalize() {}
  runTransaction(fn) {
    const before = JSON.stringify(this.g);
    const result = fn();
    if (!result) this.g = JSON.parse(before);
    return result;
  }
  fail() { return false; }
  notify() {}
}

const modules = {
  engine: { TycoonEngine: Engine },
  playerEngineBridge: { getEngine: () => null },
  executiveRetirementSuccession: {}
};
const context = { globalThis: null, console, setTimeout, queueMicrotask };
context.globalThis = context;
context.__capitalismTycoonModules = modules;
vm.runInNewContext(fs.readFileSync('js/global-company-ranking-goals.js', 'utf8'), context);

const mod = modules.globalCompanyRankingGoals;
const jsonValue = value => JSON.parse(JSON.stringify(value));

const state = {
  week: 50,
  companyName: 'テスト商事',
  ticker: 'TST',
  cash: 1_000_000_000,
  cumulativeProfit: 500_000_000,
  personalCash: 300_000,
  subsidiaries: [{}],
  executiveManagement: { executives: [{}, {}] }
};
const personal = state.personalCash;
const result = mod.process(state);
assert(result && Number.isFinite(result.rank));
assert(result.rank >= 1 && result.rank <= 500);
assert(Number.isFinite(result.score));
assert.strictEqual(state.personalCash, personal);
assert.strictEqual(mod.process(state), false, '同じ週を二重処理しない');
assert.strictEqual(state.globalRanking.history.length, 1);

const clone = jsonValue({ ...state, globalRanking: undefined });
const same = mod.process(clone);
assert.strictEqual(same.rank, result.rank);
assert.strictEqual(same.score, result.score);

const rich = {
  week: 1,
  companyName: '世界企業',
  cash: 1e15,
  cumulativeProfit: 1e14,
  subsidiaries: Array(20).fill({}),
  executiveManagement: { executives: Array(6).fill({}) }
};
const richResult = mod.process(rich);
assert.strictEqual(richResult.rank, 1);
assert(rich.globalRanking.completedGoalIds.includes('top1'));
assert(rich.globalRanking.prestige >= 185);
const before = { cash: rich.cash, profit: rich.cumulativeProfit };
const achievedPrestige = rich.globalRanking.prestige;
const achievedGoals = [...rich.globalRanking.completedGoalIds];
rich.week = 2;
mod.process(rich);
assert.deepStrictEqual({ cash: rich.cash, profit: rich.cumulativeProfit }, before);
assert.strictEqual(rich.globalRanking.prestige, achievedPrestige, '完了済み目標の名声を二重付与しない');
assert.deepStrictEqual([...rich.globalRanking.completedGoalIds], achievedGoals);

const capped = {
  globalRanking: {
    currentRank: 'bad',
    score: Infinity,
    prestige: -1,
    completedGoalIds: ['top10', 'bad', 'top10'],
    history: Array.from({ length: 120 }, (_, i) => ({ week: i })),
    lastProcessedWeek: 'bad'
  }
};
mod.ensure(capped);
assert.strictEqual(capped.globalRanking.history.length, 80);
assert.strictEqual(capped.globalRanking.history[0].week, 40);
assert.strictEqual(capped.globalRanking.lastProcessedWeek, null);
assert.deepStrictEqual([...capped.globalRanking.completedGoalIds], ['top10']);
assert(Number.isFinite(capped.globalRanking.score));
const normalizedOnce = jsonValue(capped.globalRanking);
mod.ensure(capped);
mod.ensure(capped);
assert.deepStrictEqual(jsonValue(capped.globalRanking), normalizedOnce, 'normalizeは冪等である');

const saved = jsonValue(rich);
mod.ensure(saved);
assert.deepStrictEqual(jsonValue(saved.globalRanking), jsonValue(rich.globalRanking));

const makeLongRunState = () => ({
  week: 1,
  companyName: '長期検証商事',
  ticker: 'LONG',
  cash: 987_654_321,
  cumulativeProfit: 123_456_789,
  personalCash: 7_654_321,
  totalAssets: 1_500_000_000,
  personalAssets: 9_000_000,
  subsidiaries: [{}],
  executiveManagement: { executives: [{}, {}] }
});
const advanceContinuously = (target, weeks) => {
  for (let i = 0; i < weeks; i++) {
    target.week++;
    mod.process(target);
  }
  return target;
};
const replaceWithJsonReload = target => {
  const reloaded = jsonValue(target);
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, reloaded);
  mod.ensure(target);
};
const rankingSnapshot = target => jsonValue({
  week: target.week,
  currentRank: target.globalRanking.currentRank,
  score: target.globalRanking.score,
  prestige: target.globalRanking.prestige,
  completedGoalIds: target.globalRanking.completedGoalIds,
  history: target.globalRanking.history,
  lastProcessedWeek: target.globalRanking.lastProcessedWeek,
  cash: target.cash,
  personalCash: target.personalCash,
  totalAssets: target.totalAssets,
  personalAssets: target.personalAssets,
  cumulativeProfit: target.cumulativeProfit
});

// The production UI's four-week action calls advanceWeek four times. There is no
// engine API that advances an arbitrary number of weeks in one call, so this test
// compares continuous weekly processing with weekly processing split by reloads.
const continuous = advanceContinuously(makeLongRunState(), 1200);
const segmented = makeLongRunState();
for (let block = 0; block < 12; block++) {
  advanceContinuously(segmented, 100);
  replaceWithJsonReload(segmented);
}
assert.deepStrictEqual(
  rankingSnapshot(segmented),
  rankingSnapshot(continuous),
  '連続した週進行と100週単位で保存再読込を挟んだ分割週進行の結果が一致する'
);

assert.strictEqual(continuous.globalRanking.history.length, mod.LIMIT);
assert.strictEqual(continuous.globalRanking.history[0].week, 1122, '最古の保持履歴週が正しい');
assert.strictEqual(continuous.globalRanking.history.at(-1).week, 1201, '最新の保持履歴週が正しい');
const historyLength = continuous.globalRanking.history.length;
const prestigeBeforeDuplicate = continuous.globalRanking.prestige;
const goalsBeforeDuplicate = jsonValue(continuous.globalRanking.completedGoalIds);
assert.strictEqual(mod.process(continuous), false, '1200週後も同じ週を二重処理しない');
assert.strictEqual(continuous.globalRanking.history.length, historyLength);
replaceWithJsonReload(continuous);
assert.strictEqual(mod.process(continuous), false, '保存再読込直後も同じ週を二重処理しない');
assert.strictEqual(continuous.globalRanking.history.length, historyLength);
assert.strictEqual(continuous.globalRanking.prestige, prestigeBeforeDuplicate);
assert.deepStrictEqual(jsonValue(continuous.globalRanking.completedGoalIds), goalsBeforeDuplicate);

assert.deepStrictEqual(
  {
    cash: continuous.cash,
    personalCash: continuous.personalCash,
    totalAssets: continuous.totalAssets,
    personalAssets: continuous.personalAssets,
    cumulativeProfit: continuous.cumulativeProfit
  },
  {
    cash: 987_654_321,
    personalCash: 7_654_321,
    totalAssets: 1_500_000_000,
    personalAssets: 9_000_000,
    cumulativeProfit: 123_456_789
  },
  'ランキング処理は会社・個人資産と会計累計を変更しない'
);

const assertRankingFinite = ranking => {
  assert(Number.isFinite(ranking.currentRank) && ranking.currentRank >= 1);
  assert(Number.isFinite(ranking.score) && ranking.score >= 0);
  assert(Number.isFinite(ranking.prestige) && ranking.prestige >= 0);
  assert(Number.isFinite(ranking.lastProcessedWeek));
  for (const entry of ranking.history) {
    assert(Number.isFinite(entry.week) && entry.week >= 1);
    assert(Number.isFinite(entry.rank) && entry.rank >= 1);
    assert(Number.isFinite(entry.score) && entry.score >= 0);
  }
};
assertRankingFinite(continuous.globalRanking);

// Keep the generic guard cycle-safe while checking the complete synthetic state.
const numericValues = [];
const visited = new Set();
(function collect(value) {
  if (typeof value === 'number') numericValues.push(value);
  else if (value && typeof value === 'object' && !visited.has(value)) {
    visited.add(value);
    Object.values(value).forEach(collect);
  }
})(continuous);
assert(numericValues.every(Number.isFinite), '1200週後も全数値が有限値である');

const html = mod.renderSection({
  g: { configured: true, selectedTab: 'finance', globalRanking: rich.globalRanking }
});
assert(html.includes('min-height:44px'));
assert(html.includes('世界企業ランキング・達成目標'));
const source = fs.readFileSync('js/global-company-ranking-goals.js', 'utf8');
assert(!source.includes('Math.random'));
assert(!source.includes('Date.now'));
assert(source.includes('operationID'));
console.log('global-company-ranking-goals tests passed');
