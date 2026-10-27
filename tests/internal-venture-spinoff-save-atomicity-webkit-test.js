'use strict';
// P3-4 W-INTERNAL-VENTURE (spin-off): the installed spin-off of a commercialised internal venture into a wholly owned
// subsidiary (spinOffInternalVenture) in real iPhone WebKit with native IndexedDB. Save faults roll back
// live/mirror/cache/durable state, a recovery save exceeds the failed allocation, the retried spin-off equals the
// uninterrupted one, a fresh durable-only context hydrates the exact state, and a second spin-off is refused. Node
// counterpart: tests/internal-venture-spinoff-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: VENTURES } = require('./fixtures/internal-venture-spinoff-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/internal-venture-spinoff-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const VARIANTS = Object.keys(VENTURES);

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
async function exercise({ state, kind, pending, nested, soft, subsidiaryID, ventureID, mutation = null }) {
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
  const held = prior.internalVentures.find(v => v.id === ventureID);
  check(held && held.status === 'active' && !prior.subsidiaries.some(row => row.id === subsidiaryID), 'pinned venture changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The spin-off posts no ledger row: the actual installed spin-off notice for the pinned venture must be raised inside
  // the transaction.
  const notify = e.notify;
  let reached = 0;
  e.notify = function (message, ...rest) {
    if (String(message).includes(held.name) && this.inTransaction()) reached++;
    return notify.call(this, message, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('spin-off save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectSpinOffFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => e.spinOffInternalVenture(ventureID);
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; e.notify = notify; }
  check(reached > 0, 'actual installed spin-off was not reached');
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
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  // Port of success() in tests/internal-venture-spinoff-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const was = baseline.internalVentures.find(v => v.id === ventureID), now = after.internalVentures.find(v => v.id === ventureID);
    const book = Number(was.carryingBookValue), valuation = Math.max(book, Number(was.valuation)), risk = clamp(Number(was.risk), .03, .45);
    check(book > 0, 'the venture carries a book');
    check(after.companyCash === baseline.companyCash, 'a spin-off moves no company cash');
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(same(after.finance.transactions, baseline.finance.transactions), 'no ledger row');
    check(now.status === 'spun-off' && now.spunOffSubsidiaryID === subsidiaryID && now.spunOffWeek === after.week, 'venture spun off');
    check(now.transferredBookValue === book && now.carryingBookValue === 0, 'the book leaves the venture');
    check(after.subsidiaries.length === baseline.subsidiaries.length + 1, 'exactly one new subsidiary');
    const sub = after.subsidiaries.find(row => row.id === subsidiaryID);
    const expected = { id: subsidiaryID, internalVentureID: was.id, name: was.name, domain: was.domain, ownership: 1, valuation, investedCost: book,
      carryingBookValue: book, weeklyProfit: Number.isFinite(Number(was.weeklyProfit)) ? Number(was.weeklyProfit) : valuation * clamp(.015 - risk * .02, .002, .03) / 52,
      growth: clamp(Number(was.marketPotential) / 180 + Number(was.teamQuality) / 500, .08, .75), risk, publicCompany: false, status: 'active',
      retainedEarnings: 0, createdWeek: after.week, source: 'internalVenture', subsidiaryCash: 0, parentCapitalInjected: 0, externalCapitalRaised: 0,
      externalFundingRounds: 0, lastExternalFundingWeek: 0, lastCapitalActionWeek: 0 };
    check(Object.entries(expected).every(([key, value]) => same(sub?.[key], value)), 'the wholly owned subsidiary carries the venture book');
    check(same(after.internalVentureBusinessHistory[0], { week: after.week, type: 'spunOff', ventureID: was.id, ventureName: was.name,
      subsidiaryID, bookValue: book, valuation }), 'spin-off history row');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed spin-off durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful spin-off rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'cash') after.companyCash += 1;
    if (mutation === 'book') after.internalVentures.find(v => v.id === ventureID).carryingBookValue = 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__spinOffEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, run };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, run } = globalThis.__spinOffEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (run() !== true || saves.count !== 1) throw Error('retried spin-off failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// A spun-off venture cannot be spun off again: refused with no change and no durable write.
async function repeat() {
  const { e, backend, key, normalized, durableBytes, saves, run } = globalThis.__spinOffEvidence;
  const stateBefore = JSON.stringify(normalized(e.g)), bytes = backend.readSync(key);
  saves.count = 0;
  if (run() !== false) throw Error('second spin-off accepted');
  await backend.flush();
  if (JSON.stringify(normalized(e.g)) !== stateBefore || saves.count !== 0) throw Error('refused spin-off changed state or saved');
  if (backend.readSync(key) !== bytes || await durableBytes() !== bytes) throw Error('refused spin-off wrote storage');
  return normalized(e.g);
}

(async () => {
  const states = {}, ids = {}, results = [];
  for (const variant of VARIANTS) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = { subsidiaryID: s.subsidiaryID, ventureID: s.ventureID };
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'internal-venture-spinoff-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectSpinOffFault=' + inject.toString() + ';' });
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
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, ...ids[variant], mutation });
    for (const variant of VARIANTS) {
      // The command commits notify -> saved -> change, so every shared kind applies, notify and change included.
      const cases = ['none', ...FAULT_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'second') for (const kind of ['save-false', 'save-throw'])
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
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals the uninterrupted spin-off');
            await fresh(context, committed, label + '/retry');
          }
          assert.deepEqual(await p.evaluate(repeat), committed, label + ': a second spin-off is refused and changes nothing');
          await fresh(context, committed, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit internal venture spin-off ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /moves no company cash/],
      ['book', 'none', /book leaves the venture/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('second', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Internal venture spin-off real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
