const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { modules } = loadGame();
const { engine, finance, playerCrisis, playerCrisisCreditor } = modules;

assert.ok(playerCrisisCreditor?.__installed, 'player crisis creditor module must be registered');
assert.deepEqual([...playerCrisisCreditor.NEGOTIATION_TYPES], ['principalDeferral', 'maturityExtension', 'interestReduction']);
assert.equal(typeof engine.TycoonEngine.prototype.crisisCreditorNegotiationOptions, 'function');
assert.equal(typeof engine.TycoonEngine.prototype.executeCrisisCreditorNegotiation, 'function');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function addLoan(game, loanID, amount = 2_000_000, interestRate = 0.08) {
  game.g.week = 4;
  game.g.companyCash += amount;
  game.g.companyDebt += amount;
  finance.event(game.g, 'debtBorrowing', amount, {
    cashEffect: amount,
    liabilityEffect: amount,
    sourceType: 'creditorNegotiationTestLoan',
    sourceID: loanID,
    operationID: `creditor-test-borrow-${loanID}`,
    idempotencyKey: `creditor-test-borrow-${loanID}`,
    description: '債権者交渉テスト借入'
  });
  finance.ensureFinance(game.g).loans.push({
    loanID,
    name: `テスト借入 ${loanID}`,
    principal: amount,
    outstandingPrincipal: amount,
    interestRate,
    termWeeks: 52,
    remainingWeeks: 52,
    repaymentMethod: 'scheduled',
    weeklyPrincipalPayment: 100_000,
    nextPaymentWeek: 5,
    status: 'active',
    sourceType: 'creditorNegotiationTestLoan'
  });
  return finance.ensureFinance(game.g).loans.at(-1);
}

function forceCrisis(game, targetCash = -1_000_000) {
  game.g.week = 4;
  const delta = targetCash - game.g.companyCash;
  game.g.companyCash = targetCash;
  finance.event(game.g, 'otherOperating', Math.abs(delta), {
    cashEffect: delta,
    profitEffect: delta,
    sourceType: 'creditorNegotiationTestLoss',
    sourceID: `creditor-test-loss-${game.g.week}-${game.g.companyDebt}`,
    operationID: `creditor-test-loss-${game.g.week}-${game.g.companyDebt}`,
    idempotencyKey: `creditor-test-loss-${game.g.week}-${game.g.companyDebt}`,
    description: '債権者交渉テスト用損失'
  });
  game.g.playerCrisis.lastEvaluationWeek = 0;
  playerCrisis.evaluate(game.g);
  assert.equal(game.g.playerCrisis.status, 'distressed');
}

const stable = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
assert.equal(stable.crisisCreditorNegotiationOptions().eligible, false);
assert.equal(stable.crisisCreditorNegotiationOptions().loans.length, 0);
assert.equal(stable.executeCrisisCreditorNegotiation('principalDeferral', 'missing'), false);

const rateGame = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
rateGame.g.companyCredit = 100;
rateGame.g.executives.CFO = { role: 'CFO', name: '再建CFO', finance: 100, skill: 100 };
const rateLoan = addLoan(rateGame, 'loan-10');
forceCrisis(rateGame);
const beforeOptionsState = JSON.stringify(rateGame.g);
const rateOptions = rateGame.crisisCreditorNegotiationOptions();
assert.equal(JSON.stringify(rateGame.g), beforeOptionsState, 'creditor options must be read-only after normalization');
assert.equal(rateOptions.eligible, true);
assert.equal(rateOptions.loans.length, 1);
assert.equal(rateOptions.loans[0].actions.length, 3);
assert.ok(rateOptions.loans[0].actions.every(row => Number.isFinite(row.approvalChance)));
const rateCandidate = playerCrisisCreditor.findCandidate(rateGame, 'interestReduction', rateLoan.loanID);
assert.ok(rateCandidate);
assert.ok(rateCandidate.approvalChance >= 0.12 && rateCandidate.approvalChance <= 0.92);
const borrowRateBefore = rateGame.companyBorrowRate();
const loanRateBefore = rateLoan.interestRate;
assert.equal(rateGame.executeCrisisCreditorNegotiation('interestReduction', rateLoan.loanID), true);
const rateHistory = rateGame.g.playerCrisisCreditor.history.at(-1);
assert.equal(rateHistory.success, true, 'loan-10 deterministic rate negotiation should succeed');
assert.ok(rateLoan.interestRate < loanRateBefore);
assert.ok(rateGame.companyBorrowRate() < borrowRateBefore, 'negotiated rate discount must reduce actual weekly borrowing rate');
assert.equal(rateGame.crisisCreditorNegotiationOptions().loans[0].cooldownWeeksRemaining, playerCrisisCreditor.COOLDOWN_WEEKS);
assert.equal(rateGame.executeCrisisCreditorNegotiation('interestReduction', rateLoan.loanID), false, 'same-loan negotiation must respect cooldown');
assert.equal(finance.validate(rateGame.g).ok, true, finance.validate(rateGame.g).errors.join(' / '));
const structuralIssues = findStateIssues(rateGame.g).filter(issue => !issue.startsWith('g.finance.lastStatements.ratios.'));
assert.deepEqual(structuralIssues, []);

