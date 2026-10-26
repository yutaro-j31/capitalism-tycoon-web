'use strict';
// P3-4 W-DIV-PAY: the installed canonical quarterly dividend-payment week (advanceWeek, week 12 -> 13) in real
// iPhone WebKit with native IndexedDB: save faults roll back live/mirror/cache/durable state, a recovery save
// exceeds the failed allocation, the retried week equals the uninterrupted same-seed week, a fresh durable-only
// context hydrates the exact state, and week 14 cannot pay again. Node counterpart:
// tests/shareholder-dividend-payment-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, PINS, PER_SHARE } = require('./fixtures/shareholder-dividend-payment-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/dividend-payment-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
// The canonical week has no payment-specific notify and its terminal event is `week`, not a command `change`.
const SHARED_KINDS = FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind));
// Actual payment-receipt, final-close and week-completion boundaries inside the installed week.
const BOUNDARY_KINDS = ['receipt', 'finalize', 'week'];

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
async function exercise({ state, kind, pending, nested, soft, pin, perShare, variant, mutation = null }) {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const plain = value => JSON.parse(JSON.stringify(value));
  const m = globalThis.__capitalismTycoonModules, e = new m.engine.TycoonEngine(plain(state));
  const backend = m.saveStorageIDB, key = m.engine.SAVE_KEY;
  await backend.hydrate(); check(backend.status().available, 'real IndexedDB unavailable');
  check(e.shareholderReturnCapacity().safeAmount === pin.capacity, 'pinned payment capacity changed');
  check(e.save() === true, 'baseline save rejected'); await backend.flush();
  // Queue the predecessor in this same task, before any microtask can start it.
  if (pending) check(e.save() === true, 'pending predecessor rejected');
  const before = JSON.stringify(e.g), prior = plain(e.g), bytes = backend.readSync(key);
  const predecessorSequence = backend.sequenceOf(bytes), allocated = [];
  m.saveStorageIDB = { ...backend, nextSequence(...args) { const seq = backend.nextSequence(...args); allocated.push(seq); return seq; } };
  check(prior.week === 12 && prior.sharesOut === 100000 && prior.treasuryBuybackShares === 1000 && prior.founderShares === 60000 &&
    prior.companyCash === pin.cash && prior.personalCash === 10000000 && prior.dividendPerShare === perShare, 'pinned opening inputs changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed payment must be reached inside the week transaction with the pinned legs.
  const observe = m.finance.observeDividendDistribution;
  let reached = 0;
  m.finance.observeDividendDistribution = function (s, distribution) {
    if (s === e.g && e.inTransaction()) {
      check(s.week === 13 && distribution.gross === pin.gross && distribution.personalCashAfter - distribution.personalCashBefore === pin.net, 'unpinned payment');
      reached++;
    }
    return observe.apply(this, arguments);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('dividend payment save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind === 'receipt') {
    let hits = 0; const record = m.finance.recordWeekly;
    m.finance.recordWeekly = function (s, ...args) {
      const result = record.call(this, s, ...args);
      if (s === e.g && s.week === 13) {
        check(s.finance.transactions.filter(row => row.category === 'dividend').length === 1, 'receipt not written before fault');
        hits++; throw Error('dividend receipt threw');
      }
      return result;
    };
    injection = { hits: () => hits, restore() { m.finance.recordWeekly = record; } };
  } else if (kind === 'finalize') {
    let hits = 0; const rebuild = m.finance.rebuildSnapshotForWeek;
    m.finance.rebuildSnapshotForWeek = function (...args) {
      if (/finalizeWeekBoundary/.test(new Error().stack)) { hits++; throw Error('dividend final close threw'); }
      return rebuild.apply(this, args);
    };
    injection = { hits: () => hits, restore() { m.finance.rebuildSnapshotForWeek = rebuild; } };
  } else if (kind === 'week') {
    let hits = 0; const emit = e.emit;
    e.emit = function (type, ...args) { if (type === 'week') { hits++; throw Error('dividend week completion threw'); } return emit.call(this, type, ...args); };
    injection = { hits: () => hits, restore() { e.emit = emit; } };
  } else if (kind !== 'none') injection = globalThis.__injectDividendPaymentFault(e, m, localStorage, key, kind);
  let result, error;
  try { result = nested ? e.runTransaction(() => e.advanceWeek(false)) : e.advanceWeek(false); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.observeDividendDistribution = observe; }
  check(reached > 0, 'actual installed payment was not reached');
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
  const receipts = s => s.finance.transactions.filter(row => row.category === 'dividend');
  function oracle(baseline = prior, after = plain(e.g)) {
    const equal = (a, b, message) => check(JSON.stringify(a) === JSON.stringify(b), message);
    check(after.week === 13 && baseline.week === 12, 'payment week');
    check(after.personalCash === baseline.personalCash + pin.net, 'pinned founder net cash');
    for (const field of ['sharesOut', 'founderShares', 'treasuryBuybackShares', 'personalStocks', 'companyStocks'])
      equal(after[field], baseline[field], 'payment cannot transfer ' + field);
    check(after.dividendPerShare === perShare, 'declared policy restored after temporary cap');
    check(after.market.find(row => row.id === 'CPTY').dividendPerShare === perShare, 'market policy restored');
    const rows = receipts(after);
    check(rows.length === receipts(baseline).length + 1, 'exactly one receipt');
    const row = rows.at(-1), d = row.dividendDistribution;
    check(row.week === 13 && row.sourceType === 'weekly-dividend' && row.idempotencyKey === 'week-13-dividend', 'receipt identity');
    check(row.amount === pin.gross && row.cashEffect === -pin.gross, 'pinned gross paid');
    for (const field of ['profitEffect', 'assetEffect', 'liabilityEffect', 'equityEffect']) check(row[field] === 0, 'receipt ' + field);
    for (const [field, value] of Object.entries({ gross: pin.gross, payerReduction: pin.gross, personalNet: pin.net,
      withholding: pin.withholding, externalGross: pin.external, roundingResidual: 0, founderRatio: 60000 / 99000 }))
      check(d[field] === value, 'independent distribution leg ' + field);
    const returns = after.finance.shareholderReturns, previous = baseline.finance.shareholderReturns;
    check(returns.lastActualDividend === pin.gross && returns.lastPaymentWeek === 13, 'shareholder-return payment record');
    equal(returns.history.slice(0, -1), previous.history, 'existing history retained');
    equal(returns.history.at(-1), { week: 13, type: 'dividendPayment', declaredPerShare: perShare, declaredTotal: perShare * 99000,
      paid: pin.gross, capped: variant === 'capped', safeCapacity: pin.capacity, corporateTaxCorrection: 0 }, 'payment history row');
    check(m.finance.dividendReconciliationStatus(plain(after)).ok === true, 'dividend reconciliation');
    check(after.finance.dividendReconciliation.pendingDistribution === null, 'no pending distribution');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.economicReadModel.ownershipReconciliation(plain(after)).ok === true, 'ownership reconciliation');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed payment durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'week'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful week rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'founder') after.personalCash++;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__dividendPaymentEvidence = { e, m, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, receipts, observe };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves } = globalThis.__dividendPaymentEvidence;
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

// A duplicate observation of the paid distribution is rejected without mutation, and week 14 cannot pay again.
async function nextWeek() {
  const { e, m, backend, key, normalized, durableBytes, receipts } = globalThis.__dividendPaymentEvidence;
  const evidence = receipts(e.g).at(-1).dividendDistribution.evidence, stable = JSON.stringify(e.g), bytes = backend.readSync(key);
  let rejected = false;
  try { m.finance.observeDividendDistribution(e.g, evidence); } catch (error) { rejected = /P2-DIVIDEND-DUPLICATE/.test(error.message); }
  if (!rejected || JSON.stringify(e.g) !== stable || backend.readSync(key) !== bytes) throw Error('duplicate observation accepted or mutated');
  if (e.advanceWeek(false) !== true) throw Error('week 14 failed');
  await backend.flush();
  if (e.g.week !== 14 || receipts(e.g).length !== 1 || e.g.finance.shareholderReturns.lastPaymentWeek !== 13 ||
    e.g.finance.dividendReconciliation.paymentCount !== 1) throw Error('week 14 paid again');
  if (await durableBytes() !== backend.readSync(key)) throw Error('week 14 not durable');
  return normalized(e.g);
}

(async () => {
  const states = {}, results = [];
  for (const variant of ['normal', 'capped']) states[variant] = JSON.parse(JSON.stringify((await fixture(variant)).game.g));
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'dividend-payment-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
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
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, pin: PINS[variant], perShare: PER_SHARE, variant, mutation });
    for (const variant of ['normal', 'capped']) {
      const cases = ['none', ...SHARED_KINDS, ...BOUNDARY_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'normal') for (const kind of ['save-false', 'save-throw'])
        cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
      let uninterrupted, uninterruptedNext;
      for (const item of cases) {
        const context = await browser.newContext(options), label = variant + '/' + JSON.stringify(item);
        try {
          const p = await open(context);
          await p.addScriptTag({ content: 'globalThis.__injectDividendPaymentFault=' + inject.toString() + ';' });
          const expected = await p.evaluate(exercise, args(variant, item));
          await fresh(context, expected, label + '/first');
          if (item.kind === 'none') uninterrupted = expected;
          else {
            const committed = await p.evaluate(retry);
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals uninterrupted same-seed week');
            await fresh(context, committed, label + '/retry');
          }
          const next = await p.evaluate(nextWeek);
          if (item.kind === 'none') uninterruptedNext = next;
          else assert.deepEqual(next, uninterruptedNext, label + ': week 14 after retry equals week 14 after the uninterrupted week');
          await fresh(context, next, label + '/week14');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit dividend payment ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    for (const [mutation, kind, pattern] of [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['founder', 'none', /pinned founder net cash/]
    ]) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await p.addScriptTag({ content: 'globalThis.__injectDividendPaymentFault=' + inject.toString() + ';' });
        await assert.rejects(p.evaluate(exercise, args('capped', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Dividend payment real WebKit evidence PASS: ${results.length - 2} scenarios + 2 rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
