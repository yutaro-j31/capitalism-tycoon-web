'use strict';
// P3-4 W-SUB-MARKET: the installed market sale and repurchase of a listed subsidiary's shares by the parent
// (sellListedSubsidiaryStake / buyListedSubsidiaryStake) at each installed trade size, on a subsidiary listed through
// production writers. Every save fault rolls back the whole trade (live state, RNG, mirror, cache and durable bytes);
// recovery and retry sequences are monotonic; the retry equals the uninterrupted trade; a sale inside the lock-up and
// an unfunded repurchase are refused. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/subsidiary-market-trade-atomicity');
const ipo = require('./fixtures/subsidiary-ipo-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const SELL_DISCOUNT = .02, BUY_PREMIUM = .03;
const rows = (state, sourceType) => state.finance.transactions.filter(row => row.sourceType === sourceType);

function success(before, after, s) {
  const id = s.subsidiaryID, ratio = s.ratio, sell = s.side === 'sell', ceilYen = s.modules.economicOperation.ceilYen;
  const was = before.subsidiaries.find(row => row.id === id), now = after.subsidiaries.find(row => row.id === id);
  // Independent oracle: the block at the listed valuation, less a 2% market discount on a sale or plus a 3% premium on
  // a repurchase, rounded up to whole yen; a sale removes the book pro rata, a repurchase capitalises the price.
  const price = ceilYen(Math.round(was.valuation * ratio) * (sell ? 1 - SELL_DISCOUNT : 1 + BUY_PREMIUM));
  const book = Number(was.carryingBookValue) || 0, bookSold = sell ? Math.round(book * ratio / was.ownership) : 0, gain = price - bookSold;
  assert.equal(after.companyCash, before.companyCash + (sell ? price : -price), 'company cash moves by the whole-yen trade price');
  assert.equal(after.personalCash, before.personalCash, 'founder cash is untouched');
  assert.equal(now.ownership, sell ? was.ownership - ratio : was.ownership + ratio, 'parent stake moves by the traded block');
  assert.equal(now.carryingBookValue, sell ? book - bookSold : book + price, sell ? 'sold book leaves the parent pro rata' : 'the repurchase is added to the parent book');
  assert.equal(now.publicCompany, true); assert.equal(now.valuation, was.valuation, 'the subsidiary itself is unchanged');
  assert.equal(now.subsidiaryCash, was.subsidiaryCash);
  const counter = sell ? 'marketStakeSold' : 'marketStakeRepurchased';
  assert.equal(now[counter], (Number(was[counter]) || 0) + ratio, counter);
  const expected = sell ? { week: after.week, type: 'stakeSold', subsidiaryID: id, subsidiaryName: was.name, ratio, price, bookSold, gain, ownershipAfter: now.ownership }
    : { week: after.week, type: 'stakeBought', subsidiaryID: id, subsidiaryName: was.name, ratio, price, ownershipAfter: now.ownership };
  assert.deepEqual(JSON.parse(JSON.stringify(after.listedSubsidiaryMarketHistory[0])), expected, 'market history row');
  const sourceType = sell ? 'sellListedSubsidiaryStake' : 'buyListedSubsidiaryStake', key = `${id}-${after.week}-${ratio}`;
  const tradeRows = rows(after, sourceType);
  assert.equal(tradeRows.length, rows(before, sourceType).length + 1, 'exactly one trade row');
  const row = tradeRows.at(-1);
  assert.equal(row.category, sell ? 'assetSale' : 'assetPurchase'); assert.equal(row.sourceID, key); assert.equal(row.operationID, `${sourceType}-${key}`);
  assert.equal(row.amount, price); assert.equal(row.cashEffect, sell ? price : -price, 'the row is the cash moved');
  assert.equal(row.assetEffect, sell ? -bookSold : price); assert.equal(row.profitEffect || 0, sell ? gain : 0);
  for (const field of ['amount', 'cashEffect', 'assetEffect']) assert.ok(Number.isSafeInteger(row[field]), `${field} is whole yen`);
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

async function refused(s, call, message) {
  const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), save = s.game.save;
  let saves = 0;
  s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
  assert.equal(call(), false, message); s.game.save = save;
  assert.deepEqual(economic(snapshot(s.game)), state, message + ': nothing changes'); assert.equal(saves, 0);
  await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes, message + ': durable bytes unchanged');
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'listed subsidiary market trade', fixture, command, snapshot, economic, expectSuccess: success });
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
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic trade');
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    const kept = restored.g.subsidiaries.find(row => row.id === s.subsidiaryID), doneSub = done.subsidiaries.find(row => row.id === s.subsidiaryID);
    // Ownership is a ratio (not money): a normalising reload may store 0.45 for 0.55 − 0.1 = 0.45000000000000007.
    assert.ok(Math.abs(kept.ownership - doneSub.ownership) < 1e-12, 'ownership');
    for (const field of ['carryingBookValue', 'marketStakeSold', 'marketStakeRepurchased']) assert.equal(kept[field], doneSub[field], field);
    assert.equal(restored.g.saveVersion, 9);
  }
  // Inside the IPO lock-up the parent cannot sell; without enough company cash it cannot repurchase.
  {
    const s = await ipo.fixture('balanced'); assert.equal(ipo.command(s), true); await s.backend.flush();
    await refused(s, () => s.game.sellListedSubsidiaryStake(s.subsidiaryID, .05), 'sale inside the lock-up refused');
  }
  {
    const s = await fixture('buy10'); s.game.g.companyCash = 1; assert.equal(s.game.save(), true); await s.backend.flush();
    await refused(s, () => command(s), 'unfunded repurchase refused');
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }]) {
    await harness.rejected('sell10', kind, options); await harness.rejected('buy10', kind, options);
  }
  const broken = makeTransactionFaultCase({ name: 'broken market-trade rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('sell5', 'save-false'), /full live rollback/);
  const wrong = await fixture('sell10'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.companyCash += 1;
  assert.throws(() => success(before, cash, wrong), /whole-yen trade price/);
  const book = snapshot(wrong.game); book.subsidiaries.find(row => row.id === wrong.subsidiaryID).carryingBookValue += 1;
  assert.throws(() => success(before, book, wrong), /sold book leaves the parent/);
  console.log('Listed subsidiary market trade save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
