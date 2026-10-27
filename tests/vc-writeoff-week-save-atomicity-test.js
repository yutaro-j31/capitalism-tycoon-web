'use strict';
// P3-4 W-VC-WRITEOFF / W-WEEK-STARTUPS: the installed canonical week that stops a zero-runway startup and writes off
// its holdings. Every applicable save fault rolls back the whole week (live state, RNG, mirror, cache and durable
// bytes), the recovery and retry sequences are monotonic, and the retried week equals the uninterrupted same-seed
// week. Node/fake-IDB only; WebKit is a separate counterpart.
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, week } = require('./fixtures/vc-writeoff-week-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const writeOffs = state => state.finance.transactions.filter(row => row.sourceType === 'startupWriteOff');

function success(before, after, s) {
  const p = s.pin, id = s.startupID;
  assert.equal(after.week, 21); assert.equal(before.week, 20);
  const was = before.startups.find(row => row.id === id), now = after.startups.find(row => row.id === id);
  assert.equal(was.alive, true); assert.equal(now.alive, false, 'the startup stopped');
  for (const field of ['ownedCompany', 'ownedPersonal', 'ddNegotiatedOwnedCompany', 'ddNegotiatedOwnedPersonal', 'totalInvestedCompany', 'totalInvestedPersonal'])
    assert.equal(now[field], 0, 'written-off ' + field);
  assert.equal(now.activeFundingRound, null);
  const rows = writeOffs(after);
  assert.equal(rows.length, writeOffs(before).length + 1, 'exactly one write-off receipt');
  const row = rows.at(-1);
  assert.equal(row.category, 'investmentSale'); assert.equal(row.idempotencyKey, 'startup-writeoff-' + id);
  assert.equal(row.sourceID, id + '-21'); assert.equal(row.week, 21);
  assert.equal(row.amount, 0); assert.equal(row.cashEffect, 0, 'a write-off moves no cash');
  assert.equal(row.assetEffect, -p.companyBook, 'pinned company cost basis leaves the balance sheet');
  assert.equal(row.profitEffect, -p.companyBook, 'pinned loss');
  assert.equal(row.liabilityEffect, 0); assert.equal(row.equityEffect, 0);
  // The founder's own stake is lost without touching the company ledger or the founder's cash.
  assert.equal(writeOffs(after).filter(r => r.amount !== 0 || r.cashEffect !== 0).length, 0);
  assert.ok(after.news.some(line => line.includes('資金枯渇で事業停止')), 'stop is reported');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'startup write-off week', fixture, command: week, snapshot, economic, expectSuccess: success });
  for (const variant of ['company', 'mixed']) {
    // The canonical week has no write-off-specific notify; its terminal event is `week`, not a command `change`.
    for (const kind of FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind))) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), save = s.game.save;
    let committedSaves = 0;
    s.game.save = function (...args) { if (!this.inTransaction()) committedSaves++; return save.apply(this, args); };
    assert.equal(week(s), true); assert.equal(committedSaves, 1);
    const stable = snapshot(s.game); success(before, stable, s);
    // Personal cash is not credited or debited by the write-off week beyond ordinary weekly effects.
    const control = await fixture(variant);
    control.game.g.startups.find(row => row.id === control.startupID).runwayWeeks = 52;
    assert.equal(control.game.advanceWeek(false), true);
    assert.equal(writeOffs(control.game.g).length, 0, 'same seed with runway: no write-off');
    assert.equal(stable.companyCash, control.game.g.companyCash, 'the write-off moves no company cash');
    assert.equal(stable.personalCash, control.game.g.personalCash, 'the write-off moves no founder cash');
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    // Advancing again cannot write the same startup off twice.
    assert.equal(s.game.advanceWeek(false), true); await s.backend.flush();
    assert.equal(writeOffs(s.game.g).length, 1, 'no second write-off');
    const compact = s.modules.saveStorage.compactStateForStorage(stable, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.startups.find(row => row.id === s.startupID);
    assert.equal(kept.alive, false); assert.equal(kept.totalInvestedCompany, 0); assert.equal(kept.ownedCompany, 0);
    assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('mixed', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken write-off rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command: week, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('company', 'save-false'), /full live rollback/);
  const wrong = await fixture('mixed'), before = snapshot(wrong.game); assert.equal(week(wrong), true);
  const corrupted = snapshot(wrong.game); corrupted.finance.transactions.filter(row => row.sourceType === 'startupWriteOff').at(-1).assetEffect += 1;
  assert.throws(() => success(before, corrupted, wrong), /pinned company cost basis/);
  console.log('Startup write-off canonical-week save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
