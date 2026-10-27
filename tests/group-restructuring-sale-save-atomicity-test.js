'use strict';
// P3-4 W-GROUP-DISPOSAL (sale): the installed group-restructuring sale of an unlisted subsidiary
// (executeGroupRestructuringSale), for a 70% VC subsidiary and a wholly owned one taken private through production
// writers. Every save fault rolls back the whole sale (live state, RNG, mirror, cache and durable bytes); recovery and
// retry sequences are monotonic; the retry equals the uninterrupted sale; a second sale is refused.
// Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/group-restructuring-sale-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
// The sale posts no notice (no `notify`), so that shared fault kind does not apply; its terminal event is `change`.
const KINDS = FAULT_KINDS.filter(kind => kind !== 'notify');
const PRIVATE_DISCOUNT = .08;
const rows = state => state.finance.transactions.filter(row => row.sourceType === 'groupRestructuringSale');

function success(before, after, s) {
  const id = s.subsidiaryID, ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.subsidiaries.find(row => row.id === id), now = after.subsidiaries.find(row => row.id === id);
  // Independent oracle: the whole unlisted stake at the valuation less an 8% private-sale discount, rounded up to whole
  // yen; the parent's entire book leaves.
  const proceeds = ceilYen(was.valuation * was.ownership * (1 - PRIVATE_DISCOUNT)), book = Number(was.carryingBookValue) || 0, gain = proceeds - book;
  assert.equal(was.publicCompany, false);
  assert.equal(after.companyCash, before.companyCash + proceeds, 'company receives the whole-yen sale proceeds');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(now.status, 'sold'); assert.equal(now.ownership, 0, 'no stake remains');
  assert.equal(now.carryingBookValue, 0, 'the whole book leaves the parent');
  assert.equal(now.valuation, was.valuation); assert.equal(now.subsidiaryCash, was.subsidiaryCash);
  assert.deepEqual(JSON.parse(JSON.stringify(after.groupRestructuringHistory[0])),
    { week: after.week, type: 'sale', subsidiaryID: id, proceeds, bookRemoved: book, gain }, 'restructuring history row');
  const saleRows = rows(after);
  assert.equal(saleRows.length, rows(before).length + 1, 'exactly one sale receipt');
  const row = saleRows.at(-1);
  assert.equal(row.category, 'assetSale'); assert.equal(row.sourceID, id); assert.equal(row.operationID, `groupRestructuringSale-${id}-${after.week}`);
  assert.equal(row.amount, proceeds); assert.equal(row.cashEffect, proceeds, 'the receipt is the cash received');
  assert.equal(row.assetEffect, -book); assert.equal(row.profitEffect, gain);
  for (const field of ['amount', 'cashEffect', 'profitEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  // Every other subsidiary is untouched.
  assert.deepEqual(after.subsidiaries.filter(row => row.id !== id), before.subsidiaries.filter(row => row.id !== id));
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'group restructuring sale', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of VARIANTS) {
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic sale');
    // A sold subsidiary cannot be sold again: refused without any economic change or save.
    {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(command(s), false, 'second sale refused'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID);
    assert.equal(kept.status, 'sold'); assert.equal(kept.ownership, 0); assert.equal(kept.carryingBookValue, 0);
    assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('whole', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken group-sale rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('partial', 'save-false'), /full live rollback/);
  const wrong = await fixture('whole'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen sale proceeds/);
  const book = snapshot(wrong.game); book.subsidiaries.find(row => row.id === wrong.subsidiaryID).carryingBookValue = 1;
  assert.throws(() => success(before, book, wrong), /whole book leaves the parent/);
  console.log('Group restructuring sale save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
