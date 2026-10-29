'use strict';
// P3-4 W-WEEK-PE: the installed canonical week running a PE fund lifecycle transition through processFundsWeek: the
// first management-fee period (fee and team payroll to the company), the end of the investment period (undeployed cash
// returned to LPs and the GP at par) and the end of the fund term (remaining cash returned, fund closed). Every
// applicable save fault rolls back the whole week (fund, company and personal cash, ledger, RNG, mirror, cache and
// durable bytes); recovery and retry sequences are monotonic; the retried week equals the uninterrupted same-seed week.
// Each transition is checked against the same week without it. Node/fake-IDB only; no WebKit claim.
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, week, fundOf } = require('./fixtures/week-pe-fund-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const EVALUATION = ['lastProcessedWeek', 'dpiAtEvaluation', 'deploymentRateAtEvaluation', 'evaluatedWeek'];
const CHANGED = {
  fee: ['managementFeesPaid', 'teamPayrollPaid', 'lastManagementFeePeriod', 'cash'],
  harvest: ['cash', 'status', 'undeployedReturned', 'distributed', 'gpDistributed', 'lpDistributed'],
  close: ['cash', 'status', 'closedWeek', 'undeployedReturned', 'distributed', 'gpDistributed', 'lpDistributed']
};
// The same week without the pinned transition, computed once per variant before any oracle runs.
const controls = {};
async function prepareControl(variant) {
  const c = await fixture(variant, { defer: true }); assert.equal(c.game.advanceWeek(false), true);
  controls[variant] = JSON.parse(JSON.stringify(c.game.g));
}
const rows = (state, op) => state.finance.transactions.filter(row => row.operationID === op);

function success(before, after, s) {
  const base = controls[s.variant], was = fundOf(before, s), now = fundOf(after, s), id = s.fundID;
  assert.equal(after.week, before.week + 1, 'one week');
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)]))
    if (![...CHANGED[s.variant], ...EVALUATION].includes(key)) assert.deepEqual(now[key], was[key], `fund ${key} untouched`);
  assert.deepEqual(after.simulationRng, base.simulationRng, 'the transition draws no RNG');
  if (s.variant === 'fee') {
    const paid = now.managementFeesPaid - was.managementFeesPaid, payroll = now.teamPayrollPaid - was.teamPayrollPaid;
    assert.equal(now.lastManagementFeePeriod, 1, 'first fee period');
    assert.ok(paid > 0 && payroll > 0 && payroll <= paid, 'fee collected and team payroll paid');
    assert.equal(now.cash, was.cash - paid, 'the fee leaves fund cash');
    const fee = rows(after, `pe-management-fee-${id}-p1`), wage = rows(after, `pe-team-payroll-${id}-p1`);
    assert.equal(fee.length, 1, 'one fee row'); assert.equal(wage.length, 1, 'one payroll row');
    assert.deepEqual([fee[0].category, fee[0].amount, fee[0].cashEffect, fee[0].profitEffect], ['revenue', paid, paid, paid]);
    assert.deepEqual([wage[0].category, wage[0].amount, wage[0].cashEffect, wage[0].profitEffect], ['payroll', payroll, -payroll, -payroll]);
    assert.equal(after.finance.transactions.length, base.finance.transactions.length + 2, 'only the fee and payroll rows');
    assert.equal(after.companyCash - base.companyCash, paid - payroll, 'company cash moves by fee minus payroll');
    assert.equal(after.personalCash, base.personalCash, 'personal cash as without the fee');
  } else {
    const returned = was.cash, gp = now.gpDistributed - was.gpDistributed, lp = now.lpDistributed - was.lpDistributed;
    assert.equal(now.status, s.variant === 'harvest' ? 'harvesting' : 'closed');
    if (s.variant === 'close') assert.equal(now.closedWeek, after.week, 'closed this week');
    assert.ok(returned > 0, 'undeployed cash to return');
    assert.equal(now.cash, 0, 'all fund cash returned');
    assert.equal(now.undeployedReturned - was.undeployedReturned, returned, 'returned at par');
    assert.equal(now.distributed - was.distributed, returned, 'distributed once');
    assert.equal(gp + lp, returned, 'split between GP and LPs');
    assert.ok(gp > 0 && lp > 0, 'both sides receive a share');
    assert.equal(after.personalCash - base.personalCash, gp, 'the GP share reaches personal cash');
    assert.equal(after.companyCash, base.companyCash, 'company cash as without the transition');
    assert.equal(after.finance.transactions.length, base.finance.transactions.length, 'no ledger row');
  }
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok, true);
}
(async () => {
  for (const variant of ['fee', 'harvest', 'close']) await prepareControl(variant);
  const harness = makeTransactionFaultCase({ name: 'PE fund week', fixture, command: week, snapshot, economic, expectSuccess: success });
  for (const variant of ['fee', 'harvest', 'close']) {
    // The canonical week has no fund-specific notify; its terminal event is `week`, not a command `change`.
    for (const kind of FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind))) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), save = s.game.save;
    let committedSaves = 0;
    s.game.save = function (...args) { if (!this.inTransaction()) committedSaves++; return save.apply(this, args); };
    assert.equal(week(s), true); s.game.save = save; assert.equal(committedSaves, 1);
    success(before, snapshot(s.game), s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await fixture(variant); assert.equal(week(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic week');
    console.log(`PE fund ${variant} week: transition, cash, ledger and replay PASS`);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('harvest', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken PE fund week rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command: week, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('fee', 'save-false'), /full live rollback/);
  for (const [variant, mutate, pattern] of [
    ['harvest', (after, s) => { after.personalCash -= 1; }, /GP share reaches personal cash/],
    ['fee', (after, s) => { after.companyCash += 1; }, /fee minus payroll/],
    ['close', (after, s) => { fundOf(after, s).cash = 1; }, /all fund cash returned/]
  ]) {
    const wrong = await fixture(variant), before = snapshot(wrong.game); assert.equal(week(wrong), true);
    const after = snapshot(wrong.game); mutate(after, wrong);
    assert.throws(() => success(before, after, wrong), pattern);
  }
  console.log('PE fund lifecycle canonical-week save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
