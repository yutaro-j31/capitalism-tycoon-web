'use strict';
const assert = require('node:assert/strict');
const { fixture, snapshot, economic } = require('./fixtures/shareholder-dividend-declaration-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const command = s => s.game.setDividend(s.settlement.perShare);
function success(before, after, s) {
  const { perShare, plannedTotal } = s.settlement;
  assert.equal(after.dividendPerShare, perShare, 'pinned declared per-share term');
  const own = after.market.find(row => row.id === 'CPTY'), previous = before.market.find(row => row.id === 'CPTY');
  assert.equal(own.dividendPerShare, perShare); assert.equal(own.dividendYield, perShare * 4 / (100.01 * 1.008));
  assert.deepEqual({ ...own, dividendPerShare: 0, dividendYield: 0 }, { ...previous, dividendPerShare: 0, dividendYield: 0 });
  assert.deepEqual(after.market.filter(row => row.id !== 'CPTY'), before.market.filter(row => row.id !== 'CPTY'));
  for (const key of ['week', 'companyCash', 'companyDebt', 'personalCash', 'personalDebt', 'personalStocks', 'companyStocks',
    'sharesOut', 'founderShares', 'treasuryBuybackShares', 'founderOwnershipRatio', 'externalShareholderRatio', 'competitorOwnedRatio', 'stockPrice', 'properties', 'simulationRng'])
    assert.deepEqual(after[key], before[key], key + ': declaration is not payment or share transfer');
  const returns = after.finance.shareholderReturns, prior = before.finance.shareholderReturns;
  assert.equal(returns.lastDeclaredDividend, perShare);
  assert.equal(returns.lastActualDividend, prior.lastActualDividend); assert.equal(returns.lastPaymentWeek, prior.lastPaymentWeek);
  assert.equal(returns.history.length, prior.history.length + 1);
  assert.deepEqual(returns.history.slice(0, -1), prior.history, 'existing buyback and policy history retained');
  assert.equal(returns.history.at(-1).plannedTotal, plannedTotal, 'pinned total excludes 1,000 treasury shares');
  assert.deepEqual(returns.history.at(-1), { week: 12, type: 'declaration', dividendPerShare: perShare, plannedTotal, safeCapacity: 94899990 });
  const book = value => { const copy = JSON.parse(JSON.stringify(value.finance)); delete copy.shareholderReturns; return copy; };
  assert.deepEqual(book(after), book(before), 'no cash posting, ledger row, BS movement or finance-cache drift');
  assert.equal(s.modules.economicReadModel.ownershipReconciliation(after).ok, true);
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok, true);
}
(async () => {
  const harness = makeTransactionFaultCase({ name: 'dividend declaration', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of ['declare', 'cancel']) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), draws = s.host.draws;
    let saves = 0; const save = s.game.save;
    s.game.save = function (...args) { saves++; return save.apply(this, args); };
    assert.equal(command(s), true); assert.equal(saves, 1); assert.equal(s.host.draws, draws);
    const stable = snapshot(s.game); success(before, stable, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    let retried;
    const retry = makeTransactionFaultCase({ name: 'dividend retry', fixture: async () => { retried = await fixture(variant); return retried; },
      command, snapshot, economic, expectSuccess: success });
    await retry.rejected(variant, 'save-throw');
    assert.deepEqual(economic(retried.game.g), economic(stable), 'failed/recovered/retried policy equals uninterrupted same-seed declaration');
    const compact = s.modules.saveStorage.compactStateForStorage(stable, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    for (const key of ['dividendPerShare', 'companyCash', 'personalCash', 'sharesOut', 'founderShares', 'treasuryBuybackShares', 'personalStocks'])
      assert.deepEqual(JSON.parse(JSON.stringify(restored.g[key])), stable[key], 'critical compaction retains ' + key);
    assert.equal(restored.stock('CPTY').dividendPerShare, s.settlement.perShare);
    assert.equal(restored.g.finance.shareholderReturns.lastDeclaredDividend, s.settlement.perShare);
    assert.equal(restored.g.finance.shareholderReturns.lastActualDividend, 0);
    assert.equal(restored.g.finance.shareholderReturns.lastPaymentWeek, -1);
    assert.equal(restored.g.saveVersion, 9);
    // Setting a policy is repeatable. A second valid request writes one history row,
    // without payment; it is not an operation-ID replay API.
    assert.equal(command(s), true); assert.equal(saves, 2);
    const repeated = snapshot(s.game); success(stable, repeated, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const bytes = s.backend.readSync(s.key);
    assert.equal(s.game.setDividend(1000), false, '99m request exceeds pinned safe capacity');
    assert.equal(saves, 2); assert.deepEqual(snapshot(s.game), repeated); assert.equal(s.backend.readSync(s.key), bytes);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('declare', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken declaration rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('cancel', 'save-false'), /full live rollback/);
  const wrong = await fixture('declare'), prior = snapshot(wrong.game);
  assert.equal(command(wrong), true);
  const corrupted = snapshot(wrong.game); corrupted.finance.shareholderReturns.history.at(-1).plannedTotal = 125000;
  assert.throws(() => success(prior, corrupted, wrong), /pinned total excludes/);
  console.log('Shareholder dividend declaration shared save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
