'use strict';

// feature-requests.md R1 remaining item "案件の自動入替": g.startups was populated once
// from 3 fixed master-data templates at game start and never grew, so a startup that died
// (runway exhaustion) or exited (IPO) permanently shrank the investable deal pool with no
// way to refill it. refreshStartupDealFlow() (js/expansion.js) adds new candidates from a
// separate pool when the open (alive, not subsidiary, not IPO'd) count drops below 3, gated
// by founderNetworkLevel -- a personal stat investFounder('network')/attendVentureForum
// already raise but that nothing previously consumed. This is opt-in only in the sense that
// it requires openCount<3 first (a short-circuited && before any RNG draw), so a fresh game
// where all 3 original startups are still alive draws zero extra randomness -- verified here
// to protect the calibration/transaction-baseline fixtures.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 100423001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 100423001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

function killAllStartups(engine) {
  for (const s of engine.g.startups) s.alive = false;
}

// 1. Default fresh game: 3 original startups are alive, so openCount is already 3 and the
// direct call must be a strict no-op.
{
  const { engine } = newGame();
  assert.equal(engine.g.startups.filter(s => s.alive && !s.subsidiary && !s.ipoStockID).length, 3, 'precondition: 3 open startups at game start');
  const before = JSON.stringify(engine.g.startups);
  assert.equal(engine.refreshStartupDealFlow(), false, 'openCount>=3 must be a no-op');
  assert.equal(JSON.stringify(engine.g.startups), before, 'startups array must be untouched');
}

// 2. Once the open count drops below 3, a direct call adds exactly one new, well-formed
// candidate with a name that doesn't collide with any existing entry.
{
  const { engine } = newGame();
  engine.g.startups[0].alive = false;
  const existingNames = new Set(engine.g.startups.map(s => s.name));
  const before = engine.g.startups.length;
  assert.equal(engine.refreshStartupDealFlow(), true, 'openCount<3 must add a new candidate');
  assert.equal(engine.g.startups.length, before + 1, 'exactly one new startup must be added');
  const added = engine.g.startups[engine.g.startups.length - 1];
  assert.ok(!existingNames.has(added.name), 'new candidate must not collide with an existing name');
  for (const key of ['valuation', 'minTicket', 'growth', 'risk', 'runwayWeeks', 'productProgress']) {
    assert.ok(Number.isFinite(added[key]), `${key} must be finite`);
  }
  assert.equal(added.alive, true);
  assert.equal(added.subsidiary, false);
  assert.equal(added.ownedCompany, 0);
  assert.equal(added.ownedPersonal, 0);
  assert.equal(added.fundingOpen, true);
}

// 3. The new candidate is fully usable through the existing production investStartup()
// action -- proves the pushed shape matches what the rest of the engine expects, with no
// special-casing needed. Company-account investment must not touch personalCash/personalStocks.
{
  const { modules, engine } = newGame();
  engine.g.startups[0].alive = false;
  assert.equal(engine.refreshStartupDealFlow(), true);
  const added = engine.g.startups[engine.g.startups.length - 1];
  // Company-account investment requires the investment department; use the store-zero
  // route (already implemented) since this fresh game has no stores yet.
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);
  const companyCashBefore = engine.g.companyCash, personalCashBefore = engine.g.personalCash;
  const personalStocksBefore = JSON.stringify(engine.g.personalStocks);
  assert.equal(engine.investStartup(added.id, added.minTicket, 'company'), true, '新規案件は既存のinvestStartupでそのまま投資できる');
  assert.ok(engine.g.companyCash < companyCashBefore, 'companyCash must decrease by the investment');
  assert.equal(engine.g.personalCash, personalCashBefore, 'personalCash must be untouched by a company-account investment');
  assert.equal(JSON.stringify(engine.g.personalStocks), personalStocksBefore, 'personalStocks must be untouched');
  assert.ok(added.ownedCompany > 0, 'ownedCompany must reflect the investment');
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 4. The deal pool is finite (6 templates): after 6 successful refreshes the pool is
// exhausted and a 7th call must fail cleanly rather than producing a duplicate name.
{
  const { engine } = newGame();
  const addedNames = new Set();
  for (let i = 0; i < 6; i++) {
    killAllStartups(engine);
    assert.equal(engine.refreshStartupDealFlow(), true, `refresh #${i + 1} must succeed while pool candidates remain`);
    const added = engine.g.startups[engine.g.startups.length - 1];
    assert.ok(!addedNames.has(added.name), 'each refresh must add a distinct name');
    addedNames.add(added.name);
  }
  assert.equal(addedNames.size, 6, 'all 6 pool templates must have been used');
  killAllStartups(engine);
  assert.equal(engine.refreshStartupDealFlow(), false, 'a 7th refresh must fail once the pool is exhausted');
}

// 5. No early auto-trigger: with all 3 originals still alive (openCount stays 3 well before
// any of them can hit runway exhaustion), advancing several weeks must never grow the
// startups array -- the openCount<3 short-circuit must prevent even the RNG gate check.
{
  const { engine } = newGame();
  for (let i = 0; i < 10; i++) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(engine.g.startups.length, 3, 'startups array must stay at 3 while all originals remain open');
}

// 6. Weekly integration: with the open count forced below 3 and founderNetworkLevel at its
// maximum (highest weekly refresh probability), advancing many weeks must eventually add a
// new startup through generateRecurringEvents() -- not just through the direct call tested
// above. Deterministic under the fixed seed used here (not a flaky probabilistic assertion).
{
  const { engine } = newGame(552001);
  engine.g.startups[0].alive = false;
  engine.g.founderNetworkLevel = 100;
  const before = engine.g.startups.length;
  let grew = false;
  for (let i = 0; i < 80 && !grew; i++) {
    assert.notEqual(engine.advanceWeek(false), false);
    if (engine.g.startups.length > before) grew = true;
  }
  assert.ok(grew, 'generateRecurringEvents() must eventually add a new startup while openCount<3');
}

// 7. Determinism: same seed, same actions -> identical resulting startups array.
{
  function run() {
    const { engine } = newGame(778899);
    engine.g.startups[0].alive = false;
    engine.refreshStartupDealFlow();
    return JSON.stringify(engine.g.startups);
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 8. Save/reload round trip.
{
  const { modules, engine } = newGame();
  engine.g.startups[0].alive = false;
  assert.equal(engine.refreshStartupDealFlow(), true);
  const before = JSON.stringify(engine.g.startups);
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  assert.equal(JSON.stringify(reloaded.g.startups), before, 'reload後もstartupsが一致する');
}

// 9. Static source scan: no new MutationObserver introduced by this feature.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  const expansionSrc = fs.readFileSync(path.join(__dirname, '../js/expansion.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(engineSrc), 'engine.jsに新しいMutationObserverを追加していない');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(expansionSrc), 'expansion.jsに新しいMutationObserverを追加していない');
}

console.log('Startup deal flow refresh tests passed');
