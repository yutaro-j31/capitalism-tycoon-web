'use strict';
// P3-4 W-VC-CLOSE / W-WEEK-STARTUPS: an open startup funding round reaches its closing week inside the installed
// canonical week (advanceWeek -> updateStartups -> closeStartupFundingRound), which dilutes and re-prices both holders'
// stakes. Holdings and contributions are made through installed commands; the round's terms are pinned.
const assert = require('node:assert/strict');
const { loadGame } = require('../harness');
const { indexedDBFor } = require('./pe-fund-acquisition-faults');
const { snapshot, economic } = require('./stock-split-atomicity');
// Pinned round: Series A at a 300M pre-money opens a Series B raising 20% (60M), so post-money is 360M.
const TERMS = Object.freeze({ pre: 300000000, raise: 60000000, post: 360000000, from: 'Series A', round: 'Series B', openedWeek: 20, closesWeek: 24 });
// company: the company alone holds and pays half its pro-rata share. mixed: the company maintains its stake in full
// while the founder, also a holder, does not participate and is diluted.
const PINS = Object.freeze({
  company: Object.freeze({ companyBook: 20000000, personalBook: 0, companyShare: 0.5, personalShare: 0 }),
  mixed: Object.freeze({ companyBook: 20000000, personalBook: 10000000, companyShare: 1, personalShare: 0 })
});
async function fixture(variant = 'company') {
  assert.ok(Object.hasOwn(PINS, variant), 'known round-close variant');
  const pin = PINS[variant], durable = new Map(), control = { attempts: [] }, host = { draws: 0 };
  let seed = 11;
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable, control), random: () => {
    host.draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32;
  } });
  const backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY; await backend.hydrate();
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: TERMS.openedWeek, companyCash: 500000000, personalCash: 50000000 });
  g.departments.investment = { ...s.modules.data.MASTER.departments.find(d => d.id === 'investment'), established: true };
  g.finance = s.modules.finance.defaultFinanceState(g);
  const game = new s.engineModule.TycoonEngine(g);
  s.modules.simulationRng.reseed(game.g, 1);
  const startup = game.g.startups.find(row => row.alive);
  assert.ok(startup, 'an operating startup');
  // Installed commands establish the holdings and the company's recognised investment.
  assert.equal(game.investStartup(startup.id, pin.companyBook, 'company'), true, 'company investment');
  if (pin.personalBook) assert.equal(game.investStartup(startup.id, pin.personalBook, 'personal'), true, 'founder investment');
  const held = game.g.startups.find(row => row.id === startup.id);
  assert.ok(held.ownedCompany > 0 && (pin.personalBook ? held.ownedPersonal > 0 : held.ownedPersonal === 0));
  // Pin the round's terms, then open it through the installed opener. Half of each stake carries negotiated due-diligence
  // terms, so the close must dilute those fractions as well.
  Object.assign(held, { stage: TERMS.from, valuation: TERMS.pre, fundingOpen: true, runwayWeeks: 10,
    ddNegotiatedOwnedCompany: held.ownedCompany / 2, ddNegotiatedOwnedPersonal: held.ownedPersonal / 2 });
  assert.equal(game.openStartupFundingRound(held), true, 'round opens');
  const plan = game.getStartupFundingRoundPlan(held.id);
  assert.deepEqual([plan.round, plan.preMoneyValuation, plan.targetRaise, plan.postMoneyValuation, plan.closesWeek],
    [TERMS.round, TERMS.pre, TERMS.raise, TERMS.post, TERMS.closesWeek]);
  const paid = { company: plan.company.proRataRequired * pin.companyShare, personal: plan.personal.proRataRequired * pin.personalShare };
  for (const account of ['company', 'personal'])
    if (paid[account] > 0) assert.equal(game.participateStartupFundingRound(held.id, paid[account], account), true, account + ' contribution');
  // The receipts sit inside the round window; the next installed week is the closing week.
  game.g.week = TERMS.closesWeek - 1;
  assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  const round = JSON.parse(JSON.stringify(held.activeFundingRound));
  const result = { ...s, game, backend, key, durable, control, host, variant, pin, paid, round, startupID: held.id, closeHits: 0 };
  // A delegating observer requires the actual installed close of this round inside the week transaction.
  const close = game.closeStartupFundingRound;
  game.closeStartupFundingRound = function (startup, ...args) {
    const value = close.call(this, startup, ...args);
    if (startup?.id === held.id && value === true && this.inTransaction()) { assert.equal(this.g.week, TERMS.closesWeek); result.closeHits++; }
    return value;
  };
  return result;
}
function week(s) {
  const hits = s.closeHits;
  try { return s.game.advanceWeek(false); }
  finally { assert.ok(s.closeHits > hits, 'actual installed week closes the pinned round inside a transaction'); }
}
module.exports = { fixture, snapshot, economic, PINS, TERMS, week };
