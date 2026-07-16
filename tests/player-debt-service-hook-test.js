const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

function seededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

const { modules } = loadGame({ random: seededRandom(0x6a3a0001) });
const { engine, finance, playerDebtService } = modules;

assert.ok(playerDebtService?.__installed, 'player debt service module must be registered');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);
assert.equal(engine.TycoonEngine.prototype.__playerDebtServiceInstalled, true);
assert.equal(typeof engine.TycoonEngine.prototype.companyWeeklyBorrowRate, 'function');
assert.equal(typeof engine.TycoonEngine.prototype.companyWeeklyInterest, 'function');

function makeDebtGame() {
  const state = engine.createInitialState({ configured: true });
  state.companyCash = 100_000_000;
  state.companyDebt = 52_000_000;
  state.companyCredit = 60;
  state.policyRate = 0.005;
  state.finance = finance.defaultFinanceState(state);
  return new engine.TycoonEngine(state);
}
function legacyRate(game) {
  return Math.max(0.012, Math.min(0.12, game.g.policyRate + 0.018 + (100 - game.g.companyCredit) * 0.00025));
}
function legacyInterest(game) {
  return game.g.companyDebt * legacyRate(game) / 52;
}

const game = makeDebtGame();
const openingRate = legacyRate(game);
const openingInterest = legacyInterest(game);
assert.equal(game.companyBorrowRate(), openingRate, 'normal borrowing rate must remain unchanged outside weekly processing');
assert.equal(game.companyWeeklyBorrowRate(), openingRate);
assert.equal(game.companyWeeklyInterest(), openingInterest);
assert.equal(playerDebtService.baseRate(game), openingRate);
assert.equal(playerDebtService.weeklyRate(game), openingRate);
assert.equal(playerDebtService.weeklyInterest(game), openingInterest);
assert.equal(playerDebtService.inWeeklyContext(game), false);

assert.equal(game.advanceWeek(false), true);
const settledInterest = legacyInterest(game);
assert.equal(game.g.lastReport.interest, settledInterest, 'default weekly interest must preserve the legacy post-macro formula exactly');
assert.equal(playerDebtService.inWeeklyContext(game), false, 'weekly context must be released after a successful week');
assert.equal(game.companyBorrowRate(), legacyRate(game), 'weekly processing must not change later borrowing quotes');
const baseInterestTxn = game.g.finance.transactions.find(row => row.week === game.g.week && row.category === 'interestExpense');
assert.ok(baseInterestTxn, 'weekly interest transaction must remain recorded');
assert.equal(baseInterestTxn.amount, settledInterest);
assert.equal(baseInterestTxn.cashEffect, -settledInterest);
assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join(' / '));
assert.deepEqual(findStateIssues(game.g), []);

const negotiated = makeDebtGame();
let sawWeeklyContext = false;
negotiated.companyWeeklyBorrowRate = function() {
  sawWeeklyContext = playerDebtService.inWeeklyContext(this);
  return 0.01;
};
assert.equal(negotiated.companyBorrowRate(), legacyRate(negotiated), 'weekly override must not alter ordinary borrowing quotes');
assert.equal(negotiated.companyWeeklyInterest(), 10_000);
assert.equal(negotiated.advanceWeek(false), true);
assert.equal(sawWeeklyContext, true, 'weekly hook must execute only inside the weekly debt-service context');
assert.equal(negotiated.g.lastReport.interest, 10_000);
assert.equal(negotiated.companyBorrowRate(), legacyRate(negotiated), 'ordinary rate must be restored immediately after weekly processing');
assert.equal(playerDebtService.inWeeklyContext(negotiated), false);
const negotiatedTxn = negotiated.g.finance.transactions.find(row => row.week === negotiated.g.week && row.category === 'interestExpense');
assert.ok(negotiatedTxn);
assert.equal(negotiatedTxn.amount, 10_000);
assert.equal(negotiatedTxn.cashEffect, -10_000);
assert.equal(finance.validate(negotiated.g).ok, true, finance.validate(negotiated.g).errors.join(' / '));
assert.deepEqual(findStateIssues(negotiated.g), []);

const invalid = makeDebtGame();
invalid.companyWeeklyBorrowRate = () => Number.NaN;
assert.equal(playerDebtService.weeklyRate(invalid), legacyRate(invalid), 'non-finite hooks must fall back to the legacy rate');
invalid.companyWeeklyBorrowRate = () => 99;
assert.equal(playerDebtService.weeklyRate(invalid), 0.18, 'weekly rate must remain bounded');
invalid.companyWeeklyBorrowRate = () => -1;
assert.equal(playerDebtService.weeklyRate(invalid), 0, 'weekly rate must not become negative');

const throwing = makeDebtGame();
throwing.companyWeeklyBorrowRate = () => { throw new Error('debt hook test failure'); };
assert.throws(() => throwing.advanceWeek(false), /debt hook test failure/);
assert.equal(playerDebtService.inWeeklyContext(throwing), false, 'weekly context must be released after an exception');
assert.equal(throwing.companyBorrowRate(), legacyRate(throwing), 'ordinary borrowing rate must recover after an exception');

const restored = new engine.TycoonEngine(JSON.parse(JSON.stringify(negotiated.g)));
assert.equal(restored.companyBorrowRate(), legacyRate(restored));
assert.equal(restored.companyWeeklyBorrowRate(), legacyRate(restored), 'runtime hooks must not leak into persisted state');
assert.deepEqual(findStateIssues(restored.g), []);

console.log('player debt service hook tests passed');
