'use strict';

// Issue #734 (P1-01): runTransaction() batched save/emit but never rolled state back, so a
// transaction that threw or did not commit left its partial mutations live (and a save() called
// inside it could persist them). The outermost transaction is now atomic: it restores the state
// it entered with when the work throws or does not commit, nested transactions share that
// boundary, and save/emit happen once, only after a successful commit.
// Runs against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newGame(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Atomic', companyName: 'Atomic Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = 100_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  engine.save();
  // Count the side effects the transaction is responsible for.
  const effects = { save: 0, change: 0 };
  const baseSave = engine.save.bind(engine);
  engine.save = function (...args) { const r = baseSave(...args); if (!this.inTransaction()) effects.save += 1; return r; };
  engine.addEventListener('change', () => { effects.change += 1; });
  return { engine, finance, loaded, effects };
}

const snap = g => JSON.stringify(g);
const stored = loaded => loaded.ctx.__localStorageData.get('capitalism_tycoon_web_v1');

// 1. Mutation then throw -> exact rollback; nothing is saved or emitted.
{
  const { engine, effects, loaded } = newGame(734);
  const before = snap(engine.g), g = engine.g, savedBefore = stored(loaded);
  assert.throws(() => engine.runTransaction(() => {
    engine.g.companyCash -= 12_345;
    engine.g.news.unshift('partial');
    engine.g.stores.push({ id: 'ghost' });
    engine.save();
    throw new Error('boom');
  }), /boom/);
  assert.equal(engine.g, g, 'the state object identity is kept');
  assert.equal(snap(engine.g), before, 'throw rolls the state back exactly');
  assert.equal(effects.save, 0, 'no save after a failed transaction');
  assert.equal(effects.change, 0, 'no change event after a failed transaction');
  assert.equal(stored(loaded), savedBefore, 'a save requested inside the failed transaction never reached storage');
}

// 2. Mutation then false -> exact rollback.
{
  const { engine, effects } = newGame(735);
  const before = snap(engine.g);
  const result = engine.runTransaction(() => { engine.g.companyCash += 999; engine.g.week += 3; return false; });
  assert.equal(result, false);
  assert.equal(snap(engine.g), before, 'a non-committing transaction rolls back');
  assert.equal(effects.save + effects.change, 0);
}

// 3. Finance event then throw -> cash and ledger both roll back; the books still validate.
{
  const { engine, finance } = newGame(736);
  const cash = engine.g.companyCash, rows = engine.g.finance.transactions.length, before = snap(engine.g);
  assert.throws(() => engine.runTransaction(() => {
    engine.g.companyCash -= 5_000_000;
    finance.event(engine.g, 'otherOperating', 5_000_000, { cashEffect: -5_000_000, profitEffect: -5_000_000, sourceType: 'test', sourceID: 'rollback' });
    throw new Error('after the ledger write');
  }));
  assert.equal(engine.g.companyCash, cash);
  assert.equal(engine.g.finance.transactions.length, rows, 'the ledger row is rolled back too');
  assert.equal(snap(engine.g), before);
  const v = finance.validate(engine.g);
  assert.equal(v.ok, true, v.errors.join(' / '));
}

// 4. Nested: an inner throw rolls back to the outer entry, including the outer's own mutations.
{
  const { engine } = newGame(737);
  const before = snap(engine.g);
  assert.throws(() => engine.runTransaction(() => {
    engine.g.companyCash -= 1;
    engine.runTransaction(() => { engine.g.companyCash -= 2; throw new Error('inner'); });
  }), /inner/);
  assert.equal(snap(engine.g), before, 'nested failure restores the outer entry state');
  assert.equal(engine.inTransaction(), false);
}

// 5. Success -> the work is kept and save/emit happen exactly once, even if work saved itself.
{
  const { engine, effects } = newGame(738);
  const cash = engine.g.companyCash;
  const result = engine.runTransaction(() => { engine.g.companyCash += 10; engine.save(); engine.runTransaction(() => { engine.g.companyCash += 5; engine.save(); }); return true; });
  assert.equal(result, true);
  assert.equal(engine.g.companyCash, cash + 15);
  assert.equal(effects.save, 1, 'one save after the commit');
  assert.equal(effects.change, 1, 'one change event after the commit');
}

