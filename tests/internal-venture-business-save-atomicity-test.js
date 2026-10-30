'use strict';
// P3-4 W-INTERNAL-VENTURE (business): the installed internal-venture funding, sale and withdrawal commands
// (fundInternalVenture, sellInternalVenture, withdrawInternalVenture), on ventures proposed, approved and developed with
// production writers. Every save fault rolls back the whole command (live state, RNG, mirror, cache and durable bytes);
// recovery and retry sequences are monotonic; the retry equals the uninterrupted command; an exited venture cannot be
// sold or withdrawn again, and funding below the installed minimum is refused. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/internal-venture-business-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// The shared ledger keeps effects at ¥0.01 (finance.js contract §2); the approved venture book is fractional.
const cents = value => Math.round(value * 100) / 100;
const SOURCE = { fund: 'fundInternalVenture', sell: 'sellInternalVenture', withdraw: 'withdrawInternalVenture' };
const rows = (state, action) => state.finance.transactions.filter(row => row.sourceType === SOURCE[action]);

function success(before, after, s) {
  const ceilYen = s.modules.economicOperation.ceilYen, week = after.week;
  const was = before.internalVentures.find(v => v.id === s.ventureID), now = after.internalVentures.find(v => v.id === s.ventureID);
  // Independent oracle from the venture's own inputs: quality, market potential, risk, progress and book.
  const quality = clamp(was.teamQuality / 100, 0, 1), market = clamp(was.marketPotential / 100, 0, 1), risk = clamp(was.risk, 0, 1);
  const book = Math.max(0, was.carryingBookValue);
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.deepEqual(JSON.parse(JSON.stringify(after.subsidiaries)), JSON.parse(JSON.stringify(before.subsidiaries)), 'no subsidiary changes');
  const added = rows(after, s.action).slice(rows(before, s.action).length);
  assert.equal(added.length, 1, 'exactly one ledger row');
  const row = added[0];
  if (s.action === 'fund') {
    const amount = ceilYen(s.amount), base = Math.max(0, was.requiredBudget);
    const lift = Math.round(amount * clamp(.62 + quality * .32 + market * .28 - risk * .22, .65, 1.18));
    assert.equal(after.companyCash, before.companyCash - amount, 'company pays the whole-yen funding');
    assert.equal(now.carryingBookValue, book + amount, 'the funding is capitalised in the venture book');
    assert.equal(now.investedCapital, Math.max(base, was.investedCapital) + amount);
    assert.equal(now.additionalFunding, (was.additionalFunding || 0) + amount);
    assert.equal(now.valuation, was.valuation + lift, 'valuation lift');
    assert.equal(now.fundingRounds, (was.fundingRounds || 0) + 1); assert.equal(now.lastFundingWeek, week);
    if (was.status === 'developing') {
      const progress = clamp(was.progress + clamp(amount / Math.max(1, base) * 28 * (.75 + clamp(quality, .2, 1) * .5), 2, 28), 0, 100);
      assert.equal(now.progress, progress, 'development progress'); assert.equal(now.status, progress >= 100 ? 'active' : 'developing');
    } else { assert.equal(now.progress, was.progress); assert.equal(now.status, 'active'); }
    assert.deepEqual(JSON.parse(JSON.stringify(after.internalVentureBusinessHistory[0])), { week, type: 'funded', ventureID: was.id, ventureName: was.name,
      amount, valueLift: lift }, 'funding history row');
    assert.equal(row.category, 'assetPurchase'); assert.equal(row.operationID, `fundInternalVenture-${was.id}-${week}-${now.fundingRounds}`);
    assert.equal(row.cashEffect, -amount); assert.equal(row.assetEffect, amount);
  } else if (s.action === 'sell') {
    const multiple = clamp(.72 + quality * .2 + market * .24 - risk * .22 + (was.status === 'active' ? .08 : 0), .65, 1.18);
    const price = ceilYen(Math.max(was.valuation * multiple, book * .55)), gain = price - book;
    assert.equal(after.companyCash, before.companyCash + price, 'company receives the whole-yen sale price');
    assert.equal(now.status, 'sold'); assert.equal(now.exitWeek, week); assert.equal(now.exitPrice, price); assert.equal(now.exitGain, gain);
    assert.equal(now.valuationAtExit, was.valuation); assert.equal(now.carryingBookValue, 0, 'the book leaves the venture');
    assert.deepEqual(JSON.parse(JSON.stringify(after.internalVentureBusinessHistory[0])), { week, type: 'sold', ventureID: was.id, ventureName: was.name,
      price, gain, bookValue: book }, 'sale history row');
    assert.equal(row.category, 'assetSale'); assert.equal(row.operationID, `sellInternalVenture-${was.id}-${week}`);
    assert.equal(row.cashEffect, price); assert.equal(row.assetEffect, cents(-book)); assert.equal(row.profitEffect, cents(gain));
  } else {
    const rate = clamp(.08 + clamp(was.progress / 100, 0, 1) * .22 + quality * .08 - risk * .12, .05, .35);
    const recovered = ceilYen(book * rate), impairment = Math.max(0, book - recovered);
    assert.equal(after.companyCash, before.companyCash + recovered, 'company recovers the whole-yen withdrawal cash');
    assert.equal(now.status, 'withdrawn'); assert.equal(now.withdrawnWeek, week);
    assert.equal(now.withdrawalRecovery, recovered); assert.equal(now.withdrawalLoss, impairment);
    assert.equal(now.valuationAtExit, was.valuation); assert.equal(now.carryingBookValue, 0, 'the book leaves the venture');
    assert.deepEqual(JSON.parse(JSON.stringify(after.internalVentureBusinessHistory[0])), { week, type: 'withdrawn', ventureID: was.id, ventureName: was.name,
      recoveredCash: recovered, impairment, bookValue: book }, 'withdrawal history row');
    assert.equal(row.category, 'assetSale'); assert.equal(row.operationID, `withdrawInternalVenture-${was.id}-${week}`);
    assert.equal(row.cashEffect, recovered); assert.equal(row.assetEffect, cents(-book)); assert.equal(row.profitEffect, cents(-impairment));
  }
  assert.equal(row.sourceType, SOURCE[s.action]);
  for (const field of ['amount', 'cashEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  const others = state => JSON.parse(JSON.stringify(state.internalVentures.filter(v => v.id !== s.ventureID)));
  assert.deepEqual(others(after), others(before), 'the other venture is untouched');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}
// The refusal after the committed command: an exited venture cannot be sold or withdrawn again, and funding below the
// installed ¥1,000,000 minimum is refused.
const refused = s => s.action === 'fund' ? s.game.fundInternalVenture(s.ventureID, 999_999) : command(s);

(async () => {
  const harness = makeTransactionFaultCase({ name: 'internal venture business', fixture, command, snapshot, economic, expectSuccess: success });
  for (const variant of Object.keys(VARIANTS)) {
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic command');
    {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(refused(s), false, 'follow-up command refused'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.internalVentures.find(v => v.id === s.ventureID), doneVenture = done.internalVentures.find(v => v.id === s.ventureID);
    for (const field of ['status', 'carryingBookValue', 'valuation', 'progress', 'fundingRounds', 'exitPrice', 'withdrawalRecovery'])
      assert.equal(kept[field], doneVenture[field], field);
    assert.equal(restored.g.companyCash, done.companyCash); assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('sellActive', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken internal venture rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('sellActive', 'save-false'), /full live rollback/);
  const wrong = await fixture('withdraw'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen withdrawal cash/);
  const book = snapshot(wrong.game); book.internalVentures.find(v => v.id === wrong.ventureID).carryingBookValue = 1;
  assert.throws(() => success(before, book, wrong), /book leaves the venture/);
  console.log('Internal venture business save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
