'use strict';
// P3-4 W-GROUP-NEGOTIATED: closing an agreed subsidiary sale negotiation (closeNegotiatedSubsidiarySale), on
// negotiations started, agreed and advanced to their close week with production writers. Every save fault rolls back
// the whole close (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are monotonic; the
// retry equals the uninterrupted close; a closed negotiation cannot be closed again. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/group-negotiated-sale-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
// The close posts no notice (no `notify`), so that shared fault kind does not apply; its terminal event is `change`.
const KINDS = FAULT_KINDS.filter(kind => kind !== 'notify');
const ratio = value => Math.round(Math.max(0, Math.min(1, value)) * 1e6) / 1e6;
const rows = state => state.finance.transactions.filter(row => row.sourceType === 'negotiatedSubsidiarySale');

function success(before, after, s) {
  const ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.saleNegotiations.find(n => n.id === s.negotiationID), now = after.saleNegotiations.find(n => n.id === s.negotiationID);
  const target = before.subsidiaries.find(row => row.id === s.subsidiaryID), sub = after.subsidiaries.find(row => row.id === s.subsidiaryID);
  // Independent oracle: the agreed offer is settled in whole yen less a 2% whole-yen fee; a listed subsidiary keeps
  // 10%; the parent's book leaves pro rata (all of it on a full exit).
  const ownership = ratio(target.ownership), sellRatio = ratio(Math.min(was.sellRatio, target.publicCompany ? Math.max(0, ownership - .1) : ownership));
  const book = Math.max(0, target.carryingBookValue), bookRemoved = sellRatio >= ownership ? book : Math.max(0, Math.round(book * sellRatio / ownership));
  const gross = ceilYen(was.currentOffer), fee = Math.min(ceilYen(gross * .02), gross), net = gross - fee, gain = net - bookRemoved;
  assert.ok(sellRatio > 0 && net > 0, 'a real sale');
  assert.equal(after.companyCash, before.companyCash + net, 'company receives the whole-yen net proceeds');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(sub.ownership, ratio(ownership - sellRatio), 'the parent stake falls by the sold block');
  assert.equal(sub.carryingBookValue, book - bookRemoved, 'the sold book leaves the parent');
  assert.equal(sub.status, sub.ownership === 0 ? 'sold' : 'active');
  assert.equal(now.status, 'completed'); assert.equal(now.completedWeek, after.week);
  assert.equal(now.fee, fee); assert.equal(now.bookRemoved, bookRemoved); assert.equal(now.saleGain, gain); assert.equal(now.netProceeds, net);
  const earnouts = (after.earnoutAgreements || []).filter(e => e.id === `earnout-${was.id}`);
  if (was.earnoutAmount > 0) {
    assert.equal(earnouts.length, 1, 'one pending earnout');
    const e = earnouts[0];
    assert.deepEqual([e.subsidiaryID, e.earnoutTarget, e.earnoutAmount, e.earnoutDeadlineWeek, e.earnoutStatus, e.earnoutPaidWeek, e.closingWeek],
      [was.subsidiaryID, was.earnoutTarget, was.earnoutAmount, after.week + 52, 'pending', null, after.week], 'earnout terms');
  } else assert.equal(earnouts.length, 0, 'no earnout');
  assert.deepEqual(JSON.parse(JSON.stringify(after.groupRestructuringProgressHistory.at(-1))), { week: after.week, type: 'saleCompleted', negotiationID: was.id,
    subsidiaryID: was.subsidiaryID, sellRatio, proceeds: net, bookRemoved, gain, fee }, 'sale history row');
  const saleRows = rows(after);
  assert.equal(saleRows.length, rows(before).length + 1, 'exactly one sale receipt');
  const row = saleRows.at(-1);
  assert.equal(row.sourceID, was.id); assert.equal(row.operationID, `saleClose-${was.id}`);
  assert.equal(row.amount, gross); assert.equal(row.cashEffect, net, 'the receipt is the net cash');
  assert.equal(row.assetEffect, -bookRemoved); assert.equal(row.profitEffect, gain);
  for (const field of ['amount', 'cashEffect', 'assetEffect', 'profitEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'negotiated subsidiary sale', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of Object.keys(VARIANTS)) {
    for (const kind of KINDS) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), events = [], emit = s.game.emit, save = s.game.save;
    let saves = 0;
    s.game.emit = function (type = 'change', ...args) { events.push(type); return emit.call(this, type, ...args); };
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(command(s), true); s.game.emit = emit; s.game.save = save;
    assert.deepEqual(events, ['saved', 'change']); assert.equal(saves, 1);
    const done = snapshot(s.game); success(before, done, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await fixture(variant); assert.equal(command(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic close');
    // A closed negotiation cannot be closed again: refused without any economic change or save.
    {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(command(s), false, 'second close refused'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), doneSub = done.subsidiaries.find(row => row.id === s.subsidiaryID);
    for (const field of ['ownership', 'carryingBookValue', 'publicCompany', 'status']) assert.equal(kept[field], doneSub[field], field);
    assert.equal(restored.g.saleNegotiations.find(n => n.id === s.negotiationID).status, 'completed');
    assert.deepEqual(JSON.parse(JSON.stringify(restored.g.earnoutAgreements)), JSON.parse(JSON.stringify(done.earnoutAgreements)), 'earnouts survive compaction');
    assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('whole', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken negotiated sale rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('whole', 'save-false'), /full live rollback/);
  const wrong = await fixture('listed'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen net proceeds/);
  const book = snapshot(wrong.game); book.subsidiaries.find(row => row.id === wrong.subsidiaryID).carryingBookValue += 1;
  assert.throws(() => success(before, book, wrong), /sold book leaves the parent/);
  console.log('Negotiated subsidiary sale save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
