'use strict';
// P3-4: installed dividend declaration command, real WebKit/IndexedDB and durable-only hydration.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, PINS } = require('./fixtures/shareholder-dividend-declaration-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/dividend-declaration-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };

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
async function exercise({ state, kind, pending, nested, soft, settlement, request, mutation = null }) {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const plain = value => JSON.parse(JSON.stringify(value));
  const m = globalThis.__capitalismTycoonModules, e = new m.engine.TycoonEngine(plain(state));
  const backend = m.saveStorageIDB, key = m.engine.SAVE_KEY;
  await backend.hydrate(); check(backend.status().available, 'real IndexedDB unavailable');
  check(e.shareholderReturnCapacity().safeAmount === 94899990, 'pinned preview capacity changed');
  check(e.save() === true, 'baseline save rejected'); await backend.flush();
  // Queue the predecessor in this same task, before any microtask can start it.
  if (pending) check(e.save() === true, 'pending predecessor rejected');
  const before = JSON.stringify(e.g), prior = plain(e.g), bytes = backend.readSync(key);
  const predecessorSequence = backend.sequenceOf(bytes), allocated = [];
  m.saveStorageIDB = { ...backend, nextSequence(...args) { const seq = backend.nextSequence(...args); allocated.push(seq); return seq; } };
  check(prior.sharesOut === 100000 && prior.treasuryBuybackShares === 1000 && prior.companyCash === 99899990 &&
    prior.dividendPerShare === 2.5 && prior.personalStocks.CPTY.qty === 5000, 'pinned opening inputs changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { saves.count++; return save.apply(this, args); };
  const stock = e.stock;
  let reached = 0;
  e.stock = function (id, ...args) {
    if (this.inTransaction() && id === 'CPTY' && this.g.dividendPerShare === request) reached++;
    return stock.call(this, id, ...args);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    const save = e.save; let hits = 0;
    e.save = () => { hits++; throw Error('dividend declaration save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = save; } };
  } else if (kind !== 'none') injection = globalThis.__injectDividendFault(e, m, localStorage, key, kind);
  let result, error;
  try { result = nested ? e.runTransaction(() => e.setDividend(request)) : e.setDividend(request); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; }
  check(reached > 0, 'actual installed declaration was not reached');
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
  function oracle(baseline = prior) {
    const assert = {
      equal: (a, b, message = 'scalar mismatch') => check(a === b, message),
      deepEqual: (a, b, message = 'state mismatch') => check(JSON.stringify(a) === JSON.stringify(b), message)
    };
    function success(before, after, s) {
      const { perShare, plannedTotal } = s.settlement;
      assert.equal(after.dividendPerShare, perShare, 'pinned declared per-share term');
      const own = after.market.find(row => row.id === 'CPTY'), previous = before.market.find(row => row.id === 'CPTY');
      assert.equal(own.dividendPerShare, perShare); assert.equal(own.dividendYield, perShare * 4 / (100.01 * 1.008));
      assert.deepEqual({ ...own, dividendPerShare: 0, dividendYield: 0 }, { ...previous, dividendPerShare: 0, dividendYield: 0 });
      assert.deepEqual(after.market.filter(row => row.id !== 'CPTY'), before.market.filter(row => row.id !== 'CPTY'));
      for (const key of ['week', 'companyCash', 'companyDebt', 'personalCash', 'personalDebt', 'personalStocks', 'companyStocks',
        'sharesOut', 'founderShares', 'treasuryBuybackShares', 'founderOwnershipRatio', 'externalShareholderRatio', 'competitorOwnedRatio', 'stockPrice', 'properties', 'simulationRng'])
        assert.deepEqual(after[key], before[key], key + ': declaration is not payment or share transfer');
      const returns = after.finance.shareholderReturns, prior = before.finance.shareholderReturns;
      assert.equal(returns.lastDeclaredDividend, perShare);
      assert.equal(returns.lastActualDividend, prior.lastActualDividend); assert.equal(returns.lastPaymentWeek, prior.lastPaymentWeek);
      assert.equal(returns.history.length, prior.history.length + 1);
      assert.deepEqual(returns.history.slice(0, -1), prior.history, 'existing buyback and policy history retained');
      assert.equal(returns.history.at(-1).plannedTotal, plannedTotal, 'pinned total excludes 1,000 treasury shares');
      assert.deepEqual(returns.history.at(-1), { week: 12, type: 'declaration', dividendPerShare: perShare, plannedTotal, safeCapacity: 94899990 });
      const book = value => { const copy = JSON.parse(JSON.stringify(value.finance)); delete copy.shareholderReturns; return copy; };
      assert.deepEqual(book(after), book(before), 'no cash posting, ledger row, BS movement or finance-cache drift');
      assert.equal(s.modules.economicReadModel.ownershipReconciliation(after).ok, true);
      assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok, true);
    }
    const after = plain(e.g);
    if (mutation === 'total') after.finance.shareholderReturns.history.at(-1).plannedTotal = 125000;
    success(baseline, after, { settlement, modules: m });
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed declaration durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful declaration rejected or saved twice'); oracle();
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__dividendEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, request, saves, settlement };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, request, saves } = globalThis.__dividendEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (e.setDividend(request) !== true || saves.count !== 1) throw Error('retry failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

async function repeatOrder() {
  const { e, backend, key, normalized, durableBytes, saves, request, oracle } = globalThis.__dividendEvidence;
  const before = JSON.parse(JSON.stringify(e.g));
  saves.count = 0;
  if (e.setDividend(request) !== true || saves.count !== 1) throw Error('valid repeat policy failed or saved twice');
  oracle(before); await backend.flush();
  const stable = JSON.stringify(e.g), bytes = backend.readSync(key);
  saves.count = 0;
  if (e.setDividend(1000) !== false || saves.count !== 0 || JSON.stringify(e.g) !== stable || backend.readSync(key) !== bytes)
    throw Error('unsafe policy accepted, mutated state or saved');
  await backend.flush();
  if (await durableBytes() !== bytes) throw Error('repeat policy not durable or unsafe request persisted');
  return normalized(e.g);
}

(async () => {
  const states = {}, results = [];
  for (const variant of ['declare', 'cancel']) states[variant] = JSON.parse(JSON.stringify((await fixture(variant)).game.g));
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'dividend-declaration-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
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
    for (const variant of ['declare', 'cancel']) {
      const cases = ['none', ...FAULT_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'declare') for (const kind of ['save-false', 'save-throw'])
        cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
      let uninterrupted, uninterruptedRepeat;
      for (const item of cases) {
        const context = await browser.newContext(options), label = variant + '/' + JSON.stringify(item);
        try {
          const p = await open(context);
          await p.addScriptTag({ content: 'globalThis.__injectDividendFault=' + inject.toString() + ';' });
          const expected = await p.evaluate(exercise, { state: states[variant], ...item, soft: SOFT_FAILURES, settlement: PINS[variant], request: PINS[variant].perShare });
          await fresh(context, expected, label + '/first');
          if (item.kind === 'none') uninterrupted = expected;
          else {
            const committed = await p.evaluate(retry);
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals uninterrupted same-seed order');
            await fresh(context, committed, label + '/retry');
          }
          const repeated = await p.evaluate(repeatOrder);
          if (item.kind === 'none') uninterruptedRepeat = repeated;
          else assert.deepEqual(repeated, uninterruptedRepeat, label + ': repeat after retry equals repeat after uninterrupted order');
          await fresh(context, repeated, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit dividend declaration ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    for (const [mutation, kind, pattern] of [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['total', 'none', /pinned total excludes/]
    ]) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await p.addScriptTag({ content: 'globalThis.__injectDividendFault=' + inject.toString() + ';' });
        await assert.rejects(p.evaluate(exercise, { state: states.declare, kind, soft: SOFT_FAILURES, settlement: PINS.declare, request: PINS.declare.perShare, mutation }), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log('Dividend declaration real WebKit evidence PASS: 24 scenarios + 2 rejected mutations');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
