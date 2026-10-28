'use strict';
// P3-4 W-PE-PARENT: the installed acquirePEPortfolioCompany, called directly and through the PE UI adapter, in real
// iPhone WebKit with native IndexedDB, buying a PE fund portfolio company closed with production writers into the
// player's group. Save faults roll back live/mirror/cache/durable state, a recovery save exceeds the failed allocation,
// the retried acquisition equals the uninterrupted one, a fresh durable-only context hydrates the exact state, and a
// second acquisition is refused. Node counterpart: tests/pe-parent-acquisition-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: PINNED } = require('./fixtures/pe-parent-acquisition-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/pe-acquisition-atomicity-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const VARIANTS = Object.keys(PINNED);

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
async function exercise({ state, kind, pending, nested, soft, fundID, portfolioID, coinvest, route, mutation = null }) {
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
  const holding = s => { const fund = s.peFirm.funds.find(f => f.id === fundID); return { fund, deal: fund.deals.find(d => d.id === portfolioID) }; };
  check(holding(prior).deal.status === 'active', 'pinned holding changed');
  // The purchase price is the production sale-exit value, read from the read-only preview before the command.
  const plan = plain(e.previewPEParentAcquisition(fundID, portfolioID));
  check(plan.ok === true && JSON.stringify(e.g) === before, 'read-only eligible preview');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed acquisition of the pinned holding must post its ledger row inside its transaction.
  const event = m.finance.event;
  let reached = 0;
  m.finance.event = function (s, type, value, meta, ...rest) {
    if (meta?.sourceType === 'acquirePEPortfolioCompany' && meta.sourceID === portfolioID && e.inTransaction()) reached++;
    return event.call(this, s, type, value, meta, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('PE parent acquisition save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectPEParentFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => {
    if (route !== 'adapter') return e.acquirePEPortfolioCompany(fundID, portfolioID);
    m.playerEngineBridge.bindEngine(e);
    return m.peUIAdapter.performPortfolio('acquireIntoGroup', { fundID, dealID: portfolioID });
  };
  // The follow-up: an acquired holding cannot be acquired again.
  const refuse = run;
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.event = event; }
  check(reached > 0, 'actual installed PE parent acquisition was not reached');
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
  const CHANGED = ['companyCash', 'personalCash', 'subsidiaries', 'totalAcquisitions', 'news', 'finance', 'peFirm', 'lastSaveDate', 'saveSequence'];
  // Port of success() in tests/pe-parent-acquisition-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const price = plan.purchasePrice, st = plan.settlement;
    check(Number.isSafeInteger(price) && price > 0, 'whole-yen purchase price');
    check(st.grossProceeds === price && st.distributedToFund + st.returnedToCoinvestors === price, 'the whole price is settled');
    check((st.returnedToCoinvestors > 0) === coinvest, 'co-investors are paid only when they invested');
    const was = holding(baseline), now = holding(after);
    check(after.companyCash === baseline.companyCash - price, 'company pays the purchase price');
    check(after.personalCash - baseline.personalCash === now.fund.gpDistributed - was.fund.gpDistributed, 'GP economics reach personal cash once');
    check(after.personalCash - baseline.personalCash === st.gpCarry + st.gpPrincipalAndGain, 'GP carry and principal');
    check(now.fund.distributed - was.fund.distributed === st.distributedToFund, 'fund receives its share');
    check((now.fund.gpDistributed - was.fund.gpDistributed) + (now.fund.lpDistributed - was.fund.lpDistributed) === st.distributedToFund, 'GP + LP = fund share');
    check(now.fund.coinvestReturned - was.fund.coinvestReturned === st.returnedToCoinvestors, 'co-investors receive their share');
    check(after.peFirm.coinvestCapital - baseline.peFirm.coinvestCapital === st.returnedToCoinvestors, 'co-invest capital returns');
    const subID = `pe-group-sub-${portfolioID}-w${after.week}`;
    check(now.deal.status === 'exited' && now.deal.exitMethod === 'parent-company-acquisition' && now.deal.exitedWeek === after.week
      && now.deal.exitProceeds === price && now.deal.convertedToSubsidiaryID === subID, 'deal exit');
    check(same(now.deal.exitSettlement, st) && now.deal.exitAttribution.method === 'parent-company-acquisition', 'exit settlement and attribution');
    const added = after.subsidiaries.slice(baseline.subsidiaries.length), sub = added[0];
    check(added.length === 1 && same(after.subsidiaries.slice(0, baseline.subsidiaries.length), baseline.subsidiaries), 'exactly one subsidiary');
    check(sub.id === subID && sub.ownership === 1 && sub.sourcePEFundID === fundID && sub.sourcePEDealID === portfolioID
      && sub.acquiredWeek === after.week && sub.source === 'pe-fund-portfolio', 'subsidiary identity');
    for (const field of ['valuation', 'investedCost', 'carryingBookValue', 'acquisitionPrice']) check(sub[field] === price, `subsidiary ${field} at the purchase price`);
    check(after.totalAcquisitions === baseline.totalAcquisitions + 1, 'acquisition counted');
    check(after.finance.transactions.length === baseline.finance.transactions.length + 1, 'exactly one ledger row');
    const row = after.finance.transactions.at(-1);
    check(row.category === 'acquisition' && row.sourceType === 'acquirePEPortfolioCompany' && row.sourceID === portfolioID
      && row.operationID === `pe-parent-acquisition-${portfolioID}` && row.idempotencyKey === row.operationID
      && row.amount === price && row.cashEffect === -price && row.assetEffect === price && row.profitEffect === 0, 'acquisition row');
    for (const field of new Set([...Object.keys(baseline), ...Object.keys(after)]))
      if (!CHANGED.includes(field)) check(same(after[field], baseline[field]), `${field} untouched`);
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed command durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful command rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'cash') after.personalCash += 1;
    if (mutation === 'coinvest') holding(after).fund.coinvestReturned -= 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__peParentEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run, refuse };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run } = globalThis.__peParentEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (run() !== true || saves.count !== 1) throw Error('retried command failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// The follow-up command is refused with no change and no durable write.
async function repeat() {
  const { e, backend, key, normalized, durableBytes, saves, refuse } = globalThis.__peParentEvidence;
  const stateBefore = JSON.stringify(normalized(e.g)), bytes = backend.readSync(key);
  saves.count = 0;
  if (refuse() !== false) throw Error('follow-up command accepted');
  await backend.flush();
  if (JSON.stringify(normalized(e.g)) !== stateBefore || saves.count !== 0) throw Error('refused command changed state or saved');
  if (backend.readSync(key) !== bytes || await durableBytes() !== bytes) throw Error('refused command wrote storage');
  return normalized(e.g);
}

(async () => {
  const states = {}, ids = {}, results = [];
  for (const variant of VARIANTS) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = { fundID: s.fundID, portfolioID: s.portfolioID, coinvest: s.coinvest, route: s.route };
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'pe-parent-acquisition-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectPEParentFault=' + inject.toString() + ';' });
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
      if (variant === 'coinvest') for (const kind of ['save-false', 'save-throw'])
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
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals the uninterrupted command');
            await fresh(context, committed, label + '/retry');
          }
          assert.deepEqual(await p.evaluate(repeat), committed, label + ': the follow-up command is refused and changes nothing');
          await fresh(context, committed, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit PE parent acquisition ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /GP economics reach personal cash once/],
      ['coinvest', 'none', /co-investors receive their share/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('coinvest', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`PE parent acquisition real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
