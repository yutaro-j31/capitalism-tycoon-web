'use strict';
// P3-4 W-COMMERCIAL-SPINOUT: the installed commercialization decision for a researched new-business project
// (commercializeNewBusiness) in each mode (business launch, subsidiary spin-out, abandonment), on projects researched to
// `ready` with production writers. Every save fault rolls back the whole decision (live state, RNG, mirror, cache and
// durable bytes); recovery and retry sequences are monotonic; the retry equals the uninterrupted decision; a decided
// project cannot be decided again. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/new-business-commercialization-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const rows = state => state.finance.transactions.filter(row => row.sourceType === 'newBusinessCommercialization');
const plain = value => JSON.parse(JSON.stringify(value));

function success(before, after, s) {
  const ceilYen = s.modules.economicOperation.ceilYen, week = after.week;
  const was = before.newBusinessResearch.projects.find(p => p.id === s.projectID), now = after.newBusinessResearch.projects.find(p => p.id === s.projectID);
  // Independent oracle: launch pays 25% and spin-out 15% of the research invested, rounded up to whole yen; abandonment
  // is free. The charge is capitalised in the new business or subsidiary.
  const invested = Math.floor(was.invested), cost = s.mode === 'launch' ? ceilYen(was.invested * .25) : s.mode === 'spinout' ? ceilYen(was.invested * .15) : 0;
  assert.equal(after.companyCash, before.companyCash - cost, 'company pays the whole-yen commercialization cost');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(now.status, s.mode === 'abandon' ? 'abandoned' : 'commercialized');
  assert.equal(now.commercializedWeek, week); assert.equal(now.commercializationMode, s.mode);
  const businesses = state => plain(state.newBusinesses || []), subsidiaries = state => plain(state.maSubsidiaries || []);
  if (s.mode === 'launch') {
    assert.equal(after.newBusinesses.length, (before.newBusinesses || []).length + 1, 'exactly one new business');
    assert.deepEqual(plain(after.newBusinesses[0]), { id: `business-${was.id}`, name: was.name, sector: was.sector, startWeek: week, invested: invested + cost,
      commercializationCarryingValue: cost, weeklyRevenue: Math.floor(was.invested * (.01 + was.outcomeScore * .025)), status: 'operating' }, 'launched business');
    assert.deepEqual(subsidiaries(after), subsidiaries(before), 'no subsidiary');
  } else if (s.mode === 'spinout') {
    assert.equal(after.maSubsidiaries.length, (before.maSubsidiaries || []).length + 1, 'exactly one new subsidiary');
    const book = invested + cost, sub = after.maSubsidiaries[0];
    const expected = { id: `spinout-${was.id}`, name: `${was.name}事業会社`, status: 'active', investmentBookValue: book, commercializationCarryingValue: cost,
      enterpriseValue: Math.floor(book * (1.1 + was.outcomeScore)), valuation: 1_000_000, operatingProfit: 0, sales: 0, weeklyProfit: 0, standaloneWeeklyProfit: 0,
      retainedEarnings: 0, risk: .45, quality: .6, growth: was.outcomeScore };
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(sub[key], value, `spin-out subsidiary ${key}`);
    assert.deepEqual(businesses(after), businesses(before), 'no business');
  } else {
    assert.deepEqual(subsidiaries(after), subsidiaries(before)); assert.deepEqual(businesses(after), businesses(before));
  }
  assert.deepEqual(plain(after.newBusinessCommercializationHistory.at(-1)), { week, projectId: was.id, projectStartWeek: was.startWeek, mode: s.mode,
    cashEffect: cost ? -cost : 0, assetEffect: cost, profitEffect: 0 }, 'commercialization history row');
  const added = rows(after).slice(rows(before).length);
  if (cost > 0) {
    assert.equal(added.length, 1, 'exactly one ledger row');
    const sourceID = `${was.id}-w${Math.floor(was.startWeek)}`, row = added[0];
    assert.equal(row.category, 'assetPurchase'); assert.equal(row.sourceID, sourceID);
    assert.equal(row.operationID, `new-business-commercialization-${s.mode}-${sourceID}`);
    assert.equal(row.amount, cost); assert.equal(row.cashEffect, -cost); assert.equal(row.assetEffect, cost); assert.equal(row.profitEffect, 0);
    for (const field of ['amount', 'cashEffect', 'assetEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  } else assert.equal(added.length, 0, 'abandonment posts nothing');
  const others = state => plain(state.newBusinessResearch.projects.filter(p => p.id !== s.projectID));
  assert.deepEqual(others(after), others(before), 'the other projects are untouched');
  const copy = () => plain(after);
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'new-business commercialization', fixture, command, snapshot, economic, expectSuccess: success });
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic decision');
    // A decided project cannot be decided again, in any mode: refused without any economic change or save.
    for (const mode of ['launch', 'spinout', 'abandon']) {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(s.game.commercializeNewBusiness(s.identity, mode), false, `second ${mode} refused`); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(plain(compact));
    const kept = restored.g.newBusinessResearch.projects.find(p => p.id === s.projectID);
    assert.equal(kept.status, done.newBusinessResearch.projects.find(p => p.id === s.projectID).status);
    assert.deepEqual(plain(restored.g.newBusinesses || []), plain(done.newBusinesses || []), 'businesses survive compaction');
    assert.deepEqual(plain((restored.g.maSubsidiaries || []).map(x => [x.id, x.investmentBookValue, x.commercializationCarryingValue])),
      plain((done.maSubsidiaries || []).map(x => [x.id, x.investmentBookValue, x.commercializationCarryingValue])), 'spin-outs survive compaction');
    assert.equal(restored.g.companyCash, done.companyCash); assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('spinout', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken commercialization rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('spinout', 'save-false'), /full live rollback/);
  const wrong = await fixture('spinout'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen commercialization cost/);
  const book = snapshot(wrong.game); book.maSubsidiaries[0].investmentBookValue -= 1;
  assert.throws(() => success(before, book, wrong), /spin-out subsidiary investmentBookValue/);
  console.log('New-business commercialization save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
