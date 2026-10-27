'use strict';
// P3-4 W-VC-LIST / W-WEEK-STARTUPS: the installed canonical week that lists a held Pre-IPO startup and converts both
// holders' stakes into listed share lots. Every applicable save fault rolls back the whole week (live state, RNG,
// mirror, cache and durable bytes), the recovery and retry sequences are monotonic, and the retried week equals the
// uninterrupted same-seed week. Node/fake-IDB only; WebKit is a separate counterpart.
const assert = require('node:assert/strict');
const { fixture, snapshot, economic, SHARES, week } = require('./fixtures/vc-listing-week-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
// Engine objects come from the game's VM realm; compare their JSON copies.
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const listingRows = state => state.finance.transactions.filter(row => ['listStartup', 'listStartupShares'].includes(row.sourceType));

function success(before, after, s) {
  const p = s.pin, id = s.startupID;
  assert.equal(after.week, 21); assert.equal(before.week, 20);
  const was = before.startups.find(row => row.id === id), now = after.startups.find(row => row.id === id);
  assert.equal(was.alive, true); assert.equal(was.ipoStockID, undefined);
  assert.equal(now.alive, false, 'the startup leaves the private book');
  const ticker = now.ipoStockID;
  assert.match(ticker, /^V\d{4}$/); assert.equal(before.market.some(row => row.id === ticker), false, 'a fresh ticker');
  for (const field of ['ownedCompany', 'ownedPersonal', 'ddNegotiatedOwnedCompany', 'ddNegotiatedOwnedPersonal', 'totalInvestedCompany', 'totalInvestedPersonal'])
    assert.equal(now[field], 0, 'converted ' + field);
  // One market row at the listing-week valuation.
  assert.equal(after.market.length, before.market.length + 1);
  const listed = after.market.find(row => row.id === ticker), price = now.valuation / SHARES;
  assert.equal(listed.name, was.name); assert.equal(listed.issuedShares, SHARES); assert.equal(listed.marketCap, now.valuation);
  assert.equal(listed.price, price); assert.equal(listed.previous, price); assert.equal(listed.listingMarket, '東証グロース');
  assert.deepEqual(listed.priceHistory, [{ week: 21, price }]);
  // Each holder's stake becomes a lot of floor(stake * shares) at its own cost basis.
  const companyQty = Math.floor(was.ownedCompany * SHARES), personalQty = Math.floor(was.ownedPersonal * SHARES);
  assert.deepEqual(after.companyStocks[ticker], { qty: companyQty, avg: p.companyBook / companyQty }, 'company lot');
  if (p.personalBook) assert.deepEqual(after.personalStocks[ticker], { qty: personalQty, avg: p.personalBook / personalQty }, 'founder lot');
  else assert.equal(after.personalStocks[ticker], undefined, 'no founder lot');
  // The company's basis moves from the venture holding to listed shares: two cashless, profitless rows.
  const rows = listingRows(after);
  assert.equal(rows.length, listingRows(before).length + 2, 'exactly the transfer pair');
  const [out, into] = rows.slice(-2);
  assert.equal(out.sourceType, 'listStartup'); assert.equal(out.category, 'investmentSale');
  assert.equal(out.idempotencyKey, 'list-startup-' + id); assert.equal(out.assetEffect, -p.companyBook, 'pinned basis leaves the venture holding');
  assert.equal(into.sourceType, 'listStartupShares'); assert.equal(into.category, 'investmentPurchase');
  assert.equal(into.idempotencyKey, 'list-startup-shares-' + id); assert.equal(into.assetEffect, p.companyBook, 'pinned basis enters listed shares');
  for (const row of [out, into]) {
    assert.equal(row.amount, p.companyBook); assert.equal(row.sourceID, id + '-21'); assert.equal(row.week, 21);
    assert.equal(row.cashEffect, 0, 'a listing moves no cash'); assert.equal(row.profitEffect, 0, 'a listing books no gain');
  }
  assert.ok(after.news.some(line => line.includes(`${was.name}がIPOしました`)), 'listing is reported');
  const copy = () => JSON.parse(JSON.stringify(after));
  assert.equal(s.modules.finance.validate(copy()).ok, true);
  assert.equal(s.modules.finance.standaloneClose(copy()).ok, true);
}

(async () => {
  const harness = makeTransactionFaultCase({ name: 'startup listing week', fixture, command: week, snapshot, economic, expectSuccess: success });
  for (const variant of ['company', 'mixed']) {
    // The canonical week has no listing-specific notify; its terminal event is `week`, not a command `change`.
    for (const kind of FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind))) await harness.rejected(variant, kind);
    const s = await fixture(variant), before = snapshot(s.game), save = s.game.save;
    let committedSaves = 0;
    s.game.save = function (...args) { if (!this.inTransaction()) committedSaves++; return save.apply(this, args); };
    assert.equal(week(s), true); assert.equal(committedSaves, 1);
    const stable = snapshot(s.game); success(before, stable, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    // Advancing again cannot list the same startup twice.
    const ticker = stable.startups.find(row => row.id === s.startupID).ipoStockID;
    assert.equal(s.game.advanceWeek(false), true); await s.backend.flush();
    assert.equal(listingRows(s.game.g).length, 2, 'no second listing');
    assert.equal(s.game.g.market.filter(row => row.name === stable.market.find(m => m.id === ticker).name).length, 1, 'one market row');
    assert.deepEqual(plain(s.game.g.companyStocks[ticker]), stable.companyStocks[ticker], 'company lot kept');
    const compact = s.modules.saveStorage.compactStateForStorage(stable, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(compact)));
    assert.equal(restored.g.startups.find(row => row.id === s.startupID).alive, false);
    assert.deepEqual(plain(restored.g.companyStocks[ticker]), stable.companyStocks[ticker]);
    assert.deepEqual(plain(restored.g.personalStocks[ticker]), stable.personalStocks[ticker]);
    assert.ok(restored.g.market.some(row => row.id === ticker));
    assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('mixed', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken listing rollback', fixture: async variant => {
    const s = await fixture(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command: week, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('company', 'save-false'), /full live rollback/);
  const wrong = await fixture('mixed'), before = snapshot(wrong.game); assert.equal(week(wrong), true);
  const ticker = wrong.game.g.startups.find(row => row.id === wrong.startupID).ipoStockID;
  const lot = snapshot(wrong.game); lot.personalStocks[ticker].qty += 1;
  assert.throws(() => success(before, lot, wrong), /founder lot/);
  const gain = snapshot(wrong.game); listingRows(gain).at(-1).profitEffect = 1;
  assert.throws(() => success(before, gain, wrong), /a listing books no gain/);
  console.log('Startup listing canonical-week save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
