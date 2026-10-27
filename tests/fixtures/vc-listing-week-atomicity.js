'use strict';
// P3-4 W-VC-LIST / W-WEEK-STARTUPS: a held Pre-IPO startup lists inside the installed canonical week
// (advanceWeek -> updateStartups -> listStartup), converting both holders' stakes into listed share lots. Inputs are
// pinned; the listing itself is reached through the deterministic simulation RNG of a fixed seed, never by stubbing
// the production draw.
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { indexedDBFor } = require('./pe-fund-acquisition-faults');
const { snapshot, economic } = require('./stock-split-atomicity');
// companyBook is the company's recognised cost basis; personalBook is the founder's own, off the company ledger.
const PINS = Object.freeze({
  company: Object.freeze({ companyBook: 20000000, personalBook: 0 }),
  mixed: Object.freeze({ companyBook: 20000000, personalBook: 10000000 })
});
// A ¥2,000,000,000 Pre-IPO valuation qualifies for listing; 1,000,000 shares list at ¥2,000 before the week's drift.
const VALUATION = 2000000000, SHARES = 1000000;
// The first simulation seed whose week-21 draw (< .025) lists the pinned startup; found by search and pinned.
const SIM_SEED = 2;
async function fixture(variant = 'company') {
  assert.ok(Object.hasOwn(PINS, variant), 'known listing variant');
  const pin = PINS[variant], durable = new Map(), control = { attempts: [] }, host = { draws: 0 };
  let seed = 7;
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control), random: () => {
    host.draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32;
  } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY; await backend.hydrate();
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: 20, companyCash: 500000000, personalCash: 50000000 });
  g.departments.investment = { ...s.modules.data.MASTER.departments.find(d => d.id === 'investment'), established: true };
  g.finance = s.modules.finance.defaultFinanceState(g);
  const game = new s.engineModule.TycoonEngine(g);
  s.modules.simulationRng.reseed(game.g, SIM_SEED);
  const startup = game.g.startups.find(row => row.alive);
  assert.ok(startup, 'an operating startup');
  // Installed commands establish the holdings and the company's recognised investment.
  assert.equal(game.investStartup(startup.id, pin.companyBook, 'company'), true, 'company investment');
  if (pin.personalBook) assert.equal(game.investStartup(startup.id, pin.personalBook, 'personal'), true, 'founder investment');
  const held = game.g.startups.find(row => row.id === startup.id);
  assert.equal(held.totalInvestedCompany, pin.companyBook);
  assert.equal(held.totalInvestedPersonal, pin.personalBook);
  assert.ok(held.ownedCompany > 0 && (pin.personalBook ? held.ownedPersonal > 0 : held.ownedPersonal === 0));
  // A qualifying Pre-IPO with ample runway and no open round; the next week's draw decides the listing.
  Object.assign(held, { stage: 'Pre-IPO', valuation: VALUATION, runwayWeeks: 104, fundingOpen: false });
  assert.ok(!held.activeFundingRound, 'no open round');
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  const result = { ...s, game, backend, key, durable, control, host, variant, pin, startupID: held.id, listHits: 0 };
  // A delegating observer requires the actual installed listing of this startup inside the week transaction.
  const list = game.listStartup;
  game.listStartup = function (startup, ...args) {
    const value = list.call(this, startup, ...args);
    if (startup?.id === held.id && startup.ipoStockID && this.inTransaction()) {
      assert.equal(this.g.week, 21); result.listHits++;
    }
    return value;
  };
  return result;
}
function week(s) {
  const hits = s.listHits;
  try { return s.game.advanceWeek(false); }
  finally { assert.ok(s.listHits > hits, 'actual installed week reaches the pinned listing inside a transaction'); }
}
module.exports = { fixture, snapshot, economic, PINS, SIM_SEED, VALUATION, SHARES, week };
