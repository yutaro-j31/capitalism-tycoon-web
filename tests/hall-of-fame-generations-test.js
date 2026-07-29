'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Engine {
  constructor(g) { this.g = g; }
  normalize() {}
  runTransaction(fn) { return fn(); }
  notify() {}
  fail() { return false; }
}

const modules = {
  engine: { TycoonEngine: Engine },
  playerEngineBridge: { getEngine: () => null },
  globalCompanyRankingGoals: {}
};
const context = { globalThis: null, console };
context.globalThis = context;
context.__capitalismTycoonModules = modules;
vm.runInNewContext(fs.readFileSync('js/hall-of-fame-generations.js', 'utf8'), context);

const mod = modules.hallOfFameGenerations;
const clone = value => JSON.parse(JSON.stringify(value));
const snapshot = value => ({
  cash: value.cash,
  personalCash: value.personalCash,
  totalAssets: value.totalAssets,
  personalAssets: value.personalAssets,
  cumulativeProfit: value.cumulativeProfit
});

const state = {
  saveVersion: 9,
  week: 10,
  cash: 1000,
  personalCash: 500,
  totalAssets: 5000,
  personalAssets: 800,
  cumulativeProfit: 100,
  subsidiaries: Array(5).fill({}),
  globalRanking: { currentRank: 8, score: 2000, prestige: 50 }
};
const before = snapshot(state);
const unlocked = mod.process(state);
assert.strictEqual(unlocked.length, 4);
assert.strictEqual(mod.process(state), false);
assert.deepStrictEqual(snapshot(state), before);

const rec = mod.retireGeneration(state);
assert.strictEqual(rec.generation, 1);
assert.strictEqual(state.hallOfFame.generation, 2);
assert.strictEqual(state.hallOfFame.records.length, 1);
assert.strictEqual(mod.retireGeneration(state), false);
assert.strictEqual(state.hallOfFame.generation, 2);
assert.strictEqual(state.hallOfFame.records.length, 1);
assert.deepStrictEqual(snapshot(state), before);

const saved = clone(state);
mod.ensure(saved);
assert.deepStrictEqual(clone(saved.hallOfFame), clone(state.hallOfFame));
const normalized = clone(saved.hallOfFame);
mod.ensure(saved);
mod.ensure(saved);
assert.deepStrictEqual(clone(saved.hallOfFame), normalized);

const capped = {
  hallOfFame: {
    generation: 'bad',
    legacyPoints: Infinity,
    achievements: Array(100).fill('a'),
    records: Array.from({ length: 120 }, (_, i) => ({ week: i })),
    lastProcessedWeek: 'bad',
    lastRetiredWeek: 'bad'
  }
};
mod.ensure(capped);
assert.strictEqual(capped.hallOfFame.records.length, 80);
assert.strictEqual(capped.hallOfFame.lastProcessedWeek, null);
assert.strictEqual(capped.hallOfFame.lastRetiredWeek, null);
assert(Number.isFinite(capped.hallOfFame.legacyPoints));

// Long-run determinism: advancing one week at a time must match segmented
// progression with a JSON save/reload every 100 weeks.
function makeLongRunState() {
  return {
    saveVersion: 9,
    week: 0,
    cash: 12_345_678,
    personalCash: 2_345_678,
    totalAssets: 98_765_432,
    personalAssets: 8_765_432,
    cumulativeProfit: 5_000_000,
    subsidiaries: Array(5).fill({}),
    globalRanking: { currentRank: 9, score: 2500, prestige: 60 }
  };
}

function advance(input, fromWeek, toWeek, reloadEvery = 0) {
  let current = input;
  for (let week = fromWeek; week <= toWeek; week++) {
    current.week = week;
    mod.process(current);
    if (week % 15 === 0) mod.retireGeneration(current);
    if (reloadEvery > 0 && week % reloadEvery === 0) {
      current = clone(current);
      mod.ensure(current);
    }
  }
  return current;
}

const weeklyStart = makeLongRunState();
const segmentedStart = clone(weeklyStart);
const financialBefore = snapshot(weeklyStart);
const weeklyResult = advance(weeklyStart, 1, 1200, 0);
const segmentedResult = advance(segmentedStart, 1, 1200, 100);

assert.deepStrictEqual(clone(segmentedResult.hallOfFame), clone(weeklyResult.hallOfFame));
assert.deepStrictEqual(snapshot(weeklyResult), financialBefore);
assert.deepStrictEqual(snapshot(segmentedResult), financialBefore);
assert.strictEqual(weeklyResult.hallOfFame.records.length, mod.LIMIT);
assert.strictEqual(segmentedResult.hallOfFame.records.length, mod.LIMIT);
assert.strictEqual(weeklyResult.hallOfFame.generation, 81);
assert.strictEqual(segmentedResult.hallOfFame.generation, 81);
assert.strictEqual(weeklyResult.saveVersion, 9);
assert.strictEqual(segmentedResult.saveVersion, 9);
for (const value of [
  weeklyResult.hallOfFame.generation,
  weeklyResult.hallOfFame.legacyPoints,
  weeklyResult.hallOfFame.lastProcessedWeek,
  weeklyResult.hallOfFame.lastRetiredWeek,
  ...weeklyResult.hallOfFame.records.flatMap(row => [row.generation, row.week, row.rank, row.score, row.prestige, row.legacyPoints])
]) assert(Number.isFinite(value));

const html = mod.renderSection({ g: { configured: true, selectedTab: 'finance', hallOfFame: state.hallOfFame } });
assert(html.includes('min-height:44px'));
const source = fs.readFileSync('js/hall-of-fame-generations.js', 'utf8');
assert(!source.includes('Math.random'));
assert(!source.includes('Date.now'));
assert(source.includes('operationID'));
console.log('hall-of-fame-generations tests passed');
