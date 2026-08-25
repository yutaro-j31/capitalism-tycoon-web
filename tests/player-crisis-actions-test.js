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
assert.deepEqual([...playerCrisisActions.ACTION_TYPES], ['founderCapital', 'emergencyBridge', 'sponsorInjection']);

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
assert.equal(legacyGame.g.playerCrisisActions.lastSponsorInjectionWeek, null, '旧saveはlastSponsorInjectionWeekなしでも安全に読み込める');

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

// Sponsor injection: a last-resort dilutive rescue lever, distinct from founder capital and the
// bridge loan. Distressed-only eligibility, deterministic distressed-valuation pricing, real
// share issuance/dilution, and its own cooldown.
const sponsorGame = new engine.TycoonEngine(crisisState({ propertyValue: 100_000_000 }));
const sponsorOptionsBefore = sponsorGame.crisisLiquidityOptions();
assert.equal(sponsorOptionsBefore.canRequestSponsor, true, 'distressed status must allow sponsor injection');
assert.ok(sponsorOptionsBefore.sponsorAmount >= playerCrisisActions.SPONSOR_MIN_INJECTION);
assert.ok(sponsorOptionsBefore.sponsorEquity > 0 && sponsorOptionsBefore.sponsorEquity < 1);
const expectedValuation = Math.max(1_000_000, Math.round(sponsorGame.companyValue() * playerCrisisActions.SPONSOR_VALUATION_DISCOUNT));
assert.equal(sponsorOptionsBefore.sponsorPreMoneyValuation, expectedValuation, 'sponsor pricing must be a fixed discount off companyValue(), no dice roll');
const sponsorSharesBefore = sponsorGame.g.sharesOut;
const sponsorFounderSharesBefore = sponsorGame.g.founderShares;
const sponsorOwnershipBefore = sponsorGame.g.founderOwnershipRatio;
const sponsorCashBefore = sponsorGame.g.companyCash;
const sponsorDebtBefore = sponsorGame.g.companyDebt;
assert.equal(sponsorGame.requestSponsorInjection(), true);
const sponsorHistory = sponsorGame.g.playerCrisisActions.history.at(-1);
assert.equal(sponsorHistory.type, 'sponsorInjection');
assert.equal(sponsorGame.g.companyCash, sponsorCashBefore + sponsorHistory.amount, '出資額は全額会社資金へ入る');
assert.equal(sponsorGame.g.companyDebt, sponsorDebtBefore, 'スポンサー出資はcompanyDebtを増やさない（借入ではなく増資）');
assert.ok(sponsorGame.g.sharesOut > sponsorSharesBefore, '新株が発行される');
assert.equal(sponsorGame.g.founderShares, sponsorFounderSharesBefore, '創業者の保有株数自体は減らない（新株発行による希薄化のみ）');
assert.ok(sponsorGame.g.founderOwnershipRatio < sponsorOwnershipBefore, '新株発行で創業者持分比率が希薄化する');
assert.equal(sponsorGame.g.playerCrisisActions.lastSponsorInjectionWeek, sponsorGame.g.week);
const sponsorTxn = sponsorGame.g.finance.transactions.find(row => row.sourceType === 'playerCrisisSponsorInjection');
assert.ok(sponsorTxn, 'sponsor injection finance transaction missing');
assert.equal(sponsorTxn.category, 'equityFinancing');
assert.equal(sponsorTxn.cashEffect, sponsorHistory.amount);
assert.equal(sponsorTxn.equityEffect, sponsorHistory.amount);
assert.equal(finance.validate(sponsorGame.g).ok, true, finance.validate(sponsorGame.g).errors.join(' / '));

// Save/reload must carry the sponsor cooldown and history forward. Checked here, before the
// cooldown test below deliberately corrupts companyCash to force a distressed re-evaluation.
assert.equal(sponsorGame.save(), true);
const sponsorSaved = JSON.parse(ctx.__localStorageData.get(engine.SAVE_KEY));
const sponsorRestored = new engine.TycoonEngine(sponsorSaved);
assert.equal(sponsorRestored.g.playerCrisisActions.lastSponsorInjectionWeek, sponsorGame.g.playerCrisisActions.lastSponsorInjectionWeek);
assert.ok(sponsorRestored.g.playerCrisisActions.history.some(row => row.type === 'sponsorInjection'));
assert.equal(finance.validate(sponsorRestored.g).ok, true, finance.validate(sponsorRestored.g).errors.join(' / '));
assert.deepEqual(findStateIssues(sponsorRestored.g), []);

// Same-week and within-cooldown reapplication must be rejected, mirroring the bridge loan.
const sponsorRepeatCash = sponsorGame.g.companyCash;
const sponsorRepeatShares = sponsorGame.g.sharesOut;
assert.equal(sponsorGame.requestSponsorInjection(), false, 'same-week sponsor reapplication must be rejected');
assert.equal(sponsorGame.g.companyCash, sponsorRepeatCash);
assert.equal(sponsorGame.g.sharesOut, sponsorRepeatShares);
sponsorGame.g.week += 1;
sponsorGame.g.companyCash = -1;
sponsorGame.g.playerCrisis.status = 'distressed';
sponsorGame.g.playerCrisis.lastEvaluationWeek = sponsorGame.g.week;
assert.equal(sponsorGame.requestSponsorInjection(), false, `${playerCrisisActions.SPONSOR_COOLDOWN_WEEKS - 1}週の再申請クールダウンが必要`);
assert.equal(sponsorGame.crisisLiquidityOptions().sponsorCooldownWeeksRemaining, playerCrisisActions.SPONSOR_COOLDOWN_WEEKS - 1);

// Unlike founder capital, sponsor injection is NOT available in the milder watch/recovered
// states -- it is a last-resort lever, restricted to distressed/turnaround only.
const watchGame = new engine.TycoonEngine(crisisState({ propertyValue: 100_000_000 }));
watchGame.g.playerCrisis.status = 'watch';
watchGame.g.playerCrisis.lastEvaluationWeek = watchGame.g.week;
assert.equal(watchGame.crisisLiquidityOptions().canRequestSponsor, false, 'watchでは利用不可');
assert.equal(watchGame.requestSponsorInjection(), false);

// Public companies must use the existing shareholder-facing capital tools instead, matching
// acceptInvestorOffer's own pre-IPO-only restriction.
const publicGame = new engine.TycoonEngine(crisisState({ propertyValue: 100_000_000 }));
publicGame.g.publicCompany = true;
assert.equal(publicGame.crisisLiquidityOptions().canRequestSponsor, false, '上場後は利用不可');
assert.equal(publicGame.requestSponsorInjection(), false);

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
const insolventBefore = JSON.stringify({ cash: insolvent.g.companyCash, debt: insolvent.g.companyDebt, personal: insolvent.g.personalCash, shares: insolvent.g.sharesOut });
assert.equal(insolvent.injectFounderCapital(500_000), false);
assert.equal(insolvent.requestEmergencyBridgeLoan(), false);
assert.equal(insolvent.requestSponsorInjection(), false);
assert.equal(JSON.stringify({ cash: insolvent.g.companyCash, debt: insolvent.g.companyDebt, personal: insolvent.g.personalCash, shares: insolvent.g.sharesOut }), insolventBefore);

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
