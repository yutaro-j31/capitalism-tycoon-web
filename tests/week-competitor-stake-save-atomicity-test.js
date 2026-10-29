'use strict';
// P3-4 W-WEEK-COMPETITOR: the installed canonical week in which a competitor buys player-company shares from the
// external float (updateCompetitors -> buyCompetitorStake). Every applicable save fault rolls back the whole week (the
// competitor's named holding and cash, the aggregate ratio, live state, RNG, mirror, cache and durable bytes), the
// recovery and retry sequences are monotonic, and the retried week equals the uninterrupted same-seed week. The
// purchase itself is checked against the same week with the purchase disabled. Node/fake-IDB only; no WebKit claim.
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, week, withoutPurchase } = require('./fixtures/week-competitor-stake-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const EPS = 1e-9;
const controls = {};
const control = variant => (controls[variant] ||= withoutPurchase(variant));

function success(before, after, s) {
  assert.equal(after.week, before.week + 1, 'one week');
  const base = control(s.variant), outstanding = before.sharesOut - before.treasuryBuybackShares;
  // The purchase pays the stock price at that point of the week; later passes of the same week move it again, so the
  // observer records it. The week's final price is the same as without the purchase (checked below).
  // Only the buyers' named holdings and cash, and the aggregate ratios, differ from the same week without the purchase.
  const bought = after.competitors.filter((c, i) => c.ownedPlayerShares !== base.competitors[i].ownedPlayerShares);
  assert.ok(bought.length >= 1, 'a competitor bought shares');
  let filled = 0;
  for (const c of bought) {
    const i = after.competitors.indexOf(c), was = base.competitors[i], qty = c.ownedPlayerShares - was.ownedPlayerShares;
    assert.ok(Number.isSafeInteger(qty) && qty > 0, 'whole shares');
    const seen = s.buys.filter(b => b.id === c.id).at(-1);
    assert.ok(seen && seen.filled === qty && Number.isFinite(seen.price) && seen.price > 0, 'the observed purchase is this holding change');
    assert.ok(Math.abs((was.cash - c.cash) - qty * seen.price) < .1, 'the buyer pays filled × price');
    assert.deepEqual({ ...c, cash: 0, ownedPlayerShares: 0 }, { ...was, cash: 0, ownedPlayerShares: 0 }, 'nothing else about the buyer changes');
    filled += qty;
  }
  assert.ok(Math.abs(after.competitorOwnedRatio * outstanding - (before.competitorOwnedRatio * outstanding + filled)) < EPS * outstanding,
    'aggregate ratio grows by the filled quantity');
  assert.ok(after.competitorOwnedRatio <= .49 + EPS, '49% cap');
  for (const key of ['sharesOut', 'founderShares', 'treasuryBuybackShares', 'stockPrice', 'market', 'companyCash', 'personalCash', 'finance'])
    assert.deepEqual(after[key], base[key], `${key} same as the week without the purchase`);
  assert.ok(Math.abs(after.founderOwnershipRatio + after.competitorOwnedRatio + after.externalShareholderRatio - 1) < EPS, 'ratios sum to 1');
  assert.deepEqual(after.simulationRng, base.simulationRng, 'the purchase draws no RNG');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'competitor stake week', fixture, command: week, snapshot, economic, expectSuccess: success });
  for (const variant of ['fresh', 'held']) {
    // The canonical week has no purchase-specific notify; its terminal event is `week`, not a command `change`.
    for (const kind of FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind))) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), save = s.game.save;
    let committedSaves = 0;
    s.game.save = function (...args) { if (!this.inTransaction()) committedSaves++; return save.apply(this, args); };
    assert.equal(week(s), true); s.game.save = save; assert.equal(committedSaves, 1);
    success(before, snapshot(s.game), s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await fixture(variant); assert.equal(week(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic week');
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('held', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken competitor stake week rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command: week, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('fresh', 'save-false'), /full live rollback/);
  const wrong = await fixture('held'), before = snapshot(wrong.game); assert.equal(week(wrong), true);
  const ratio = snapshot(wrong.game); ratio.competitorOwnedRatio += 1 / 1000000;
  assert.throws(() => success(before, ratio, wrong), /aggregate ratio grows by the filled quantity/);
  const cash = snapshot(wrong.game); cash.competitors.find(c => c.id === wrong.buys[0].id).cash += 1000;
  assert.throws(() => success(before, cash, wrong), /buyer pays filled × price/);
  console.log('Competitor stake canonical-week save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
