'use strict';
// P3-4: installed sponsor command, real WebKit/IndexedDB and durable-only hydration.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, SETTLEMENT } = require('./fixtures/sponsor-injection-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/sponsor-webkit');
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
async function exercise({ state, kind, pending, nested, soft, settlement, mutation = null }) {
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
  check(prior.sharesOut === 10000 && e.companyValue() === 99000000 && prior.playerCrisis.reserveThreshold === 3000000, 'pinned opening inputs changed');
  const ratios = e.updateOwnershipRatios;
  let reached = 0;
  e.updateOwnershipRatios = function (...args) {
    if (this.inTransaction() && this.g.sharesOut === prior.sharesOut + settlement.shares) reached++;
    if (mutation === 'quantity') this.g.sharesOut--;
    return ratios.apply(this, args);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    const save = e.save; let hits = 0;
    e.save = () => { hits++; throw Error('sponsor save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = save; } };
  } else if (kind !== 'none') injection = globalThis.__injectSponsorFault(e, m, localStorage, key, kind);
  let result, error;
  try { result = nested ? e.runTransaction(() => e.requestSponsorInjection()) : e.requestSponsorInjection(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; }
  check(reached > 0, 'actual installed sponsor issuance was not reached');
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
    const after = e.g;
    check(after.companyCash === prior.companyCash + settlement.amount, 'independent sponsor cash');
    check(after.sharesOut === prior.sharesOut + settlement.shares, 'independent sponsor quantity');
    for (const k of ['week', 'founderShares', 'treasuryBuybackShares', 'personalCash', 'personalDebt', 'personalStocks', 'companyStocks', 'companyDebt', 'properties', 'simulationRng'])
      check(JSON.stringify(after[k]) === JSON.stringify(prior[k]), 'account/asset/RNG separation: ' + k);
    const actions = after.playerCrisisActions, action = actions.history.at(-1);
    check(actions.nextActionSeq === prior.playerCrisisActions.nextActionSeq + 1, 'one action sequence');
    check(actions.lastSponsorInjectionWeek === prior.week && actions.history.length === prior.playerCrisisActions.history.length + 1, 'one action/cooldown');
    check(action.actionID === 'pca-1' && action.operationID === 'player-crisis-action-pca-1' && action.type === 'sponsorInjection' && action.status === 'completed', 'action identity/status');
    check(action.amount === settlement.amount && action.cashBefore === prior.companyCash && action.cashAfter === after.companyCash, 'independent action amount');
    const receipts = after.finance.transactions.filter(t => t.sourceType === 'playerCrisisSponsorInjection');
    check(receipts.length === 1 && after.finance.transactions.length === prior.finance.transactions.length + 1, 'one financing receipt');
    const txn = receipts[0];
    for (const k of ['amount', 'cashEffect', 'equityEffect']) check(txn[k] === settlement.amount, 'independent receipt ' + k);
    for (const k of ['profitEffect', 'assetEffect', 'liabilityEffect']) check(txn[k] === 0, 'receipt ' + k);
    check(txn.category === 'equityFinancing' && txn.sourceID === action.actionID && txn.operationID === action.operationID && txn.idempotencyKey === action.operationID, 'receipt identity');
    check(after.finance.balances.capitalSurplus === prior.finance.balances.capitalSurplus + settlement.amount, 'one capital-surplus increment');
    check(m.economicReadModel.ownershipReconciliation(after).ok, 'ownership reconciliation');
    check(m.finance.validate(plain(after)).ok, 'company book validation');
    const settled = JSON.stringify(after), stored = backend.readSync(key);
    check(e.requestSponsorInjection() === false && JSON.stringify(e.g) === settled && backend.readSync(key) === stored, 'cooldown replay issued or saved again');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed issuance durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error, 'successful sponsor command rejected'); oracle();
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__sponsorEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes } = globalThis.__sponsorEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  if (e.requestSponsorInjection() !== true) throw Error('retry failed');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

(async () => {
  const input = await fixture(), state = JSON.parse(JSON.stringify(input.game.g)), results = [];
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'sponsor-injection-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
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
    const cases = ['none', ...FAULT_KINDS].map(kind => ({ kind, pending: false, nested: false }));
    for (const kind of ['save-false', 'save-throw']) cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
    let uninterrupted;
    for (const item of cases) {
      const context = await browser.newContext(options), label = JSON.stringify(item);
      try {
        const p = await open(context);
        await p.addScriptTag({ content: 'globalThis.__injectSponsorFault=' + inject.toString() + ';' });
        const expected = await p.evaluate(exercise, { state, ...item, soft: SOFT_FAILURES, settlement: SETTLEMENT });
        await fresh(context, expected, label + '/first');
        if (item.kind === 'none') uninterrupted = expected;
        else {
          const committed = await p.evaluate(retry);
          assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals uninterrupted same-seed command');
          await fresh(context, committed, label + '/retry');
        }
        results.push({ ...item, pass: true }); record(false);
        console.log('iPhone WebKit sponsor ' + label + ' / real IDB + fresh hydration PASS');
      } finally { await context.close(); }
    }
    // Important oracles must reject real browser fixtures with deliberately broken behavior.
    for (const [mutation, kind, pattern] of [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['quantity', 'none', /independent sponsor quantity/]
    ]) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await p.addScriptTag({ content: 'globalThis.__injectSponsorFault=' + inject.toString() + ';' });
        await assert.rejects(p.evaluate(exercise, { state, kind, soft: SOFT_FAILURES, settlement: SETTLEMENT, mutation }), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log('Sponsor real WebKit evidence PASS: 14 scenarios + 2 rejected mutations');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
