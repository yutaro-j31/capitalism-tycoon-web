'use strict';
// P3-4 W-PE-PARENT: the installed acquirePEPortfolioCompany, called directly and through the PE UI adapter, buying a
// PE fund portfolio company closed with production writers into the player's group. Every save fault rolls back the
// whole command (live state, RNG, mirror, cache and durable bytes); recovery and retry sequences are monotonic; the
// retry equals the uninterrupted command; an acquired holding cannot be acquired again. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/pe-parent-acquisition-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const json = value => JSON.parse(JSON.stringify(value));
const CHANGED = ['companyCash', 'personalCash', 'subsidiaries', 'totalAcquisitions', 'news', 'finance', 'peFirm', 'lastSaveDate', 'saveSequence'];
const holding = (state, s) => { const fund = state.peFirm.funds.find(f => f.id === s.fundID); return { fund, deal: fund.deals.find(d => d.id === s.portfolioID) }; };

function success(before, after, s) {
  // The purchase price is the production sale-exit value, read from the read-only preview before the command; the
  // settlement split is then checked for conservation and against the fund, co-investor and founder balances.
  const plan = s.plan, price = plan.purchasePrice, st = plan.settlement;
  assert.ok(Number.isSafeInteger(price) && price > 0, 'whole-yen purchase price');
  assert.equal(st.grossProceeds, price); assert.equal(st.distributedToFund + st.returnedToCoinvestors, price, 'the whole price is settled');
  assert.equal(st.returnedToCoinvestors > 0, s.coinvest, 'co-investors are paid only when they invested');
  const was = holding(before, s), now = holding(after, s);
  assert.equal(after.companyCash, before.companyCash - price, 'company pays the purchase price');
  assert.equal(after.personalCash - before.personalCash, now.fund.gpDistributed - was.fund.gpDistributed, 'GP economics reach personal cash once');
  assert.equal(after.personalCash - before.personalCash, st.gpCarry + st.gpPrincipalAndGain, 'GP carry and principal');
  assert.equal(now.fund.distributed - was.fund.distributed, st.distributedToFund, 'fund receives its share');
  assert.equal((now.fund.gpDistributed - was.fund.gpDistributed) + (now.fund.lpDistributed - was.fund.lpDistributed), st.distributedToFund, 'GP + LP = fund share');
  assert.equal(now.fund.coinvestReturned - was.fund.coinvestReturned, st.returnedToCoinvestors, 'co-investors receive their share');
  assert.equal(after.peFirm.coinvestCapital - before.peFirm.coinvestCapital, st.returnedToCoinvestors, 'co-invest capital returns');
  const subID = `pe-group-sub-${s.portfolioID}-w${after.week}`;
  assert.equal(now.deal.status, 'exited'); assert.equal(now.deal.exitMethod, 'parent-company-acquisition');
  assert.equal(now.deal.exitedWeek, after.week); assert.equal(now.deal.exitProceeds, price); assert.equal(now.deal.convertedToSubsidiaryID, subID);
  assert.deepEqual(json(now.deal.exitSettlement), json(st)); assert.equal(now.deal.exitAttribution.method, 'parent-company-acquisition');
  const added = after.subsidiaries.slice(before.subsidiaries.length);
  assert.equal(added.length, 1, 'exactly one subsidiary'); assert.deepEqual(json(after.subsidiaries.slice(0, before.subsidiaries.length)), json(before.subsidiaries));
  const sub = added[0];
  assert.equal(sub.id, subID); assert.equal(sub.ownership, 1); assert.equal(sub.sourcePEFundID, s.fundID); assert.equal(sub.sourcePEDealID, s.portfolioID);
  for (const field of ['valuation', 'investedCost', 'carryingBookValue', 'acquisitionPrice']) assert.equal(sub[field], price, `subsidiary ${field} at the purchase price`);
  assert.equal(sub.acquiredWeek, after.week); assert.equal(sub.source, 'pe-fund-portfolio');
  assert.equal(after.totalAcquisitions, before.totalAcquisitions + 1);
  assert.equal(after.finance.transactions.length, before.finance.transactions.length + 1, 'exactly one ledger row');
  const row = after.finance.transactions.at(-1);
  assert.equal(row.category, 'acquisition'); assert.equal(row.sourceType, 'acquirePEPortfolioCompany'); assert.equal(row.sourceID, s.portfolioID);
  assert.equal(row.operationID, `pe-parent-acquisition-${s.portfolioID}`); assert.equal(row.idempotencyKey, row.operationID);
  assert.equal(row.amount, price); assert.equal(row.cashEffect, -price); assert.equal(row.assetEffect, price); assert.equal(row.profitEffect, 0);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (!CHANGED.includes(key)) assert.deepEqual(json(after[key]), json(before[key]), `${key} untouched`);
  const copy = () => json(after);
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}
const planned = async variant => { const s = await fixture(variant); s.plan = json(s.game.previewPEParentAcquisition(s.fundID, s.portfolioID)); return s; };

(async () => {
  const harness = makeTransactionFaultCase({ name: 'PE parent acquisition', fixture: planned, command, snapshot, economic, expectSuccess: success });
  for (const variant of Object.keys(VARIANTS)) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    const s = await planned(variant), before = snapshot(s.game), events = [], emit = s.game.emit, save = s.game.save;
    let saves = 0;
    s.game.emit = function (type = 'change', ...args) { events.push(type); return emit.call(this, type, ...args); };
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(command(s), true); s.game.emit = emit; s.game.save = save;
    assert.deepEqual(events, ['notify', 'saved', 'change']); assert.equal(saves, 1);
    const done = snapshot(s.game); success(before, done, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await planned(variant); assert.equal(command(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic command');
    {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(command(s), false, 'an acquired holding cannot be acquired again'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(json(compact)), kept = holding(restored.g, s), doneHolding = holding(done, s);
    for (const field of ['status', 'exitProceeds', 'convertedToSubsidiaryID']) assert.equal(kept.deal[field], doneHolding.deal[field], field);
    for (const field of ['distributed', 'gpDistributed', 'lpDistributed', 'coinvestReturned']) assert.equal(kept.fund[field], doneHolding.fund[field], field);
    assert.ok(restored.g.subsidiaries.some(x => x.id === doneHolding.deal.convertedToSubsidiaryID), 'subsidiary survives compaction');
    assert.equal(restored.g.companyCash, done.companyCash); assert.equal(restored.g.personalCash, done.personalCash); assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('coinvest', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken PE parent acquisition rollback', fixture: async variant => {
    const s = await planned(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('plain', 'save-false'), /full live rollback/);
  const wrong = await planned('coinvest'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.personalCash += 1;
  assert.throws(() => success(before, cash, wrong), /GP economics reach personal cash once/);
  const returned = snapshot(wrong.game); holding(returned, wrong).fund.coinvestReturned -= 1;
  assert.throws(() => success(before, returned, wrong), /co-investors receive their share/);
  console.log('PE parent acquisition save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
