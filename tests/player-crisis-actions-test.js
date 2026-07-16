const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a200001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { ctx, modules } = loadGame({ random });
const { engine, finance, playerCrisis, playerCrisisActions } = modules;

assert.ok(playerCrisisActions?.__installed, 'player crisis actions module must be registered');
assert.equal(engine.TycoonEngine.prototype.__playerCrisisActionsInstalled, true);
assert.equal(engine.SAVE_VERSION, 9);
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.deepEqual([...playerCrisisActions.ACTION_TYPES], ['founderCapital', 'emergencyBridge']);

function crisisState({ cash = -1_000_000, personalCash = 10_000_000, propertyValue = 0 } = {}) {
  const state = engine.createInitialState({ configured: true });
  state.week = 2;
  state.companyCash = cash;
  state.personalCash = personalCash;
  state.companyCredit = 80;
  if (propertyValue > 0) {
    const property = state.properties[0];
    property.owner = 'company';
    property.purchasePrice = propertyValue;
    property.price = propertyValue;
    property.value = propertyValue;
  }
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  return state;
}

const legacy = crisisState({ cash: 4_000_000 });
delete legacy.playerCrisisActions;
const legacyGame = new engine.TycoonEngine(legacy);
assert.ok(legacyGame.g.playerCrisisActions, 'old save must receive additive action defaults');
assert.equal(legacyGame.g.playerCrisisActions.nextActionSeq, 1);
assert.deepEqual(legacyGame.g.playerCrisisActions.history, []);

const founderGame = new engine.TycoonEngine(crisisState());
assert.equal(founderGame.g.playerCrisis.status, 'distressed');
const founderOptions = founderGame.crisisLiquidityOptions();
assert.equal(founderOptions.canInjectFounder, true);
assert.equal(founderOptions.founderAvailable, 10_000_000);
const personalBefore = founderGame.g.personalCash;
const founderCashBefore = founderGame.g.companyCash;
const founderDebtBefore = founderGame.g.companyDebt;
assert.equal(founderGame.injectFounderCapital(2_000_000), true);
assert.equal(founderGame.g.personalCash, personalBefore - 2_000_000);
assert.equal(founderGame.g.companyCash, founderCashBefore + 2_000_000);
assert.equal(founderGame.g.companyDebt, founderDebtBefore);
assert.equal(founderGame.g.playerCrisis.status, 'turnaround');
assert.equal(founderGame.g.playerCrisisActions.history.length, 1);
assert.equal(founderGame.g.playerCrisisActions.history[0].type, 'founderCapital');
const founderTxn = founderGame.g.finance.transactions.find(row => row.sourceType === 'founderCrisisCapital');
assert.ok(founderTxn, 'founder capital finance transaction missing');
assert.equal(founderTxn.cashEffect, 2_000_000);
assert.equal(founderTxn.equityEffect, 2_000_000);
assert.equal(founderTxn.profitEffect, 0);
assert.equal(finance.validate(founderGame.g).ok, true, finance.validate(founderGame.g).errors.join(' / '));

founderGame.g.week += 1;
founderGame.g.companyCash = Math.max(founderGame.g.companyCash, 4_000_000);
playerCrisis.evaluate(founderGame.g);
assert.equal(founderGame.g.playerCrisis.status, 'recovered', 'liquidity action must connect to the existing recovery sequence');

const rejectedFounder = new engine.TycoonEngine(crisisState({ personalCash: 500_000 }));
const rejectedFounderCash = rejectedFounder.g.companyCash;
const rejectedPersonalCash = rejectedFounder.g.personalCash;
assert.equal(rejectedFounder.injectFounderCapital(1_000_000), false);
assert.equal(rejectedFounder.g.companyCash, rejectedFounderCash);
assert.equal(rejectedFounder.g.personalCash, rejectedPersonalCash);
assert.equal(rejectedFounder.g.playerCrisisActions.history.length, 0);

const bridgeGame = new engine.TycoonEngine(crisisState({ propertyValue: 100_000_000 }));
const bridgeOptions = bridgeGame.crisisLiquidityOptions();
assert.equal(bridgeOptions.canRequestBridge, true);
assert.ok(bridgeOptions.bridgeAmount >= playerCrisisActions.MIN_EMERGENCY_LOAN);
assert.ok(bridgeOptions.bridgeAmount <= bridgeOptions.availableCredit);
const bridgeCashBefore = bridgeGame.g.companyCash;
const bridgeDebtBefore = bridgeGame.g.companyDebt;
const bridgeCreditBefore = bridgeGame.g.companyCredit;
assert.equal(bridgeGame.requestEmergencyBridgeLoan(), true);
const bridgeHistory = bridgeGame.g.playerCrisisActions.history.at(-1);
assert.equal(bridgeHistory.type, 'emergencyBridge');
assert.equal(bridgeGame.g.companyCash, bridgeCashBefore + bridgeHistory.amount);
assert.equal(bridgeGame.g.companyDebt, bridgeDebtBefore + bridgeHistory.amount);
assert.equal(bridgeGame.g.companyCredit, bridgeCreditBefore - 4);
assert.equal(bridgeGame.g.playerCrisisActions.lastEmergencyLoanWeek, bridgeGame.g.week);
const bridgeTxn = bridgeGame.g.finance.transactions.find(row => row.sourceType === 'playerCrisisEmergencyLoan');
assert.ok(bridgeTxn, 'emergency bridge finance transaction missing');
assert.equal(bridgeTxn.category, 'debtBorrowing');
assert.equal(bridgeTxn.cashEffect, bridgeHistory.amount);
assert.equal(bridgeTxn.liabilityEffect, bridgeHistory.amount);
const bridgeLoan = bridgeGame.g.finance.loans.find(row => row.loanID === bridgeHistory.actionID);
assert.ok(bridgeLoan, 'matching emergency loan record missing');
assert.equal(bridgeLoan.principal, bridgeHistory.amount);
assert.equal(bridgeLoan.outstandingPrincipal, bridgeHistory.amount);
assert.equal(bridgeLoan.status, 'active');
assert.equal(finance.validate(bridgeGame.g).ok, true, finance.validate(bridgeGame.g).errors.join(' / '));

