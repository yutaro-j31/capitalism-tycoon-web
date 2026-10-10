'use strict';

// The turnaround-fund ratchet (settle()) issues free shares after the base advanceWeek chain.
// It must be rolled back with the week when the final weekly boundary fails (#922 Writer matrix:
// "Turnaround ratchet ... week boundary unproven"). Test-only: no production change.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const KEY = 'capitalism_tycoon_web_v1';
function lcg(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function fixture() {
  const loaded = loadGame({ random: lcg(7), headless: true });
  const { engine, finance, playerCrisis } = loaded.modules;
  const state = engine.createInitialState({ configured: true });
  state.week = 2;
  state.companyCash = -3_000_000;
  state.companyCredit = 80;
  const property = state.properties[0];
  property.owner = 'company';
  property.purchasePrice = property.price = property.value = 100_000_000;
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  const game = new engine.TycoonEngine(state);
  assert.equal(game.acceptTurnaroundFund().ok !== false, true, 'fund accepted');
  game.save();
  return { loaded, game };
}

// Reference run: find how many weeks until the ratchet fires.
let ratchetWeeks = 0;
{
  const { game } = fixture();
  while (game.turnaroundFundSnapshot().status !== 'ratcheted' && ratchetWeeks < 30) {
    game.advanceWeek(false);
    ratchetWeeks++;
  }
  assert.equal(game.turnaroundFundSnapshot().status, 'ratcheted', 'precondition: the fund ratchets without intervention');
}

// Failure run: fail the final boundary in the very week the ratchet would fire.
{
  const { loaded, game } = fixture();
  for (let i = 0; i < ratchetWeeks - 1; i++) game.advanceWeek(false);
  assert.notEqual(game.turnaroundFundSnapshot().status, 'ratcheted');
  const state = JSON.stringify(game.g);
  const saved = loaded.ctx.__localStorageData.get(KEY);
  const finance = loaded.modules.finance;
  const original = finance.rebuildSnapshotForWeek;
  let thrown = 0;
  finance.rebuildSnapshotForWeek = function (...args) {
    if (!thrown && /finalizeWeekBoundary/.test(new Error().stack)) { thrown++; throw new Error('synthetic boundary failure'); }
    return original.apply(this, args);
  };
  assert.throws(() => game.advanceWeek(false), /synthetic boundary failure/);
  assert.equal(thrown, 1, 'precondition: the final boundary ran (after settle) and failed');
  assert.equal(JSON.stringify(game.g), state, 'ratchet shares and fund status are rolled back with the week');
  assert.equal(loaded.ctx.__localStorageData.get(KEY), saved, 'the save is not overwritten');
  finance.rebuildSnapshotForWeek = original;
  game.advanceWeek(false);
  assert.equal(game.turnaroundFundSnapshot().status, 'ratcheted', 'retry commits the ratchet exactly once');
}

console.log('player crisis turnaround ratchet week rollback tests passed');
