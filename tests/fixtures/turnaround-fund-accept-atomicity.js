'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { indexedDBFor } = require('./pe-fund-acquisition-faults');
const { snapshot, economic } = require('./stock-split-atomicity');
// The injection is max(15m, 2 * (3m reserve + 3m cash shortfall)) = 15m.
// At 25% of 97m value, round(10,000 * 15m / 24.25m) = 6,186 shares.
// At 25% of 7m value, pricing exceeds the 60% enlarged-share cap: 15,000.
const uncapped = Object.freeze({ amount: 15000000, shares: 6186, value: 97000000 });
const PINS = Object.freeze({ uncapped, capped: Object.freeze({ amount: 15000000, shares: 15000, value: 7000000 }), replace: uncapped });
async function fixture(variant = 'uncapped') {
  assert.ok(Object.hasOwn(PINS, variant), 'known fund fixture');
  const durable = new Map(), control = { attempts: [] }, host = { draws: 0 };
  let seed = 7;
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control), random: () => {
    host.draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32;
  } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate();
  const state = s.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 2, companyCash: -3000000, personalCash: 10000000, companyCredit: 80 });
  const value = variant === 'capped' ? 10000000 : 100000000;
  Object.assign(state.properties[0], { owner: 'company', purchasePrice: value, price: value, value });
  state.finance = s.modules.finance.defaultFinanceState(state); s.modules.playerCrisis.evaluate(state);
  const game = new s.engineModule.TycoonEngine(state);
  if (variant === 'replace') assert.equal(s.modules.playerTurnaroundPlan.start(game.g), true);
  assert.equal(game.g.sharesOut, 10000); assert.equal(game.companyValue(), PINS[variant].value);
  assert.equal(game.g.playerCrisis.reserveThreshold, 3000000); assert.equal(game.g.playerCrisis.status, 'distressed');
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  return { ...s, game, backend, key, durable, control, host, variant, settlement: PINS[variant] };
}
module.exports = { fixture, snapshot, economic, PINS };
