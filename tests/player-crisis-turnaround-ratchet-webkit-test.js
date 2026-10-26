'use strict';
// P3-4: installed ratchet week, real WebKit/IndexedDB and durable-only hydration.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { loadGame } = require('./harness');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/ratchet-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };

function preRatchetState() {
  let seed = 7;
  const s = loadGame({ headless: true, random: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; } });
  const state = s.engineModule.createInitialState({ configured: true });
  state.week = 2; state.companyCash = -3000000; state.companyCredit = 80;
  const property = state.properties[0];
  property.owner = 'company'; property.purchasePrice = property.price = property.value = 100000000;
  state.finance = s.modules.finance.defaultFinanceState(state);
  s.modules.playerCrisis.evaluate(state);
  const e = new s.engineModule.TycoonEngine(state);
  assert.equal(e.acceptTurnaroundFund().ok !== false, true);
  for (let i = 0; i < 30; i++) {
    const before = JSON.parse(JSON.stringify(e.g));
    assert.equal(e.advanceWeek(false), true);
    if (e.turnaroundFundSnapshot().status === 'ratcheted') {
      assert.equal(before.playerTurnaroundFund.status, 'active');
      return before;
    }
  }
  throw Error('fixture did not reach a real ratchet through installed APIs');
}

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
async function exercise({ state, kind, pending, nested, soft, broken = false }) {
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
  const originalEmit = e.emit, ratios = e.updateOwnershipRatios;
  let reached = 0;
  e.updateOwnershipRatios = function (...args) {
    if (this.g.playerTurnaroundFund.status === 'ratcheted') reached++;
    return ratios.apply(this, args);
  };
  if (broken) e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    const save = e.save; let hits = 0;
    e.save = () => { hits++; throw Error('ratchet save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = save; } };
  } else if (kind === 'week') {
    let hits = 0;
    e.emit = function (type, ...args) {
      if (type === 'week') { check(this.g.playerTurnaroundFund.status === 'ratcheted', 'week event before ratchet'); hits++; throw Error('ratchet week completion threw'); }
      return originalEmit.call(this, type, ...args);
    };
    injection = { hits: () => hits, restore() { e.emit = originalEmit; } };
  } else if (kind !== 'none') injection = globalThis.__injectRatchetFault(e, m, localStorage, key, kind);
  const injectedEmit = e.emit;
  e.emit = function (type, ...args) {
    if (type === 'notify' && this.g.playerTurnaroundFund.status !== 'ratcheted') return originalEmit.call(this, type, ...args);
    return injectedEmit.call(this, type, ...args);
  };
  let result, error;
  try { result = nested ? e.runTransaction(() => e.advanceWeek(false)) : e.advanceWeek(false); }
  catch (ex) { error = ex; }
  finally { e.emit = injectedEmit; injection.restore(); m.saveStorageIDB = backend; }
  check(reached > 0, 'actual installed ratchet was not reached');
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
    const after = e.g, shares = Math.max(1, Math.round(prior.sharesOut * .15 / .85));
    check(after.week === prior.week + 1, 'one canonical week');
    check(after.sharesOut === prior.sharesOut + shares, 'independent issuer quantity');
    check(after.playerTurnaroundFund.status === 'ratcheted', 'fund not ratcheted');
    check(after.playerTurnaroundFund.shares === prior.playerTurnaroundFund.shares + shares, 'independent fund quantity');
    check(after.playerTurnaroundFund.ratchetShares === prior.playerTurnaroundFund.ratchetShares + shares, 'one ratchet issuance');
    for (const k of ['founderShares', 'treasuryBuybackShares', 'personalStocks', 'companyStocks'])
      check(JSON.stringify(after[k]) === JSON.stringify(prior[k]), 'existing holding changed: ' + k);
    const receipts = g => g.finance.transactions.filter(t => t.sourceType === 'playerCrisisTurnaroundFund');
    check(JSON.stringify(receipts(after)) === JSON.stringify(receipts(prior)), 'synthetic second financing receipt');
    check(m.economicReadModel.ownershipReconciliation(after).ok, 'ownership reconciliation');
    check(m.finance.validate(plain(after)).ok, 'company book validation');
    const settled = JSON.stringify(after);
    check(m.playerCrisisTurnaroundFund.settle(e) === null && JSON.stringify(e.g) === settled, 'terminal settlement issued again');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed issuance durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'week'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error, 'successful week rejected'); oracle();
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__ratchetEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes } = globalThis.__ratchetEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  if (e.advanceWeek(false) !== true) throw Error('retry failed');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

(async () => {
  const state = preRatchetState(), results = [];
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'turnaround-ratchet-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
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
    const cases = ['none', ...FAULT_KINDS.filter(k => k !== 'change'), 'week'].map(kind => ({ kind, pending: false, nested: false }));
    for (const kind of ['save-false', 'save-throw']) cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
    let uninterrupted;
    for (const item of cases) {
      const context = await browser.newContext(options), label = JSON.stringify(item);
      try {
        const p = await open(context);
        await p.addScriptTag({ content: 'globalThis.__injectRatchetFault=' + inject.toString() + ';' });
        const expected = await p.evaluate(exercise, { state, ...item, soft: SOFT_FAILURES });
        await fresh(context, expected, label + '/first');
        if (item.kind === 'none') uninterrupted = expected;
        else {
          const committed = await p.evaluate(retry);
          assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals uninterrupted same-seed week');
          await fresh(context, committed, label + '/retry');
        }
        results.push({ ...item, pass: true }); record(false);
        console.log('iPhone WebKit ratchet ' + label + ' / real IDB + fresh hydration PASS');
      } finally { await context.close(); }
    }
    // A real browser fixture with broken rollback must be rejected by the oracle.
    const broken = await browser.newContext(options);
    try {
      const p = await open(broken);
      await p.addScriptTag({ content: 'globalThis.__injectRatchetFault=' + inject.toString() + ';' });
      await assert.rejects(p.evaluate(exercise, { state, kind: 'save-false', soft: SOFT_FAILURES, broken: true }), /exact rollback changed full live state/);
      results.push({ mutation: 'disabled rollback rejected', pass: true });
    } finally { await broken.close(); }
    record(true);
    console.log('Ratchet real WebKit evidence PASS: 14 scenarios + rejected rollback mutation');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
