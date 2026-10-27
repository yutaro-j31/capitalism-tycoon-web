'use strict';
// P3-4 W-SUB-RELIST: the installed relisting of a wholly owned, previously squeezed-out subsidiary (relistSubsidiary)
// with each installed strategy, on a subsidiary taken through production writers only. Every save fault rolls back the
// whole relisting (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are monotonic; the
// retry equals the uninterrupted relisting; a second relisting is refused. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, STRATEGIES } = require('./fixtures/subsidiary-relist-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
// Installed strategies: primary / parent-secondary ratios of the subsidiary, offer discount and lock-up.
const TERMS = Object.freeze({
  control: { label: '支配維持型', primary: .05, secondary: .05, discount: .04, lockupWeeks: 26, volatility: .12 },
  balanced: { label: '標準型', primary: .10, secondary: .10, discount: .07, lockupWeeks: 18, volatility: .18 },
  growth: { label: '成長資金型', primary: .20, secondary: .05, discount: .11, lockupWeeks: 13, volatility: .28 }
});
const PREPARATION_COST = 15000000;
const ratio6 = value => Math.round(value * 1e6) / 1e6;
const rows = (state, sourceType) => state.finance.transactions.filter(row => row.sourceType === sourceType);

function success(before, after, s) {
  const id = s.subsidiaryID, t = TERMS[s.variant], ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.subsidiaries.find(row => row.id === id), now = after.subsidiaries.find(row => row.id === id);
  // Independent oracle: both blocks priced at the discounted private valuation and rounded up to whole yen; the wholly
  // owned parent sells its block with the same share of its book, and pays the fixed preparation cost.
  const preMoney = was.valuation, primary = ceilYen(Math.round(preMoney * t.primary) * (1 - t.discount));
  const secondary = ceilYen(Math.round(preMoney * t.secondary) * (1 - t.discount));
  const ownership = ratio6((1 - t.secondary) * preMoney / (preMoney + primary));
  const book = Number(was.carryingBookValue) || 0, bookSold = Math.round(book * t.secondary), lockupUntilWeek = after.week + t.lockupWeeks;
  assert.equal(was.ownership, 1); assert.equal(was.publicCompany, false);
  assert.equal(after.companyCash, before.companyCash - PREPARATION_COST + secondary, 'company pays the preparation cost and receives the whole-yen secondary proceeds');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(now.subsidiaryCash, was.subsidiaryCash + primary, 'primary proceeds stay in the subsidiary');
  assert.equal(now.valuation, preMoney + primary, 'post-money valuation');
  assert.equal(now.ownership, ownership, 'parent stake after the secondary block and the primary dilution');
  assert.equal(now.carryingBookValue, book - bookSold, 'sold book leaves the parent');
  assert.equal(now.publicCompany, true, 'listed again'); assert.equal(now.relistingRounds, (was.relistingRounds || 0) + 1); assert.equal(now.lastRelistedWeek, after.week);
  assert.deepEqual(JSON.parse(JSON.stringify(now.ipoOfferTerms)), { termID: s.variant, label: t.label, preMoney, primaryProceeds: primary, secondaryProceeds: secondary,
    lockupWeeks: t.lockupWeeks, lockupUntilWeek, volatility: t.volatility, listingPriceIndex: 100, relisting: true }, 'relisting offer terms');
  // The listed market restarts at this week rather than replaying the private period.
  assert.equal(now.marketLastWeek, after.week); assert.equal(now.marketPriceIndex, 100); assert.equal(now.marketListingValuation, now.valuation);
  assert.deepEqual(JSON.parse(JSON.stringify(after.subsidiaryRelistingHistory[0])), { week: after.week, type: 'relisted', subsidiaryID: id, subsidiaryName: was.name,
    strategyID: s.variant, primaryProceeds: primary, secondaryProceeds: secondary, ownershipAfter: ownership, lockupUntilWeek }, 'history row');
  const prep = rows(after, 'subsidiaryRelistingPreparation'), sale = rows(after, 'subsidiaryRelistingSecondary');
  assert.equal(prep.length, rows(before, 'subsidiaryRelistingPreparation').length + 1, 'one preparation cost');
  assert.equal(sale.length, rows(before, 'subsidiaryRelistingSecondary').length + 1, 'one secondary receipt');
  const cost = prep.at(-1), receipt = sale.at(-1);
  assert.equal(cost.operationID, `subsidiaryRelistingPreparation-${id}-${after.week}`); assert.equal(cost.sourceID, id);
  assert.equal(cost.amount, PREPARATION_COST); assert.equal(cost.cashEffect, -PREPARATION_COST); assert.equal(cost.profitEffect, -PREPARATION_COST);
  assert.equal(receipt.category, 'investmentSale'); assert.equal(receipt.operationID, `subsidiaryRelistingSecondary-${id}-${after.week}`); assert.equal(receipt.sourceID, id);
  assert.equal(receipt.amount, secondary); assert.equal(receipt.cashEffect, secondary, 'the sale receipt is the cash received');
  assert.equal(receipt.assetEffect, -bookSold); assert.equal(receipt.profitEffect, secondary - bookSold);
  for (const row of [cost, receipt]) for (const field of ['amount', 'cashEffect', 'assetEffect', 'profitEffect'])
    assert.ok(Number.isSafeInteger(row[field] || 0), `${row.sourceType} ${field} is whole yen`);
  assert.ok(after.news.some(line => line.includes('再上場')), 'relisting is reported');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'subsidiary relisting', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of STRATEGIES) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), events = [], emit = s.game.emit, save = s.game.save;
    let saves = 0;
    s.game.emit = function (type = 'change', ...args) { events.push(type); return emit.call(this, type, ...args); };
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(command(s), true); s.game.emit = emit; s.game.save = save;
    assert.deepEqual(events, ['notify', 'saved', 'change']); assert.equal(saves, 1);
    const done = snapshot(s.game); success(before, done, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await fixture(variant); assert.equal(command(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic relisting');
    // A listed subsidiary cannot relist again: every strategy is refused without change or save.
    for (const strategy of STRATEGIES) {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(s.game.relistSubsidiary(s.subsidiaryID, strategy), false, `second ${strategy} relisting refused`);
      s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), doneSub = done.subsidiaries.find(row => row.id === s.subsidiaryID);
    for (const field of ['ownership', 'carryingBookValue', 'valuation', 'subsidiaryCash', 'publicCompany', 'lastRelistedWeek']) assert.equal(kept[field], doneSub[field], field);
    assert.equal(restored.g.saveVersion, 9);
  }
  // Without the preparation cost in company cash the relisting is refused before any change.
  {
    const s = await fixture('balanced'); s.game.g.companyCash = PREPARATION_COST - 1; assert.equal(s.game.save(), true); await s.backend.flush();
    const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key);
    assert.equal(command(s), false, 'unfunded relisting refused');
    assert.deepEqual(economic(snapshot(s.game)), state); await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('growth', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken relisting rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('control', 'save-false'), /full live rollback/);
  const wrong = await fixture('growth'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen secondary proceeds/);
  const primary = snapshot(wrong.game); primary.subsidiaries.find(row => row.id === wrong.subsidiaryID).subsidiaryCash -= 1;
  assert.throws(() => success(before, primary, wrong), /primary proceeds stay in the subsidiary/);
  console.log('Subsidiary relisting save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
