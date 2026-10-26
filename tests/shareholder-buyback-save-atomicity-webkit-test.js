'use strict';
// P3-4: installed shareholder buyback command, real WebKit/IndexedDB and durable-only hydration.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, PINS, REQUEST } = require('./fixtures/shareholder-buyback-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/buyback-webkit');
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
  check(e.shareholderReturnCapacity().safeAmount === 95000000, 'pinned preview capacity changed');
  check(e.save() === true, 'baseline save rejected'); await backend.flush();
  // Queue the predecessor in this same task, before any microtask can start it.
  if (pending) check(e.save() === true, 'pending predecessor rejected');
  const before = JSON.stringify(e.g), prior = plain(e.g), bytes = backend.readSync(key);
  const predecessorSequence = backend.sequenceOf(bytes), allocated = [];
  m.saveStorageIDB = { ...backend, nextSequence(...args) { const seq = backend.nextSequence(...args); allocated.push(seq); return seq; } };
  check(prior.sharesOut === 100000 && prior.stockPrice === 100.01 && prior.personalStocks.CPTY.qty === 5000 && prior.founderShares === settlement.founder, 'pinned opening inputs changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { saves.count++; return save.apply(this, args); };
  const ratios = e.updateOwnershipRatios;
  let reached = 0;
  e.updateOwnershipRatios = function (...args) {
    if (this.inTransaction() && this.g.treasuryBuybackShares === settlement.quantity) reached++;
    return ratios.apply(this, args);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    const save = e.save; let hits = 0;
    e.save = () => { hits++; throw Error('buyback save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = save; } };
  } else if (kind !== 'none') injection = globalThis.__injectBuybackFault(e, m, localStorage, key, kind);
  let result, error;
  try { result = nested ? e.runTransaction(() => e.buybackOwnShares(request)) : e.buybackOwnShares(request); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; }
  check(reached > 0, 'actual installed buyback was not reached');
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
  function oracle() {
    const assert = {
      equal: (a, b, message = 'scalar mismatch') => check(a === b, message),
      deepEqual: (a, b, message = 'state mismatch') => check(JSON.stringify(a) === JSON.stringify(b), message)
    };
    function success(before, after, s) {
      const { quantity, cost, remaining } = s.settlement;
      assert.equal(after.treasuryBuybackShares, before.treasuryBuybackShares + quantity, 'pinned treasury quantity');
      assert.equal(after.companyCash, before.companyCash - cost, 'pinned whole-yen cash outflow');
      assert.equal(after.finance.balances.treasuryStock, before.finance.balances.treasuryStock + cost, 'pinned contra-equity book');
      for (const key of ['week', 'sharesOut', 'founderShares', 'personalCash', 'personalDebt', 'personalStocks', 'companyStocks', 'companyDebt', 'properties', 'simulationRng'])
        assert.deepEqual(after[key], before[key], key + ': issuer/account/asset/RNG separation');
      assert.equal(after.stockPrice, 100.01 * (1 + Math.min(.08, quantity / 100000 * .8)));
      const own = after.market.find(row => row.id === 'CPTY');
      assert.equal(own.price, after.stockPrice); assert.equal(own.issuedShares, 100000);
      assert.equal(own.marketCap, after.stockPrice * 100000);
      assert.deepEqual(own.priceHistory, before.market.find(row => row.id === 'CPTY').priceHistory);
      assert.deepEqual(after.market.filter(row => row.id !== 'CPTY'), before.market.filter(row => row.id !== 'CPTY'));
      assert.equal(after.founderOwnershipRatio, before.founderShares / (100000 - quantity));
      assert.equal(after.competitorOwnedRatio, 0);
      assert.equal(after.externalShareholderRatio, 1 - after.founderOwnershipRatio);
      assert.equal(after.finance.transactions.length, before.finance.transactions.length + 1);
      const txn = after.finance.transactions.at(-1);
      assert.equal(txn.category, 'otherFinancing'); assert.equal(txn.sourceType, 'shareholderReturns');
      assert.equal(txn.sourceID, `buyback-12-${quantity}`);
      assert.equal(txn.idempotencyKey, `shareholder-buyback-12-${quantity}`);
      assert.equal(txn.amount, cost); assert.equal(txn.cashEffect, -cost); assert.equal(txn.equityEffect, -cost);
      for (const key of ['profitEffect', 'assetEffect', 'liabilityEffect']) assert.equal(txn[key], 0);
      const receipt = txn.buybackReconciliation;
      assert.equal(receipt.quantity, quantity); assert.equal(receipt.cost, cost); assert.equal(receipt.executionPrice, 100.01);
      assert.equal(receipt.evidence.costRounding, 'ceilYen');
      for (const [key, value] of Object.entries({ companyCashBefore: 100000000, companyCashAfter: 100000000 - cost,
        treasurySharesBefore: 0, treasurySharesAfter: quantity, issuedSharesBefore: 100000, issuedSharesAfter: 100000,
        founderSharesBefore: before.founderShares, founderSharesAfter: before.founderShares,
        treasuryBookBefore: 0, treasuryBookAfter: cost, outstandingSharesBefore: 100000, outstandingSharesAfter: 100000 - quantity }))
        assert.equal(receipt.evidence[key], value, 'receipt ' + key);
      const history = after.finance.shareholderReturns.history;
      assert.equal(history.length, (before.finance.shareholderReturns?.history.length || 0) + 1);
      assert.deepEqual(history.at(-1), { week: 12, type: 'buyback', amount: cost, shares: quantity, price: 100.01, safeCapacity: 95000000 });
      const reconciliation = s.modules.economicReadModel.ownershipReconciliation(after);
      assert.equal(reconciliation.ok, true);
      assert.equal(reconciliation.securityClasses[0].unallocatedOutstandingQuantity, remaining, 'outside float excludes both founder buckets');
      const copy = () => JSON.parse(JSON.stringify(after));
      assert.equal(s.modules.finance.buybackReconciliationStatus(copy()).ok, true);
      assert.equal(s.modules.finance.validate(copy()).ok, true);
    }
    const after = plain(e.g);
    if (mutation === 'quantity') after.treasuryBuybackShares++;
    success(prior, after, { settlement, modules: m });
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed buyback durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful buyback command rejected or saved twice'); oracle();
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__buybackEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, request, saves, settlement };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, request, saves } = globalThis.__buybackEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (e.buybackOwnShares(request) !== true || saves.count !== 1) throw Error('retry failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

async function repeatOrder() {
  const { e, backend, key, normalized, durableBytes, saves, settlement, request } = globalThis.__buybackEvidence;
  const before = JSON.stringify(e.g), bytes = backend.readSync(key);
  saves.count = 0;
  if (settlement.remaining === 0) {
    if (e.buybackOwnShares(request) !== false || saves.count !== 0 || JSON.stringify(e.g) !== before || backend.readSync(key) !== bytes)
      throw Error('exhausted float accepted or saved another order');
  } else {
    if (e.buybackOwnShares(109) !== true || saves.count !== 1) throw Error('valid second order failed or saved twice');
    const g = e.g, rows = g.finance.transactions.filter(row => row.sourceType === 'shareholderReturns');
    if (g.treasuryBuybackShares !== 10000 || g.companyCash !== 98999891 || g.finance.balances.treasuryStock !== 1000109)
      throw Error('independent second order quantity/cash/book');
    if (rows.length !== 2 || rows[1].amount !== 109 || rows[1].buybackReconciliation.quantity !== 1 || rows[0].idempotencyKey === rows[1].idempotencyKey)
      throw Error('second order receipts not distinct or duplicated');
    if (JSON.stringify(g.personalStocks) !== JSON.stringify(JSON.parse(before).personalStocks)) throw Error('second order touched personal shares');
    const m = globalThis.__capitalismTycoonModules;
    if (!m.finance.validate(JSON.parse(JSON.stringify(g))).ok || !m.economicReadModel.ownershipReconciliation(g).ok) throw Error('second order invalid');
  }
  await backend.flush();
  if (await durableBytes() !== backend.readSync(key)) throw Error('repeat result not durable');
  return normalized(e.g);
}

(async () => {
  const states = {}, results = [];
  for (const variant of ['ordinary', 'capped']) states[variant] = JSON.parse(JSON.stringify((await fixture(variant)).game.g));
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'shareholder-buyback-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
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
    for (const variant of ['ordinary', 'capped']) {
      const cases = ['none', ...FAULT_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'ordinary') for (const kind of ['save-false', 'save-throw'])
        cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
      let uninterrupted, uninterruptedRepeat;
      for (const item of cases) {
        const context = await browser.newContext(options), label = variant + '/' + JSON.stringify(item);
        try {
          const p = await open(context);
          await p.addScriptTag({ content: 'globalThis.__injectBuybackFault=' + inject.toString() + ';' });
          const expected = await p.evaluate(exercise, { state: states[variant], ...item, soft: SOFT_FAILURES, settlement: PINS[variant], request: REQUEST });
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
          console.log('iPhone WebKit buyback ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    for (const [mutation, kind, pattern] of [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['quantity', 'none', /pinned treasury quantity/]
    ]) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await p.addScriptTag({ content: 'globalThis.__injectBuybackFault=' + inject.toString() + ';' });
        await assert.rejects(p.evaluate(exercise, { state: states.capped, kind, soft: SOFT_FAILURES, settlement: PINS.capped, request: REQUEST, mutation }), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log('Buyback real WebKit evidence PASS: 24 scenarios + 2 rejected mutations');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
