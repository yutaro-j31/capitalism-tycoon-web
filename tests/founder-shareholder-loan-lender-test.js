'use strict';

// Issue #730 (P0-05): a founder shareholder loan moved founder cash into the company as debt,
// but every repayment path (manual repay, debt-maturity refinancing, voluntary prepayment) and
// the weekly interest paid the money to nobody, and the founder's net worth simply lost the
// amount lent. The founder is the lender: principal and interest go to personalCash (no
// personal tax on the interest, owner decision), and the unpaid balance counts toward personal
// net worth. The company side -- cash, interest expense, ledger -- is unchanged.
// Runs against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newGame(seed, { companyCash, personalCash }) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Founder', companyName: 'Founder Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  if (companyCash != null) { engine.g.companyCash = companyCash; engine.g.finance = finance.defaultFinanceState(engine.g); }
  engine.g.personalCash = personalCash;
  return { engine, finance, modules: loaded.modules };
}

function assertValid(finance, g, label) {
  const v = finance.validate(g);
  assert.equal(v.ok, true, `${label}: ${v.errors.join(' / ')}`);
}

const close = (a, b, label, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} vs ${b}`);
const founderLoans = g => g.finance.loans.filter(l => l.sourceType === 'founderShareholderLoan');

// 1. Same seed, same debt: a founder loan (A) against a bank loan of the same size (B). The
//    company is identical in both; only the founder side differs, by exactly the interest paid.
{
  const L = 2_000_000;
  const a = newGame(730, { personalCash: 50_000_000 });
  const b = newGame(730, { personalCash: 50_000_000 });
  const nw0 = a.engine.personalNetWorth();
  assert.equal(a.engine.foundersLoanToCompany(L), true);
  assert.equal(b.engine.borrow(L, 'company'), true);
  close(a.engine.personalNetWorth(), nw0, 'lending to the company does not reduce net worth');
  assert.equal(a.engine.g.personalCash, b.engine.g.personalCash - L);
  let interestReceived = 0;
  for (let i = 0; i < 8; i++) {
    const pa = a.engine.g.personalCash, pb = b.engine.g.personalCash;
    assert.notEqual(a.engine.advanceWeek(false), false);
    assert.notEqual(b.engine.advanceWeek(false), false);
    const week = a.engine.g.week;
    assert.equal(a.engine.g.companyCash, b.engine.g.companyCash, `week ${week}: company cash is independent of the lender`);
    assert.equal(a.engine.g.lastReport.interest, b.engine.g.lastReport.interest, `week ${week}: company interest expense unchanged`);
    assert.ok(a.engine.g.lastReport.interest > 0);
    const credited = (a.engine.g.personalCash - pa) - (b.engine.g.personalCash - pb);
    close(credited, a.engine.g.lastReport.interest, `week ${week}: founder receives the interest on the founder loan, untaxed`);
    interestReceived += credited;
    assertValid(a.finance, a.engine.g, `week ${week}`);
  }
  close(a.engine.personalNetWorth() - b.engine.personalNetWorth(), interestReceived, 'net worth differs only by the interest received');
  // Full repayment through engine.repay(): the founder gets the principal back.
  assert.ok(a.engine.g.companyCash >= L);
  const cash = a.engine.g.personalCash, nw = a.engine.personalNetWorth();
  assert.equal(a.engine.repay(L, 'company'), true);
  close(a.engine.g.personalCash - cash, L, 'repay: principal returns to the founder');
  assert.equal(founderLoans(a.engine.g)[0].status, 'paid');
  assert.equal(a.finance.founderLoanReceivable(a.engine.g), 0);
  close(a.engine.personalNetWorth(), nw, 'repayment converts the receivable into cash, net worth conserved');
  assertValid(a.finance, a.engine.g, 'after repay');
}

// 2. Voluntary prepayment across a bank loan and a founder loan: only the founder's share of
//    the principal goes to the founder.
{
  const { engine, finance } = newGame(731, { companyCash: 500_000_000, personalCash: 100_000_000 });
  assert.equal(engine.borrow(5_000_000, 'company'), true);
  assert.equal(engine.foundersLoanToCompany(3_000_000), true);
  const cash = engine.g.personalCash, nw = engine.personalNetWorth();
  assert.equal(engine.prepayCompanyDebtVoluntarily(8_000_000), true);
  close(engine.g.personalCash - cash, 3_000_000, 'prepayment: founder receives exactly the founder loan principal');
  close(engine.personalNetWorth(), nw, 'prepayment conserves founder net worth');
  assert.equal(finance.founderLoanReceivable(engine.g), 0);
  assert.equal(engine.g.companyDebt, 0);
  assertValid(finance, engine.g, 'after prepayment');
}

// 3. Debt-maturity refinancing repays part of the principal: the founder loan's part goes to the founder.
{
  const { engine, finance, modules } = newGame(732, { companyCash: 500_000_000, personalCash: 100_000_000 });
  const L = 40_000_000;
  assert.equal(engine.foundersLoanToCompany(L), true);
  const debtService = modules.playerDebtService;
  debtService.refinancingState(engine).nextMaturityWeek = engine.g.week;
  const cash = engine.g.personalCash, nw = engine.personalNetWorth();
  const r = debtService.processDebtMaturity(engine);
  const paid = r.history.at(-1).principalPaid;
  assert.ok(paid > 0, 'fixture: maturity repays principal');
  close(engine.g.personalCash - cash, paid, 'maturity: repaid founder principal returns to the founder');
  close(finance.founderLoanReceivable(engine.g), L - paid, 'receivable is the unpaid balance');
  close(engine.personalNetWorth(), nw, 'maturity repayment conserves founder net worth');
  assertValid(finance, engine.g, 'after maturity');
}

// 4. Bank loans never pay the founder.
{
  const { engine, finance } = newGame(733, { companyCash: 500_000_000, personalCash: 100_000_000 });
  assert.equal(engine.borrow(4_000_000, 'company'), true);
  const cash = engine.g.personalCash;
  assert.equal(engine.repay(4_000_000, 'company'), true);
  assert.equal(engine.g.personalCash, cash, 'bank repayment stays off personal cash');
  assert.equal(finance.founderLoanReceivable(engine.g), 0);
}

console.log('founder shareholder loan lender tests passed');
