'use strict';
// #745 (owner decision): a real player founding a gym on Hard could not open a first store at all.
// Hard starts with 6M company cash and 2.1M of ordinary credit room, so after borrowing the full room
// the shortfall at every gym tenant (6.27M-7.38M) was above the gym startup loan's 4.6M cutoff, and
// openStore() failed at all 47 gym tenants. Hard alone now gets a 7.5M cutoff (principal cap = cutoff
// + reserve); Easy and Normal keep the measured 4.6M cutoff and 5.5M cap.
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadGame } = require('./harness');

const lcg = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

function newGame(difficulty) {
  const loaded = loadGame({ headless: true, random: lcg(0x6a1) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'G', companyName: 'ジム創業', difficulty, scenario: 'free' });
  return { loaded, engine };
}

// --- 1. Limits per difficulty ---
{
  const { loaded } = newGame('normal');
  const mod = loaded.modules.bankLoansCovenants;
  assert.equal(mod.GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX, 4_600_000, 'Easy/Normal cutoff is unchanged');
  assert.equal(mod.GYM_STARTUP_MAX, 5_500_000, 'Easy/Normal principal cap is unchanged');
  assert.equal(mod.GYM_STARTUP_HARD_REQUIRED_MAX, 7_500_000);
  assert.equal(mod.GYM_STARTUP_HARD_MAX, 8_500_000);
  for (const difficulty of ['easy', 'normal']) {
    const state = { week: 1, companyCash: 0, cash: 0, difficulty, stores: [] };
    assert.equal(mod.gymStartupQuote(state, 4_600_000).eligible, true, `${difficulty}: 4.6M shortfall is eligible`);
    assert.equal(mod.gymStartupQuote(state, 4_600_001).eligible, false, `${difficulty}: 1 yen over 4.6M is not eligible`);
  }
  const hard = { week: 1, companyCash: 0, cash: 0, difficulty: 'hard', stores: [] };
  const atCutoff = mod.gymStartupQuote(hard, 7_500_000);
  assert.equal(atCutoff.eligible, true, 'hard: 7.5M shortfall is eligible');
  assert.equal(atCutoff.principal, 8_500_000, 'hard: principal is shortfall + reserve, capped at 8.5M');
  assert.equal(mod.gymStartupQuote(hard, 7_500_001).eligible, false, 'hard: 1 yen over 7.5M is not eligible');
  console.log('1. per-difficulty limits: pass');
}

// --- 2. A real player can open a first gym at every gym tenant on every difficulty ---
for (const difficulty of ['easy', 'normal', 'hard']) {
  const { engine: probe } = newGame(difficulty);
  const gym = probe.business('gym');
  const tenantIDs = probe.g.tenants.filter(t => !t.occupiedBy && t.businessID === 'gym').map(t => t.id);
  assert.equal(tenantIDs.length, 47, `${difficulty}: one gym tenant per prefecture`);
  const failed = [];
  for (const tenantID of tenantIDs) {
    const { loaded, engine } = newGame(difficulty);
    const tenant = engine.g.tenants.find(t => t.id === tenantID);
    const upfront = gym.storeCost + (tenant.deposit || 0);
    // What a player does: borrow up to the ordinary credit room, then open (openStore takes the startup loan).
    const room = Math.max(0, Math.floor(engine.companyCreditLimit() - (engine.g.companyDebt || 0)));
    const borrow = Math.min(Math.max(0, upfront - engine.g.companyCash), room);
    if (borrow > 0) assert.ok(engine.borrow(borrow, 'company'), `${difficulty} ${tenantID}: ordinary borrowing`);
    const quote = loaded.modules.bankLoansCovenants.gymStartupQuote(engine.g, upfront);
    const opened = engine.openStore({ tenantID, businessID: 'gym', name: 'ジム1号店', operatingHours: 3 }) === true;
    if (!opened) { failed.push({ tenantID, upfront, cash: engine.g.companyCash, required: quote.required }); continue; }
    assert.equal(engine.g.stores.filter(s => s.businessID === 'gym').length, 1, `${difficulty} ${tenantID}: one gym opened`);
    assert.ok(engine.g.companyCash >= 0, `${difficulty} ${tenantID}: company cash stays non-negative`);
    const validation = loaded.modules.finance.validate(engine.g);
    assert.equal(validation.ok, true, `${difficulty} ${tenantID}: finance.validate ${JSON.stringify(validation.errors || validation)}`);
  }
  assert.deepEqual(failed, [], `${difficulty}: every gym tenant must be openable by a founding player`);
  console.log(`2. ${difficulty}: ${tenantIDs.length}/${tenantIDs.length} gym tenants openable: pass`);
}
console.log('gym-startup-hard-founding-test: pass');
