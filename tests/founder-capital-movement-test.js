'use strict';

// Issue #423 priority 3: a formal, always-available founder-to-company capital movement
// (capital injection / shareholder loan), distinct from js/player-crisis-actions.js's
// injectFounderCapital, which stays crisis-status gated (watch/distressed/turnaround/
// recovered only) and hidden behind the crisis panel -- unchanged here, verified by test 8
// below. contributeFounderCapital/foundersLoanToCompany are new engine methods available
// any time the company isn't over/sold, reusing the existing equityFinancing+capitalSurplus
// accounting shape (contribution) and the existing itemized finance.loans+companyDebt shape
// (loan), so they interoperate with the pre-existing borrow()/repay() machinery for free.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 423003) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 423003) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

// 1. contributeFounderCapital: available at the normal (non-crisis) 'stable' status, moves
// only companyCash/personalCash, records one equityFinancing transaction, and bumps
// capitalSurplus by the injected amount. companyDebt and personalStocks are untouched.
{
  const { modules, engine } = newGame();
  assert.equal(modules.playerCrisis.snapshot(engine.g).status, 'stable', 'precondition: no crisis');
  const companyCashBefore = engine.g.companyCash, personalCashBefore = engine.g.personalCash;
  const personalStocksBefore = JSON.stringify(engine.g.personalStocks);
  const debtBefore = engine.g.companyDebt;
  const capitalSurplusBefore = engine.g.finance.balances.capitalSurplus;
  const txBefore = engine.g.finance.transactions.length;
  assert.equal(engine.contributeFounderCapital(500_000), true, '平常時でも資本注入できる');
  assert.equal(engine.g.companyCash, companyCashBefore + 500_000, 'companyCashが注入額だけ増える');
  assert.equal(engine.g.personalCash, personalCashBefore - 500_000, 'personalCashが注入額だけ減る');
  assert.equal(JSON.stringify(engine.g.personalStocks), personalStocksBefore, 'personalStocksは不変');
  assert.equal(engine.g.companyDebt, debtBefore, '資本注入はcompanyDebtを増やさない');
  const newTx = engine.g.finance.transactions.slice(txBefore);
  assert.equal(newTx.length, 1, '会計イベントは1件だけ記録される');
  assert.equal(newTx[0].sourceType, 'founderCapitalContribution');
  assert.ok(Math.abs(newTx[0].cashEffect - 500_000) < 1);
  assert.ok(Math.abs(newTx[0].equityEffect - 500_000) < 1);
  assert.ok(Math.abs(engine.g.finance.balances.capitalSurplus - (capitalSurplusBefore + 500_000)) < 1, 'capitalSurplusが注入額だけ増える');
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 2. foundersLoanToCompany: available at 'stable' status, moves companyCash/personalCash and
// increases companyDebt, records one debtBorrowing transaction, and pushes an itemized loan
// tagged as a founder shareholder loan. capitalSurplus is untouched (it's debt, not equity).
{
  const { modules, engine } = newGame();
  const companyCashBefore = engine.g.companyCash, personalCashBefore = engine.g.personalCash, debtBefore = engine.g.companyDebt;
  const capitalSurplusBefore = engine.g.finance.balances.capitalSurplus;
  const loansBefore = engine.g.finance.loans.length;
  const txBefore = engine.g.finance.transactions.length;
  assert.equal(engine.foundersLoanToCompany(500_000), true, '平常時でも株主ローンを実行できる');
  assert.equal(engine.g.companyCash, companyCashBefore + 500_000);
  assert.equal(engine.g.personalCash, personalCashBefore - 500_000);
  assert.equal(engine.g.companyDebt, debtBefore + 500_000, 'companyDebtが融資額だけ増える');
  assert.equal(engine.g.finance.balances.capitalSurplus, capitalSurplusBefore, '株主ローンはcapitalSurplusを増やさない（負債であり資本ではない）');
  const newLoans = engine.g.finance.loans.slice(loansBefore);
  assert.equal(newLoans.length, 1, '新規ローンが1件記録される');
  assert.equal(newLoans[0].sourceType, 'founderShareholderLoan');
  assert.equal(newLoans[0].status, 'active');
  assert.ok(Math.abs(newLoans[0].outstandingPrincipal - 500_000) < 1);
  const newTx = engine.g.finance.transactions.slice(txBefore);
  assert.equal(newTx.length, 1, '会計イベントは1件だけ記録される');
  assert.equal(newTx[0].sourceType, 'founderShareholderLoan');
  assert.ok(Math.abs(newTx[0].liabilityEffect - 500_000) < 1);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 3. Atomicity: insufficient personalCash / non-positive amount fail both actions with no
// state change.
{
  const { engine } = newGame();
  const snapshot = () => JSON.stringify({ companyCash: engine.g.companyCash, personalCash: engine.g.personalCash, companyDebt: engine.g.companyDebt, tx: engine.g.finance.transactions.length, loans: engine.g.finance.loans.length });
  const before = snapshot();
  assert.equal(engine.contributeFounderCapital(engine.g.personalCash + 1), false, '個人資金不足では資本注入は失敗する');
  assert.equal(snapshot(), before);
  assert.equal(engine.foundersLoanToCompany(engine.g.personalCash + 1), false, '個人資金不足では株主ローンは失敗する');
  assert.equal(snapshot(), before);
  assert.equal(engine.contributeFounderCapital(0), false, '0円の資本注入は失敗する');
  assert.equal(engine.foundersLoanToCompany(-100), false, '負額の株主ローンは失敗する');
  assert.equal(snapshot(), before);
}

// 4. foundersLoanToCompany respects the existing company credit limit (companyCreditLimit()),
// the same guard borrow() already uses -- this is not an uncapped money glitch.
{
  const { engine } = newGame();
  engine.g.personalCash = 500_000_000;
  const limit = engine.companyCreditLimit();
  assert.ok(limit < 500_000_000, 'precondition: requested amount exceeds the credit limit');
  const before = engine.g.companyDebt;
  assert.equal(engine.foundersLoanToCompany(500_000_000), false, '与信枠を超える株主ローンは失敗する');
  assert.equal(engine.g.companyDebt, before, '失敗時はcompanyDebtが変化しない');
}

// 5. gameOver / isCompanySold both block either action.
{
  const { engine } = newGame();
  engine.g.gameOver = true;
  assert.equal(engine.contributeFounderCapital(100_000), false, 'gameOver後は資本注入できない');
  assert.equal(engine.foundersLoanToCompany(100_000), false, 'gameOver後は株主ローンできない');
}
{
  const { engine } = newGame();
  engine.g.isCompanySold = true;
  assert.equal(engine.contributeFounderCapital(100_000), false, '会社売却後は資本注入できない');
  assert.equal(engine.foundersLoanToCompany(100_000), false, '会社売却後は株主ローンできない');
}

// 6. A founder shareholder loan is repaid through the existing generic repay('company')
// action -- no separate repayment mechanism was built, confirming real interoperation with
// the pre-existing debt machinery rather than a parallel one.
{
  const { modules, engine } = newGame();
  assert.equal(engine.foundersLoanToCompany(500_000), true);
  const loan = engine.g.finance.loans.find(l => l.sourceType === 'founderShareholderLoan');
  assert.ok(loan, 'founder loan must be recorded');
  assert.equal(engine.repay(500_000, 'company'), true, '通常の会社返済アクションで返済できる');
  assert.equal(engine.g.companyDebt, 0, '返済後はcompanyDebtが0に戻る');
  assert.equal(loan.status, 'paid', '対応するfounder loanレコードもpaidになる');
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 7. The new actions are usable across every player-crisis status except after game-over/
// sale (unlike injectFounderCapital, which requires a crisis status). Sanity-check at
// 'watch' too, so this isn't accidentally exclusive to 'stable'.
{
  const { modules, engine } = newGame();
  const crisis = modules.playerCrisis.ensure(engine.g);
  crisis.status = 'watch';
  assert.equal(engine.contributeFounderCapital(100_000), true, 'crisis状態でも資本注入できる');
  assert.equal(engine.foundersLoanToCompany(100_000), true, 'crisis状態でも株主ローンできる');
}

// 8. Regression guard: js/player-crisis-actions.js's injectFounderCapital is untouched --
// it must still refuse to run at the normal 'stable' status, exactly as before this feature.
{
  const { modules, engine } = newGame();
  assert.equal(modules.playerCrisis.snapshot(engine.g).status, 'stable');
  assert.equal(engine.injectFounderCapital(100_000), false, '既存のinjectFounderCapitalはstable状態では引き続き利用不可');
}

// 9. Determinism: same seed, same actions -> identical resulting state.
{
  function run() {
    const { engine } = newGame(777001);
    engine.contributeFounderCapital(500_000);
    engine.foundersLoanToCompany(300_000);
    return JSON.stringify({ companyCash: engine.g.companyCash, personalCash: engine.g.personalCash, companyDebt: engine.g.companyDebt, capitalSurplus: engine.g.finance.balances.capitalSurplus });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 10. Save/reload round trip.
{
  const { modules, engine } = newGame();
  assert.equal(engine.contributeFounderCapital(500_000), true);
  assert.equal(engine.foundersLoanToCompany(300_000), true);
  const companyCashBefore = engine.g.companyCash, companyDebtBefore = engine.g.companyDebt;
  engine.save();
  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  assert.equal(reloaded.g.companyCash, companyCashBefore, 'reload後もcompanyCashが一致する');
  assert.equal(reloaded.g.companyDebt, companyDebtBefore, 'reload後もcompanyDebtが一致する');
  assert.ok(reloaded.g.finance.loans.some(l => l.sourceType === 'founderShareholderLoan'), 'reload後もfounder loanが残る');
  const v = modules.finance.validate(reloaded.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 11. Static source scan: no new MutationObserver, and this feature did not touch the
// existing crisis-only eligibility set for injectFounderCapital.
{
  const fs = require('node:fs');
  const path = require('node:path');
  const engineSrc = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
  const crisisActionsSrc = fs.readFileSync(path.join(__dirname, '../js/player-crisis-actions.js'), 'utf8');
  assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(engineSrc), 'engine.jsに新しいMutationObserverを追加していない');
  assert.ok(/ELIGIBLE_FOUNDER=new Set\(\['watch','distressed','turnaround','recovered'\]\)/.test(crisisActionsSrc), 'injectFounderCapitalのcrisis限定ゲートを変更していない');
}

console.log('Founder capital movement tests passed');
