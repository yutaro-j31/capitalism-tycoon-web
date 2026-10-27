'use strict';
// P3-4 W-GROUP-DISPOSAL (merge): the installed group-restructuring merge of two wholly owned private subsidiaries
// (executeGroupRestructuringMerge), on subsidiaries spun out of internal ventures with production writers. Every save
// fault rolls back the whole merge (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are
// monotonic; the retry equals the uninterrupted merge; the merged pair cannot be merged again; either argument order
// gives the same merge. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/group-restructuring-merge-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
// The merge posts no notice (no `notify`), so that shared fault kind does not apply; its terminal event is `change`.
const KINDS = FAULT_KINDS.filter(kind => kind !== 'notify');
const ratio6 = value => Math.round(Math.max(0, Math.min(1, value)) * 1e6) / 1e6;
const rows = state => state.finance.transactions.filter(row => row.sourceType === 'groupRestructuringMerge');

function success(before, after, s) {
  const ceilYen = s.modules.economicOperation.ceilYen, ids = [...s.pair].sort();
  const [a, b] = ids.map(id => before.subsidiaries.find(row => row.id === id));
  // Independent oracle: no measured pair synergy, so the cost, profit and valuation lifts follow the installed rates
  // for same-business or cross-business merges; the cost is rounded up to whole yen.
  assert.ok(!(before.interSubsidiarySynergyHistory || []).length, 'no measured pair synergy');
  const same = String(a.domain || '') === String(b.domain || '');
  const cost = ceilYen(Math.max(5_000_000, (a.valuation + b.valuation) * (same ? .035 : .05)));
  const profitBase = Math.round(a.weeklyProfit + b.weeklyProfit), valuationBase = Math.round(a.valuation + b.valuation);
  const mergedID = `restructured-${ids.join('-')}`, book = a.carryingBookValue + b.carryingBookValue;
  assert.equal(after.companyCash, before.companyCash - cost, 'company pays the whole-yen integration cost');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.ok(!after.subsidiaries.some(row => ids.includes(row.id)), 'both subsidiaries leave the group list');
  assert.equal(after.subsidiaries.length, before.subsidiaries.length - 1, 'two rows become one');
  const merged = after.subsidiaries.find(row => row.id === mergedID);
  assert.ok(merged, 'merged subsidiary');
  assert.equal(merged.name, `${a.name}・${b.name}`); assert.equal(merged.ownership, 1); assert.equal(merged.publicCompany, false); assert.equal(merged.status, 'active');
  assert.equal(merged.carryingBookValue, book, 'the merged book is the sum of both books'); assert.equal(merged.investedCost, book);
  assert.equal(merged.valuation, valuationBase + Math.round(Math.max(0, valuationBase) * (same ? .06 : .025)), 'post-merge valuation');
  assert.equal(merged.weeklyProfit, profitBase + Math.round(Math.max(0, profitBase) * (same ? .08 : .04)), 'post-merge weekly profit');
  assert.equal(merged.subsidiaryCash, Math.round(a.subsidiaryCash + b.subsidiaryCash));
  assert.equal(merged.growth, ratio6((a.growth + b.growth) / 2)); assert.equal(merged.risk, ratio6(Math.max(a.risk, b.risk) - (same ? .03 : .015)));
  assert.equal(merged.integrationSynergyRounds, (a.integrationSynergyRounds || 0) + (b.integrationSynergyRounds || 0));
  assert.deepEqual(merged.restructuredFrom, ids); assert.equal(merged.restructuredWeek, after.week);
  assert.deepEqual(JSON.parse(JSON.stringify(after.groupRestructuringHistory[0])), { week: after.week, type: 'merge', aID: ids[0], bID: ids[1], mergedID,
    integrationCost: cost, bookValue: book }, 'restructuring history row');
  const mergeRows = rows(after);
  assert.equal(mergeRows.length, rows(before).length + 1, 'exactly one integration cost');
  const row = mergeRows.at(-1);
  assert.equal(row.sourceID, mergedID); assert.equal(row.operationID, `groupRestructuringMerge-${mergedID}-${after.week}`);
  assert.equal(row.amount, cost); assert.equal(row.cashEffect, -cost, 'the cost is the cash paid');
  assert.equal(row.assetEffect, 0, 'no book is created or lost'); assert.equal(row.profitEffect, -cost, 'the cost is expensed');
  for (const field of ['amount', 'cashEffect', 'profitEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'group restructuring merge', fixture, command, snapshot, economic, expectSuccess: success });
  const committed = {};
  for (const variant of Object.keys(VARIANTS)) {
    for (const kind of KINDS) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), events = [], emit = s.game.emit, save = s.game.save;
    let saves = 0;
    s.game.emit = function (type = 'change', ...args) { events.push(type); return emit.call(this, type, ...args); };
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(command(s), true); s.game.emit = emit; s.game.save = save;
    assert.deepEqual(events, ['saved', 'change']); assert.equal(saves, 1);
    const done = snapshot(s.game); success(before, done, s); committed[variant] = economic(done);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await fixture(variant); assert.equal(command(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic merge');
    // The merged pair no longer exists: merging it again is refused without any economic change or save.
    {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(command(s), false, 'second merge refused'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const mergedID = `restructured-${[...s.pair].sort().join('-')}`;
    const kept = restored.g.subsidiaries.find(row => row.id === mergedID), doneSub = done.subsidiaries.find(row => row.id === mergedID);
    for (const field of ['ownership', 'carryingBookValue', 'valuation', 'publicCompany', 'status']) assert.equal(kept[field], doneSub[field], field);
    assert.equal(restored.g.saveVersion, 9);
  }
  assert.deepEqual(committed.reverse, committed.forward, 'argument order does not change the merge');
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('forward', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken merge rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('forward', 'save-false'), /full live rollback/);
  const wrong = await fixture('forward'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen integration cost/);
  const book = snapshot(wrong.game); book.subsidiaries.at(-1).carryingBookValue -= 1;
  assert.throws(() => success(before, book, wrong), /sum of both books/);
  console.log('Group restructuring merge save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
