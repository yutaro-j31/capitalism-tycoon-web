'use strict';
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, PER_SHARE, week } = require('./fixtures/shareholder-dividend-payment-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const receipts = state => state.finance.transactions.filter(row => row.category === 'dividend');
function success(before, after, s) {
  const p = s.settlement;
  assert.equal(after.week, 13); assert.equal(before.week, 12);
  assert.equal(after.personalCash, before.personalCash + p.net, 'pinned founder net cash');
  for (const key of ['sharesOut', 'founderShares', 'treasuryBuybackShares', 'personalStocks', 'companyStocks'])
    assert.deepEqual(after[key], before[key], 'payment cannot transfer ' + key);
  assert.equal(after.dividendPerShare, PER_SHARE, 'declared policy restored after temporary cap');
  assert.equal(after.market.find(row => row.id === 'CPTY').dividendPerShare, PER_SHARE);
  const rows = receipts(after); assert.equal(rows.length, receipts(before).length + 1);
  const row = rows.at(-1), d = row.dividendDistribution;
  assert.equal(row.week, 13); assert.equal(row.sourceType, 'weekly-dividend'); assert.equal(row.sourceID, 'dividend');
  assert.equal(row.operationID, 'week-13-dividend'); assert.equal(row.idempotencyKey, 'week-13-dividend');
  assert.equal(row.amount, p.gross, 'pinned gross paid'); assert.equal(row.cashEffect, -p.gross);
  for (const key of ['profitEffect', 'assetEffect', 'liabilityEffect', 'equityEffect']) assert.equal(row[key], 0);
  for (const [key, value] of Object.entries({ gross: p.gross, payerReduction: p.gross, personalNet: p.net,
    withholding: p.withholding, externalGross: p.external, roundingResidual: 0, founderRatio: 60000 / 99000 }))
    assert.equal(d[key], value, 'independent distribution leg ' + key);
  assert.equal(d.evidence.netRounding, 'ceilYen'); assert.equal(d.evidence.gross, p.gross);
  assert.equal(d.evidence.personalCashBefore, 10000000); assert.equal(d.evidence.personalCashAfter, 10000000 + p.net);
  assert.equal(d.evidence.payerCashWithoutDividend, p.cash); assert.equal(d.evidence.payerCashAfter, p.cash - p.gross);
  const returns = after.finance.shareholderReturns, prior = before.finance.shareholderReturns;
  assert.equal(returns.lastActualDividend, p.gross); assert.equal(returns.lastDeclaredDividend, prior.lastDeclaredDividend);
  assert.equal(returns.lastPaymentWeek, 13); assert.equal(returns.history.length, prior.history.length + 1);
  assert.deepEqual(returns.history.slice(0, -1), prior.history);
  assert.deepEqual(returns.history.at(-1), { week: 13, type: 'dividendPayment', declaredPerShare: PER_SHARE,
    declaredTotal: PER_SHARE * 99000, paid: p.gross, capped: s.variant === 'capped', safeCapacity: p.capacity, corporateTaxCorrection: 0 });
  const copy = () => JSON.parse(JSON.stringify(after));
  const reconciliation = s.modules.finance.dividendReconciliationStatus(copy());
  assert.equal(reconciliation.ok, true); assert.equal(reconciliation.metrics.paymentCount, 1);
  assert.equal(after.finance.dividendReconciliation.pendingDistribution, null);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.economicReadModel.ownershipReconciliation(copy()).ok, true);
}