const deferralGame = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
deferralGame.g.companyCredit = 100;
deferralGame.g.executives.CFO = { role: 'CFO', name: '再建CFO', finance: 100, skill: 100 };
const deferralLoan = addLoan(deferralGame, 'loan-0');
forceCrisis(deferralGame);
assert.equal(deferralGame.executeCrisisCreditorNegotiation('principalDeferral', deferralLoan.loanID), true);
assert.equal(deferralGame.g.playerCrisisCreditor.history.at(-1).success, true);
assert.equal(deferralLoan.principalMoratoriumUntilWeek, 12);
assert.equal(deferralLoan.nextPaymentWeek, 13);

const extensionGame = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
extensionGame.g.companyCredit = 100;
extensionGame.g.executives.CFO = { role: 'CFO', name: '再建CFO', finance: 100, skill: 100 };
const extensionLoan = addLoan(extensionGame, 'loan-1');
forceCrisis(extensionGame);
assert.equal(extensionGame.executeCrisisCreditorNegotiation('maturityExtension', extensionLoan.loanID), true);
assert.equal(extensionGame.g.playerCrisisCreditor.history.at(-1).success, true);
assert.equal(extensionLoan.termWeeks, 78);
assert.equal(extensionLoan.remainingWeeks, 78);
assert.equal(extensionLoan.maturityExtendedWeeks, 26);

const failureGame = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
failureGame.g.companyCredit = 20;
const failureLoan = addLoan(failureGame, 'loan-10', 20_000_000, 0.12);
forceCrisis(failureGame);
const failureCreditBefore = failureGame.g.companyCredit;
const failureRateBefore = failureLoan.interestRate;
assert.equal(failureGame.executeCrisisCreditorNegotiation('interestReduction', failureLoan.loanID), true);
const failed = failureGame.g.playerCrisisCreditor.history.at(-1);
assert.equal(failed.success, false, 'low-credit loan-10 deterministic negotiation should fail');
assert.equal(failureGame.g.companyCredit, failureCreditBefore - playerCrisisCreditor.FAILURE_CREDIT_PENALTY);
assert.equal(failureLoan.interestRate, failureRateBefore);
assert.equal(failureGame.executeCrisisCreditorNegotiation('interestReduction', failureLoan.loanID), false);

const restored = new engine.TycoonEngine(JSON.parse(JSON.stringify(rateGame.g)));
assert.equal(restored.g.playerCrisisCreditor.history.length, 1);
assert.ok(restored.companyBorrowRate() < borrowRateBefore);
assert.doesNotThrow(() => playerCrisisCreditor.validate(restored.g));
assert.equal(finance.validate(restored.g).ok, true, finance.validate(restored.g).errors.join(' / '));

restored.g.playerCrisisCreditor.history = Array.from({ length: 60 }, (_, index) => ({
  negotiationID: `legacy-negotiation-${index}`,
  operationID: `legacy-negotiation-operation-${index}`,
  week: index + 1,
  type: 'principalDeferral',
  loanID: `legacy-loan-${index}`,
  loanName: `借入${index}`,
  approvalChance: 0.6,
  approvalRoll: 0.4,
  success: true,
  creditBefore: 50,
  creditAfter: 50,
  previousValue: 0,
  nextValue: 8,
  statusBefore: 'distressed',
  statusAfter: 'distressed',
  detail: 'legacy'
}));
playerCrisisCreditor.ensure(restored.g);
assert.equal(restored.g.playerCrisisCreditor.history.length, playerCrisisCreditor.HISTORY_LIMIT);
assert.equal(restored.g.playerCrisisCreditor.history[0].negotiationID, 'legacy-negotiation-8');
assert.doesNotThrow(() => playerCrisisCreditor.validate(restored.g));

console.log('player crisis creditor negotiation tests passed');
