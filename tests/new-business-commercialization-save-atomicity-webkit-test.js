'use strict';
// P3-4 W-COMMERCIAL-SPINOUT: the installed commercialization decision for a researched new-business project
// (commercializeNewBusiness: launch, subsidiary spin-out, abandonment) in real iPhone WebKit with native IndexedDB, on
// projects researched to `ready` with production writers. Save faults roll back live/mirror/cache/durable state, a
// recovery save exceeds the failed allocation, the retried decision equals the uninterrupted one, a fresh durable-only
// context hydrates the exact state, and a second decision in any mode is refused. Node counterpart:
// tests/new-business-commercialization-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: PINNED } = require('./fixtures/new-business-commercialization-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/new-business-commercialization-webkit');
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
async function exercise({ state, kind, pending, nested, soft, identity, projectID, mode, mutation = null }) {
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
  const held = prior.newBusinessResearch.projects.find(p => p.id === projectID);
  check(held && held.status === 'ready', 'pinned project changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed decision for the pinned project raises its notice inside the transaction (abandonment posts
  // no ledger row, so the notice is the common witness).
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
    e.save = () => { hits++; throw Error('commercialization save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectCommercializationFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => e.commercializeNewBusiness(identity, mode);
  // The follow-up: a decided project cannot be decided again, in any mode.
  const refuse = () => ['launch', 'spinout', 'abandon'].every(other => e.commercializeNewBusiness(identity, other) === false) ? false : true;
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; e.notify = notify; }
  check(reached > 0, 'actual installed commercialization was not reached');
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
  const rows = s => s.finance.transactions.filter(row => row.sourceType === 'newBusinessCommercialization');
  // Port of success() in tests/new-business-commercialization-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const ceilYen = m.economicOperation.ceilYen, week = after.week;
    const was = baseline.newBusinessResearch.projects.find(p => p.id === projectID), now = after.newBusinessResearch.projects.find(p => p.id === projectID);
    const invested = Math.floor(was.invested), cost = mode === 'launch' ? ceilYen(was.invested * .25) : mode === 'spinout' ? ceilYen(was.invested * .15) : 0;
    check(after.companyCash === baseline.companyCash - cost, 'company pays the whole-yen commercialization cost');
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(now.status === (mode === 'abandon' ? 'abandoned' : 'commercialized') && now.commercializedWeek === week && now.commercializationMode === mode,
      'project decided');
    const businesses = s => s.newBusinesses || [], subsidiaries = s => s.maSubsidiaries || [];
    if (mode === 'launch') {
      check(businesses(after).length === businesses(baseline).length + 1, 'exactly one new business');
      check(same(after.newBusinesses[0], { id: `business-${was.id}`, name: was.name, sector: was.sector, startWeek: week, invested: invested + cost,
        commercializationCarryingValue: cost, weeklyRevenue: Math.floor(was.invested * (.01 + was.outcomeScore * .025)), status: 'operating' }), 'launched business');
      check(same(subsidiaries(after), subsidiaries(baseline)), 'no subsidiary');
    } else if (mode === 'spinout') {
      check(subsidiaries(after).length === subsidiaries(baseline).length + 1, 'exactly one new subsidiary');
      const book = invested + cost, sub = after.maSubsidiaries[0];
      const expected = { id: `spinout-${was.id}`, name: `${was.name}事業会社`, status: 'active', investmentBookValue: book, commercializationCarryingValue: cost,
        enterpriseValue: Math.floor(book * (1.1 + was.outcomeScore)), valuation: 1_000_000, operatingProfit: 0, sales: 0, weeklyProfit: 0, standaloneWeeklyProfit: 0,
        retainedEarnings: 0, risk: .45, quality: .6, growth: was.outcomeScore };
      for (const [field, value] of Object.entries(expected)) check(same(sub[field], value), `spin-out subsidiary ${field}`);
      check(same(businesses(after), businesses(baseline)), 'no business');
    } else check(same(subsidiaries(after), subsidiaries(baseline)) && same(businesses(after), businesses(baseline)), 'abandonment creates nothing');
    check(same(after.newBusinessCommercializationHistory.at(-1), { week, projectId: was.id, projectStartWeek: was.startWeek, mode,
      cashEffect: cost ? -cost : 0, assetEffect: cost, profitEffect: 0 }), 'commercialization history row');
    const added = rows(after).slice(rows(baseline).length);
    if (cost > 0) {
      const sourceID = `${was.id}-w${Math.floor(was.startWeek)}`, row = added[0];
      check(added.length === 1 && row.category === 'assetPurchase' && row.sourceID === sourceID
        && row.operationID === `new-business-commercialization-${mode}-${sourceID}` && row.amount === cost && row.cashEffect === -cost
        && row.assetEffect === cost && row.profitEffect === 0, 'commercialization row');
      check(Number.isSafeInteger(row.amount) && Number.isSafeInteger(row.cashEffect) && Number.isSafeInteger(row.assetEffect), 'whole-yen row');
    } else check(added.length === 0, 'abandonment posts nothing');
    check(same(after.newBusinessResearch.projects.filter(p => p.id !== projectID), baseline.newBusinessResearch.projects.filter(p => p.id !== projectID)),
      'the other projects are untouched');
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
    if (mutation === 'cash') after.companyCash += 1;
    if (mutation === 'book') after.maSubsidiaries[0].investmentBookValue -= 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__commercializationEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run, refuse };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run } = globalThis.__commercializationEvidence;
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
  const { e, backend, key, normalized, durableBytes, saves, refuse } = globalThis.__commercializationEvidence;
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
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = { identity: s.identity, projectID: s.projectID, mode: s.mode };
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'new-business-commercialization-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectCommercializationFault=' + inject.toString() + ';' });
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
      if (variant === 'spinout') for (const kind of ['save-false', 'save-throw'])
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
          console.log('iPhone WebKit new-business commercialization ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen commercialization cost/],
      ['book', 'none', /spin-out subsidiary investmentBookValue/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('spinout', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`New-business commercialization real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