// 6. A normal transaction still works after a rollback; a production action that fails leaves no trace.
{
  const { engine, effects } = newGame(739);
  assert.throws(() => engine.runTransaction(() => { engine.g.companyCash = -1; throw new Error('x'); }));
  const cash = engine.g.companyCash;
  assert.equal(engine.runTransaction(() => { engine.g.companyCash += 1; return true; }), true);
  assert.equal(engine.g.companyCash, cash + 1);
  assert.equal(effects.save, 1);
  // Production path: the weekly advance throws halfway (a module hook fails) -> the week is not half-applied.
  // One normal week first, so the modules' lazily initialised fields (set outside the week's
  // transaction) already exist and the comparison isolates the week itself.
  assert.notEqual(engine.advanceWeek(false), false);
  const before = snap(engine.g), week = engine.g.week;
  const original = engine.updateMarket;
  engine.updateMarket = function () { original.call(this); throw new Error('market hook failure'); };
  assert.throws(() => engine.advanceWeek(false), /market hook failure/);
  engine.updateMarket = original;
  assert.equal(engine.g.week, week, 'a failed week does not advance the calendar');
  assert.equal(snap(engine.g), before, 'a failed week leaves the state exactly as it was');
  assert.notEqual(engine.advanceWeek(false), false, 'the next week advances normally');
  assert.equal(engine.g.week, week + 1);
}

// 7. A rejected board dismissal still commits its decision record while reporting false
//    (same fixture as executive-dismissal-governance-test: a 92-rated CFO the board keeps).
{
  const loaded = loadGame({ headless: true });
  const engine = new loaded.engineModule.TycoonEngine();
  const g = engine.g;
  g.configured = true; g.week = 160; g.companyReputation = 70; g.employeeSatisfaction = 75; g.boardGovernanceQuality = 65;
  g.executiveManagement = { executives: [{ id: 'exec-high', name: '高評価役員', role: 'CFO', skill: 90, salary: 12_000_000, hiredWeek: 80, fit: 'finance' }], assignments: { finance: 'exec-high' } };
  g.executiveGovernance = { reviews: [{ week: 159, executiveId: 'exec-high', score: 92, rating: 'S' }], boardHistory: [], dismissalDecisions: [], successorId: null, lastReviewWeek: 159 };
  engine.normalize();
  assert.equal(engine.assessExecutiveDismissal('exec-high', 'underperformance').approved, false, 'fixture: the board rejects');
  const cash = g.companyCash;
  assert.equal(engine.dismissExecutiveWithReason('exec-high', 'underperformance'), false);
  assert.equal(g.companyCash, cash, 'no severance is paid');
  assert.ok(g.executiveManagement.executives.some(e => e.id === 'exec-high'));
  assert.equal(g.executiveGovernance?.dismissalDecisions?.at(-1)?.outcome, 'rejected', 'the rejection is recorded');
}

// 8. References held across a failed transaction stay live (the rollback reconciles in place).
{
  const { engine } = newGame(741);
  const finance = engine.g.finance, balances = engine.g.finance.balances, news = engine.g.news;
  const cashBalance = JSON.stringify(balances);
  assert.throws(() => engine.runTransaction(() => {
    engine.g.finance.balances.accruedTaxes = 123;
    engine.g.news.push('x');
    engine.g.finance = { replaced: true };
    throw new Error('late');
  }));
  assert.equal(engine.g.finance, finance, 'a replaced sub-object is reconciled back into the original object');
  assert.equal(engine.g.finance.balances, balances);
  assert.equal(JSON.stringify(balances), cashBalance, 'the held reference sees the restored values');
  assert.equal(engine.g.news, news);
  // A non-committing call that changed nothing keeps everything untouched.
  const store = engine.g.stores, before = snap(engine.g);
  assert.equal(engine.runTransaction(() => false), false);
  assert.equal(engine.g.stores, store);
  assert.equal(snap(engine.g), before);
}

console.log('transaction rollback tests passed');
