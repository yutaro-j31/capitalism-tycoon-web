'use strict';
// P3-4 W-SUB-IPO: the installed prepared subsidiary IPO (executePreparedSubsidiaryIPO -> preparation wrapper ->
// engine ipoSubsidiary) in real iPhone WebKit with native IndexedDB. Save faults roll back live/mirror/cache/durable
// state, a recovery save exceeds the failed allocation, the retried listing equals the uninterrupted one, a fresh
// durable-only context hydrates the exact state, and a second listing is refused. Node counterpart:
// tests/subsidiary-ipo-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture } = require('./fixtures/subsidiary-ipo-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/subsidiary-ipo-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const VARIANTS = ['balanced', 'growth'];

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
async function exercise({ state, kind, pending, nested, soft, subsidiaryID, termID, mutation = null }) {
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
  check(held && !held.publicCompany && held.ipoPreparation?.offerTermID === termID && e.subsidiaryIPOPreparationSnapshot(subsidiaryID).ready,
    'pinned prepared subsidiary changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed engine sale of the pinned subsidiary must post inside the listing transaction.
  const event = m.finance.event;
  let reached = 0;
  m.finance.event = function (state, type, amount, meta, ...rest) {
    if (meta?.sourceType === 'ipoSubsidiary' && String(meta.sourceID) === subsidiaryID && e.inTransaction()) reached++;
    return event.call(this, state, type, amount, meta, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('subsidiary IPO save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectSubsidiaryIPOFault(e, m, localStorage, key, kind);
  let result, error;
  try { result = nested ? e.runTransaction(() => e.executePreparedSubsidiaryIPO(subsidiaryID)) : e.executePreparedSubsidiaryIPO(subsidiaryID); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.event = event; }
  check(reached > 0, 'actual installed IPO sale was not reached');
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
  const ipoRows = s => s.finance.transactions.filter(row => row.sourceType === 'ipoSubsidiary');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Port of success() in tests/subsidiary-ipo-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const SOLD = .15, SHARES = 1000000, ceilYen = m.economicOperation.ceilYen;
    const was = baseline.subsidiaries.find(row => row.id === subsidiaryID), now = after.subsidiaries.find(row => row.id === subsidiaryID);
    check(was.publicCompany === false && now.publicCompany === true, 'listed');
    check(/^V\d{3}$/.test(now.ticker) && now.sharesOut === SHARES && now.stockPrice === was.valuation / SHARES, 'ticker and shares at the pre-money price');
    const preBook = Number(was.carryingBookValue || was.investedCost || 0), soldBook = Math.round(preBook * SOLD / was.ownership);
    const proceeds = ceilYen(was.valuation * SOLD);
    check(Math.abs(now.ownership - (was.ownership - SOLD)) < 1e-12, 'parent stake falls by the sold block');
    check(now.carryingBookValue === preBook - soldBook, 'sold book leaves the parent');
    check(after.companyCash === baseline.companyCash + proceeds, 'company receives the whole-yen secondary proceeds');
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    const terms = m.subsidiaryIPOPreparation.offerPreview(was, was.ipoPreparation.offerTermID);
    check(now.subsidiaryCash === Math.max(0, Number(was.subsidiaryCash) || 0) + terms.primaryProceeds, 'primary proceeds stay in the subsidiary');
    check(now.valuation === was.valuation + terms.primaryProceeds, 'post-money valuation');
    check(same(now.ipoOfferTerms, { termID: terms.id, label: terms.label, preMoney: was.valuation, primaryProceeds: terms.primaryProceeds,
      discount: terms.discount, primaryRatio: terms.primaryRatio, lockupWeeks: terms.lockupWeeks, lockupUntilWeek: after.week + terms.lockupWeeks,
      volatility: terms.volatility, listingPriceIndex: 100 }), 'recorded offer terms');
    check(now.ipoPreparation.completed === true && now.ipoPreparation.listedWeek === after.week, 'preparation listed');
    check(now.marketLastWeek === after.week && now.marketPriceIndex === 100 && now.marketListingValuation === now.valuation, 'market started');
    const history = after.subsidiaryIPOPreparationHistory[0];
    check(history.type === 'listed' && history.subsidiaryID === subsidiaryID && history.ticker === now.ticker &&
      history.termID === terms.id && history.primaryProceeds === terms.primaryProceeds, 'listed history row');
    const rows = ipoRows(after);
    check(rows.length === ipoRows(baseline).length + 1, 'exactly one IPO sale receipt');
    const row = rows.at(-1);
    check(row.category === 'investmentSale' && row.sourceID === subsidiaryID && row.week === after.week, 'receipt identity');
    check(row.amount === proceeds && row.cashEffect === proceeds, 'the sale receipt is the cash received');
    check(row.assetEffect === -soldBook && row.profitEffect === proceeds - soldBook, 'book and gain');
    check(['amount', 'cashEffect', 'assetEffect', 'profitEffect'].every(field => Number.isSafeInteger(row[field])), 'whole-yen receipt');
    check(after.news.some(line => line.includes('を上場させ')), 'listing is reported');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed IPO durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful IPO rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'cash') after.companyCash += 1;
    if (mutation === 'primary') after.subsidiaries.find(row => row.id === subsidiaryID).subsidiaryCash -= 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__subsidiaryIPOEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID } = globalThis.__subsidiaryIPOEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (e.executePreparedSubsidiaryIPO(subsidiaryID) !== true || saves.count !== 1) throw Error('retried IPO failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// A listed subsidiary cannot list again: refused with no economic change and no durable write.
async function repeat() {
  const { e, backend, key, normalized, durableBytes, saves, subsidiaryID } = globalThis.__subsidiaryIPOEvidence;
  const stateBefore = JSON.stringify(normalized(e.g)), bytes = backend.readSync(key);
  saves.count = 0;
  if (e.executePreparedSubsidiaryIPO(subsidiaryID) !== false) throw Error('second listing accepted');
  await backend.flush();
  if (JSON.stringify(normalized(e.g)) !== stateBefore || saves.count !== 0) throw Error('second listing changed state or saved');
  if (backend.readSync(key) !== bytes || await durableBytes() !== bytes) throw Error('second listing wrote storage');
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
    const record = ok => fs.writeFileSync(path.join(DIR, 'subsidiary-ipo-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectSubsidiaryIPOFault=' + inject.toString() + ';' });
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
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, subsidiaryID: ids[variant], termID: variant, mutation });
    for (const variant of VARIANTS) {
      // The command commits change -> saved -> change, so every shared kind applies, notify and change included.
      const cases = ['none', ...FAULT_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'growth') for (const kind of ['save-false', 'save-throw'])
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
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals the uninterrupted listing');
            await fresh(context, committed, label + '/retry');
          }
          assert.deepEqual(await p.evaluate(repeat), committed, label + ': a refused second listing changes nothing');
          await fresh(context, committed, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit subsidiary IPO ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen secondary proceeds/],
      ['primary', 'none', /primary proceeds stay in the subsidiary/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('growth', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Subsidiary IPO real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
