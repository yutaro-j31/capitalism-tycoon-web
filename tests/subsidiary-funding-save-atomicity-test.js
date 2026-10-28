'use strict';
// P3-4 W-INTERNAL-VENTURE (subsidiary funding): the installed parent capital injection and external round of an
// unlisted subsidiary (fundSubsidiaryFromParent, raiseSubsidiaryExternalRound), on a subsidiary spun out of an internal
// venture and on a 70% VC subsidiary, both built with production writers. Every save fault rolls back the whole command
// (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are monotonic; the retry equals the
// uninterrupted command; the follow-up command is refused. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/subsidiary-funding-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rows = state => state.finance.transactions.filter(row => row.sourceType === 'fundSubsidiaryFromParent');

function success(before, after, s) {
  const ceilYen = s.modules.economicOperation.ceilYen, week = after.week, amount = ceilYen(s.amount);
  const was = before.subsidiaries.find(row => row.id === s.subsidiaryID), sub = after.subsidiaries.find(row => row.id === s.subsidiaryID);
  // Independent oracle: the round is priced at the subsidiary's valuation (pre-money); the parent's new shares buy in at
  // that price, an external round dilutes the parent instead.
  const pre = Math.max(1, was.valuation), post = pre + amount, own = clamp(was.ownership, 0, 1);
  const ownAfter = clamp(s.side === 'parent' ? (own * pre + amount) / post : own * pre / post, 0, 1);
  const lift = clamp(amount / pre, 0, 1);
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(sub.valuation, post, 'post-money valuation'); assert.equal(sub.ownership, ownAfter, 'parent stake at post-money');
  assert.equal(sub.subsidiaryCash, was.subsidiaryCash + amount, 'the subsidiary receives the whole-yen round');
  assert.equal(sub.growth, clamp(was.growth + clamp(lift * .08, .002, .03), 0, 1), 'growth effect');
  assert.equal(sub.risk, clamp(was.risk - clamp(lift * .02, .001, .008), 0, 1), 'risk effect');
  assert.equal(sub.lastCapitalActionWeek, week);
  const history = { week, subsidiaryID: was.id, subsidiaryName: was.name, amount, ownershipBefore: own, ownershipAfter: ownAfter, valuationBefore: pre, valuationAfter: post };
  if (s.side === 'parent') {
    assert.equal(after.companyCash, before.companyCash - amount, 'company pays the whole-yen injection');
    assert.equal(sub.carryingBookValue, was.carryingBookValue + amount, 'the injection is capitalised in the parent book');
    assert.equal(sub.investedCost, Math.max(0, was.investedCost ?? was.carryingBookValue) + amount);
    assert.equal(sub.parentCapitalInjected, (was.parentCapitalInjected || 0) + amount);
    assert.equal(sub.externalCapitalRaised, was.externalCapitalRaised || 0);
    assert.deepEqual(JSON.parse(JSON.stringify(after.subsidiaryFundingHistory[0])), { ...history, type: 'parentFunding' }, 'funding history row');
    const added = rows(after).slice(rows(before).length);
    assert.equal(added.length, 1, 'exactly one ledger row');
    const row = added[0];
    assert.equal(row.category, 'assetPurchase'); assert.equal(row.operationID, `fundSubsidiaryFromParent-${was.id}-${week}-${sub.parentCapitalInjected}`);
    assert.equal(row.amount, amount); assert.equal(row.cashEffect, -amount); assert.equal(row.assetEffect, amount);
    for (const field of ['amount', 'cashEffect', 'assetEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  } else {
    assert.equal(after.companyCash, before.companyCash, 'an external round moves no parent cash');
    assert.equal(sub.carryingBookValue, was.carryingBookValue, 'the parent book is unchanged');
    assert.equal(sub.externalCapitalRaised, (was.externalCapitalRaised || 0) + amount);
    assert.equal(sub.externalFundingRounds, (was.externalFundingRounds || 0) + 1); assert.equal(sub.lastExternalFundingWeek, week);
    assert.equal(sub.parentCapitalInjected, was.parentCapitalInjected || 0);
    assert.deepEqual(JSON.parse(JSON.stringify(after.subsidiaryFundingHistory[0])), { ...history, type: 'externalFunding', dilution: own - ownAfter },
      'funding history row');
    assert.deepEqual(after.finance.transactions, before.finance.transactions, 'no parent ledger row');
  }
  const others = state => JSON.parse(JSON.stringify(state.subsidiaries.filter(row => row.id !== s.subsidiaryID)));
  assert.deepEqual(others(after), others(before), 'other subsidiaries untouched');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}
// The follow-up: a second external round is refused inside the 13-week cooldown; a parent injection below the
// installed ¥1,000,000 minimum is refused.
const refused = s => s.side === 'parent' ? s.game.fundSubsidiaryFromParent(s.subsidiaryID, 999_999) : command(s);

(async () => {
  const harness = makeTransactionFaultCase({ name: 'subsidiary funding', fixture, command, snapshot, economic, expectSuccess: success });
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic funding');
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
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), doneSub = done.subsidiaries.find(row => row.id === s.subsidiaryID);
    for (const field of ['valuation', 'carryingBookValue', 'subsidiaryCash', 'parentCapitalInjected', 'externalCapitalRaised', 'lastExternalFundingWeek'])
      assert.equal(kept[field], doneSub[field], field);
    // The round leaves an unrounded post-money stake; the load normalisation stores ownership ratios to six decimals.
    assert.equal(kept.ownership, Math.round(doneSub.ownership * 1e6) / 1e6, 'ownership');
    assert.equal(restored.g.companyCash, done.companyCash); assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('parentVc', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken subsidiary funding rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('parentVc', 'save-false'), /full live rollback/);
  const wrong = await fixture('parentVc'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen injection/);
  const stake = snapshot(wrong.game); stake.subsidiaries.find(row => row.id === wrong.subsidiaryID).ownership = .7;
  assert.throws(() => success(before, stake, wrong), /parent stake at post-money/);
  console.log('Subsidiary funding save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
