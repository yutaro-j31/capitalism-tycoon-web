'use strict';
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, REQUEST } = require('./fixtures/shareholder-buyback-atomicity');
const { makeTransactionFaultCase, injectFault, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const command = s => s.game.buybackOwnShares(REQUEST);
function success(before, after, s) {
  const { quantity, cost, remaining } = s.settlement;
  assert.equal(after.treasuryBuybackShares, before.treasuryBuybackShares + quantity, 'pinned treasury quantity');
  assert.equal(after.companyCash, before.companyCash - cost, 'pinned whole-yen cash outflow');
  assert.equal(after.finance.balances.treasuryStock, before.finance.balances.treasuryStock + cost, 'pinned contra-equity book');
  for (const key of ['week', 'sharesOut', 'founderShares', 'personalCash', 'personalDebt', 'personalStocks', 'companyStocks', 'companyDebt', 'properties', 'simulationRng'])
    assert.deepEqual(after[key], before[key], key + ': issuer/account/asset/RNG separation');
  assert.equal(after.stockPrice, 100.01 * (1 + Math.min(.08, quantity / 100000 * .8)));
  const own = after.market.find(row => row.id === 'CPTY');
  assert.equal(own.price, after.stockPrice); assert.equal(own.issuedShares, 100000);
  assert.equal(own.marketCap, after.stockPrice * 100000);
  assert.deepEqual(own.priceHistory, before.market.find(row => row.id === 'CPTY').priceHistory);
  assert.deepEqual(after.market.filter(row => row.id !== 'CPTY'), before.market.filter(row => row.id !== 'CPTY'));
  assert.equal(after.founderOwnershipRatio, before.founderShares / (100000 - quantity));
  assert.equal(after.competitorOwnedRatio, 0);
  assert.equal(after.externalShareholderRatio, 1 - after.founderOwnershipRatio);
  assert.equal(after.finance.transactions.length, before.finance.transactions.length + 1);
  const txn = after.finance.transactions.at(-1);
  assert.equal(txn.category, 'otherFinancing'); assert.equal(txn.sourceType, 'shareholderReturns');
  assert.equal(txn.sourceID, `buyback-12-${quantity}`);
  assert.equal(txn.idempotencyKey, `shareholder-buyback-12-${quantity}`);
  assert.equal(txn.amount, cost); assert.equal(txn.cashEffect, -cost); assert.equal(txn.equityEffect, -cost);
  for (const key of ['profitEffect', 'assetEffect', 'liabilityEffect']) assert.equal(txn[key], 0);
  const receipt = txn.buybackReconciliation;
  assert.equal(receipt.quantity, quantity); assert.equal(receipt.cost, cost); assert.equal(receipt.executionPrice, 100.01);
  assert.equal(receipt.evidence.costRounding, 'ceilYen');
  for (const [key, value] of Object.entries({ companyCashBefore: 100000000, companyCashAfter: 100000000 - cost,
    treasurySharesBefore: 0, treasurySharesAfter: quantity, issuedSharesBefore: 100000, issuedSharesAfter: 100000,
    founderSharesBefore: before.founderShares, founderSharesAfter: before.founderShares,
    treasuryBookBefore: 0, treasuryBookAfter: cost, outstandingSharesBefore: 100000, outstandingSharesAfter: 100000 - quantity }))
    assert.equal(receipt.evidence[key], value, 'receipt ' + key);
  const history = after.finance.shareholderReturns.history;
  assert.equal(history.length, (before.finance.shareholderReturns?.history.length || 0) + 1);
  assert.deepEqual(history.at(-1), { week: 12, type: 'buyback', amount: cost, shares: quantity, price: 100.01, safeCapacity: 95000000 });
  const reconciliation = s.modules.economicReadModel.ownershipReconciliation(after);
  assert.equal(reconciliation.ok, true);
  assert.equal(reconciliation.securityClasses[0].unallocatedOutstandingQuantity, remaining, 'outside float excludes both founder buckets');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.buybackReconciliationStatus(copy()).ok, true);
  assert.equal(s.modules.finance.validate(copy()).ok, true);
}
(async () => {
  const harness = makeTransactionFaultCase({ name: 'buyback', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of ['ordinary', 'capped']) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), draws = s.host.draws;
    let saves = 0; const save = s.game.save;
    s.game.save = function (...args) { saves++; return save.apply(this, args); };
    assert.equal(command(s), true); assert.equal(saves, 1); assert.equal(s.host.draws, draws);
    success(before, snapshot(s.game), s); await s.backend.flush(); await harness.loaded(s, s.game.g);
    const stable = snapshot(s.game);
    let retried;
    const retry = makeTransactionFaultCase({ name: 'buyback deterministic retry', fixture: async () => {
      retried = await fixture(variant); return retried;
    }, command, snapshot, economic, expectSuccess: success });
    await retry.rejected(variant, 'save-throw');
    assert.deepEqual(economic(retried.game.g), economic(stable), 'recovery/retry equals uninterrupted same-seed order');
    const compact = s.modules.saveStorage.compactStateForStorage(stable, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    for (const key of ['companyCash', 'personalCash', 'personalStocks', 'sharesOut', 'founderShares', 'treasuryBuybackShares'])
      assert.deepEqual(JSON.parse(JSON.stringify(restored.g[key])), stable[key], 'critical compaction retains ' + key);
    assert.equal(restored.g.finance.balances.treasuryStock, s.settlement.cost);
    assert.equal(s.modules.finance.buybackReconciliationStatus(restored.g).ok, true);
    assert.equal(s.modules.economicReadModel.ownershipReconciliation(restored.g).ok, true);
    assert.equal(restored.g.saveVersion, 9);
    // This API is an order, not an idempotent operation-ID command. Another valid
    // order is allowed; exhausted outside float rejects without a second save.
    if (variant === 'capped') {
      const bytes = s.backend.readSync(s.key);
      assert.equal(command(s), false); assert.equal(saves, 1);
      assert.deepEqual(snapshot(s.game), stable); assert.equal(s.backend.readSync(s.key), bytes);
    } else {
      assert.equal(s.game.buybackOwnShares(109), true); assert.equal(saves, 2);
      assert.equal(s.game.g.treasuryBuybackShares, 10000); assert.equal(s.game.g.companyCash, 98999891);
      assert.equal(s.game.g.finance.balances.treasuryStock, 1000109);
      const rows = s.game.g.finance.transactions.filter(row => row.sourceType === 'shareholderReturns');
      assert.equal(rows.length, 2); assert.equal(rows[1].amount, 109); assert.equal(rows[1].buybackReconciliation.quantity, 1);
      assert.notEqual(rows[0].idempotencyKey, rows[1].idempotencyKey);
      assert.deepEqual(snapshot(s.game).personalStocks, stable.personalStocks);
      await s.backend.flush(); await harness.loaded(s, s.game.g);
    }
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('ordinary', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken buyback rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('capped', 'save-false'), /full live rollback/);
  const wrong = await fixture('ordinary'), prior = snapshot(wrong.game);
  assert.equal(command(wrong), true);
  const corrupted = snapshot(wrong.game); corrupted.treasuryBuybackShares++;
  assert.throws(() => success(prior, corrupted, wrong), /pinned treasury quantity/);
  // P3-4 direct-export closure: the exported implementation has its own shared transaction and verification leg.
  // Trap the installed method, so a test accidentally delegated through the usual engine entry cannot pass.
  const directFixture = async variant => {
    const s = await fixture(variant);
    s.game.buybackOwnShares = () => { throw Error('direct export test used installed entry'); };
    return s;
  };
  const directCommand = s => s.modules.shareholderReturns.buyback(s.game, REQUEST);
  const direct = makeTransactionFaultCase({ name: 'buyback direct export', fixture: directFixture,
    command: directCommand, snapshot, economic, expectSuccess: success });
  for (const variant of ['ordinary', 'capped']) {
    const s = await directFixture(variant), before = snapshot(s.game), draws = s.host.draws;
    let saves = 0; const save = s.game.save;
    s.game.save = function (...args) { saves++; return save.apply(this, args); };
    assert.equal(directCommand(s), true); assert.equal(saves, 1); assert.equal(s.host.draws, draws);
    success(before, snapshot(s.game), s); await s.backend.flush(); await direct.loaded(s, s.game.g);
    for (const kind of ['save-false', 'save-throw']) await direct.rejected(variant, kind);
    console.log('buyback direct export ' + variant + ': exact settlement / one save / fresh fake-IDB PASS');
  }
  await direct.rejected('ordinary', 'save-false', { nested: true });
  await direct.rejected('ordinary', 'save-throw', { pending: true });
  // A one-share divergence on this bypass must be refused by the real verification leg, not merely caught by
  // the normal-success oracle after a committed order. Both money and the entire durable predecessor survive.
  const skew = await directFixture('ordinary'), beforeSkew = snapshot(skew.game), bytes = skew.backend.readSync(skew.key), puts = skew.control.attempts.length;
  const ratios = skew.game.updateOwnershipRatios;
  skew.game.updateOwnershipRatios = function (...args) { this.g.treasuryBuybackShares++; return ratios.apply(this, args); };
  assert.equal(directCommand(skew), false, 'direct export rejects one extra treasury share');
  assert.deepEqual(snapshot(skew.game), beforeSkew, 'mismatch restores full live state and persisted RNG');
  await skew.backend.flush();
  assert.equal(skew.backend.readSync(skew.key), bytes); assert.equal(skew.ctx.localStorage.getItem(skew.key), bytes);
  assert.equal(skew.durable.get(skew.key), bytes); assert.equal(skew.control.attempts.length, puts, 'mismatch never admits a durable put');
  await direct.loaded(skew, beforeSkew);
  skew.game.updateOwnershipRatios = ratios; assert.equal(directCommand(skew), true, 'healthy direct-export retry');
  success(beforeSkew, snapshot(skew.game), skew); await skew.backend.flush(); await direct.loaded(skew, skew.game.g);
  console.log('buyback direct export: one-share mismatch / full rollback / durable hydration / retry PASS');
  // W-BUYBACK-BASE is an overridden legacy body, not the export above. Prove rejection only:
  // its successful settlement/book/rounding policy is not adopted by this evidence.
  const baseCases = ['ordinary', 'capped'].flatMap(variant =>
    ['caller-false', 'caller-throw', 'save-false', 'save-throw'].map(kind => ({ variant, kind, pending: false })));
  for (const kind of ['save-false', 'save-throw']) baseCases.push({ variant: 'ordinary', kind, pending: true });
  for (const { variant, kind, pending } of baseCases) {
    const s = await fixture(variant), proto = Object.getPrototypeOf(s.engineModule.TycoonEngine.prototype);
    assert.equal(Object.hasOwn(proto, 'buybackOwnShares'), true, 'actual base declaration');
    const captured = proto.buybackOwnShares, installed = s.game.buybackOwnShares;
    assert.notEqual(captured, installed);
    assert.equal(s.modules.phase3OwnershipPlanner.WRITER_POLICIES['W-BUYBACK-BASE'].rejection, 'INTERNAL_ENTRY');
    s.game.buybackOwnShares = () => { throw Error('captured base test used installed entry'); };
    if (pending) {
      const opening = s.durable.get(s.key);
      s.game.g.companyName += ' accepted pending predecessor';
      s.control.holdPut = true; assert.equal(s.game.save(), true);
      for (let i = 0; i < 100 && !s.control.release; i++) await new Promise(resolve => setImmediate(resolve));
      assert.equal(typeof s.control.release, 'function', 'earlier accepted put is in flight');
      assert.equal(s.durable.get(s.key), opening, 'earlier put has not completed');
      assert.notEqual(s.backend.readSync(s.key), opening, 'pending predecessor differs from old durable save');
      assert.equal(JSON.parse(s.backend.readSync(s.key)).companyName, s.game.g.companyName);
    }
    const before = snapshot(s.game), bytes = s.backend.readSync(s.key), durable = s.durable.get(s.key),
      puts = s.control.attempts.length, draws = s.host.draws;
    let entered = 0;
    const invoke = () => s.game.runTransaction(() => {
      assert.equal(s.game.inTransaction(), true); entered++;
      const result = captured.call(s.game, REQUEST);
      assert.equal(result, true, 'legacy body finishes before refusal');
      assert.equal(s.game.g.treasuryBuybackShares, before.treasuryBuybackShares + s.settlement.quantity);
      assert.ok(s.game.g.companyCash < before.companyCash, 'legacy cash write really happened');
      if (kind === 'caller-throw') throw Error('buyback caller threw after legacy body');
      return kind === 'caller-false' ? false : result;
    });
    const fault = kind.startsWith('save-') ? injectFault(s, kind) : null;
    try {
      if (kind === 'caller-throw' || kind === 'save-throw')
        assert.throws(invoke, kind === 'caller-throw' ? /buyback caller threw/ : /save accepted then threw/);
      else assert.equal(invoke(), false);
    } finally { fault?.restore(); s.game.buybackOwnShares = installed; }
    assert.equal(entered, 1); if (fault) assert.ok(fault.hits() > 0, 'outer save fault reached');
    assert.deepEqual(snapshot(s.game), before, 'entire legacy candidate including book/history/RNG restored');
    assert.equal(s.host.draws, draws);
    assert.equal(s.ctx.localStorage.getItem(s.key), bytes); assert.equal(s.backend.readSync(s.key), bytes);
    assert.equal(s.durable.get(s.key), durable, 'old durable copy unchanged before predecessor release');
    s.control.release?.(); await s.backend.flush(); assert.equal(s.durable.get(s.key), bytes);
    assert.equal(s.control.attempts.length, puts, 'predecessor preserved and no rejected base put starts');
    await harness.loaded(s, before);
    assert.equal(command(s), true, 'supported installed command works after legacy rollback');
    success(before, snapshot(s.game), s); await s.backend.flush(); await harness.loaded(s, s.game.g);
    assert.equal(s.control.attempts.length, puts + 1, 'only the supported recovery order is persisted');
    console.log('captured buyback base / ' + variant + ' / ' + kind + ' / pending=' + pending + ' / rollback-installed-recovery-fresh fake-IDB PASS');
  }
  console.log('Shareholder buyback shared save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
