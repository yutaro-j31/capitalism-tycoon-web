'use strict';
// P3-4 W-SUB-IPO: the installed prepared subsidiary IPO (executePreparedSubsidiaryIPO -> preparation wrapper ->
// engine ipoSubsidiary) on a VC subsidiary built and prepared with production writers. Every save fault rolls back
// the whole listing (live state, RNG, mirror, cache and durable bytes); the recovery and retry sequences are monotonic;
// the retry equals the uninterrupted listing; a second listing is refused. Node/fake-IDB only; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic } = require('./fixtures/subsidiary-ipo-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const SOLD = .15, SHARES = 1000000;
const ipoRows = state => state.finance.transactions.filter(row => row.sourceType === 'ipoSubsidiary');

function success(before, after, s) {
  const id = s.subsidiaryID, ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.subsidiaries.find(row => row.id === id), now = after.subsidiaries.find(row => row.id === id);
  assert.equal(was.publicCompany, false); assert.equal(now.publicCompany, true, 'listed');
  assert.match(now.ticker, /^V\d{3}$/); assert.equal(now.sharesOut, SHARES); assert.equal(now.stockPrice, was.valuation / SHARES);
  // The parent sells 15 points of its stake at the pre-money valuation; the book leaves pro rata in whole yen.
  const preBook = Number(was.carryingBookValue || was.investedCost || 0), soldBook = Math.round(preBook * SOLD / was.ownership);
  const proceeds = ceilYen(was.valuation * SOLD);
  // Ownership is a ratio (not money): a normalising reload may store 0.55 for 0.7 − 0.15 = 0.5499999999999999.
  assert.ok(Math.abs(now.ownership - (was.ownership - SOLD)) < 1e-12, 'parent stake falls by the sold block');
  assert.equal(now.carryingBookValue, preBook - soldBook, 'sold book leaves the parent');
  assert.equal(after.companyCash, before.companyCash + proceeds, 'company receives the whole-yen secondary proceeds');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  // The installed offer term adds primary proceeds to the subsidiary, not to the parent.
  const terms = s.modules.subsidiaryIPOPreparation.offerPreview(was, was.ipoPreparation.offerTermID);
  assert.equal(now.subsidiaryCash, Math.max(0, Number(was.subsidiaryCash) || 0) + terms.primaryProceeds, 'primary proceeds stay in the subsidiary');
  assert.equal(now.valuation, was.valuation + terms.primaryProceeds);
  assert.deepEqual(JSON.parse(JSON.stringify(now.ipoOfferTerms)), { termID: terms.id, label: terms.label, preMoney: was.valuation, primaryProceeds: terms.primaryProceeds,
    discount: terms.discount, primaryRatio: terms.primaryRatio, lockupWeeks: terms.lockupWeeks, lockupUntilWeek: after.week + terms.lockupWeeks, volatility: terms.volatility, listingPriceIndex: 100 });
  assert.equal(now.ipoPreparation.completed, true); assert.equal(now.ipoPreparation.listedWeek, after.week);
  assert.equal(now.marketLastWeek, after.week); assert.equal(now.marketPriceIndex, 100); assert.equal(now.marketListingValuation, now.valuation);
  const history = after.subsidiaryIPOPreparationHistory[0];
  assert.equal(history.type, 'listed'); assert.equal(history.subsidiaryID, id); assert.equal(history.ticker, now.ticker);
  assert.equal(history.termID, terms.id); assert.equal(history.primaryProceeds, terms.primaryProceeds);
  // Exactly one whole-yen ledger row for the parent's sale.
  const rows = ipoRows(after);
  assert.equal(rows.length, ipoRows(before).length + 1, 'exactly one IPO sale receipt');
  const row = rows.at(-1);
  assert.equal(row.category, 'investmentSale'); assert.equal(row.sourceID, id); assert.equal(row.week, after.week);
  assert.equal(row.amount, proceeds); assert.equal(row.cashEffect, proceeds, 'the sale receipt is the cash received');
  assert.equal(row.assetEffect, -soldBook); assert.equal(row.profitEffect, proceeds - soldBook);
  for (const key of ['amount', 'cashEffect', 'assetEffect', 'profitEffect']) assert.ok(Number.isSafeInteger(row[key]), `${key} is whole yen`);
  assert.ok(after.news.some(line => line.includes('を上場させ')), 'listing is reported');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'subsidiary IPO', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of ['balanced', 'growth']) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    // Uninterrupted listing: one accepted save and the existing notify -> saved -> change order.
    const s = await fixture(variant), before = snapshot(s.game), events = [], emit = s.game.emit, save = s.game.save;
    let saves = 0;
    s.game.emit = function (type = 'change', ...args) { events.push(type); return emit.call(this, type, ...args); };
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(command(s), true); s.game.emit = emit; s.game.save = save;
    assert.deepEqual(events, ['notify', 'saved', 'change']); assert.equal(saves, 1);
    const listed = snapshot(s.game); success(before, listed, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    // The same prepared state lists identically.
    const replay = await fixture(variant); assert.equal(command(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic listing');
    // A listed subsidiary cannot list again: refused without any economic change or save.
    const bytes = s.backend.readSync(s.key);
    assert.equal(command(s), false, 'second listing refused');
    assert.deepEqual(economic(s.game.g), economic(listed), 'refusal changes nothing'); assert.equal(s.backend.readSync(s.key), bytes);
    // The listing survives a v9 critical compaction.
    const compact = s.modules.saveStorage.compactStateForStorage(listed, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID);
    assert.equal(kept.publicCompany, true); assert.ok(Math.abs(kept.ownership - listed.subsidiaries.find(row => row.id === s.subsidiaryID).ownership) < 1e-12);
    assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('growth', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken IPO rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('balanced', 'save-false'), /full live rollback/);
  const wrong = await fixture('growth'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen secondary proceeds/);
  const primary = snapshot(wrong.game); primary.subsidiaries.find(row => row.id === wrong.subsidiaryID).subsidiaryCash -= 1;
  assert.throws(() => success(before, primary, wrong), /primary proceeds stay in the subsidiary/);
  console.log('Subsidiary IPO save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
