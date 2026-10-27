'use strict';
// P3-4 W-VC-CLOSE / W-WEEK-STARTUPS: the installed canonical week that closes an open startup funding round, diluting
// and re-pricing both holders' stakes. Every applicable save fault rolls back the whole week (live state, RNG, mirror,
// cache and durable bytes), the recovery and retry sequences are monotonic, and the retried week equals the
// uninterrupted same-seed week. Node/fake-IDB only; WebKit is a separate counterpart.
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, TERMS, week } = require('./fixtures/vc-round-close-week-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const roundRows = (state, s) => state.finance.transactions.filter(row => String(row.sourceID).includes(s.round.id));
const closedRows = (state, s) => (state.startupFundingHistory[s.startupID] || []).filter(row => row.eventType === 'closed');

function success(before, after, s) {
  const r = s.round, id = s.startupID, dilution = TERMS.pre / TERMS.post;
  assert.equal(before.week, TERMS.closesWeek - 1); assert.equal(after.week, TERMS.closesWeek);
  const was = before.startups.find(row => row.id === id), now = after.startups.find(row => row.id === id);
  assert.equal(was.activeFundingRound.status, 'open'); assert.equal(now.alive, true);
  // The pinned contributions are the round's paid evidence; closing moves no further money.
  assert.equal(r.contributedCompany, s.paid.company); assert.equal(r.contributedPersonal, s.paid.personal);
  const ownedCompany = r.preRoundOwnedCompany * dilution + r.contributedCompany / TERMS.post;
  const ownedPersonal = r.preRoundOwnedPersonal * dilution + r.contributedPersonal / TERMS.post;
  assert.equal(now.ownedCompany, ownedCompany, 'company stake is diluted and re-priced at the pinned post-money');
  assert.equal(now.ownedPersonal, ownedPersonal, 'founder stake is diluted and re-priced at the pinned post-money');
  assert.equal(now.ddNegotiatedOwnedCompany, Math.min(Math.max(was.ddNegotiatedOwnedCompany * dilution, 0), ownedCompany));
  assert.equal(now.ddNegotiatedOwnedPersonal, Math.min(Math.max(was.ddNegotiatedOwnedPersonal * dilution, 0), ownedPersonal));
  if (s.variant === 'mixed') assert.ok(now.ownedPersonal < was.ownedPersonal, 'a non-participating founder is diluted');
  assert.equal(now.valuation, TERMS.post); assert.equal(now.stage, TERMS.round); assert.equal(now.fundingRound, TERMS.round);
  assert.equal(now.runwayWeeks, Math.max(was.runwayWeeks, 56)); assert.equal(now.lastFundingRoundClosedWeek, TERMS.closesWeek);
  assert.equal(now.activeFundingRound, null);
  for (const field of ['totalInvestedCompany', 'totalInvestedPersonal']) assert.equal(now[field], was[field], 'closing keeps ' + field);
  const closed = closedRows(after, s);
  assert.equal(closed.length, closedRows(before, s).length + 1, 'exactly one close receipt');
  const row = after.startupFundingHistory[id][0];
  assert.equal(row.id, r.id + '-closed'); assert.equal(row.eventType, 'closed'); assert.equal(row.closedWeek, TERMS.closesWeek);
  assert.deepEqual(row.ownershipBefore, { company: r.preRoundOwnedCompany, personal: r.preRoundOwnedPersonal });
  assert.deepEqual(row.ownershipAfter, { company: ownedCompany, personal: ownedPersonal });
  const opened = after.startupFundingHistory[id].find(entry => entry.id === r.id + '-opened');
  assert.equal(opened.status, 'closed'); assert.equal(opened.closedWeek, TERMS.closesWeek);
  assert.deepEqual(roundRows(after, s), roundRows(before, s), 'closing posts no ledger movement');
  assert.ok(after.news.some(line => line.includes(`${TERMS.round}追加資金調達が完了しました`)), 'close is reported');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'startup round close week', fixture, command: week, snapshot, economic, expectSuccess: success });
  for (const variant of ['company', 'mixed']) {
    // The canonical week has no close-specific notify; its terminal event is `week`, not a command `change`.
    for (const kind of FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind))) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), save = s.game.save;
    let committedSaves = 0;
    s.game.save = function (...args) { if (!this.inTransaction()) committedSaves++; return save.apply(this, args); };
    assert.equal(week(s), true); assert.equal(committedSaves, 1);
    const stable = snapshot(s.game); success(before, stable, s);
    // The same seed with the round still open: closing itself moves neither the company's nor the founder's cash.
    const control = await fixture(variant);
    control.game.g.startups.find(row => row.id === control.startupID).activeFundingRound.closesWeek = TERMS.closesWeek + 4;
    assert.equal(control.game.advanceWeek(false), true);
    assert.equal(closedRows(control.game.g, control).length, 0, 'same seed before the closing week: no close');
    assert.equal(stable.companyCash, control.game.g.companyCash, 'the close moves no company cash');
    assert.equal(stable.personalCash, control.game.g.personalCash, 'the close moves no founder cash');
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    // Advancing again cannot close the same round twice or re-dilute the stakes.
    assert.equal(s.game.advanceWeek(false), true); await s.backend.flush();
    assert.equal(closedRows(s.game.g, s).length, 1, 'no second close');
    const after = s.game.g.startups.find(row => row.id === s.startupID), closed = stable.startups.find(row => row.id === s.startupID);
    assert.equal(after.ownedCompany, closed.ownedCompany); assert.equal(after.ownedPersonal, closed.ownedPersonal);
    const compact = s.modules.saveStorage.compactStateForStorage(stable, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.startups.find(row => row.id === s.startupID);
    assert.equal(kept.activeFundingRound, null); assert.equal(kept.ownedCompany, closed.ownedCompany); assert.equal(kept.stage, TERMS.round);
    assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('mixed', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken round-close rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command: week, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('company', 'save-false'), /full live rollback/);
  const wrong = await fixture('mixed'), before = snapshot(wrong.game); assert.equal(week(wrong), true);
  const stake = snapshot(wrong.game); stake.startups.find(row => row.id === wrong.startupID).ownedPersonal = wrong.round.preRoundOwnedPersonal;
  assert.throws(() => success(before, stake, wrong), /founder stake is diluted/);
  const ledger = snapshot(wrong.game); ledger.finance.transactions.push({ ...roundRows(ledger, wrong).at(-1), id: 'extra' });
  assert.throws(() => success(before, ledger, wrong), /closing posts no ledger movement/);
  console.log('Startup funding round close canonical-week save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
