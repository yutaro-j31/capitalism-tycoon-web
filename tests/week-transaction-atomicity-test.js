'use strict';

// #776: in the production runtime a week advance is one transaction. Every advanceWeek wrapper,
// the delegated executive work and the final weekly boundary (accounting snapshot, crisis state,
// validation, weekly summary) run inside it. Before this, the outermost week transaction was
// opened by player-crisis.js, so 19 later-loaded wrappers and the final boundary ran outside it:
// an exception there left an advanced, partly processed week in memory and in the save.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const KEY = 'capitalism_tycoon_web_v1';

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

// Week 51 with a scheduled debt maturity at week 52: player-debt-service.js repays it from a
// wrapper that sits outside player-crisis.js's own transaction.
function maturityGame() {
  const loaded = loadGame({ random: lcg(0x74000001) });
  const { engineModule, modules } = loaded;
  const state = engineModule.createInitialState({ configured: true });
  state.week = 51;
  state.companyCash = 20_000_000;
  state.companyDebt = 100_000_000;
  state.companyCredit = 60;
  state.policyRate = 0.005;
  state.finance = modules.finance.defaultFinanceState(state);
  state.finance.debtRefinancing = { termWeeks:52, nextMaturityWeek:52, principalShare:.1, feeRate:.005, status:'scheduled', lastProcessedWeek:-1, history:[] };
  const game = new engineModule.TycoonEngine(state);
  assert.equal(Object.getPrototypeOf(game).advanceWeek.__canonicalNormalizeBoundary, true, 'full production runtime ends at the canonical week boundary');
  game.save();
  return { loaded, modules, game };
}

function observe(loaded, game) {
  return {
    state: JSON.stringify(game.g),
    saved: loaded.ctx.__localStorageData.get(KEY)
  };
}

// Throw once from the first finance call made inside a function whose name matches `where`.
function throwOnceFrom(modules, method, where) {
  const original = modules.finance[method];
  let thrown = 0;
  modules.finance[method] = function (...args) {
    if (!thrown && where.test(new Error().stack)) { thrown++; throw new Error(`synthetic failure in ${where}`); }
    return original.apply(this, args);
  };
  return () => thrown;
}

// 1. An exception in a wrapper outside player-crisis.js (debt maturity) rolls the whole week back.
{
  const { loaded, modules, game } = maturityGame();
  const before = observe(loaded, game);
  const thrown = throwOnceFrom(modules, 'event', /processDebtMaturity/);
  assert.throws(() => game.advanceWeek(false), /synthetic failure/);
  assert.equal(thrown(), 1, 'precondition: the debt-maturity wrapper ran and failed');
  const after = observe(loaded, game);
  assert.equal(game.g.week, 51, 'the week does not advance when an outer wrapper fails');
  assert.equal(after.state, before.state, 'the in-memory state is exactly the pre-week state');
  assert.equal(after.saved, before.saved, 'the save is not overwritten with a partly processed week');
}

// 2. An exception in the final weekly boundary rolls the whole week back as well.
{
  const { loaded, modules, game } = maturityGame();
  const before = observe(loaded, game);
  const thrown = throwOnceFrom(modules, 'rebuildSnapshotForWeek', /finalizeWeekBoundary/);
  assert.throws(() => game.advanceWeek(false), /synthetic failure/);
  assert.equal(thrown(), 1, 'precondition: the final weekly boundary ran and failed');
  const after = observe(loaded, game);
  assert.equal(game.g.week, 51, 'the week does not advance when finalization fails');
  assert.equal(after.state, before.state, 'the in-memory state is exactly the pre-week state');
  assert.equal(after.saved, before.saved, 'the save still holds the pre-week state');
}

// 3. Without a failure the same week commits once, finalized, and is saved.
{
  const { loaded, modules, game } = maturityGame();
  const weekEvents = [];
  game.addEventListener('week', event => weekEvents.push(event.detail));
  assert.equal(game.advanceWeek(true), true);
  assert.equal(game.g.week, 52);
  assert.ok(game.g.finance.debtRefinancing.history.some(row => row.week === 52), 'debt maturity ran');
  assert.equal(game.g.playerCrisis.lastEvaluationWeek, 52, 'the final boundary evaluated this week');
  assert.equal(game.g.playerCrisis.lastCash, game.g.companyCash, 'crisis state reads the final cash');
  assert.deepEqual(JSON.parse(JSON.stringify(game.g.finance.lastValidation)), JSON.parse(JSON.stringify(modules.finance.validate(game.g))), 'the recorded validation describes the committed state');
  assert.equal(JSON.parse(loaded.ctx.__localStorageData.get(KEY)).week, 52, 'the committed week is saved');
  assert.equal(weekEvents.length, 1, 'one week event per committed week');
  assert.equal(weekEvents[0].summary, game.g.lastWeeklySummary, 'the week event carries the final weekly summary');
}

console.log('week transaction atomicity tests passed');
