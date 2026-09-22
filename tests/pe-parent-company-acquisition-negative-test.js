'use strict';
// Negative/mutation counterpart to tests/pe-parent-company-acquisition-test.js. Proves that test's
// accounting assertions actually detect the corruptions they claim to guard against, using the
// same technique as tests/pe-realestate-agency-bridge-negative-test.js: revert specific lines in an
// in-memory copy of js/pe-portfolio-operations.js, load it via loadGameFromHtml(), and confirm the
// corruption reproduces. The real file on disk is never touched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGameFromHtml, readIndex } = require('./harness');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'pe-portfolio-operations.js'), 'utf8');
const TAG = '<script src="./js/pe-portfolio-operations.js"></script>';

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function setup(source, randomSeed) {
  const html = readIndex().replace(TAG, `<script>${source}</script>`);
  const { ctx, modules } = loadGameFromHtml(html, { random: lcg(randomSeed) });
  const engine = ctx.__ct_engine;
  engine.configure({ playerName: 'Negative Test', companyName: 'Reverted Parent Acquisition', difficulty: 'normal' });
  engine.g.companyCash = 9_000_000_000;
  engine.g.personalCash = 12_000_000_000;
  const pf = modules.peFund, ops = modules.pePortfolioOperations;
  pf.recordExit(engine.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  const fund = pf.createFund(engine.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(engine.g, fund.id, { businessID: 'gym', enterpriseValue: 2_000_000_000, useCoinvest: false, week: engine.g.week });
  assert(deal && deal.portfolioCompany, 'PE holding created');
  for (let w = 0; w < 20; w++) engine.advanceWeek(false);
  return { engine, modules, fund, deal };
}


// ---- Case 1: company cash <-> personal cash misattribution -------------------------------------
// acquirePortfolioCompanyByParent() must debit state.companyCash, never state.personalCash. Revert
// that single line to the wrong pool and prove the real production assertion (from
// pe-parent-company-acquisition-test.js: "buyer company pays the exact PE sale proceeds") fails
// against this reverted code.
{
  const FIXED = 'state.companyCash=finite(state.companyCash)-plan.purchasePrice;';
  assert(SOURCE.includes(FIXED), 'expected the companyCash debit line in acquirePortfolioCompanyByParent(); has it been refactored?');
  assert.equal(SOURCE.split(FIXED).length - 1, 1, 'expected exactly one occurrence');
  const BUGGY = 'state.personalCash=finite(state.personalCash)-plan.purchasePrice;';
  const reverted = SOURCE.replace(FIXED, BUGGY);

  const { engine, fund, deal } = setup(reverted, 24681357);
  const companyCashBefore = engine.g.companyCash, personalCashBefore = engine.g.personalCash;

  const ok = engine.acquirePEPortfolioCompany(fund.id, deal.id);
  assert.equal(ok, true, 'reverted acquisition still succeeds -- the bug is silent misattribution, not a rejected call');

  // The corruption itself: companyCash is untouched, personalCash drained instead.
  assert.equal(engine.g.companyCash, companyCashBefore, 'expected the reverted code to leave companyCash untouched (the defect under test)');
  assert(engine.g.personalCash < personalCashBefore, 'expected the reverted code to drain personalCash instead of companyCash');
  const drained = personalCashBefore - engine.g.personalCash;
  console.log('Case 1 corruption reproduced:', JSON.stringify({ companyCashBefore, companyCashAfter: engine.g.companyCash, personalCashBefore, personalCashAfter: engine.g.personalCash, drainedFromPersonalCash: drained }));

  // Reproduce the exact real production assertion from pe-parent-company-acquisition-test.js
  // (line 68: "buyer company pays the exact PE sale proceeds") against this reverted code, and
  // confirm it throws -- i.e. the real test would have gone red had this defect shipped.
  const buyerCashBefore = companyCashBefore;
  let realAssertionThrew = null;
  try {
    assert.equal(buyerCashBefore - engine.g.companyCash, engine.g.subsidiaries[0].acquisitionPrice, 'buyer company pays the exact PE sale proceeds');
  } catch (e) {
    realAssertionThrew = e;
  }
  console.log('Case 1: real pe-parent-company-acquisition-test.js assertion against reverted code threw:', Boolean(realAssertionThrew), realAssertionThrew ? '-- ' + realAssertionThrew.message.split('\n')[0] : '');
  assert(realAssertionThrew, 'expected the real "buyer company pays the exact PE sale proceeds" assertion to fail against this reverted (personalCash-debiting) code -- if it does not, that assertion has lost its detection power and needs to be re-examined');
}

// ---- Case 2: remove all three double-booking guards ---------------------------------------------
// acquirePortfolioCompanyByParent()/previewParentCompanyAcquisition() has three independent guards
// against acquiring the same PE company twice: (1) deal.status flips to 'exited', which blocks all
// further previewPortfolioExit()-based eligibility checks, (2) a duplicate-subsidiary check keyed on
// deal.id, and (3) a finance-transaction idempotencyKey check. Remove all three and confirm a second
// call to acquirePEPortfolioCompany() succeeds again and actually double-books the company.
//
// tests/pe-parent-company-acquisition-negative-test.js's own investigation found that
// js/finance.js's event() has its own idempotencyKey dedup, which silently drops the second ledger
// row even though state.companyCash is genuinely debited twice -- so a bare
// "finance.transactions.length===1" check alone would NOT have caught this corruption (the ledger
// looks consistent even though it is not). modules.finance.validate(engine.g).ok is the assertion
// that actually catches it, independently, via balance-sheet/cash-flow/opening-cash-rollforward
// reconciliation errors -- so it is asserted here as the primary defense, not as a fallback.
{
  const DUP_CHECK = "const duplicate=arr(state?.subsidiaries).some(s=>s?.sourcePEDealID===dealID);\n  if(duplicate)return {ok:false,fundID,dealID,reason:'already-subsidiary'};\n  ";
  const BOOKED_CHECK = "const operationID=`pe-parent-acquisition-${dealID}`;\n  const alreadyBooked=arr(state?.finance?.transactions).some(t=>t?.idempotencyKey===operationID||t?.operationID===operationID);\n  if(alreadyBooked)return {ok:false,fundID,dealID,reason:'already-booked',purchasePrice,companyCash,postCompanyCash:companyCash};\n  ";
  const STATUS_FLIP = "\n  deal.status='exited';\n  deal.exitedWeek=w;";
  assert(SOURCE.includes(DUP_CHECK), 'expected the duplicate-subsidiary check in previewParentCompanyAcquisition(); has it been refactored?');
  assert(SOURCE.includes(BOOKED_CHECK), 'expected the alreadyBooked idempotencyKey check in previewParentCompanyAcquisition(); has it been refactored?');
  assert(SOURCE.includes(STATUS_FLIP), 'expected the deal.status flip in acquirePortfolioCompanyByParent(); has it been refactored?');

  let reverted = SOURCE.replace(DUP_CHECK, '');
  reverted = reverted.replace(BOOKED_CHECK, "const operationID=`pe-parent-acquisition-${dealID}`;\n  ");
  reverted = reverted.replace(STATUS_FLIP, "\n  /* deal.status flip removed for negative test */\n  deal.exitedWeek=w;");

  const { engine, modules, fund, deal } = setup(reverted, 13572468);
  const companyCashBefore = engine.g.companyCash;

  const first = engine.acquirePEPortfolioCompany(fund.id, deal.id);
  assert.equal(first, true, 'first (reverted) acquisition succeeds');
  const firstAcquisitionPrice = companyCashBefore - engine.g.companyCash;
  const afterFirst = {
    companyCash: engine.g.companyCash,
    subsidiaryCount: engine.g.subsidiaries.filter(s => s.sourcePEDealID === deal.id).length,
    transactionCount: engine.g.finance.transactions.filter(t => t.sourceType === 'acquirePEPortfolioCompany' && t.sourceID === deal.id).length
  };

  const second = engine.acquirePEPortfolioCompany(fund.id, deal.id);

  // The corruption itself: with all three guards gone, the second call succeeds again and
  // double-books the company.
  assert.equal(second, true, 'expected the reverted (guardless) code to allow acquiring the same PE company a second time -- if this ever returns false, the guard removal above stopped being effective and this negative test needs to be re-examined');
  const afterSecond = {
    companyCash: engine.g.companyCash,
    subsidiaryCount: engine.g.subsidiaries.filter(s => s.sourcePEDealID === deal.id).length,
    transactionCount: engine.g.finance.transactions.filter(t => t.sourceType === 'acquirePEPortfolioCompany' && t.sourceID === deal.id).length
  };
  console.log('Case 2 corruption reproduced:', JSON.stringify({ companyCashBefore, firstAcquisitionPrice, afterFirst, afterSecond, totalDebited: companyCashBefore - engine.g.companyCash }));

  assert.equal(afterSecond.subsidiaryCount, 2, 'expected the reverted code to create two subsidiaries from the same PE deal');
  assert(Math.abs((companyCashBefore - engine.g.companyCash) - firstAcquisitionPrice * 2) < 1, 'expected companyCash to be debited twice (once per acquisition call)');

  // js/finance.js's own event() idempotencyKey dedup silently drops the second ledger row even
  // though companyCash was genuinely debited twice -- confirm that blind spot is real, so nobody
  // mistakes "transactionCount stayed at 1" for "nothing went wrong".
  assert.equal(afterSecond.transactionCount, 1, 'expected finance.event()\'s own idempotencyKey dedup to silently drop the second ledger row even though companyCash was debited twice -- this is the blind spot that makes a bare transaction-count check insufficient on its own');

  // The primary defense: modules.finance.validate() must independently catch the resulting
  // cash/ledger mismatch, regardless of the (insufficient) transaction-count signal above.
  const financeValidation = modules.finance.validate(engine.g);
  console.log('Case 2: modules.finance.validate(engine.g) against reverted (guardless) code:', JSON.stringify(financeValidation));
  assert.equal(financeValidation.ok, false, 'expected modules.finance.validate() to independently catch the ledger/cash mismatch from this double-booking -- this is the primary defense, not the (insufficient) transaction-count check above');
  assert(financeValidation.errors.length > 0, 'expected finance.validate() to report at least one concrete reconciliation error');

  console.log('Case 2: real pe-parent-company-acquisition-test.js assertions against reverted code:');
  let subCountThrew = null, secondCallThrew = null;
  try {
    assert.equal(engine.g.subsidiaries.filter(s => s.sourcePEDealID === deal.id).length, 1);
  } catch (e) { subCountThrew = e; }
  try {
    assert.equal(second, false, 'same PE company cannot be acquired twice');
  } catch (e) { secondCallThrew = e; }
  console.log('  subsidiaries.length===1 threw:', Boolean(subCountThrew));
  console.log('  transactions.length===1 threw: false (does NOT catch this corruption -- see blind-spot note above)');
  console.log('  second-call-returns-false threw:', Boolean(secondCallThrew));
  console.log('  finance.validate().ok===true threw: true (correctly catches this corruption)');
  assert(subCountThrew && secondCallThrew, 'expected the real subsidiaries.length===1 and second-call-returns-false assertions to both fail against this reverted code');
}

console.log('PE parent-company acquisition negative test passed (both corruptions reproduced and caught)');

