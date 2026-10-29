'use strict';
// P3-4 W-INVESTOR-AUX: the installed refreshInvestorOffers and declineInvestorOffer, now one transaction each. Every save
// fault rolls back the whole command (offers, declined status, news, RNG, mirror, cache and durable bytes); recovery and
// retry sequences are monotonic; the retry equals the uninterrupted command; a declined offer cannot be declined again
// and a listed company cannot refresh. Node/fake-IDB; no WebKit claim.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/investor-offer-aux-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const json = value => JSON.parse(JSON.stringify(value));
const CHANGED = { refresh: ['investorOffers', 'news', 'simulationRng', 'lastSaveDate', 'saveSequence'], decline: ['investorOffers', 'news', 'lastSaveDate', 'saveSequence'] };

function success(before, after, s) {
  if (s.variant === 'refresh') {
    const added = after.investorOffers.slice(before.investorOffers.length);
    assert.deepEqual(json(after.investorOffers.slice(0, before.investorOffers.length)), json(before.investorOffers), 'existing offers untouched');
    assert.ok(added.length >= 1 && added.length <= 2, 'one or two new offers');
    for (const o of added) {
      assert.equal(o.status, 'pending'); assert.equal(o.expiresWeek, after.week + 6, 'six-week expiry');
      assert.ok(Number.isSafeInteger(o.amount) && o.amount > 0 && Number.isSafeInteger(o.preMoneyValuation) && o.preMoneyValuation > 0);
      assert.ok(o.equity >= .05 && o.equity <= .2, 'equity within the offer range');
    }
    assert.notDeepEqual(json(after.simulationRng), json(before.simulationRng), 'offers are drawn from the simulation RNG');
    assert.match(after.news[0], /出資提案が届きました/);
  } else {
    const was = before.investorOffers.find(o => o.id === s.offerID), now = after.investorOffers.find(o => o.id === s.offerID);
    assert.deepEqual(json(now), { ...json(was), status: 'declined' }, 'only the declined status changes');
    assert.deepEqual(json(after.investorOffers.filter(o => o.id !== s.offerID)), json(before.investorOffers.filter(o => o.id !== s.offerID)), 'other offers untouched');
    assert.match(after.news[0], /出資提案を見送りました/);
  }
  assert.equal(after.news.length, Math.min(300, before.news.length + 1), 'one notice');
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (!CHANGED[s.variant].includes(key)) assert.deepEqual(json(after[key]), json(before[key]), `${key} untouched`);
  assert.equal(s.modules.finance.validate(json(after)).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'investor offer auxiliary command', fixture, command, snapshot, economic, expectSuccess: success });
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
    // The follow-up is refused with no change and no save: the declined offer is no longer pending, and a company that
    // has listed cannot refresh.
    {
      if (variant === 'refresh') s.game.g.publicCompany = true;
      const state = economic(snapshot(s.game)), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(command(s), false, `${variant}: follow-up refused`); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
    }
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('decline', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken investor offer rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('refresh', 'save-false'), /full live rollback/);
  const wrong = await fixture('decline'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const other = snapshot(wrong.game); other.investorOffers.find(o => o.id !== wrong.offerID).status = 'declined';
  assert.throws(() => success(before, other, wrong), /other offers untouched/);
  const rng = await fixture('refresh'), start = snapshot(rng.game); assert.equal(command(rng), true);
  const frozen = snapshot(rng.game); frozen.simulationRng = start.simulationRng;
  assert.throws(() => success(start, frozen, rng), /drawn from the simulation RNG/);
  console.log('investor offer auxiliary save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
