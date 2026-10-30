'use strict';
// P3-4 W-SUB-FOLLOWON: the installed follow-on offering of a listed subsidiary (executeListedSubsidiaryFollowOnOffering)
// with each installed option, on a subsidiary listed through production writers. Every save fault rolls back the whole
// offering (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are monotonic; the retry
// equals the uninterrupted offering; a second offering inside the cooldown is refused. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, OPTIONS } = require('./fixtures/subsidiary-follow-on-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
// Installed terms: primary / parent-secondary ratios of the subsidiary and the offer discount.
const TERMS = Object.freeze({ primary: { primary: .1, secondary: 0, discount: .06 }, secondary: { primary: 0, secondary: .1, discount: .04 },
  balanced: { primary: .05, secondary: .05, discount: .05 } });
const ratio6 = value => Math.round(value * 1e6) / 1e6;
const rows = (state, sourceType) => state.finance.transactions.filter(row => row.sourceType === sourceType);

function success(before, after, s) {
  const id = s.subsidiaryID, t = TERMS[s.variant], ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.subsidiaries.find(row => row.id === id), now = after.subsidiaries.find(row => row.id === id);
  // Independent oracle: both blocks priced at the discounted listed valuation and rounded up to whole yen; the primary
  // dilutes the parent at the post-money value and the parent then sells its block with its book pro rata.
  const ownership = ratio6(was.ownership), valuation = was.valuation, factor = 1 - t.discount;
  const primary = ceilYen(valuation * t.primary * factor), secondary = ceilYen(valuation * t.secondary * factor);
  const postMoney = valuation + primary, after6 = ratio6(ratio6(ownership * valuation / postMoney) - t.secondary);
  const book = Number(was.carryingBookValue) || 0, bookSold = Math.round(book * t.secondary / ownership), gain = secondary - bookSold;
  assert.equal(after.companyCash, before.companyCash + secondary, 'company receives only the whole-yen secondary proceeds');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(now.subsidiaryCash, was.subsidiaryCash + primary, 'primary proceeds stay in the subsidiary');
  assert.equal(now.valuation, postMoney, 'post-money valuation');
  assert.equal(now.ownership, after6, 'parent stake diluted by the primary, then reduced by the secondary');
  assert.equal(now.carryingBookValue, book - bookSold, 'sold book leaves the parent pro rata');
  assert.equal(now.publicCompany, true);
  assert.equal(now.followOnOfferingCount, (was.followOnOfferingCount || 0) + 1); assert.equal(now.lastFollowOnOfferingWeek, after.week);
  assert.equal(now.followOnPrimaryRaised, (was.followOnPrimaryRaised || 0) + primary);
  assert.equal(now.followOnSecondaryProceeds, (was.followOnSecondaryProceeds || 0) + secondary);
  assert.deepEqual(JSON.parse(JSON.stringify(after.listedSubsidiaryFollowOnOfferingHistory[0])), { week: after.week, subsidiaryID: id,
    subsidiaryName: was.name, optionID: s.variant, primaryProceeds: primary, secondaryProceeds: secondary, ownershipAfter: after6, bookSold, gain }, 'history row');
  const key = `${id}-${after.week}-${s.variant}`;
  const primaryRows = rows(after, 'listedSubsidiaryPrimaryOffering'), secondaryRows = rows(after, 'listedSubsidiarySecondaryOffering');
  assert.equal(primaryRows.length, rows(before, 'listedSubsidiaryPrimaryOffering').length + (primary > 0 ? 1 : 0), 'one primary row when raised');
  assert.equal(secondaryRows.length, rows(before, 'listedSubsidiarySecondaryOffering').length + (secondary > 0 ? 1 : 0), 'one secondary row when sold');
  if (primary > 0) {
    const row = primaryRows.at(-1);
    assert.equal(row.sourceID, key); assert.equal(row.operationID, `listedSubsidiaryPrimaryOffering-${key}`);
    assert.equal(row.amount, primary); assert.equal(row.cashEffect, 0, 'the parent receives none of the primary');
    assert.equal(row.assetEffect, 0); assert.equal(row.profitEffect, 0);
  }
  if (secondary > 0) {
    const row = secondaryRows.at(-1);
    assert.equal(row.category, 'assetSale'); assert.equal(row.sourceID, key); assert.equal(row.operationID, `listedSubsidiarySecondaryOffering-${key}`);
    assert.equal(row.amount, secondary); assert.equal(row.cashEffect, secondary, 'the sale receipt is the cash received');
    assert.equal(row.assetEffect, -bookSold); assert.equal(row.profitEffect, gain);
    for (const field of ['amount', 'cashEffect', 'assetEffect', 'profitEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  }
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'listed subsidiary follow-on', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of OPTIONS) {
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic follow-on');
    // The 26-week capital-policy cooldown restarts: every option is refused without change or save.
    for (const option of OPTIONS) {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(s.game.executeListedSubsidiaryFollowOnOffering(s.subsidiaryID, option), false, `${option} inside the cooldown refused`);
      s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), doneSub = done.subsidiaries.find(row => row.id === s.subsidiaryID);
    for (const field of ['ownership', 'carryingBookValue', 'valuation', 'subsidiaryCash', 'lastFollowOnOfferingWeek']) assert.equal(kept[field], doneSub[field], field);
    assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('balanced', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken follow-on rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('primary', 'save-false'), /full live rollback/);
  const wrong = await fixture('balanced'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen secondary proceeds/);
  const primary = snapshot(wrong.game); primary.subsidiaries.find(row => row.id === wrong.subsidiaryID).subsidiaryCash -= 1;
  assert.throws(() => success(before, primary, wrong), /primary proceeds stay in the subsidiary/);
  console.log('Listed subsidiary follow-on save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
