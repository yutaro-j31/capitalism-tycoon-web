'use strict';
// P3-4 W-VC-CLOSE / W-WEEK-STARTUPS: the installed canonical week that closes an open startup funding round, diluting
// and re-pricing both holders' stakes, in real iPhone WebKit with native IndexedDB. Save faults roll back
// live/mirror/cache/durable state, a recovery save exceeds the failed allocation, the retried week equals the
// uninterrupted same-seed week, a fresh durable-only context hydrates the exact state, and the next week cannot close
// again. Node counterpart: tests/vc-round-close-week-save-atomicity-test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { webkit, devices } = require('playwright');
const { fixture, TERMS } = require('./fixtures/vc-round-close-week-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/vc-round-close-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
// The canonical week has no close-specific notify and its terminal event is `week`, not a command `change`.
const SHARED_KINDS = FAULT_KINDS.filter(kind => !['change', 'notify'].includes(kind));
// Actual final-close and week-completion boundaries inside the installed week.
const BOUNDARY_KINDS = ['finalize', 'week'];

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
async function exercise({ state, kind, pending, nested, soft, terms, round, paid, startupID, mutation = null }) {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const plain = value => JSON.parse(JSON.stringify(value));
  // As Node's deep equality: object key order is not state. A rollback through normalisation may re-order the keys of
  // funding history rows, so every field value and every array order is compared, not the insertion order.
  const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(name => [name, sorted(value[name])])) : value;
  const canonical = value => JSON.stringify(sorted(value));
  const m = globalThis.__capitalismTycoonModules, e = new m.engine.TycoonEngine(plain(state));
  const backend = m.saveStorageIDB, key = m.engine.SAVE_KEY;
  await backend.hydrate(); check(backend.status().available, 'real IndexedDB unavailable');
  check(e.save() === true, 'baseline save rejected'); await backend.flush();
  // Queue the predecessor in this same task, before any microtask can start it.
  if (pending) check(e.save() === true, 'pending predecessor rejected');
  const before = canonical(e.g), prior = plain(e.g), bytes = backend.readSync(key);
  const predecessorSequence = backend.sequenceOf(bytes), allocated = [];
  m.saveStorageIDB = { ...backend, nextSequence(...args) { const seq = backend.nextSequence(...args); allocated.push(seq); return seq; } };
  const held = prior.startups.find(row => row.id === startupID);
  check(prior.week === terms.closesWeek - 1 && held && held.alive && JSON.stringify(held.activeFundingRound) === JSON.stringify(round) &&
    round.status === 'open' && round.closesWeek === terms.closesWeek && round.contributedCompany === paid.company &&
    round.contributedPersonal === paid.personal, 'pinned opening inputs changed');
  const saves = { count: 0 }, save = e.save;
  e.save = function (...args) { if (!this.inTransaction()) saves.count++; return save.apply(this, args); };
  // The actual installed close of the pinned round must succeed inside the week transaction.
  const close = e.closeStartupFundingRound;
  let reached = 0;
  e.closeStartupFundingRound = function (startup, ...args) {
    const value = close.call(this, startup, ...args);
    if (startup?.id === startupID && value === true && this.inTransaction()) { check(this.g.week === terms.closesWeek, 'unpinned close week'); reached++; }
    return value;
  };
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  let injection = { hits: () => 0, restore() {} };
  if (kind === 'save-before-throw') {
    let hits = 0; const inner = e.save;
    e.save = () => { hits++; throw Error('round-close save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = inner; } };
  } else if (kind === 'finalize') {
    let hits = 0; const rebuild = m.finance.rebuildSnapshotForWeek;
    m.finance.rebuildSnapshotForWeek = function (...args) {
      if (/finalizeWeekBoundary/.test(new Error().stack)) { hits++; throw Error('round-close final close threw'); }
      return rebuild.apply(this, args);
    };
    injection = { hits: () => hits, restore() { m.finance.rebuildSnapshotForWeek = rebuild; } };
  } else if (kind === 'week') {
    let hits = 0; const emit = e.emit;
    e.emit = function (type, ...args) { if (type === 'week') { hits++; throw Error('round-close week completion threw'); } return emit.call(this, type, ...args); };
    injection = { hits: () => hits, restore() { e.emit = emit; } };
  } else if (kind !== 'none') injection = globalThis.__injectRoundCloseFault(e, m, localStorage, key, kind);
  let result, error;
  try { result = nested ? e.runTransaction(() => e.advanceWeek(false)) : e.advanceWeek(false); }
  catch (ex) { error = ex; }
  finally { injection.restore(); m.saveStorageIDB = backend; e.closeStartupFundingRound = close; }
  check(reached > 0, 'actual installed round close was not reached');
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
  const roundRows = state => state.finance.transactions.filter(row => String(row.sourceID).includes(round.id));
  const closedRows = state => (state.startupFundingHistory[startupID] || []).filter(row => row.eventType === 'closed');
  // Port of success() in tests/vc-round-close-week-save-atomicity-test.js.
  function oracle(baseline = prior, after = plain(e.g)) {
    const dilution = terms.pre / terms.post;
    check(baseline.week === terms.closesWeek - 1 && after.week === terms.closesWeek, 'closing week');
    const was = baseline.startups.find(row => row.id === startupID), now = after.startups.find(row => row.id === startupID);
    check(was.activeFundingRound.status === 'open' && now.alive === true, 'round was open and the startup lives');
    const ownedCompany = round.preRoundOwnedCompany * dilution + round.contributedCompany / terms.post;
    const ownedPersonal = round.preRoundOwnedPersonal * dilution + round.contributedPersonal / terms.post;
    check(now.ownedCompany === ownedCompany, 'company stake is diluted and re-priced at the pinned post-money');
    check(now.ownedPersonal === ownedPersonal, 'founder stake is diluted and re-priced at the pinned post-money');
    check(now.ddNegotiatedOwnedCompany === Math.min(Math.max(was.ddNegotiatedOwnedCompany * dilution, 0), ownedCompany), 'company DD fraction diluted');
    check(now.ddNegotiatedOwnedPersonal === Math.min(Math.max(was.ddNegotiatedOwnedPersonal * dilution, 0), ownedPersonal), 'founder DD fraction diluted');
    if (round.preRoundOwnedPersonal > 0 && !paid.personal) check(now.ownedPersonal < was.ownedPersonal, 'a non-participating founder is diluted');
    check(now.valuation === terms.post && now.stage === terms.round && now.fundingRound === terms.round, 'pinned valuation and stage');
    check(now.runwayWeeks === Math.max(was.runwayWeeks, 56) && now.lastFundingRoundClosedWeek === terms.closesWeek, 'pinned runway and close week');
    check(now.activeFundingRound === null, 'no open round');
    for (const field of ['totalInvestedCompany', 'totalInvestedPersonal']) check(now[field] === was[field], 'closing keeps ' + field);
    check(closedRows(after).length === closedRows(baseline).length + 1, 'exactly one close receipt');
    const row = after.startupFundingHistory[startupID][0];
    check(row.id === round.id + '-closed' && row.eventType === 'closed' && row.closedWeek === terms.closesWeek, 'close receipt identity');
    check(JSON.stringify(row.ownershipBefore) === JSON.stringify({ company: round.preRoundOwnedCompany, personal: round.preRoundOwnedPersonal }) &&
      JSON.stringify(row.ownershipAfter) === JSON.stringify({ company: ownedCompany, personal: ownedPersonal }), 'close receipt ownership');
    const opened = after.startupFundingHistory[startupID].find(entry => entry.id === round.id + '-opened');
    check(opened.status === 'closed' && opened.closedWeek === terms.closesWeek, 'opened row marked closed');
    check(JSON.stringify(roundRows(after)) === JSON.stringify(roundRows(baseline)), 'closing posts no ledger movement');
    check(after.news.some(line => line.includes(terms.round + '追加資金調達が完了しました')), 'close is reported');
    check(m.finance.validate(plain(after)).ok === true, 'finance.validate');
    check(m.finance.standaloneClose(plain(after)).ok === true, 'standalone close');
  }
  const failedSequence = Math.max(predecessorSequence, ...allocated);
  if (kind !== 'none') {
    check(injection.hits() > 0, 'fault not reached');
    check(soft.includes(kind) ? result === false && !error : error && /threw/.test(error.message), 'wrong failure result');
    check(canonical(e.g) === before, 'exact rollback changed full live state');
    check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'rollback changed mirror/cache');
    check(await durableBytes() === bytes, 'failed round-close durable or pending predecessor lost');
    check(allocated.every(Number.isSafeInteger), 'invalid allocated sequence');
    if (['mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'week'].includes(kind))
      check(allocated.length > 0, 'admitted fault never allocated a sequence');
  } else {
    check(result === true && !error && saves.count === 1, 'successful week rejected or saved twice');
    const after = plain(e.g);
    if (mutation === 'stake') after.startups.find(row => row.id === startupID).ownedPersonal = round.preRoundOwnedPersonal;
    if (mutation === 'ledger') after.finance.transactions.push({ ...roundRows(after).at(-1), id: 'extra' });
    oracle(prior, after);
    check(await durableBytes() === backend.readSync(key), 'successful durable copy differs');
  }
  globalThis.__roundCloseEvidence = { e, backend, key, before, canonical, failedSequence, oracle, normalized, durableBytes, saves, closedRows, terms };
  return normalized(e.g);
}

async function retry() {
  const { e, backend, key, before, canonical, failedSequence, oracle, normalized, durableBytes, saves } = globalThis.__roundCloseEvidence;
  if (canonical(e.g) !== before || e.save() !== true) throw Error('recovery precondition/save failed');
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

// The next week cannot close the same round again or re-dilute the stakes.
async function nextWeek(startupID) {
  const { e, backend, key, normalized, durableBytes, closedRows, terms } = globalThis.__roundCloseEvidence;
  const closed = e.g.startups.find(row => row.id === startupID), stake = [closed.ownedCompany, closed.ownedPersonal];
  if (e.advanceWeek(false) !== true) throw Error('next week failed');
  await backend.flush();
  const now = e.g.startups.find(row => row.id === startupID);
  if (e.g.week !== terms.closesWeek + 1 || closedRows(e.g).length !== 1) throw Error('next week closed again');
  if (now.ownedCompany !== stake[0] || now.ownedPersonal !== stake[1]) throw Error('next week re-diluted the stakes');
  if (await durableBytes() !== backend.readSync(key)) throw Error('next week not durable');
  return normalized(e.g);
}

(async () => {
  const states = {}, pinned = {}, results = [];
  for (const variant of ['company', 'mixed']) {
    const s = await fixture(variant);
    states[variant] = JSON.parse(JSON.stringify(s.game.g)); pinned[variant] = { startupID: s.startupID, round: s.round, paid: s.paid };
  }
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch();
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const record = ok => fs.writeFileSync(path.join(DIR, 'vc-round-close-result.json'), JSON.stringify({ ok, browser: browser.version(), physicalDevice: false, results }, null, 2));
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
    const args = (variant, item, mutation) => ({ state: states[variant], ...item, soft: SOFT_FAILURES, terms: TERMS, ...pinned[variant], mutation });
    for (const variant of ['company', 'mixed']) {
      const cases = ['none', ...SHARED_KINDS, ...BOUNDARY_KINDS].map(kind => ({ kind, pending: false, nested: false }));
      if (variant === 'mixed') for (const kind of ['save-false', 'save-throw'])
        cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
      let uninterrupted, uninterruptedNext;
      for (const item of cases) {
        const context = await browser.newContext(options), label = variant + '/' + JSON.stringify(item);
        try {
          const p = await open(context);
          await p.addScriptTag({ content: 'globalThis.__injectRoundCloseFault=' + inject.toString() + ';' });
          const expected = await p.evaluate(exercise, args(variant, item));
          await fresh(context, expected, label + '/first');
          if (item.kind === 'none') uninterrupted = expected;
          else {
            const committed = await p.evaluate(retry);
            assert.deepEqual(committed, uninterrupted, label + ': failure/retry equals uninterrupted same-seed week');
            await fresh(context, committed, label + '/retry');
          }
          const next = await p.evaluate(nextWeek, pinned[variant].startupID);
          if (item.kind === 'none') uninterruptedNext = next;
          else assert.deepEqual(next, uninterruptedNext, label + ': the next week after retry equals the next week after the uninterrupted week');
          await fresh(context, next, label + '/next-week');
          results.push({ variant, ...item, pass: true }); record(false);
          console.log('iPhone WebKit startup round close ' + label + ' / real IDB + fresh hydration PASS');
        } finally { await context.close(); }
      }
    }
    const controls = [
      ['rollback', 'save-false', /exact rollback changed full live state/],
      ['stake', 'none', /founder stake is diluted/],
      ['ledger', 'none', /closing posts no ledger movement/]
    ];
    for (const [mutation, kind, pattern] of controls) {
      const broken = await browser.newContext(options);
      try {
        const p = await open(broken);
        await p.addScriptTag({ content: 'globalThis.__injectRoundCloseFault=' + inject.toString() + ';' });
        await assert.rejects(p.evaluate(exercise, args('mixed', { kind, pending: false, nested: false }, mutation)), pattern);
        results.push({ mutation: mutation + ' rejected', pass: true });
      } finally { await broken.close(); }
    }
    record(true);
    console.log(`Startup funding round close real WebKit evidence PASS: ${results.length - controls.length} scenarios + ${controls.length} rejected mutations`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
