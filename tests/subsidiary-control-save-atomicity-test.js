'use strict';
// P3-4 W-SUB-CONTROL: the installed listed-subsidiary control actions (launchListedSubsidiaryTenderOffer to 90%,
// squeezeOutListedSubsidiary to 100% and delisting) on a subsidiary listed through production writers. Every save fault
// rolls back the whole action (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are
// monotonic; the retry equals the uninterrupted action; a repeated action is refused. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic } = require('./fixtures/subsidiary-control-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
// Installed terms: a tender offer to 90% at an 18% premium; a squeeze-out from 90% to 100% at an 8% premium.
const TERMS = Object.freeze({
  tob: { target: .9, premium: .18, type: 'tenderOffer', sourceType: 'listedSubsidiaryTenderOffer', listed: true },
  squeeze: { target: 1, premium: .08, type: 'squeezeOut', sourceType: 'listedSubsidiarySqueezeOut', listed: false }
});
const ratio6 = value => Math.round(value * 1e6) / 1e6;
const controlRows = (state, sourceType) => state.finance.transactions.filter(row => row.sourceType === sourceType);

function success(before, after, s) {
  const id = s.subsidiaryID, t = TERMS[s.variant], ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.subsidiaries.find(row => row.id === id), now = after.subsidiaries.find(row => row.id === id);
  // Independent oracle: the stake gap to the target at the listed valuation, plus the premium rounded up to whole yen;
  // the whole price is added to the parent's book.
  const ratio = ratio6(t.target - ratio6(was.ownership)), price = ceilYen(Math.round(was.valuation * ratio) * (1 + t.premium));
  assert.ok(ratio > 0);
  assert.equal(after.companyCash, before.companyCash - price, 'company pays the whole-yen control price');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(now.ownership, t.target, 'parent stake reaches the target');
  assert.equal(now.carryingBookValue, Math.max(0, Number(was.carryingBookValue) || 0) + price, 'the price is added to the parent book');
  assert.equal(now.publicCompany, t.listed, t.listed ? 'still listed after the tender offer' : 'delisted by the squeeze-out');
  assert.equal(now.valuation, was.valuation, 'the subsidiary itself is unchanged'); assert.equal(now.subsidiaryCash, was.subsidiaryCash);
  if (t.listed) { assert.equal(now.tenderOfferCompletedWeek, after.week); assert.equal(now.tenderOfferPremium, t.premium); }
  else { assert.equal(now.delistedWeek, after.week); assert.equal(now.delistingReason, 'squeezeOut'); assert.equal(now.status, 'active'); }
  assert.deepEqual(JSON.parse(JSON.stringify(after.listedSubsidiaryControlHistory[0])), { week: after.week, type: t.type, subsidiaryID: id,
    subsidiaryName: was.name, ratio, price, ownershipAfter: t.target, premium: t.premium }, 'control history row');
  assert.equal(after.listedSubsidiaryControlHistory.length, (before.listedSubsidiaryControlHistory || []).length + 1);
  const rows = controlRows(after, t.sourceType);
  assert.equal(rows.length, controlRows(before, t.sourceType).length + 1, 'exactly one control payment');
  const row = rows.at(-1);
  assert.equal(row.category, 'assetPurchase'); assert.equal(row.sourceID, `${id}-${after.week}`);
  assert.equal(row.operationID, `${t.sourceType}-${id}-${after.week}`); assert.equal(row.week, after.week);
  assert.equal(row.amount, price); assert.equal(row.cashEffect, -price, 'the payment is the cash paid');
  assert.equal(row.assetEffect, price, 'the payment is capitalised'); assert.equal(row.profitEffect || 0, 0, 'no profit effect');
  for (const key of ['amount', 'cashEffect', 'assetEffect']) assert.ok(Number.isSafeInteger(row[key]), `${key} is whole yen`);
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

async function refused(s, call, message) {
  const before = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), save = s.game.save;
  let saves = 0;
  s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
  assert.equal(call(), false, message); s.game.save = save;
  assert.deepEqual(economic(snapshot(s.game)), before, message + ': nothing changes'); assert.equal(saves, 0);
  await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes, message + ': durable bytes unchanged');
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'listed subsidiary control', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of ['tob', 'squeeze']) {
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic control action');
    // The action cannot be repeated: at 90% there is no tender gap; a delisted subsidiary has no control actions.
    await refused(s, () => command(s), `repeated ${variant} refused`);
    if (variant === 'squeeze') await refused(s, () => s.game.launchListedSubsidiaryTenderOffer(s.subsidiaryID), 'tender offer on a delisted subsidiary refused');
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), doneSub = done.subsidiaries.find(row => row.id === s.subsidiaryID);
    assert.equal(kept.ownership, doneSub.ownership); assert.equal(kept.carryingBookValue, doneSub.carryingBookValue);
    assert.equal(kept.publicCompany, doneSub.publicCompany); assert.equal(restored.g.saveVersion, 9);
  }
  // A squeeze-out needs the 90% stake: from the post-IPO 55% it is refused with no change and no save.
  { const s = await fixture('tob'); await refused(s, () => s.game.squeezeOutListedSubsidiary(s.subsidiaryID), 'squeeze-out below 90% refused'); }
  // Without enough company cash the tender offer is refused before any change.
  { const s = await fixture('tob'); s.game.g.companyCash = 1; assert.equal(s.game.save(), true); await s.backend.flush();
    await refused(s, () => command(s), 'unfunded tender offer refused'); }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('squeeze', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken control rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('tob', 'save-false'), /full live rollback/);
  const wrong = await fixture('squeeze'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash -= 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen control price/);
  const book = snapshot(wrong.game); book.subsidiaries.find(row => row.id === wrong.subsidiaryID).carryingBookValue -= 1;
  assert.throws(() => success(before, book, wrong), /added to the parent book/);
  console.log('Listed subsidiary control save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
