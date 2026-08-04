const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

function seededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

const { modules } = loadGame({ random: seededRandom(0x6a4c0001), isolatedLegacyIndex:true });
const { engine, finance, playerDebtService, playerCrisisCreditor } = modules;

assert.ok(playerDebtService?.__installed, 'player debt service module must be registered');
assert.ok(playerCrisisCreditor?.__installed, 'creditor module must be registered first');
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
  const game = new engine.TycoonEngine(state);
  const loan = playerCrisisCreditor.activeLoans(game.g)[0];
  assert.ok(loan, 'an active debt record is required');
  return { game, loan };
}
function legacyRate(game) {
  return Math.max(0.012, Math.min(0.12, game.g.policyRate + 0.018 + (100 - game.g.companyCredit) * 0.00025));
}
function ledgerPrecision(value) {
  return Math.round(Number(value) * 100) / 100;
}
function structuralIssues(state) {
  return findStateIssues(state).filter(issue => !issue.startsWith('g.finance.lastStatements.ratios.'));
}

const baseCase = makeDebtGame();
assert.equal(baseCase.game.companyBorrowRate(), legacyRate(baseCase.game));
assert.equal(playerDebtService.ordinaryRate(baseCase.game), legacyRate(baseCase.game));
assert.equal(playerDebtService.negotiatedRate(baseCase.game), legacyRate(baseCase.game));
assert.equal(playerDebtService.inWeeklyContext(baseCase.game), false);

const negotiated = makeDebtGame();
const ordinaryQuote = negotiated.game.companyBorrowRate();
negotiated.loan.crisisNegotiatedRateDiscount = 0.01;
negotiated.loan.interestRate = Math.max(0.008, ordinaryQuote - 0.01);
assert.equal(negotiated.game.companyBorrowRate(), ordinaryQuote, 'negotiated relief must not change ordinary borrowing quotes');
assert.equal(playerDebtService.ordinaryRate(negotiated.game), ordinaryQuote);
assert.ok(playerDebtService.negotiatedRate(negotiated.game) < ordinaryQuote, 'weekly negotiated rate must reflect loan relief');
assert.equal(playerDebtService.inWeeklyContext(negotiated.game), false);

let usedRate = null;
let debtAtInterest = null;
const defaultWeeklyRate = negotiated.game.companyWeeklyBorrowRate;
negotiated.game.companyWeeklyBorrowRate = function() {
  usedRate = defaultWeeklyRate.call(this);
  debtAtInterest = this.g.companyDebt;
  assert.equal(playerDebtService.inWeeklyContext(this), true, 'weekly rate must be requested only inside advanceWeek context');
  return usedRate;
};
assert.equal(negotiated.game.advanceWeek(false), true);
assert.equal(negotiated.game.g.lastReport.interest, debtAtInterest * usedRate / 52);
assert.equal(playerDebtService.inWeeklyContext(negotiated.game), false, 'weekly context must be released after success');
assert.equal(negotiated.game.companyBorrowRate(), legacyRate(negotiated.game), 'ordinary quote must be restored after weekly processing');
const interestTxn = negotiated.game.g.finance.transactions.find(row => row.week === negotiated.game.g.week && row.category === 'interestExpense');
assert.ok(interestTxn, 'weekly interest transaction must remain recorded');
assert.equal(interestTxn.amount, ledgerPrecision(negotiated.game.g.lastReport.interest));
assert.equal(interestTxn.cashEffect, -ledgerPrecision(negotiated.game.g.lastReport.interest));
assert.equal(finance.validate(negotiated.game.g).ok, true, finance.validate(negotiated.game.g).errors.join(' / '));
assert.deepEqual(structuralIssues(negotiated.game.g), []);

const invalid = makeDebtGame().game;
invalid.companyWeeklyBorrowRate = () => Number.NaN;
assert.equal(playerDebtService.weeklyRate(invalid), playerDebtService.negotiatedRate(invalid), 'non-finite hooks must fall back to the negotiated weekly rate');
invalid.companyWeeklyBorrowRate = () => 99;
assert.equal(playerDebtService.weeklyRate(invalid), 0.18, 'weekly rate must remain bounded');
invalid.companyWeeklyBorrowRate = () => -1;
assert.equal(playerDebtService.weeklyRate(invalid), 0.005, 'weekly rate must not fall below the debt-service floor');

const throwing = makeDebtGame().game;
throwing.companyWeeklyBorrowRate = () => { throw new Error('weekly debt-service hook failure'); };
assert.throws(() => throwing.advanceWeek(false), /weekly debt-service hook failure/);
assert.equal(playerDebtService.inWeeklyContext(throwing), false, 'weekly context must be released after an exception');
assert.equal(throwing.companyBorrowRate(), legacyRate(throwing), 'ordinary quote must recover after an exception');

const restoredState = JSON.parse(JSON.stringify(negotiated.game.g));
const restored = new engine.TycoonEngine(restoredState);
assert.equal(restored.companyBorrowRate(), legacyRate(restored));
assert.ok(restored.companyWeeklyBorrowRate() <= restored.companyBorrowRate(), 'saved negotiated relief must remain available only to weekly debt service');
assert.deepEqual(structuralIssues(restored.g), []);

console.log('player weekly debt service tests passed');
require('./bank-loans-covenants-accounting-test');
