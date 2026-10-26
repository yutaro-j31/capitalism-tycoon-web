'use strict';
const assert = require('node:assert/strict');
const { fixture, snapshot, economic } = require('./fixtures/turnaround-fund-accept-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const command = s => s.game.acceptTurnaroundFund();
function success(before, after, s) {
  const { amount, shares } = s.settlement;
  assert.equal(after.companyCash, before.companyCash + amount, 'pinned fund cash');
  assert.equal(after.sharesOut, before.sharesOut + shares, 'pinned fund issuance');
  for (const key of ['week', 'founderShares', 'treasuryBuybackShares', 'personalCash', 'personalDebt', 'personalStocks', 'companyStocks', 'companyDebt', 'properties', 'simulationRng'])
    assert.deepEqual(after[key], before[key], key + ': account/asset/RNG separation');
  const fund = after.playerTurnaroundFund, plan = after.playerTurnaroundPlan;
  assert.equal(fund.status, 'active'); assert.equal(fund.fundID, 'turnaround-fund-2');
  assert.equal(fund.investedWeek, 2); assert.equal(fund.investedAmount, amount);
  assert.equal(fund.shares, shares); assert.equal(fund.ratchetShares, 0, 'acceptance is not a ratchet');
  assert.equal(fund.planID, 'turnaround-2'); assert.equal(plan.planID, fund.planID);
  assert.equal(plan.status, 'active'); assert.equal(plan.startedWeek, 2); assert.equal(plan.deadlineWeek, 10);
  assert.equal(plan.startingCash, 12000000); assert.equal(plan.targetCash, 18000000);
  assert.equal(plan.targetDebt, 0); assert.equal(plan.startingDebt, 0);
  assert.equal(fund.history.length, before.playerTurnaroundFund.history.length + 1);
  const history = fund.history.at(-1);
  assert.equal(history.type, 'accepted'); assert.equal(history.amount, amount); assert.equal(history.shares, shares);
  const oldHistory = before.playerTurnaroundPlan.history;
  if (s.variant === 'replace') {
    assert.deepEqual(plan.history.slice(0, -1), oldHistory);
    assert.equal(plan.history.at(-1).status, 'cancelled');
    assert.equal(plan.history.at(-1).planID, before.playerTurnaroundPlan.planID);
  } else assert.deepEqual(plan.history, oldHistory);
  const receipts = after.finance.transactions.filter(t => t.sourceType === 'playerCrisisTurnaroundFund');
  assert.equal(receipts.length, 1); assert.equal(after.finance.transactions.length, before.finance.transactions.length + 1);
  const txn = receipts[0];
  for (const key of ['amount', 'cashEffect', 'equityEffect']) assert.equal(txn[key], amount);
  for (const key of ['profitEffect', 'assetEffect', 'liabilityEffect']) assert.equal(txn[key], 0);
  assert.equal(txn.category, 'equityFinancing');
  for (const key of ['sourceID', 'operationID', 'idempotencyKey']) assert.equal(txn[key], fund.fundID);
  assert.equal(after.finance.balances.capitalSurplus, before.finance.balances.capitalSurplus + amount);
  const reconcile = s.modules.economicReadModel.ownershipReconciliation;
  const prior = reconcile(before), current = reconcile(after);
  assert.equal(prior.ok, true); assert.equal(current.ok, true);
  assert.equal(current.securityClasses[0].unallocatedOutstandingQuantity, prior.securityClasses[0].unallocatedOutstandingQuantity + shares);
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'fund acceptance', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of ['uncapped', 'capped', 'replace']) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), draws = s.host.draws;
    let commits = 0; const save = s.game.save;
    s.game.save = function (...args) { commits++; return save.apply(this, args); };
    assert.equal(command(s), true); assert.equal(commits, 1); assert.equal(s.host.draws, draws);
    success(before, snapshot(s.game), s); await s.backend.flush(); await harness.loaded(s, s.game.g);
    const stable = snapshot(s.game), bytes = s.backend.readSync(s.key), saves = commits;
    assert.equal(command(s), false); assert.deepEqual(snapshot(s.game), stable);
    assert.equal(commits, saves); assert.equal(s.backend.readSync(s.key), bytes);
    let replay;
    const deterministic = makeTransactionFaultCase({ name: 'fund retry', fixture: async () => { replay = await fixture(variant); return replay; }, command, snapshot, economic, expectSuccess: success });
    await deterministic.rejected(variant, 'save-throw');
    assert.deepEqual(economic(replay.game.g), economic(stable), 'failure/recovery/retry equals uninterrupted same-seed acceptance');
    const compact = s.modules.saveStorage.compactStateForStorage(s.game.g, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    for (const key of ['companyCash', 'companyDebt', 'personalCash', 'personalDebt', 'sharesOut', 'founderShares', 'playerTurnaroundFund', 'playerTurnaroundPlan'])
      assert.deepEqual(JSON.parse(JSON.stringify(restored.g[key])), stable[key], 'critical save retains ' + key);
    assert.equal(restored.acceptTurnaroundFund(), false);
    assert.equal(restored.g.sharesOut, stable.sharesOut);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('uncapped', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken fund rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('replace', 'save-false'), /full live rollback/);
  const wrong = await fixture('capped'), prior = snapshot(wrong.game), ratios = wrong.game.updateOwnershipRatios;
  wrong.game.updateOwnershipRatios = function (...args) { this.g.sharesOut--; return ratios.apply(this, args); };
  assert.equal(command(wrong), true);
  assert.throws(() => success(prior, snapshot(wrong.game), wrong), /pinned fund issuance/);
  console.log('Turnaround fund acceptance shared save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
