'use strict';
// P3-4 W-VC-LIST / W-WEEK-STARTUPS: the installed canonical week that lists a held Pre-IPO startup and converts both
// holders' stakes into listed share lots, in real iPhone WebKit with native IndexedDB. Save faults roll back
// live/mirror/cache/durable state, a recovery save exceeds the failed allocation, the retried week equals the
// uninterrupted same-seed week, a fresh durable-only context hydrates the exact state, and the next week cannot list
// again. Node counterpart: tests/vc-listing-week-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, PINS, VALUATION, SHARES } = require('./fixtures/vc-listing-week-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/vc-listing-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
// The canonical week has no listing notify and its terminal event is `week`, not a command `change`.
const SHARED_KINDS = FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind));
// Actual final-close and week-completion boundaries inside the installed week.
const BOUNDARY_KINDS = ['finalize', 'week'];

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
async function exercise({ state, kind, pending, nested, soft, pin, startupID, valuation, shares, mutation = null }) {
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
  const held = prior.startups.find(row => row.id === startupID);
  check(prior.week === 20 && held && held.alive && held.stage === 'Pre-IPO' && held.valuation === valuation && !held.activeFundingRound &&
    held.totalInvestedCompany === pin.companyBook && held.totalInvestedPersonal === pin.personalBook, 'pinned opening inputs changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed listing of the pinned startup must be reached inside the week transaction.
  const list = e.listStartup;
  let reached = 0;
  e.listStartup = function (startup, ...args) {
    const value = list.call(this, startup, ...args);
    if (startup?.id === startupID && startup.ipoStockID && this.inTransaction()) { check(this.g.week === 21, 'unpinned listing week'); reached++; }
    return value;
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('listing save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind === 'finalize') {
    let hits = 0; const rebuild = m.finance.rebuildSnapshotForWeek;
    m.finance.rebuildSnapshotForWeek = function (...args) {
      if (/finalizeWeekBoundary/.test(new Error().stack)) { hits++; throw Error('listing final close threw'); }
      return rebuild.apply(this, args);
    };
    injection = { hits: () => hits, restore() { m.finance.rebuildSnapshotForWeek = rebuild; } };
  } else if (kind === 'week') {
    let hits = 0; const emit = e.emit;
    e.emit = function (type, ...args) { if (type === 'week') { hits++; throw Error('listing week completion threw'); } return emit.call(this, type, ...args); };
    injection = { hits: () => hits, restore() { e.emit = emit; } };
  } else if (kind !== 'none') injection = globalThis.__injectListingFault(e, m, localStorage, key, kind);
  let result, error;
  try { result = nested ? e.runTransaction(() => e.advanceWeek(false)) : e.advanceWeek(false); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; e.listStartup = list; }
  check(reached > 0, 'actual installed listing was not reached');
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
  const listingRows = state => state.finance.transactions.filter(row => ['listStartup', 'listStartupShares'].includes(row.sourceType));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Port of success() in tests/vc-listing-week-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    check(after.week === 21 && baseline.week === 20, 'listing week');
    const was = baseline.startups.find(row => row.id === startupID), now = after.startups.find(row => row.id === startupID);
    check(was.alive === true && was.ipoStockID === undefined && now.alive === false, 'the startup leaves the private book');
    const ticker = now.ipoStockID;
    check(/^V\d{4}$/.test(ticker) && !baseline.market.some(row => row.id === ticker), 'a fresh ticker');
    for (const field of ['ownedCompany', 'ownedPersonal', 'ddNegotiatedOwnedCompany', 'ddNegotiatedOwnedPersonal', 'totalInvestedCompany', 'totalInvestedPersonal'])
      check(now[field] === 0, 'converted ' + field);
    check(after.market.length === baseline.market.length + 1, 'one market row');
    const listed = after.market.find(row => row.id === ticker), price = now.valuation / shares;
    check(listed.name === was.name && listed.issuedShares === shares && listed.marketCap === now.valuation &&
      listed.price === price && listed.previous === price && listed.listingMarket === '東証グロース' &&
      same(listed.priceHistory, [{ week: 21, price }]), 'market row at the listing-week valuation');
    const companyQty = Math.floor(was.ownedCompany * shares), personalQty = Math.floor(was.ownedPersonal * shares);
    check(same(after.companyStocks[ticker], { qty: companyQty, avg: pin.companyBook / companyQty }), 'company lot');
    check(pin.personalBook ? same(after.personalStocks[ticker], { qty: personalQty, avg: pin.personalBook / personalQty }) : after.personalStocks[ticker] === undefined, 'founder lot');
    const rows = listingRows(after);
    check(rows.length === listingRows(baseline).length + 2, 'exactly the transfer pair');
    const [out, into] = rows.slice(-2);
    check(out.sourceType === 'listStartup' && out.category === 'investmentSale' && out.idempotencyKey === 'list-startup-' + startupID &&
      out.assetEffect === -pin.companyBook, 'pinned basis leaves the venture holding');
    check(into.sourceType === 'listStartupShares' && into.category === 'investmentPurchase' && into.idempotencyKey === 'list-startup-shares-' + startupID &&
      into.assetEffect === pin.companyBook, 'pinned basis enters listed shares');
    for (const row of [out, into]) {
      check(row.amount === pin.companyBook && row.sourceID === startupID + '-21' && row.week === 21, 'transfer identity');
      check(row.cashEffect === 0, 'a listing moves no cash'); check(row.profitEffect === 0, 'a listing books no gain');
    }
    check(after.news.some(line => line.includes(was.name + 'がIPOしました')), 'listing is reported');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed listing durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'week'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful week rejected or saved twice');
    const after = plain(e.g);
    const ticker = after.startups.find(row => row.id === startupID).ipoStockID;
    if (mutation === 'lot') after.personalStocks[ticker].qty += 1;
    if (mutation === 'gain') listingRows(after).at(-1).profitEffect = 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__listingEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, listingRows };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves } = globalThis.__listingEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (e.advanceWeek(false) !== true || saves.count !== 1) throw Error('retried week failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// The next week cannot list the same startup again or change its lots.
async function nextWeek(startupID) {
  const { e, backend, key, normalized, durableBytes, listingRows } = globalThis.__listingEvidence;
  const ticker = e.g.startups.find(row => row.id === startupID).ipoStockID, lots = JSON.stringify([e.g.companyStocks[ticker], e.g.personalStocks[ticker]]);
  const name = e.g.market.find(row => row.id === ticker).name;
  if (e.advanceWeek(false) !== true) throw Error('week 22 failed');
  await backend.flush();
  if (e.g.week !== 22 || listingRows(e.g).length !== 2 || e.g.market.filter(row => row.name === name).length !== 1) throw Error('week 22 listed again');
  if (JSON.stringify([e.g.companyStocks[ticker], e.g.personalStocks[ticker]]) !== lots) throw Error('week 22 changed the lots');
  if (await durableBytes() !== backend.readSync(key)) throw Error('week 22 not durable');
  return normalized(e.g);
}

(async () => {
  const states = {}, startupIDs = {}, results = [];
  for (const variant of ['company', 'mixed']) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); startupIDs[variant] = s.startupID;
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'vc-listing-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) { const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' }); return p; }
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
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, pin: PINS[variant], startupID: startupIDs[variant], valuation: VALUATION, shares: SHARES, mutation });
    for (const variant of ['company', 'mixed']) {
      const cases = ['none', ...SHARED_KINDS, ...BOUNDARY_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'mixed') for (const kind of ['save-false', 'save-throw'])
        cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
      let uninterrupted, uninterruptedNext;
      for (const item of cases) {
        const context = await browser.newContext(options), label = variant + '/' + JSON.stringify(item);
        try {
          const p = await open(context);
          await p.addScriptTag({ content: 'globalThis.__injectListingFault=' + inject.toString() + ';' });
          const expected = await p.evaluate(exercise, args(variant, item));
          await fresh(context, expected, label + '/first');
          if (item.kind === 'none') uninterrupted = expected;
          else {
            const committed = await p.evaluate(retry);
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals uninterrupted same-seed week');
            await fresh(context, committed, label + '/retry');
          }
          const next = await p.evaluate(nextWeek, startupIDs[variant]);
          if (item.kind === 'none') uninterruptedNext = next;
          else assert.deepEqual(next, uninterruptedNext, label + ': week 22 after retry equals week 22 after the uninterrupted week');
          await fresh(context, next, label + '/week22');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit startup listing ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['lot', 'none', /founder lot/],
      ['gain', 'none', /a listing books no gain/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await p.addScriptTag({ content: 'globalThis.__injectListingFault=' + inject.toString() + ';' });
        await assert.rejects(p.evaluate(exercise, args('mixed', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Startup listing real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
