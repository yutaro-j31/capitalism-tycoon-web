'use strict';
// P3-4 W-SUB-RELIST: the installed relisting of a wholly owned, previously squeezed-out subsidiary (relistSubsidiary)
// with each installed strategy, in real iPhone WebKit with native IndexedDB. Save faults roll back live/mirror/cache/
// durable state, a recovery save exceeds the failed allocation, the retried relisting equals the uninterrupted one, a
// fresh durable-only context hydrates the exact state, and a second relisting is refused under every strategy.
// Node counterpart: tests/subsidiary-relist-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, STRATEGIES } = require('./fixtures/subsidiary-relist-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/subsidiary-relist-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const VARIANTS = STRATEGIES;
// Installed strategies, as in the Node test: primary / parent-secondary ratios, offer discount and lock-up.
const TERMS = Object.freeze({
  control: { label: '支配維持型', primary: .05, secondary: .05, discount: .04, lockupWeeks: 26, volatility: .12 },
  balanced: { label: '標準型', primary: .10, secondary: .10, discount: .07, lockupWeeks: 18, volatility: .18 },
  growth: { label: '成長資金型', primary: .20, secondary: .05, discount: .11, lockupWeeks: 13, volatility: .28 }
});

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
async function exercise({ state, kind, pending, nested, soft, subsidiaryID, option, terms, mutation = null }) {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const plain = value => JSON.parse(JSON.stringify(value));
  const m = globalThis.__capitalismTycoonModules, e = new m.engine.TycoonEngine(plain(state));
  const backend = m.saveStorageIDB, key = m.engine.SAVE_KEY;
  await backend.hydrate(); check(backend.status().available, 'real IndexedDB unavailable');
  check(e.save() === true, 'baseline save rejected'); await backend.flush();
  // Queue the predecessor in this same task, before any microtask can start it.
  if (pending) check(e.save() === true, 'pending predecessor rejected');
  // Live-state rollback is compared with sorted object keys, as Node's deep equality does: the restored subsidiary may
  // carry its listing terms (`ipoOfferTerms`) in a different key order without any value changing.
  const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(name => [name, sorted(value[name])])) : value;
  const canonical = value => JSON.stringify(sorted(value));
  const before = canonical(e.g), prior = plain(e.g), bytes = backend.readSync(key);
  const predecessorSequence = backend.sequenceOf(bytes), allocated = [];
  m.saveStorageIDB = { ...backend, nextSequence(...args) { const seq = backend.nextSequence(...args); allocated.push(seq); return seq; } };
  const held = prior.subsidiaries.find(row => row.id === subsidiaryID);
  check(held && !held.publicCompany && e.subsidiaryRelistingPreview(subsidiaryID, option).canExecute, 'pinned private subsidiary changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed relisting of the pinned subsidiary must post its secondary receipt inside its transaction.
  const event = m.finance.event;
  let reached = 0;
  m.finance.event = function (state, type, amount, meta, ...rest) {
    if (meta?.sourceType === 'subsidiaryRelistingSecondary' && String(meta.sourceID) === subsidiaryID && e.inTransaction()) reached++;
    return event.call(this, state, type, amount, meta, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('relisting save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectRelistFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => e.relistSubsidiary(subsidiaryID, option);
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.event = event; }
  check(reached > 0, 'actual installed relisting was not reached');
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
  const rows = (s, sourceType) => s.finance.transactions.filter(row => row.sourceType === sourceType);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Port of success() in tests/subsidiary-relist-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const ceilYen = m.economicOperation.ceilYen, ratio6 = value => Math.round(value * 1e6) / 1e6, PREPARATION_COST = 15000000;
    const was = baseline.subsidiaries.find(row => row.id === subsidiaryID), now = after.subsidiaries.find(row => row.id === subsidiaryID);
    const preMoney = was.valuation, primary = ceilYen(Math.round(preMoney * terms.primary) * (1 - terms.discount));
    const secondary = ceilYen(Math.round(preMoney * terms.secondary) * (1 - terms.discount));
    const ownership = ratio6((1 - terms.secondary) * preMoney / (preMoney + primary));
    const book = Number(was.carryingBookValue) || 0, bookSold = Math.round(book * terms.secondary), lockupUntilWeek = after.week + terms.lockupWeeks;
    check(was.ownership === 1 && was.publicCompany === false, 'wholly owned private subsidiary');
    check(after.companyCash === baseline.companyCash - PREPARATION_COST + secondary, 'company pays the preparation cost and receives the whole-yen secondary proceeds');
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(now.subsidiaryCash === was.subsidiaryCash + primary, 'primary proceeds stay in the subsidiary');
    check(now.valuation === preMoney + primary, 'post-money valuation');
    check(now.ownership === ownership, 'parent stake after the secondary block and the primary dilution');
    check(now.carryingBookValue === book - bookSold, 'sold book leaves the parent');
    check(now.publicCompany === true && now.relistingRounds === (was.relistingRounds || 0) + 1 && now.lastRelistedWeek === after.week, 'listed again');
    check(same(now.ipoOfferTerms, { termID: option, label: terms.label, preMoney, primaryProceeds: primary, secondaryProceeds: secondary,
      lockupWeeks: terms.lockupWeeks, lockupUntilWeek, volatility: terms.volatility, listingPriceIndex: 100, relisting: true }), 'relisting offer terms');
    check(now.marketLastWeek === after.week && now.marketPriceIndex === 100 && now.marketListingValuation === now.valuation, 'market restarted this week');
    check(same(after.subsidiaryRelistingHistory[0], { week: after.week, type: 'relisted', subsidiaryID, subsidiaryName: was.name,
      strategyID: option, primaryProceeds: primary, secondaryProceeds: secondary, ownershipAfter: ownership, lockupUntilWeek }), 'history row');
    const prep = rows(after, 'subsidiaryRelistingPreparation'), sale = rows(after, 'subsidiaryRelistingSecondary');
    check(prep.length === rows(baseline, 'subsidiaryRelistingPreparation').length + 1, 'one preparation cost');
    check(sale.length === rows(baseline, 'subsidiaryRelistingSecondary').length + 1, 'one secondary receipt');
    const cost = prep.at(-1), receipt = sale.at(-1);
    check(cost.operationID === `subsidiaryRelistingPreparation-${subsidiaryID}-${after.week}` && cost.sourceID === subsidiaryID, 'preparation row identity');
    check(cost.amount === PREPARATION_COST && cost.cashEffect === -PREPARATION_COST && cost.profitEffect === -PREPARATION_COST, 'preparation cost');
    check(receipt.category === 'investmentSale' && receipt.operationID === `subsidiaryRelistingSecondary-${subsidiaryID}-${after.week}` && receipt.sourceID === subsidiaryID, 'receipt identity');
    check(receipt.amount === secondary && receipt.cashEffect === secondary && receipt.assetEffect === -bookSold && receipt.profitEffect === secondary - bookSold, 'the sale receipt is the cash received');
    check([cost, receipt].every(row => ['amount', 'cashEffect', 'assetEffect', 'profitEffect'].every(field => Number.isSafeInteger(row[field] || 0))), 'whole-yen rows');
    check(after.news.some(line => String(line).includes('再上場')), 'relisting is reported');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(canonical(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed relisting durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful relisting rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'cash') after.companyCash += 1;
    if (mutation === 'primary') after.subsidiaries.find(row => row.id === subsidiaryID).subsidiaryCash -= 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__relistEvidence = { e, backend, key, before, canonical, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, option };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, canonical, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, option } = globalThis.__relistEvidence;
  if (canonical(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (e.relistSubsidiary(subsidiaryID, option) !== true || saves.count !== 1) throw Error('retried relisting failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// A listed subsidiary cannot relist again: every installed strategy is refused with no change and no durable write.
async function repeat(strategies) {
  const { e, backend, key, normalized, durableBytes, saves, subsidiaryID } = globalThis.__relistEvidence;
  const stateBefore = JSON.stringify(normalized(e.g)), bytes = backend.readSync(key);
  saves.count = 0;
  for (const strategy of strategies) if (e.relistSubsidiary(subsidiaryID, strategy) !== false) throw Error('second ' + strategy + ' relisting accepted');
  await backend.flush();
  if (JSON.stringify(normalized(e.g)) !== stateBefore || saves.count !== 0) throw Error('refused relisting changed state or saved');
  if (backend.readSync(key) !== bytes || await durableBytes() !== bytes) throw Error('refused relisting wrote storage');
  return normalized(e.g);
}

(async () => {
  const states = {}, ids = {}, results = [];
  for (const variant of VARIANTS) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = s.subsidiaryID;
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'subsidiary-relist-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectRelistFault=' + inject.toString() + ';' });
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
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, subsidiaryID: ids[variant], option: variant, terms: TERMS[variant], mutation });
    for (const variant of VARIANTS) {
      // The command commits change -> saved -> change, so every shared kind applies, notify and change included.
      const cases = ['none', ...FAULT_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'growth') for (const kind of ['save-false', 'save-throw'])
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
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals the uninterrupted relisting');
            await fresh(context, committed, label + '/retry');
          }
          assert.deepEqual(await p.evaluate(repeat, STRATEGIES), committed, label + ': a second relisting is refused under every strategy and changes nothing');
          await fresh(context, committed, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit subsidiary relisting ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen secondary proceeds/],
      ['primary', 'none', /primary proceeds stay in the subsidiary/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('growth', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Subsidiary relisting real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
