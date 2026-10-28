'use strict';
// P3-4 W-INTERNAL-VENTURE (business): the installed internal-venture funding, sale and withdrawal commands
// (fundInternalVenture, sellInternalVenture, withdrawInternalVenture) in real iPhone WebKit with native IndexedDB, on
// ventures proposed, approved and developed with production writers. Save faults roll back live/mirror/cache/durable
// state, a recovery save exceeds the failed allocation, the retried command equals the uninterrupted one, a fresh
// durable-only context hydrates the exact state, and the follow-up command is refused. Node counterpart:
// tests/internal-venture-business-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: PINNED } = require('./fixtures/internal-venture-business-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/internal-venture-business-webkit');
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
async function exercise({ state, kind, pending, nested, soft, ventureID, stage, action, amount, mutation = null }) {
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
  check(held && held.status === stage, 'pinned venture changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed command for the pinned venture must post its ledger row inside its transaction.
  const SOURCE = { fund: 'fundInternalVenture', sell: 'sellInternalVenture', withdraw: 'withdrawInternalVenture' };
  const event = m.finance.event;
  let reached = 0;
  m.finance.event = function (state, type, value, meta, ...rest) {
    if (meta?.sourceType === SOURCE[action] && String(meta.sourceID).startsWith(ventureID) && e.inTransaction()) reached++;
    return event.call(this, state, type, value, meta, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('internal venture save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectVentureBusinessFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => action === 'fund' ? e.fundInternalVenture(ventureID, amount) : action === 'sell' ? e.sellInternalVenture(ventureID)
    : e.withdrawInternalVenture(ventureID);
  // The follow-up: an exited venture cannot be sold or withdrawn again; funding below the ¥1,000,000 minimum is refused.
  const refuse = () => action === 'fund' ? e.fundInternalVenture(ventureID, 999_999) : run();
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.event = event; }
  check(reached > 0, 'actual installed venture command was not reached');
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
  const cents = value => Math.round(value * 100) / 100;
  const rows = s => s.finance.transactions.filter(row => row.sourceType === SOURCE[action]);
  // Port of success() in tests/internal-venture-business-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const ceilYen = m.economicOperation.ceilYen, week = after.week;
    const was = baseline.internalVentures.find(v => v.id === ventureID), now = after.internalVentures.find(v => v.id === ventureID);
    const quality = clamp(was.teamQuality / 100, 0, 1), market = clamp(was.marketPotential / 100, 0, 1), risk = clamp(was.risk, 0, 1);
    const book = Math.max(0, was.carryingBookValue);
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(same(after.subsidiaries, baseline.subsidiaries), 'no subsidiary changes');
    const added = rows(after).slice(rows(baseline).length), row = added[0];
    check(added.length === 1, 'exactly one ledger row');
    if (action === 'fund') {
      const paid = ceilYen(amount), base = Math.max(0, was.requiredBudget);
      const lift = Math.round(paid * clamp(.62 + quality * .32 + market * .28 - risk * .22, .65, 1.18));
      check(after.companyCash === baseline.companyCash - paid, 'company pays the whole-yen funding');
      check(now.carryingBookValue === book + paid, 'the funding is capitalised in the venture book');
      check(now.investedCapital === Math.max(base, was.investedCapital) + paid && now.additionalFunding === (was.additionalFunding || 0) + paid, 'invested capital');
      check(now.valuation === was.valuation + lift, 'valuation lift');
      check(now.fundingRounds === (was.fundingRounds || 0) + 1 && now.lastFundingWeek === week, 'funding round');
      if (was.status === 'developing') {
        const progress = clamp(was.progress + clamp(paid / Math.max(1, base) * 28 * (.75 + clamp(quality, .2, 1) * .5), 2, 28), 0, 100);
        check(now.progress === progress && now.status === (progress >= 100 ? 'active' : 'developing'), 'development progress');
      } else check(now.progress === was.progress && now.status === 'active', 'commercialised venture');
      check(same(after.internalVentureBusinessHistory[0], { week, type: 'funded', ventureID: was.id, ventureName: was.name, amount: paid, valueLift: lift }),
        'funding history row');
      check(row.category === 'assetPurchase' && row.operationID === `fundInternalVenture-${was.id}-${week}-${now.fundingRounds}`
        && row.cashEffect === -paid && row.assetEffect === paid, 'funding row');
    } else if (action === 'sell') {
      const multiple = clamp(.72 + quality * .2 + market * .24 - risk * .22 + (was.status === 'active' ? .08 : 0), .65, 1.18);
      const price = ceilYen(Math.max(was.valuation * multiple, book * .55)), gain = price - book;
      check(after.companyCash === baseline.companyCash + price, 'company receives the whole-yen sale price');
      check(now.status === 'sold' && now.exitWeek === week && now.exitPrice === price && now.exitGain === gain && now.valuationAtExit === was.valuation, 'venture sold');
      check(now.carryingBookValue === 0, 'the book leaves the venture');
      check(same(after.internalVentureBusinessHistory[0], { week, type: 'sold', ventureID: was.id, ventureName: was.name, price, gain, bookValue: book }),
        'sale history row');
      check(row.category === 'assetSale' && row.operationID === `sellInternalVenture-${was.id}-${week}` && row.cashEffect === price
        && row.assetEffect === cents(-book) && row.profitEffect === cents(gain), 'sale row');
    } else {
      const rate = clamp(.08 + clamp(was.progress / 100, 0, 1) * .22 + quality * .08 - risk * .12, .05, .35);
      const recovered = ceilYen(book * rate), impairment = Math.max(0, book - recovered);
      check(after.companyCash === baseline.companyCash + recovered, 'company recovers the whole-yen withdrawal cash');
      check(now.status === 'withdrawn' && now.withdrawnWeek === week && now.withdrawalRecovery === recovered && now.withdrawalLoss === impairment
        && now.valuationAtExit === was.valuation, 'venture withdrawn');
      check(now.carryingBookValue === 0, 'the book leaves the venture');
      check(same(after.internalVentureBusinessHistory[0], { week, type: 'withdrawn', ventureID: was.id, ventureName: was.name, recoveredCash: recovered,
        impairment, bookValue: book }), 'withdrawal history row');
      check(row.category === 'assetSale' && row.operationID === `withdrawInternalVenture-${was.id}-${week}` && row.cashEffect === recovered
        && row.assetEffect === cents(-book) && row.profitEffect === cents(-impairment), 'withdrawal row');
    }
    check(row.sourceType === SOURCE[action] && Number.isSafeInteger(row.amount) && Number.isSafeInteger(row.cashEffect), 'whole-yen cash row');
    check(same(after.internalVentures.filter(v => v.id !== ventureID), baseline.internalVentures.filter(v => v.id !== ventureID)), 'the other venture is untouched');
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
    if (mutation === 'book') after.internalVentures.find(v => v.id === ventureID).carryingBookValue = 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__ventureBusinessEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run, refuse };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run } = globalThis.__ventureBusinessEvidence;
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
  const { e, backend, key, normalized, durableBytes, saves, refuse } = globalThis.__ventureBusinessEvidence;
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
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = { ventureID: s.ventureID, stage: s.stage, action: s.action, amount: s.amount };
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'internal-venture-business-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectVentureBusinessFault=' + inject.toString() + ';' });
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
      if (variant === 'sellActive') for (const kind of ['save-false', 'save-throw'])
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
          console.log('iPhone WebKit internal venture business ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen withdrawal cash/],
      ['book', 'none', /book leaves the venture/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('withdraw', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Internal venture business real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