const repeatCash = bridgeGame.g.companyCash;
const repeatDebt = bridgeGame.g.companyDebt;
const repeatHistory = bridgeGame.g.playerCrisisActions.history.length;
assert.equal(bridgeGame.requestEmergencyBridgeLoan(), false, 'same-week emergency borrowing must be rejected');
assert.equal(bridgeGame.g.companyCash, repeatCash);
assert.equal(bridgeGame.g.companyDebt, repeatDebt);
assert.equal(bridgeGame.g.playerCrisisActions.history.length, repeatHistory);
bridgeGame.g.week += 1;
bridgeGame.g.companyCash = -1;
bridgeGame.g.playerCrisis.status = 'distressed';
bridgeGame.g.playerCrisis.lastEvaluationWeek = bridgeGame.g.week;
assert.equal(bridgeGame.requestEmergencyBridgeLoan(), false, '13-week cooldown must be enforced');
assert.equal(bridgeGame.crisisLiquidityOptions().bridgeCooldownWeeksRemaining, 12);

const noCredit = new engine.TycoonEngine(crisisState());
noCredit.g.companyCredit = 0;
assert.equal(noCredit.crisisLiquidityOptions().canRequestBridge, false);
assert.equal(noCredit.requestEmergencyBridgeLoan(), false);
assert.equal(noCredit.g.playerCrisisActions.history.length, 0);

const insolvent = new engine.TycoonEngine(crisisState({ propertyValue: 100_000_000 }));
insolvent.g.playerCrisis.status = 'insolvent';
insolvent.g.playerCrisis.graceWeeksRemaining = 0;
insolvent.g.gameOver = true;
insolvent.g.gameOverReason = playerCrisis.INSOLVENCY_REASON;
const insolventBefore = JSON.stringify({ cash: insolvent.g.companyCash, debt: insolvent.g.companyDebt, personal: insolvent.g.personalCash });
assert.equal(insolvent.injectFounderCapital(500_000), false);
assert.equal(insolvent.requestEmergencyBridgeLoan(), false);
assert.equal(JSON.stringify({ cash: insolvent.g.companyCash, debt: insolvent.g.companyDebt, personal: insolvent.g.personalCash }), insolventBefore);

const bounded = crisisState({ cash: 4_000_000 });
bounded.playerCrisisActions = {
  nextActionSeq: 100,
  lastEmergencyLoanWeek: 20,
  history: Array.from({ length: 90 }, (_, index) => ({
    actionID: `action-${index}`,
    operationID: `operation-${index}`,
    week: index + 1,
    type: index % 2 ? 'founderCapital' : 'emergencyBridge',
    amount: 1_000_000,
    cashBefore: 0,
    cashAfter: 1_000_000,
    debtBefore: 0,
    debtAfter: index % 2 ? 0 : 1_000_000,
    detail: `history-${index}`
  }))
};
playerCrisisActions.ensure(bounded);
assert.equal(bounded.playerCrisisActions.history.length, playerCrisisActions.HISTORY_LIMIT);
const beforeValidate = JSON.stringify(bounded);
playerCrisisActions.validate(bounded);
assert.equal(JSON.stringify(bounded), beforeValidate, 'action validation must be read-only');
assert.deepEqual(findStateIssues(bounded), []);

const saveGame = new engine.TycoonEngine(crisisState({ propertyValue: 100_000_000 }));
assert.equal(saveGame.requestEmergencyBridgeLoan(), true);
assert.equal(finance.validate(saveGame.g).ok, true, finance.validate(saveGame.g).errors.join(' / '));
assert.equal(saveGame.save(), true);
const saved = JSON.parse(ctx.__localStorageData.get(engine.SAVE_KEY));
assert.ok(saved.playerCrisisActions);
const restored = new engine.TycoonEngine(saved);
assert.deepEqual(restored.g.playerCrisisActions, saved.playerCrisisActions);
assert.equal(finance.validate(restored.g).ok, true, finance.validate(restored.g).errors.join(' / '));
assert.deepEqual(findStateIssues(restored.g), []);
assert.ok(JSON.stringify(saved).length < 5_000_000, 'crisis action metadata must remain bounded');

console.log('player crisis liquidity action tests passed');
