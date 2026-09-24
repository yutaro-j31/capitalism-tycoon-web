'use strict';

// Issue #735 (P1-02): bank-loans-covenants.js service() charges each active bank loan and gym
// startup loan its contractual interest every week, but the engine's generic weekly interest
// (companyDebt x companyBorrowRate / 52) also covered that principal, so those loans paid
// interest twice (100M at 1.2%: 23,076 contractual plus ~92,000 generic per week).
// Each debt balance now carries exactly one interest charge. Runs against the full production
// script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newGame(seed, companyCash) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Interest', companyName: 'Interest Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = companyCash;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  return { engine, finance, bank: loaded.modules.bankLoansCovenants };
}

function assertValid(finance, g, label) {
  const v = finance.validate(g);
  assert.equal(v.ok, true, `${label}: ${v.errors.join(' / ')}`);
}

const interestRows = (g, from) => g.finance.transactions.slice(from).filter(t => t.category === 'interestExpense');
// service() rounds each payment down to whole yen.
const contractual = loan => Math.floor(loan.outstandingPrincipal * loan.interestRate / 52);

function assertContractualOnly(engine, finance, loan, label, weeks) {
  const g = engine.g;
  for (let i = 0; i < weeks; i++) {
    const expected = contractual(loan), from = g.finance.transactions.length;
    assert.notEqual(engine.advanceWeek(false), false);
    const rows = interestRows(g, from), total = rows.reduce((a, t) => a + t.amount, 0);
    assert.equal(total, expected, `${label} week ${g.week}: total interest ${total} must be the contractual ${expected} (rows: ${rows.map(t => `${t.sourceType}=${t.amount}`).join(', ')})`);
    assert.equal(g.lastReport.interest, 0, `${label} week ${g.week}: no generic interest on an individually serviced loan`);
    assertValid(finance, g, `${label} week ${g.week}`);
  }
}

// 1. Only a bank loan outstanding: weekly interest is exactly the contractual amount.
{
  const { engine, finance } = newGame(735, 500_000_000);
  assert.equal(engine.borrowFromBank(100_000_000, 156), true);
  const loan = engine.g.finance.loans.find(l => l.sourceType === 'bankLoansCovenants');
  assertContractualOnly(engine, finance, loan, 'bank', 6);
}

// 2. Only a gym startup loan outstanding: same.
{
  const { engine, finance, bank } = newGame(736, 0);
  assert.ok(bank.fundGymStartup(engine.g, 3_000_000), 'fixture: gym startup loan funded');
  const loan = engine.g.finance.loans.find(l => l.sourceType === 'gymStartupLoan');
  engine.g.personalCash = 300_000_000;
  assert.equal(engine.contributeFounderCapital(200_000_000), true, 'fixture: capital to keep the loan serviced');
  assertContractualOnly(engine, finance, loan, 'gym', 4);
}

// 3. A bank loan next to a generic company loan: the generic interest covers only the generic loan.
{
  const { engine, finance } = newGame(737, 500_000_000);
  assert.equal(engine.borrowFromBank(100_000_000, 156), true);
  assert.equal(engine.borrow(10_000_000, 'company'), true);
  const loan = engine.g.finance.loans.find(l => l.sourceType === 'bankLoansCovenants');
  for (let i = 0; i < 4; i++) {
    const expected = contractual(loan), from = engine.g.finance.transactions.length;
    assert.notEqual(engine.advanceWeek(false), false);
    const bankRows = interestRows(engine.g, from).filter(t => t.sourceType === 'bankLoansCovenants');
    assert.equal(bankRows.reduce((a, t) => a + t.amount, 0), expected);
    // Generic interest is charged on the 10M generic loan only: its implied annual rate stays a
    // plausible borrowing rate (it was ~11x higher when the bank principal was included too).
    const impliedRate = engine.g.lastReport.interest * 52 / 10_000_000;
    assert.ok(impliedRate > 0 && impliedRate < 0.2, `week ${engine.g.week}: generic interest implies ${impliedRate} on the 10M generic loan`);
    assertValid(finance, engine.g, `mixed week ${engine.g.week}`);
  }
}

// 4. A defaulted gym loan is not serviced by service(), so it keeps exactly one charge: the generic one.
{
  const { engine, finance, bank } = newGame(738, 0);
  assert.ok(bank.fundGymStartup(engine.g, 3_000_000));
  const loan = engine.g.finance.loans.find(l => l.sourceType === 'gymStartupLoan');
  loan.status = 'defaulted';
  const from = engine.g.finance.transactions.length;
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(interestRows(engine.g, from).filter(t => t.sourceType === 'bankLoansCovenants').length, 0, 'defaulted loan is not serviced contractually');
  assert.ok(engine.g.lastReport.interest > 0, 'defaulted loan stays in the generic interest pool');
}

console.log('loan single interest tests passed');
