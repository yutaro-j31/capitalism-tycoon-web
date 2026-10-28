'use strict';
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, SETTLEMENT } = require('./fixtures/sponsor-injection-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const command = s => s.game.requestSponsorInjection();
function success(before, after, s) {
  assert.equal(after.companyCash, before.companyCash + SETTLEMENT.amount, 'pinned sponsor cash');
  assert.equal(after.sharesOut, before.sharesOut + SETTLEMENT.shares, 'pinned sponsor issuance');
  for (const key of ['founderShares', 'treasuryBuybackShares', 'personalCash', 'personalDebt',
    'personalStocks', 'companyStocks', 'companyDebt', 'properties', 'simulationRng'])
    assert.deepEqual(after[key], before[key], key + ': account/asset/RNG separation');
  assert.equal(after.playerCrisisActions.nextActionSeq, before.playerCrisisActions.nextActionSeq + 1);
  assert.equal(after.playerCrisisActions.lastSponsorInjectionWeek, before.week);
  assert.equal(after.playerCrisisActions.history.length, before.playerCrisisActions.history.length + 1);
  const action = after.playerCrisisActions.history.at(-1);
  assert.equal(action.actionID, 'pca-1'); assert.equal(action.operationID, 'player-crisis-action-pca-1');
  assert.equal(action.type, 'sponsorInjection'); assert.equal(action.status, 'completed');
  assert.equal(action.amount, SETTLEMENT.amount);
  assert.equal(action.cashBefore, before.companyCash); assert.equal(action.cashAfter, after.companyCash);
  const receipts = after.finance.transactions.filter(t => t.sourceType === 'playerCrisisSponsorInjection');
  assert.equal(receipts.length, 1, 'one financing receipt');
  const txn = receipts[0];
  for (const key of ['amount', 'cashEffect', 'equityEffect']) assert.equal(txn[key], SETTLEMENT.amount);
  for (const key of ['profitEffect', 'assetEffect', 'liabilityEffect']) assert.equal(txn[key], 0);
  assert.equal(txn.category, 'equityFinancing'); assert.equal(txn.sourceID, action.actionID);
  assert.equal(txn.operationID, action.operationID); assert.equal(txn.idempotencyKey, action.operationID);
  assert.equal(after.finance.transactions.length, before.finance.transactions.length + 1);
  assert.equal(after.finance.balances.capitalSurplus, before.finance.balances.capitalSurplus + SETTLEMENT.amount);
  const reconcile = s.modules.economicReadModel.ownershipReconciliation;
  const prior = reconcile(before), current = reconcile(after);
  assert.equal(prior.ok, true, JSON.stringify(prior.issues));
  assert.equal(current.ok, true, JSON.stringify(current.issues));
  assert.equal(current.securityClasses[0].unallocatedOutstandingQuantity,
    prior.securityClasses[0].unallocatedOutstandingQuantity + SETTLEMENT.shares);
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'sponsor injection', fixture, command, snapshot, economic, expectSuccess: success });
  for (const kind of FAULT_KINDS) await harness.rejected('private', kind);
  for (const kind of ['save-false', 'save-throw'])
    for (const options of [{ pending: true }, { nested: true }]) await harness.rejected('private', kind, options);

  const s = await fixture(), before = snapshot(s.game), draws = s.host.draws;
  let commits = 0; const save = s.game.save;
  s.game.save = function (...args) { commits++; return save.apply(this, args); };
  assert.equal(command(s), true); assert.equal(commits, 1, 'one outer save');
  assert.equal(s.host.draws, draws); success(before, snapshot(s.game), s);
  await s.backend.flush(); await harness.loaded(s, s.game.g);
  const stable = snapshot(s.game), bytes = s.backend.readSync(s.key), saved = commits;
  assert.equal(command(s), false, 'cooldown rejects replay');
  assert.deepEqual(snapshot(s.game), stable); assert.equal(commits, saved);
  assert.equal(s.backend.readSync(s.key), bytes);
  let replay;
  const replayHarness = makeTransactionFaultCase({ name: 'sponsor deterministic retry',
    fixture: async () => { replay = await fixture(); return replay; },
    command, snapshot, economic, expectSuccess: success });
  await replayHarness.rejected('private', 'save-throw');
  assert.deepEqual(economic(replay.game.g), economic(stable), 'failed save/recovery/retry equals uninterrupted same-seed command');
  const compact = s.modules.saveStorage.compactStateForStorage(s.game.g, 'critical').state;
  const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
  for (const key of ['companyCash', 'companyDebt', 'personalCash', 'personalDebt', 'sharesOut', 'founderShares', 'playerCrisisActions'])
    assert.deepEqual(JSON.parse(JSON.stringify(restored.g[key])), stable[key], 'critical save retains ' + key);
  assert.equal(restored.requestSponsorInjection(), false, 'critical reload retains replay rejection');
  assert.equal(restored.g.sharesOut, stable.sharesOut);

  const broken = makeTransactionFaultCase({ name: 'broken sponsor rollback', fixture: async () => {
    const s = await fixture(); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('private', 'save-false'), /full live rollback/);
  // A coherent cash/ledger receipt with the wrong issued quantity is still invalid to the oracle.
  const wrong = await fixture(), prior = snapshot(wrong.game);
  assert.equal(command(wrong), true);
  const skewed = snapshot(wrong.game); skewed.sharesOut--;
  assert.throws(() => success(prior, skewed, wrong), /pinned sponsor issuance/);
  // Since the P3-4 W-SPONSOR verification leg, the writer itself refuses such an issuance and rolls it back.
  const refused = await fixture(), unchanged = snapshot(refused.game), ratios = refused.game.updateOwnershipRatios;
  refused.game.updateOwnershipRatios = function (...args) { this.g.sharesOut--; return ratios.apply(this, args); };
  assert.equal(command(refused), false, 'a diverging issued quantity is refused');
  assert.deepEqual(snapshot(refused.game), unchanged, 'and the whole injection is rolled back');
  console.log('Sponsor injection shared save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
