'use strict';
// P3-4 W-GROUP-DISPOSAL (merge): the installed group-restructuring merge of two wholly owned private subsidiaries
// (executeGroupRestructuringMerge) in real iPhone WebKit with native IndexedDB, on subsidiaries spun out of internal
// ventures with production writers, with the pair passed in either order. Save faults roll back
// live/mirror/cache/durable state, a recovery save exceeds the failed allocation, the retried merge equals the
// uninterrupted one, a fresh durable-only context hydrates the exact state, and the merged pair cannot be merged again.
// Node counterpart: tests/group-restructuring-merge-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, VARIANTS: ORDERS } = require('./fixtures/group-restructuring-merge-atomicity');
const VARIANTS = Object.keys(ORDERS);
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/group-restructuring-merge-webkit');
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
async function exercise({ state, kind, pending, nested, soft, pair, mutation = null }) {
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
  const ids = [...pair].sort(), mergedID = `restructured-${ids.join('-')}`;
  check(e.groupRestructuringMergePreview(...pair)?.canExecute === true, 'pinned pair changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed merge of the pinned pair must post its integration cost inside its transaction.
  const event = m.finance.event;
  let reached = 0;
  m.finance.event = function (state, type, amount, meta, ...rest) {
    if (meta?.sourceType === 'groupRestructuringMerge' && String(meta.sourceID) === mergedID && e.inTransaction()) reached++;
    return event.call(this, state, type, amount, meta, ...rest);
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('group merge save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind !== 'none') injection = globalThis.__injectGroupMergeFault(e, m, localStorage, key, kind);
  let result, error;
  const run = () => e.executeGroupRestructuringMerge(...pair);
  try { result = nested ? e.runTransaction(run) : run(); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; m.finance.event = event; }
  check(reached > 0, 'actual installed group merge was not reached');
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
  const rows = s => s.finance.transactions.filter(row => row.sourceType === 'groupRestructuringMerge');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Port of success() in tests/group-restructuring-merge-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const ceilYen = m.economicOperation.ceilYen, ratio6 = value => Math.round(Math.max(0, Math.min(1, value)) * 1e6) / 1e6;
    const [a, b] = ids.map(id => baseline.subsidiaries.find(row => row.id === id));
    check(!(baseline.interSubsidiarySynergyHistory || []).length, 'no measured pair synergy');
    const same = String(a.domain || '') === String(b.domain || '');
    const cost = ceilYen(Math.max(5_000_000, (a.valuation + b.valuation) * (same ? .035 : .05)));
    const profitBase = Math.round(a.weeklyProfit + b.weeklyProfit), valuationBase = Math.round(a.valuation + b.valuation);
    const book = a.carryingBookValue + b.carryingBookValue;
    check(after.companyCash === baseline.companyCash - cost, 'company pays the whole-yen integration cost');
    check(after.personalCash === baseline.personalCash, 'founder cash is untouched');
    check(!after.subsidiaries.some(row => ids.includes(row.id)) && after.subsidiaries.length === baseline.subsidiaries.length - 1, 'two rows become one');
    const merged = after.subsidiaries.find(row => row.id === mergedID);
    check(merged && merged.name === `${a.name}・${b.name}` && merged.ownership === 1 && merged.publicCompany === false && merged.status === 'active', 'merged subsidiary');
    check(merged.carryingBookValue === book && merged.investedCost === book, 'the merged book is the sum of both books');
    check(merged.valuation === valuationBase + Math.round(Math.max(0, valuationBase) * (same ? .06 : .025)), 'post-merge valuation');
    check(merged.weeklyProfit === profitBase + Math.round(Math.max(0, profitBase) * (same ? .08 : .04)), 'post-merge weekly profit');
    check(merged.subsidiaryCash === Math.round(a.subsidiaryCash + b.subsidiaryCash), 'merged cash');
    check(merged.growth === ratio6((a.growth + b.growth) / 2) && merged.risk === ratio6(Math.max(a.risk, b.risk) - (same ? .03 : .015)), 'merged growth and risk');
    check(merged.integrationSynergyRounds === (a.integrationSynergyRounds || 0) + (b.integrationSynergyRounds || 0), 'synergy rounds');
    check(JSON.stringify(merged.restructuredFrom) === JSON.stringify(ids) && merged.restructuredWeek === after.week, 'source pair and week');
    check(JSON.stringify(after.groupRestructuringHistory[0]) === JSON.stringify({ week: after.week, type: 'merge', aID: ids[0], bID: ids[1], mergedID,
      integrationCost: cost, bookValue: book }), 'restructuring history row');
    const costRows = rows(after);
    check(costRows.length === rows(baseline).length + 1, 'exactly one integration cost');
    const row = costRows.at(-1);
    check(row.sourceID === mergedID && row.operationID === `groupRestructuringMerge-${mergedID}-${after.week}`, 'cost row identity');
    check(row.amount === cost && row.cashEffect === -cost && row.assetEffect === 0 && row.profitEffect === -cost, 'the cost is the cash paid and expensed');
    check(['amount', 'cashEffect', 'profitEffect'].every(field => Number.isSafeInteger(row[field])), 'whole-yen cost');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(JSON.stringify(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed merge durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful merge rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'cash') after.companyCash += 1;
    if (mutation === 'book') after.subsidiaries.find(row => row.id === mergedID).carryingBookValue -= 1;
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__groupMergeEvidence = { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, failedSequence, oracle, normalized, durableBytes, saves, run } = globalThis.__groupMergeEvidence;
  if (JSON.stringify(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
  await backend.flush();
  const recoverySequence = backend.sequenceOf(backend.readSync(key));
  if (!(recoverySequence > failedSequence)) throw Error('recovery reused failed admitted sequence');
  saves.count = 0;
  if (run() !== true || saves.count !== 1) throw Error('retried merge failed or saved twice');
  oracle(); await backend.flush();
  if (!(backend.sequenceOf(backend.readSync(key)) > recoverySequence)) throw Error('retry sequence not monotonic');
  if (await durableBytes() !== backend.readSync(key)) throw Error('retry not durable');
  return normalized(e.g);
}

// The merged pair no longer exists: merging it again is refused with no change and no durable write.
async function repeat() {
  const { e, backend, key, normalized, durableBytes, saves, run } = globalThis.__groupMergeEvidence;
  const stateBefore = JSON.stringify(normalized(e.g)), bytes = backend.readSync(key);
  saves.count = 0;
  if (run() !== false) throw Error('second merge accepted');
  await backend.flush();
  if (JSON.stringify(normalized(e.g)) !== stateBefore || saves.count !== 0) throw Error('refused merge changed state or saved');
  if (backend.readSync(key) !== bytes || await durableBytes() !== bytes) throw Error('refused merge wrote storage');
  return normalized(e.g);
}

(async () => {
  const states = {}, ids = {}, results = [];
  for (const variant of VARIANTS) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); ids[variant] = s.pair;
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'group-restructuring-merge-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
    async function open(context) {
      const p = await context.newPage(); await p.goto(url, { waitUntil: 'networkidle' });
      await p.addScriptTag({ content: 'globalThis.__injectGroupMergeFault=' + inject.toString() + ';' });
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
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, pair: ids[variant], mutation });
    for (const variant of VARIANTS) {
      // The merge posts no notice: its events are saved -> change, so the shared notify kind does not apply.
      const cases = ['none', ...FAULT_KINDS.filter(kind => kind !== 'notify')].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'forward') for (const kind of ['save-false', 'save-throw'])
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
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals the uninterrupted merge');
            await fresh(context, committed, label + '/retry');
          }
          assert.deepEqual(await p.evaluate(repeat), committed, label + ': a second merge is refused and changes nothing');
          await fresh(context, committed, label + '/repeat');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit group restructuring merge ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['cash', 'none', /whole-yen integration cost/],
      ['book', 'none', /sum of both books/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await assert.rejects(p.evaluate(exercise, args('forward', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Group restructuring merge real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
