'use strict';
// P3-4 W-INTERNAL-VENTURE (spin-off): the installed spin-off of a commercialised internal venture into a wholly owned
// subsidiary (spinOffInternalVenture), on ventures proposed, approved and developed with production writers. Every
// save fault rolls back the whole spin-off (live state, RNG, mirror, cache and durable bytes); recovery and retry
// sequences are monotonic; the retry equals the uninterrupted spin-off; a second spin-off is refused.
// Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/internal-venture-spinoff-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function success(before, after, s) {
  const id = s.subsidiaryID, was = before.internalVentures.find(v => v.id === s.ventureID), now = after.internalVentures.find(v => v.id === s.ventureID);
  // Independent oracle: the venture's book moves to a new wholly owned private subsidiary at the venture's valuation;
  // no cash moves and no ledger row is posted.
  const book = Number(was.carryingBookValue), valuation = Math.max(book, Number(was.valuation));
  assert.ok(book > 0, 'the venture carries a book');
  assert.equal(after.companyCash, before.companyCash, 'a spin-off moves no company cash');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.deepEqual(after.finance.transactions, before.finance.transactions, 'no ledger row');
  assert.equal(now.status, 'spun-off'); assert.equal(now.spunOffSubsidiaryID, id); assert.equal(now.spunOffWeek, after.week);
  assert.equal(now.transferredBookValue, book); assert.equal(now.carryingBookValue, 0, 'the book leaves the venture');
  assert.equal(after.subsidiaries.length, before.subsidiaries.length + 1, 'exactly one new subsidiary');
  const sub = after.subsidiaries.find(row => row.id === id);
  const risk = clamp(Number(was.risk), .03, .45);
  assert.deepEqual(JSON.parse(JSON.stringify(sub)), {
    id, internalVentureID: was.id, name: was.name, domain: was.domain, ownership: 1, valuation, investedCost: book, carryingBookValue: book,
    weeklyProfit: Number.isFinite(Number(was.weeklyProfit)) ? Number(was.weeklyProfit) : valuation * clamp(.015 - risk * .02, .002, .03) / 52,
    growth: clamp(Number(was.marketPotential) / 180 + Number(was.teamQuality) / 500, .08, .75), risk,
    publicCompany: false, status: 'active', retainedEarnings: 0, createdWeek: after.week, source: 'internalVenture', subsidiaryCash: 0,
    parentCapitalInjected: 0, externalCapitalRaised: 0, externalFundingRounds: 0, lastExternalFundingWeek: 0, lastCapitalActionWeek: 0,
    ...pickNormalized(sub)
  }, 'the wholly owned subsidiary carries the venture book');
  assert.deepEqual(JSON.parse(JSON.stringify(after.internalVentureBusinessHistory[0])), { week: after.week, type: 'spunOff', ventureID: was.id,
    ventureName: was.name, subsidiaryID: id, bookValue: book, valuation }, 'spin-off history row');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}
// Fields other installed modules add to every subsidiary on the post-commit normalisation; their values are those
// modules' defaults, not part of the spin-off, so the oracle takes them from the committed row.
const SPINOFF_FIELDS = new Set(['id', 'internalVentureID', 'name', 'domain', 'ownership', 'valuation', 'investedCost', 'carryingBookValue',
  'weeklyProfit', 'growth', 'risk', 'publicCompany', 'status', 'retainedEarnings', 'createdWeek', 'source', 'subsidiaryCash',
  'parentCapitalInjected', 'externalCapitalRaised', 'externalFundingRounds', 'lastExternalFundingWeek', 'lastCapitalActionWeek']);
function pickNormalized(sub) { return Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(sub))).filter(([key]) => !SPINOFF_FIELDS.has(key))); }

(async () => {
  const harness = makeTransactionFaultCase({ name: 'internal venture spin-off', fixture, command, snapshot, economic, expectSuccess: success });
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic spin-off');
    // A spun-off venture cannot be spun off again: refused without any economic change or save.
    {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(command(s), false, 'second spin-off refused'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), doneSub = done.subsidiaries.find(row => row.id === s.subsidiaryID);
    for (const field of ['ownership', 'carryingBookValue', 'publicCompany']) assert.equal(kept[field], doneSub[field], field);
    // The venture's valuation is fractional; group restructuring's load normalisation stores subsidiary valuations in
    // whole yen, so a reload keeps the rounded valuation.
    assert.equal(kept.valuation, Math.round(doneSub.valuation), 'valuation');
    assert.equal(restored.g.internalVentures.find(v => v.id === s.ventureID).status, 'spun-off'); assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('second', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken spin-off rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('first', 'save-false'), /full live rollback/);
  const wrong = await fixture('second'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /moves no company cash/);
  const book = snapshot(wrong.game); book.internalVentures.find(v => v.id === wrong.ventureID).carryingBookValue = 1;
  assert.throws(() => success(before, book, wrong), /book leaves the venture/);
  console.log('Internal venture spin-off save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
