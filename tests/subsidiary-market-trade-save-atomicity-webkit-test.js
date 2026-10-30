'use strict';
// P3-4 W-SUB-MARKET: the installed market sale and repurchase of a listed subsidiary's shares by the parent
// (sellListedSubsidiaryStake / buyListedSubsidiaryStake) at each installed trade size, in real iPhone WebKit with native
// IndexedDB. Save faults roll back live/mirror/cache/durable state, a recovery save exceeds the failed allocation, the
// retried trade equals the uninterrupted one, a fresh durable-only context hydrates the exact state, and an unfunded
// repurchase is refused. Node counterpart: tests/subsidiary-market-trade-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: TRADES } = require('./fixtures/subsidiary-market-trade-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/subsidiary-market-trade-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const VARIANTS = Object.keys(TRADES);

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1));
    assert.ok(file.startsWith(ROOT + path.sep));
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(file));
  } catch (error) { res.statusCode = 404; res.end(String(error)); }
});

// All functions below run in the actual page against its installed modules.
async function exercise({ state, kind, pending, nested, soft, subsidiaryID, side, ratio, mutation = null }) {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const plain = value => JSON.parse(JSON.stringify(value));
  const m = globalThis.__capitalismTycoonModules, e = new m.engine.TycoonEngine(plain(state));
  const backend = m.saveStorageIDB, key = m.engine.SAVE_KEY;
  await backend.hydrate(); check(backend.status().available, 'real IndexedDB unavailable');
  check(e.save() === true, 'baseline save rejected'); await backend.flush();
  // Queue the predecessor in this same task, before any microtask can start it.
  if (pending) check(e.save() === true, 'pending predecessor rejected');
  const before = JSON.stringify(e.g), prior = plain(e.g), bytes = backend.readSync(key);
  const predecessorSequence = backend.sequenceOf(bytes), allocated = [];
  m.saveStorageIDB = { ...backend, nextSequence(...args) { const seq = backend.nextSequence(...args); allocated.push(seq); return seq; } };
  const held = prior.subsidiaries.find(row => row.id === subsidiaryID);
  check(held && held.publicCompany && e.g.week >= held.ipoOfferTerms.lockupUntilWeek, 'pinned listed subsidiary changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed trade of the pinned subsidiary must post inside its transaction.
  const sourceType = side === 'sell' ? 'sellListedSubsidiaryStake' : 'buyListedSubsidiaryStake';
  const event = m.finance.event;
  let reached = 0;
  m.finance.event = function (state, type, amount, meta, ...rest) {
    if (meta?.sourceType === sourceType && String(meta.sourceID) === `${subsidiaryID}-${e.g.week}-${ratio}` && e.inTransaction()) reached++;
    return event.call(this, state, type, amount, meta, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('market trade save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectMarketTradeFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => side === 'sell' ? e.sellListedSubsidiaryStake(subsidiaryID, ratio) : e.buyListedSubsidiaryStake(subsidiaryID, ratio);
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.event = event; }
  check(reached > 0, 'actual installed market trade was not reached');
  await backend.flush();

  async function durableBytes() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(backend.DB_NAME, backend.DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(backend.STORE_NAME, 'readonly');
        const get = tx.objectStore(backend.STORE_NAME).get(key);
        tx.oncomplete = () => { db.close(); resolve(get.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }
  function normalized(value) {
    const copy = plain(new m.engine.TycoonEngine(plain(value)).g);
    delete copy.lastSaveDate; delete copy.saveSequence; return copy;
  }
  const rows = s => s.finance.transactions.filter(row => row.sourceType === sourceType);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Port of success() in tests/subsidiary-market-trade-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const ceilYen = m.economicOperation.ceilYen, sell = side === 'sell';
    const was = baseline.subsidiaries.find(row => row.id === subsidiaryID), now = after.subsidiaries.find(row => row.id === subsidiaryID);
    const price = ceilYen(Math.round(was.valuation * ratio) * (sell ? .98 : 1.03));
    const book = Number(was.carryingBookValue) || 0, bookSold = sell ? Math.round(book * ratio / was.ownership) : 0, gain = price - bookSold;
    check(after.companyCash === baseline.companyCash + (sell ? price : -price), 'company cash moves by the whole-yen trade price');
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(now.ownership === (sell ? was.ownership - ratio : was.ownership + ratio), 'parent stake moves by the traded block');
    check(now.carryingBookValue === (sell ? book - bookSold : book + price), sell ? 'sold book leaves the parent pro rata' : 'the repurchase is added to the parent book');
    check(now.publicCompany === true && now.valuation === was.valuation && now.subsidiaryCash === was.subsidiaryCash, 'the subsidiary itself is unchanged');
    const counter = sell ? 'marketStakeSold' : 'marketStakeRepurchased';
    check(now[counter] === (Number(was[counter]) || 0) + ratio, counter);
    const expected = sell ? { week: after.week, type: 'stakeSold', subsidiaryID, subsidiaryName: was.name, ratio, price, bookSold, gain, ownershipAfter: now.ownership }
      : { week: after.week, type: 'stakeBought', subsidiaryID, subsidiaryName: was.name, ratio, price, ownershipAfter: now.ownership };
    check(same(after.listedSubsidiaryMarketHistory[0], expected), 'market history row');
    const tradeRows = rows(after);
    check(tradeRows.length === rows(baseline).length + 1, 'exactly one trade row');
    const row = tradeRows.at(-1), key = `${subsidiaryID}-${after.week}-${ratio}`;
    check(row.category === (sell ? 'assetSale' : 'assetPurchase') && row.sourceID === key && row.operationID === `${sourceType}-${key}`, 'trade row identity');
    check(row.amount === price && row.cashEffect === (sell ? price : -price) && row.assetEffect === (sell ? -bookSold : price) && (row.profitEffect || 0) === (sell ? gain : 0), 'the row is the cash moved');
    check(['amount', 'cashEffect', 'assetEffect'].every(field => Number.isSafeInteger(row[field])), 'whole-yen row');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed trade durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful trade rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'cash') after.companyCash += 1;
    if (mutation === 'book') after.subsidiaries.find(row => row.id === subsidiaryID).carryingBookValue += 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__marketTradeEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, side, ratio, run };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, run } = globalThis.__marketTradeEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (run() !== true || saves.count !== 1) throw Error('retried trade failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// Without enough company cash a repurchase is refused with no change and no durable write. The cash is restored after
// the probe, so the committed state is unchanged.
async function repeat() {
  const { e, backend, key, normalized, durableBytes, saves, subsidiaryID } = globalThis.__marketTradeEvidence;
  const stateBefore = JSON.stringify(normalized(e.g)), bytes = backend.readSync(key), cash = e.g.companyCash;
  saves.count = 0; e.g.companyCash = 1;
  const accepted = e.buyListedSubsidiaryStake(subsidiaryID, .1);
  e.g.companyCash = cash;
  if (accepted !== false) throw Error('unfunded repurchase accepted');
  await backend.flush();
  if (JSON.stringify(normalized(e.g)) !== stateBefore || saves.count !== 0) throw Error('refused repurchase changed state or saved');
  if (backend.readSync(key) !== bytes || await durableBytes() !== bytes) throw Error('refused repurchase wrote storage');
  return normalized(e.g);
}

(async () => {
  const states = {}, ids = {}, results = [];
  for (const variant of VARIANTS) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = s.subsidiaryID;
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'subsidiary-market-trade-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectMarketTradeFault=' + inject.toString() + ';' });
      return p;
    }
    async function fresh(context, expected, label) {
      const stored = await context.storageState({ indexedDB: true });
      for (const origin of stored.origins) origin.localStorage = [];
      const c = await browser.newContext({ ...options, storageState: stored });
      try {
        const p = await open(c);
        const actual = await p.evaluate(async () => {
          const m = globalThis.__capitalismTycoonModules;
          await m.saveStorageIDB.hydrate();
          if (!m.saveStorageIDB.status().available) throw Error('fresh real IDB unavailable');
          const e = m.engine.TycoonEngine.load(); if (!e) throw Error('durable-only load failed');
          const g = JSON.parse(JSON.stringify(e.g)); delete g.lastSaveDate; delete g.saveSequence; return g;
        });
        assert.deepEqual(actual, expected, label + ': complete fresh durable-only state');
        assert.equal(actual.saveVersion, 9);
      } finally { await c.close(); }
    }
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, subsidiaryID: ids[variant], side: TRADES[variant].side, ratio: TRADES[variant].ratio, mutation });
    for (const variant of VARIANTS) {
      // The command commits change -> saved -> change, so every shared kind applies, notify and change included.
      const cases = ['none', ...FAULT_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'sell10' || variant === 'buy10') for (const kind of ['save-false', 'save-throw'])
        cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
      let uninterrupted;
      for (const item of cases) {
        const context = await browser.newContext(options), label = variant + '/' + JSON.stringify(item);
        try {
          const p = await open(context);
          const expected = await p.evaluate(exercise, args(variant, item));
          await fresh(context, expected, label + '/first');
          let committed = expected;
          if (item.kind === 'none') uninterrupted = expected;
          else {
            committed = await p.evaluate(retry);
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals the uninterrupted trade');
            await fresh(context, committed, label + '/retry');
          }
          assert.deepEqual(await p.evaluate(repeat), committed, label + ': an unfunded repurchase is refused and changes nothing');
          await fresh(context, committed, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit listed subsidiary market trade ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen trade price/],
      ['book', 'none', /sold book leaves the parent/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('sell10', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Listed subsidiary market trade real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
