'use strict';
// P3-4 W-PE-TRANSFER: the installed transferPEDealToCompany (behind the pending-initiative guard), moving a personal PE
// deal formed with production writers into the company group at fair value. Every save fault rolls back the whole
// command (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are monotonic; the retry
// equals the uninterrupted command; a deal already owned by the company cannot be transferred again. Node/fake-IDB;
// WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/pe-transfer-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const json = value => JSON.parse(JSON.stringify(value));
const rows = state => state.finance.transactions.filter(row => row.sourceType === 'peTransfer');

function success(before, after, s) {
  const was = before.peDeals.find(d => d.id === s.dealID), now = after.peDeals.find(d => d.id === s.dealID);
  // Independent oracle from the deal's own fair value and cost basis. The fractional fair value settles at
  // ceilYen (whole-yen contract slice R10a), and that one price moves both cash balances and the ledger.
  const price = s.modules.economicOperation.ceilYen(was.currentValuation), subID = `pe-subsidiary-${was.id}`;
  assert.equal(after.companyCash, before.companyCash - price, 'company pays the fair value');
  assert.equal(after.personalCash, before.personalCash + price, 'the founder receives the fair value');
  assert.equal(after.peRealizedPL, before.peRealizedPL + price - was.ownerCostBasis, 'founder realises the gain over cost basis');
  assert.deepEqual(json(now), { ...json(was), ownerAccount: 'company', ownerCostBasis: price, companyAcquisitionCost: price, subsidiaryID: subID },
    'only the ownership fields of the deal change');
  const sub = after.subsidiaries.find(x => x.id === subID);
  assert.ok(sub, 'the deal joins the group as a PE subsidiary');
  assert.deepEqual(json(sub), { id: subID, name: was.targetName, industry: was.industry, domain: was.industry, status: 'active',
    ownership: was.ownershipRatio, valuation: was.currentValuation / was.ownershipRatio, carryingBookValue: price, investedCost: price, acquisitionPrice: price,
    weeklyProfit: 0, growth: 0, risk: 0, retainedEarnings: 0, acquiredWeek: after.week, source: 'pe', peDealID: was.id, valuationManagedBy: 'pe' },
    'subsidiary booked at the fair value');
  assert.deepEqual(json(after.subsidiaries.filter(x => x.id !== subID)), json(before.subsidiaries), 'other subsidiaries untouched');
  assert.deepEqual(json(after.peDeals.filter(d => d.id !== s.dealID)), json(before.peDeals.filter(d => d.id !== s.dealID)), 'other deals untouched');
  const added = rows(after).slice(rows(before).length);
  assert.equal(added.length, 1, 'exactly one ledger row');
  const row = added[0];
  assert.equal(row.category, 'acquisition'); assert.equal(row.operationID, `pe-transfer-${was.id}`); assert.equal(row.idempotencyKey, `pe-transfer-${was.id}`);
  assert.equal(row.sourceID, was.id); assert.equal(row.week, after.week);
  assert.equal(row.amount, price); assert.equal(row.cashEffect, -price); assert.equal(row.assetEffect, price);
  for (const field of ['amount', 'cashEffect', 'assetEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  assert.ok(Number.isSafeInteger(after.companyCash) && Number.isSafeInteger(after.personalCash), 'both cash balances stay whole yen'); assert.equal(row.profitEffect, 0);
  assert.equal(after.finance.transactions.length, before.finance.transactions.length + 1, 'no other ledger rows');
  const copy = () => json(after);
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'PE transfer', fixture, command, snapshot, economic, expectSuccess: success });
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
      assert.equal(command(s), false, 'a company-owned deal cannot be transferred again'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(json(compact));
    const kept = restored.g.peDeals.find(d => d.id === s.dealID), doneDeal = done.peDeals.find(d => d.id === s.dealID);
    for (const field of ['ownerAccount', 'ownerCostBasis', 'companyAcquisitionCost', 'subsidiaryID']) assert.equal(kept[field], doneDeal[field], field);
    assert.ok(restored.g.subsidiaries.some(x => x.id === doneDeal.subsidiaryID), 'subsidiary survives compaction');
    assert.equal(restored.g.companyCash, done.companyCash); assert.equal(restored.g.personalCash, done.personalCash); assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('aged', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken PE transfer rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('fresh', 'save-false'), /full live rollback/);
  const wrong = await fixture('fresh'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.personalCash += 1;
  assert.throws(() => success(before, cash, wrong), /founder receives the fair value/);
  const book = snapshot(wrong.game); book.subsidiaries.find(x => x.peDealID === wrong.dealID).carryingBookValue = 1;
  assert.throws(() => success(before, book, wrong), /booked at the fair value/);
  console.log('PE transfer save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
