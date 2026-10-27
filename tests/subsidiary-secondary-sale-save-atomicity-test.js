'use strict';
// P3-4 W-SUB-SECONDARY: the installed sale of a listed subsidiary's shares by the parent (sellSubsidiaryIPOStake) after
// the IPO lock-up, on a subsidiary listed through production writers. Every save fault rolls back the whole sale (live
// state, RNG, mirror, cache and durable bytes); recovery and retry sequences are monotonic; the retry equals the
// uninterrupted sale; a sale that would breach the 10% retained minimum is refused. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic } = require('./fixtures/subsidiary-secondary-sale-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const DISCOUNT = .02;
const ratio6 = value => Math.round(value * 1e6) / 1e6;
const saleRows = state => state.finance.transactions.filter(row => row.sourceType === 'sellSubsidiaryIPOStake');

function success(before, after, s) {
  const id = s.subsidiaryID, ratio = s.ratio, ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.subsidiaries.find(row => row.id === id), now = after.subsidiaries.find(row => row.id === id);
  // Independent oracle: gross at the listed valuation, a 2% market discount rounded up to whole yen, and the cost basis
  // removed pro rata to the parent's stake.
  const ownership = ratio6(was.ownership), book = Math.max(0, Number(was.carryingBookValue ?? was.investedCost) || 0);
  const gross = Math.round(was.valuation * ratio), proceeds = ceilYen(gross * (1 - DISCOUNT));
  const costBasis = Math.round(book * (ratio / ownership)), gain = proceeds - costBasis;
  assert.equal(after.companyCash, before.companyCash + proceeds, 'company receives the whole-yen sale proceeds');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(after.cumulativeProfit, (Number(before.cumulativeProfit) || 0) + gain, 'realised gain');
  assert.equal(now.ownership, ratio6(ownership - ratio), 'parent stake falls by the sold ratio');
  assert.equal(now.carryingBookValue, book - costBasis, 'cost basis leaves the parent book pro rata');
  assert.equal(now.publicCompany, true); assert.equal(now.valuation, was.valuation, 'the subsidiary itself is unchanged');
  assert.equal(now.subsidiaryCash, was.subsidiaryCash);
  const operationID = `sellSubsidiaryIPOStake-${id}-${ratio}-${after.week}`;
  assert.deepEqual(JSON.parse(JSON.stringify(after.subsidiaryIPOSecondarySaleHistory[0])), { week: after.week, type: 'secondarySale', subsidiaryID: id,
    subsidiaryName: was.name, saleRatio: ratio, ownershipBefore: ownership, ownershipAfter: now.ownership, proceeds, costBasis, gain, operationID }, 'sale history row');
  const rows = saleRows(after);
  assert.equal(rows.length, saleRows(before).length + 1, 'exactly one sale receipt');
  const row = rows.at(-1);
  assert.equal(row.category, 'investmentSale'); assert.equal(row.sourceID, id); assert.equal(row.operationID, operationID);
  assert.equal(row.amount, proceeds); assert.equal(row.cashEffect, proceeds, 'the receipt is the cash received');
  assert.equal(row.profitEffect, gain, 'the receipt books the realised gain');
  for (const key of ['amount', 'cashEffect', 'profitEffect']) assert.ok(Number.isSafeInteger(row[key]), `${key} is whole yen`);
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'subsidiary secondary sale', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of ['ten', 'quarter']) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), events = [], emit = s.game.emit, save = s.game.save;
    let saves = 0;
    s.game.emit = function (type = 'change', ...args) { events.push(type); return emit.call(this, type, ...args); };
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(command(s), true); s.game.emit = emit; s.game.save = save;
    assert.deepEqual(events, ['notify', 'saved', 'change']); assert.equal(saves, 1);
    const sold = snapshot(s.game); success(before, sold, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await fixture(variant); assert.equal(command(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic sale');
    const compact = s.modules.saveStorage.compactStateForStorage(sold, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), soldSub = sold.subsidiaries.find(row => row.id === s.subsidiaryID);
    assert.equal(kept.ownership, soldSub.ownership); assert.equal(kept.carryingBookValue, soldSub.carryingBookValue);
    assert.equal(restored.g.saveVersion, 9);
  }
  // A 50% sale from the post-IPO 55% stake would leave the parent below its 10% minimum: refused, nothing changes.
  {
    const s = await fixture('ten'), before = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), save = s.game.save;
    let saves = 0;
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(s.game.sellSubsidiaryIPOStake(s.subsidiaryID, .50), false, 'a sale below the retained minimum is refused');
    assert.deepEqual(economic(snapshot(s.game)), before); assert.equal(saves, 0); await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('quarter', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken secondary-sale rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('ten', 'save-false'), /full live rollback/);
  const wrong = await fixture('quarter'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen sale proceeds/);
  const book = snapshot(wrong.game); book.subsidiaries.find(row => row.id === wrong.subsidiaryID).carryingBookValue += 1;
  assert.throws(() => success(before, book, wrong), /cost basis leaves the parent book/);
  console.log('Subsidiary secondary sale save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
