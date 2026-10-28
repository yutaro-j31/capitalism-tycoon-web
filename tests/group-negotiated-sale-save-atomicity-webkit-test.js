'use strict';
// P3-4 W-GROUP-NEGOTIATED: closing an agreed subsidiary sale negotiation (closeNegotiatedSubsidiarySale) in real iPhone
// WebKit with native IndexedDB, on negotiations started, agreed and advanced to their close week with production
// writers (a 70% VC subsidiary, a wholly owned one with an earnout, a listed one sold down to its 10% floor). Save
// faults roll back live/mirror/cache/durable state, a recovery save exceeds the failed allocation, the retried close
// equals the uninterrupted one, a fresh durable-only context hydrates the exact state, and a second close is refused.
// Node counterpart: tests/group-negotiated-sale-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: BUYERS } = require('./fixtures/group-negotiated-sale-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/group-negotiated-sale-webkit');
const VARIANTS = Object.keys(BUYERS);
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
async function exercise({ state, kind, pending, nested, soft, subsidiaryID, negotiationID, mutation = null }) {
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
  const agreed = prior.saleNegotiations.find(n => n.id === negotiationID);
  check(agreed && agreed.subsidiaryID === subsidiaryID && agreed.status === 'active' && agreed.agreementAccepted && prior.week >= agreed.closeWeek,
    'pinned agreed negotiation changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed close of the pinned negotiation must post its receipt inside its transaction.
  const event = m.finance.event;
  let reached = 0;
  m.finance.event = function (state, type, amount, meta, ...rest) {
    if (meta?.sourceType === 'negotiatedSubsidiarySale' && String(meta.sourceID) === negotiationID && e.inTransaction()) reached++;
    return event.call(this, state, type, amount, meta, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('negotiated sale save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectNegotiatedSaleFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => e.closeNegotiatedSubsidiarySale(negotiationID);
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.event = event; }
  check(reached > 0, 'actual installed negotiated sale close was not reached');
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
  const rows = s => s.finance.transactions.filter(row => row.sourceType === 'negotiatedSubsidiarySale');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ratio = value => Math.round(Math.max(0, Math.min(1, value)) * 1e6) / 1e6;
  // Port of success() in tests/group-negotiated-sale-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const ceilYen = m.economicOperation.ceilYen;
    const was = baseline.saleNegotiations.find(n => n.id === negotiationID), now = after.saleNegotiations.find(n => n.id === negotiationID);
    const target = baseline.subsidiaries.find(row => row.id === subsidiaryID), sub = after.subsidiaries.find(row => row.id === subsidiaryID);
    const ownership = ratio(target.ownership), sellRatio = ratio(Math.min(was.sellRatio, target.publicCompany ? Math.max(0, ownership - .1) : ownership));
    const book = Math.max(0, target.carryingBookValue), bookRemoved = sellRatio >= ownership ? book : Math.max(0, Math.round(book * sellRatio / ownership));
    const gross = ceilYen(was.currentOffer), fee = Math.min(ceilYen(gross * .02), gross), net = gross - fee, gain = net - bookRemoved;
    check(sellRatio > 0 && net > 0, 'a real sale');
    check(after.companyCash === baseline.companyCash + net, 'company receives the whole-yen net proceeds');
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(sub.ownership === ratio(ownership - sellRatio), 'the parent stake falls by the sold block');
    check(sub.carryingBookValue === book - bookRemoved, 'the sold book leaves the parent');
    check(sub.status === (sub.ownership === 0 ? 'sold' : 'active'), 'sold status only at zero stake');
    check(now.status === 'completed' && now.completedWeek === after.week && now.fee === fee && now.bookRemoved === bookRemoved
      && now.saleGain === gain && now.netProceeds === net, 'completed negotiation');
    const earnouts = (after.earnoutAgreements || []).filter(x => x.id === `earnout-${was.id}`);
    if (was.earnoutAmount > 0) {
      const x = earnouts[0];
      check(earnouts.length === 1 && same([x.subsidiaryID, x.earnoutTarget, x.earnoutAmount, x.earnoutDeadlineWeek, x.earnoutStatus, x.earnoutPaidWeek, x.closingWeek],
        [was.subsidiaryID, was.earnoutTarget, was.earnoutAmount, after.week + 52, 'pending', null, after.week]), 'one pending earnout');
    } else check(earnouts.length === 0, 'no earnout');
    check(same(after.groupRestructuringProgressHistory.at(-1), { week: after.week, type: 'saleCompleted', negotiationID: was.id,
      subsidiaryID: was.subsidiaryID, sellRatio, proceeds: net, bookRemoved, gain, fee }), 'sale history row');
    const saleRows = rows(after);
    check(saleRows.length === rows(baseline).length + 1, 'exactly one sale receipt');
    const row = saleRows.at(-1);
    check(row.category === 'assetSale' && row.sourceID === was.id && row.operationID === `saleClose-${was.id}`, 'receipt identity');
    check(row.amount === gross && row.cashEffect === net && row.assetEffect === -bookRemoved && row.profitEffect === gain, 'the receipt is the net cash');
    check(['amount', 'cashEffect', 'assetEffect', 'profitEffect'].every(field => Number.isSafeInteger(row[field])), 'whole-yen receipt');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed close durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful close rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'cash') after.companyCash += 1;
    if (mutation === 'book') after.subsidiaries.find(row => row.id === subsidiaryID).carryingBookValue += 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__negotiatedSaleEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, run };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, subsidiaryID, run } = globalThis.__negotiatedSaleEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (run() !== true || saves.count !== 1) throw Error('retried close failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// A closed negotiation cannot be closed again: refused with no change and no durable write.
async function repeat() {
  const { e, backend, key, normalized, durableBytes, saves, run } = globalThis.__negotiatedSaleEvidence;
  const stateBefore = JSON.stringify(normalized(e.g)), bytes = backend.readSync(key);
  saves.count = 0;
  if (run() !== false) throw Error('second close accepted');
  await backend.flush();
  if (JSON.stringify(normalized(e.g)) !== stateBefore || saves.count !== 0) throw Error('refused close changed state or saved');
  if (backend.readSync(key) !== bytes || await durableBytes() !== bytes) throw Error('refused close wrote storage');
  return normalized(e.g);
}

(async () => {
  const states = {}, ids = {}, results = [];
  for (const variant of VARIANTS) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = { subsidiaryID: s.subsidiaryID, negotiationID: s.negotiationID };
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'group-negotiated-sale-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectNegotiatedSaleFault=' + inject.toString() + ';' });
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
      // The close posts no notice: its events are saved -> change, so the shared notify kind does not apply.
      const cases = ['none', ...FAULT_KINDS.filter(kind => kind !== 'notify')].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'whole') for (const kind of ['save-false', 'save-throw'])
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
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals the uninterrupted close');
            await fresh(context, committed, label + '/retry');
          }
          assert.deepEqual(await p.evaluate(repeat), committed, label + ': a second close is refused and changes nothing');
          await fresh(context, committed, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit negotiated subsidiary sale ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen net proceeds/],
      ['book', 'none', /sold book leaves the parent/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('whole', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Negotiated subsidiary sale real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