// Additional actual payment/close/week-completion boundaries, without translating
// the canonical `week` event into a fictitious command `change`/`notify` event.
async function boundaryFault(variant, kind, harness) {
  const s = await fixture(variant), before = snapshot(s.game), bytes = s.backend.readSync(s.key);
  const puts = s.control.attempts.length, draws = s.host.draws, allocated = [], backend = s.modules.saveStorageIDB;
  s.modules.saveStorageIDB = { ...backend, nextSequence(...args) { const seq = backend.nextSequence(...args); allocated.push(seq); return seq; } };
  let hits = 0, restore;
  if (kind === 'receipt') {
    // recordWeekly calls its lexical event(), so observe the installed module
    // entry after it has actually written the dividend receipt and its book.
    const record = s.modules.finance.recordWeekly;
    s.modules.finance.recordWeekly = function (state, ...args) {
      const result = record.call(this, state, ...args);
      if (state === s.game.g && state.week === 13) {
        assert.equal(receipts(state).length, 1); hits++; throw Error('dividend receipt threw');
      }
      return result;
    };
    restore = () => { s.modules.finance.recordWeekly = record; };
  } else if (kind === 'finalize') {
    const rebuild = s.modules.finance.rebuildSnapshotForWeek;
    s.modules.finance.rebuildSnapshotForWeek = function (...args) {
      if (/finalizeWeekBoundary/.test(new Error().stack)) { hits++; throw Error('dividend final close threw'); }
      return rebuild.apply(this, args);
    };
    restore = () => { s.modules.finance.rebuildSnapshotForWeek = rebuild; };
  } else {
    const emit = s.game.emit;
    s.game.emit = function (type, ...args) {
      if (type === 'week') { hits++; throw Error('dividend week completion threw'); }
      return emit.call(this, type, ...args);
    };
    restore = () => { s.game.emit = emit; };
  }
  try { assert.throws(() => week(s), /dividend .*threw/); }
  finally { restore(); s.modules.saveStorageIDB = backend; }
  assert.equal(hits, 1); assert.deepEqual(snapshot(s.game), before, 'complete live weekly rollback');
  assert.equal(s.host.draws, draws); assert.equal(s.ctx.__localStorageData.get(s.key), bytes);
  assert.equal(s.backend.readSync(s.key), bytes); assert.equal(s.durable.get(s.key), bytes);
  await s.backend.flush(); assert.equal(s.durable.get(s.key), bytes); assert.equal(s.control.attempts.length, puts);
  const sequence = raw => JSON.parse(raw).saveSequence, predecessor = sequence(bytes);
  assert.ok(Number.isSafeInteger(predecessor)); assert.ok(allocated.every(Number.isSafeInteger));
  if (kind === 'week') assert.ok(allocated.length > 0, 'terminal week fault follows actual save admission');
  const high = Math.max(predecessor, ...allocated);
  await harness.loaded(s, before); assert.equal(s.game.save(), true); await s.backend.flush();
  assert.ok(sequence(s.backend.readSync(s.key)) > high, 'recovery exceeds failed allocation');
  const recovery = sequence(s.backend.readSync(s.key));
  assert.equal(week(s), true); success(before, snapshot(s.game), s);
  await s.backend.flush(); await harness.loaded(s, s.game.g);
  assert.ok(sequence(s.backend.readSync(s.key)) > recovery); assert.equal(s.durable.get(s.key), s.backend.readSync(s.key));
  console.log(`dividend payment ${variant}/${kind} rollback/recovery/retry PASS`);
  return s;
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'dividend payment week', fixture, command: week, snapshot, economic, expectSuccess: success });
  for (const variant of ['normal', 'capped']) {
    // The installed week has no payment-specific `notify`; its terminal event is
    // `week`, not the shared command fault's post-transaction `change`.
    for (const kind of FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind))) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), save = s.game.save;
    let committedSaves = 0;
    s.game.save = function (...args) { if (!this.inTransaction()) committedSaves++; return save.apply(this, args); };
    assert.equal(week(s), true); assert.equal(committedSaves, 1);
    const stable = snapshot(s.game); success(before, stable, s); await s.backend.flush(); await harness.loaded(s, s.game.g);
    const control = await fixture(variant);
    assert.equal(control.game.setDividend(0), true, 'installed cancellation establishes the no-dividend control');
    await control.backend.flush();
    assert.equal(control.game.advanceWeek(false), true);
    assert.equal(control.game.g.companyCash - stable.companyCash, s.settlement.gross, 'same-seed no-dividend company cash difference');
    assert.equal(stable.personalCash - control.game.g.personalCash, s.settlement.net, 'same-seed no-dividend founder cash difference');
    assert.equal(stable.lastReport.profit, control.game.g.lastReport.profit, 'dividend is not an expense');
    assert.deepEqual(stable.simulationRng, snapshot(control.game).simulationRng);
    for (const kind of ['receipt', 'finalize', 'week']) {
      const retried = await boundaryFault(variant, kind, harness);
      assert.deepEqual(economic(retried.game.g), economic(stable), 'whole retried week equals uninterrupted same-seed payment');
    }
    const compact = s.modules.saveStorage.compactStateForStorage(stable, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    for (const key of ['companyCash', 'personalCash', 'sharesOut', 'founderShares', 'treasuryBuybackShares'])
      assert.equal(restored.g[key], stable[key]);
    assert.equal(restored.g.finance.dividendReconciliation.paymentCount, 1);
    assert.equal(restored.g.finance.dividendReconciliation.lastPaymentWeek, 13);
    assert.equal(restored.g.finance.shareholderReturns.lastActualDividend, s.settlement.gross);
    assert.equal(restored.g.saveVersion, 9);
    const replay = snapshot(s.game), bytes = s.backend.readSync(s.key), evidence = receipts(stable).at(-1).dividendDistribution.evidence;
    assert.throws(() => s.modules.finance.observeDividendDistribution(s.game.g, evidence), /P2-DIVIDEND-DUPLICATE/);
    assert.deepEqual(snapshot(s.game), replay); assert.equal(s.backend.readSync(s.key), bytes);
    assert.equal(s.game.advanceWeek(false), true); await s.backend.flush();
    assert.equal(s.game.g.week, 14); assert.equal(receipts(s.game.g).length, 1);
    assert.equal(s.game.g.finance.shareholderReturns.lastPaymentWeek, 13);
    assert.equal(s.game.g.finance.dividendReconciliation.paymentCount, 1);
    await harness.loaded(s, s.game.g);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('normal', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken dividend rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command: week, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('capped', 'save-false'), /full live rollback/);
  const wrong = await fixture('normal'), before = snapshot(wrong.game); assert.equal(week(wrong), true);
  const corrupted = snapshot(wrong.game); corrupted.personalCash++;
  assert.throws(() => success(before, corrupted, wrong), /pinned founder net cash/);
  console.log('Shareholder dividend payment canonical-week save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
