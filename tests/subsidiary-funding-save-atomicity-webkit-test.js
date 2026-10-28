'use strict';
// P3-4 W-INTERNAL-VENTURE (subsidiary funding): the installed parent capital injection and external round of an
// unlisted subsidiary (fundSubsidiaryFromParent, raiseSubsidiaryExternalRound) in real iPhone WebKit with native
// IndexedDB, on a subsidiary spun out of an internal venture and on a 70% VC subsidiary, both built with production
// writers. Save faults roll back live/mirror/cache/durable state, a recovery save exceeds the failed allocation, the
// retried round equals the uninterrupted one, a fresh durable-only context hydrates the exact state, and the follow-up
// round is refused. Node counterpart: tests/subsidiary-funding-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: PINNED } = require('./fixtures/subsidiary-funding-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/subsidiary-funding-webkit');
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
async function exercise({ state, kind, pending, nested, soft, subsidiaryID, source, side, amount, mutation = null }) {
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
  check(held && held.status === 'active' && !held.publicCompany && held.ownership === (source === 'vc' ? .7 : 1), 'pinned subsidiary changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // An external round posts no parent ledger row: the actual installed round's notice naming the pinned subsidiary must
  // be raised inside the transaction.
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
    e.save = () => { hits++; throw Error('subsidiary funding save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectSubsidiaryFundingFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => side === 'parent' ? e.fundSubsidiaryFromParent(subsidiaryID, amount) : e.raiseSubsidiaryExternalRound(subsidiaryID, amount);
  // The follow-up: a second external round is refused inside the cooldown; an injection below ¥1,000,000 is refused.
  const refuse = () => side === 'parent' ? e.fundSubsidiaryFromParent(subsidiaryID, 999_999) : run();
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; e.notify = notify; }
  check(reached > 0, 'actual installed subsidiary round was not reached');
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
  const rows = s => s.finance.transactions.filter(row => row.sourceType === 'fundSubsidiaryFromParent');
  // Port of success() in tests/subsidiary-funding-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const ceilYen = m.economicOperation.ceilYen, week = after.week, paid = ceilYen(amount);
    const was = baseline.subsidiaries.find(row => row.id === subsidiaryID), sub = after.subsidiaries.find(row => row.id === subsidiaryID);
    const pre = Math.max(1, was.valuation), post = pre + paid, own = clamp(was.ownership, 0, 1);
    const ownAfter = clamp(side === 'parent' ? (own * pre + paid) / post : own * pre / post, 0, 1), lift = clamp(paid / pre, 0, 1);
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(sub.valuation === post, 'post-money valuation'); check(sub.ownership === ownAfter, 'parent stake at post-money');
    check(sub.subsidiaryCash === was.subsidiaryCash + paid, 'the subsidiary receives the whole-yen round');
    check(sub.growth === clamp(was.growth + clamp(lift * .08, .002, .03), 0, 1) && sub.risk === clamp(was.risk - clamp(lift * .02, .001, .008), 0, 1),
      'growth and risk effects');
    check(sub.lastCapitalActionWeek === week, 'capital action week');
    const historyRow = { week, subsidiaryID: was.id, subsidiaryName: was.name, amount: paid, ownershipBefore: own, ownershipAfter: ownAfter,
      valuationBefore: pre, valuationAfter: post };
    const actual = after.subsidiaryFundingHistory[0], keys = row => Object.keys(row).sort();
    if (side === 'parent') {
      check(after.companyCash === baseline.companyCash - paid, 'company pays the whole-yen injection');
      check(sub.carryingBookValue === was.carryingBookValue + paid, 'the injection is capitalised in the parent book');
      check(sub.investedCost === Math.max(0, was.investedCost ?? was.carryingBookValue) + paid, 'invested cost');
      check(sub.parentCapitalInjected === (was.parentCapitalInjected || 0) + paid && sub.externalCapitalRaised === (was.externalCapitalRaised || 0), 'parent capital');
      const expected = { ...historyRow, type: 'parentFunding' };
      check(same(keys(actual), keys(expected)) && keys(expected).every(key => same(actual[key], expected[key])), 'funding history row');
      const added = rows(after).slice(rows(baseline).length), row = added[0];
      check(added.length === 1, 'exactly one ledger row');
      check(row.category === 'assetPurchase' && row.operationID === `fundSubsidiaryFromParent-${was.id}-${week}-${sub.parentCapitalInjected}`
        && row.amount === paid && row.cashEffect === -paid && row.assetEffect === paid, 'whole-yen injection row');
    } else {
      check(after.companyCash === baseline.companyCash, 'an external round moves no parent cash');
      check(sub.carryingBookValue === was.carryingBookValue, 'the parent book is unchanged');
      check(sub.externalCapitalRaised === (was.externalCapitalRaised || 0) + paid && sub.externalFundingRounds === (was.externalFundingRounds || 0) + 1
        && sub.lastExternalFundingWeek === week && sub.parentCapitalInjected === (was.parentCapitalInjected || 0), 'external capital');
      const expected = { ...historyRow, type: 'externalFunding', dilution: own - ownAfter };
      check(same(keys(actual), keys(expected)) && keys(expected).every(key => same(actual[key], expected[key])), 'funding history row');
      check(same(after.finance.transactions, baseline.finance.transactions), 'no parent ledger row');
    }
    check(same(after.subsidiaries.filter(row => row.id !== subsidiaryID), baseline.subsidiaries.filter(row => row.id !== subsidiaryID)), 'other subsidiaries untouched');
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
    if (mutation === 'stake') after.subsidiaries.find(row => row.id === subsidiaryID).ownership = .7;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__subsidiaryFundingEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run, refuse };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run } = globalThis.__subsidiaryFundingEvidence;
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
  const { e, backend, key, normalized, durableBytes, saves, refuse } = globalThis.__subsidiaryFundingEvidence;
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
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = { subsidiaryID: s.subsidiaryID, source: s.source, side: s.side, amount: s.amount };
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'subsidiary-funding-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectSubsidiaryFundingFault=' + inject.toString() + ';' });
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
      if (variant === 'parentVc') for (const kind of ['save-false', 'save-throw'])
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
          console.log('iPhone WebKit subsidiary funding ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen injection/],
      ['stake', 'none', /parent stake at post-money/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('parentVc', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Subsidiary funding real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
