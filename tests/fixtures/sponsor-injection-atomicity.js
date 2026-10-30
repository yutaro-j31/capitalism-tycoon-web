'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { indexedDBFor } = require('./pe-fund-acquisition-faults');
const { snapshot, economic } = require('./stock-split-atomicity');

// 100m property less 1m cash shortfall = 99m company value; 40% pricing
// gives 39.6m pre-money. max(8m, 3m reserve + 1m shortfall) = 8m cash;
// round(10,000 * 8m / 39.6m) = 2,020 newly issued shares.
const SETTLEMENT = Object.freeze({ amount: 8000000, shares: 2020 });
async function fixture() {
  const durable = new Map(), control = { attempts: [] }, host = { draws: 0 };
  let seed = 7;
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control), random: () => {
    host.draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32;
  } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate();
  const state = s.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 2, companyCash: -1000000, personalCash: 10000000, companyCredit: 80 });
  Object.assign(state.properties[0], { owner: 'company', purchasePrice: 100000000, price: 100000000, value: 100000000 });
  state.finance = s.modules.finance.defaultFinanceState(state);
  s.modules.playerCrisis.evaluate(state);
  const game = new s.engineModule.TycoonEngine(state);
  assert.equal(game.g.sharesOut, 10000); assert.equal(game.companyValue(), 99000000);
  assert.equal(game.g.playerCrisis.reserveThreshold, 3000000);
  assert.equal(game.g.playerCrisis.status, 'distressed');
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  return { ...s, game, backend, key, durable, control, host };
}
module.exports = { fixture, snapshot, economic, SETTLEMENT };
