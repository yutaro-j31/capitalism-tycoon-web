'use strict';
// Tests only: the installed MBO writer, real WebKit/iPhone emulation and real IndexedDB.
// No ownership authority adoption or new MBO economics. Reuse the shared storage fault injector.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const { scenario } = require('./fixtures/stock-split-atomicity');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/mbo-atomicity-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const FAULTS = ['save-false', 'mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change', 'notify', 'pending-save-false', 'pending-change'];
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1));
    assert.ok(file.startsWith(ROOT + path.sep));
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(fs.readFileSync(file));
  } catch { res.statusCode = 404; res.end(); }
});

async function fixture() {
  const s = await scenario('external');
  const g = s.game.g;
  g.companyStocks.EXT = { qty: 600000, avg: 1000 };
  delete g.personalStocks.EXT; // Match the existing Node MBO fixture: no other modeled holder of this issuer.
  g.companyCash = 1_000_000_000;
  g.finance = s.modules.finance.defaultFinanceState(g);
  assert.equal(s.modules.finance.validate(g).ok, true, 'valid capitalized fixture');
  return JSON.parse(JSON.stringify(g));
}

async function run(browser, url, raw, fault) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  let fresh;
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(`globalThis.__mboInject = (${inject.toString()});`);
    const initial = await page.evaluate(async ({ raw, fault }) => {
      const check = (ok, message) => { if (!ok) throw new Error(message); };
      const m = __capitalismTycoonModules;
      const e = new m.engine.TycoonEngine(raw), backend = m.saveStorageIDB, key = m.engine.SAVE_KEY;
      const clone = x => JSON.parse(JSON.stringify(x));
      const strip = g => { const x = clone(g); delete x.lastSaveDate; delete x.saveSequence; return x; };
      const normalized = g => strip(new m.engine.TycoonEngine(clone(g)).g);
      const durable = () => new Promise((resolve, reject) => {
        const open = indexedDB.open('capitalism-tycoon', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get(key);
          tx.oncomplete = () => { db.close(); resolve(get.result); };
          tx.onerror = () => reject(tx.error);
        };
      });
      await backend.hydrate();
      check(backend.status().available, 'real IndexedDB required');
      check(e.save(), 'baseline save'); await backend.flush();
      const pending = fault.startsWith('pending-'), kind = fault.replace(/^pending-/, '');
      if (pending) { e.g.news.unshift('accepted predecessor'); check(e.save(), 'predecessor save'); }
      const before = clone(e.g), bytes = backend.readSync(key), puts = [];
      const basePut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, k) {
        if (this.name === 'saves' && k === key) puts.push(String(value));
        return basePut.call(this, value, k);
      };
      const normal = kind === 'normal';
      const injection = normal ? { hits: () => 0, restore() {} } : __mboInject(e, m, localStorage, key, kind);
      let result = null, error = null;
      try { result = e.executeMBO('EXT'); } catch (ex) { error = ex.message; } finally { injection.restore(); }
      if (!normal) {
        check(injection.hits() > 0, 'fault must reach installed MBO writer');
        const soft = ['save-false', 'mirror', 'enqueue-false', 'enqueue-throw'].includes(kind);
        check(soft ? result === false && error === null : /threw/.test(error || ''), 'failure result contract');
        check(JSON.stringify(e.g) === JSON.stringify(before), 'whole live state rollback');
        check(localStorage.getItem(key) === bytes && backend.readSync(key) === bytes, 'mirror/cache rollback');
        await backend.flush();
        check(await durable() === bytes, 'durable rollback including predecessor');
        check(puts.length === (pending ? 1 : 0), 'failed MBO put must never start');
        // Verify the rollback through the actual production loader before retry can hide a divergence.
        check(JSON.stringify(strip(m.engine.TycoonEngine.load().g)) === JSON.stringify(normalized(before)), 'rollback load');
      } else check(result === true && error === null, 'normal MBO');
      globalThis.__finishMBOAudit = async () => {
      const expectedCost = (raw.market.find(x => x.id === 'EXT').issuedShares - raw.companyStocks.EXT.qty) * raw.market.find(x => x.id === 'EXT').price * 1.25;
      if (!normal) check(e.executeMBO('EXT') === true, 'unfaulted retry');
      check(e.g.companyCash === before.companyCash - expectedCost, 'company pays exact residual-share consideration');
      check(e.g.personalCash === before.personalCash, 'personal cash unchanged');
      check(JSON.stringify(e.g.personalStocks) === JSON.stringify(before.personalStocks), 'personal holdings unchanged');
      check(JSON.stringify(e.g.simulationRng) === JSON.stringify(before.simulationRng), 'simulation RNG unchanged');
      const stock = e.stock('EXT'), holding = e.g.companyStocks.EXT;
      check(holding.qty === stock.issuedShares && stock.privateCompany === true && stock.suspended === true, 'MBO ownership and listing state');
      const rows = e.g.finance.transactions.filter(x => x.sourceType === 'executeMBO');
      check(rows.length === 1 && rows[0].amount === expectedCost && rows[0].category === 'investmentPurchase', 'exactly one MBO journal');
      check(m.finance.validate(clone(e.g)).ok, 'accounting valid');
      await backend.flush();
      check(await durable() === backend.readSync(key) && localStorage.getItem(key) === backend.readSync(key), 'committed storage equality');
      check(puts.length === 1 + (pending ? 1 : 0), 'one successful MBO put');
      IDBObjectStore.prototype.put = basePut;
      check(key === 'capitalism_tycoon_web_v1' && e.g.saveVersion === 9, 'save compatibility');
      return { expected: normalized(e.g), fault, hits: injection.hits(), result, error, puts: puts.length };
      };
      return { normal, rollbackExpected: normalized(before) };
    }, { raw, fault });
    const loaded = p => p.evaluate(async () => {
      const m = __capitalismTycoonModules; await m.saveStorageIDB.hydrate();
      const g = JSON.parse(JSON.stringify(m.engine.TycoonEngine.load().g));
      delete g.lastSaveDate; delete g.saveSequence; return g;
    });
    if (!initial.normal) {
      const rollbackState = await context.storageState({ indexedDB: true });
      for (const origin of rollbackState.origins) origin.localStorage = [];
      fresh = await browser.newContext({ ...options, storageState: rollbackState });
      const rollbackPage = await fresh.newPage();
      rollbackPage.on('pageerror', e => pageErrors.push(e.message));
      await rollbackPage.goto(url, { waitUntil: 'networkidle' });
      assert.deepEqual(await loaded(rollbackPage), initial.rollbackExpected, fault + ': fresh durable-only rollback before retry');
      await fresh.close(); fresh = undefined;
    }
    const proof = await page.evaluate(() => globalThis.__finishMBOAudit());
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await loaded(page), proof.expected, fault + ': reload');
    const storageState = await context.storageState({ indexedDB: true });
    for (const origin of storageState.origins) origin.localStorage = [];
    fresh = await browser.newContext({ ...options, storageState });
    const fp = await fresh.newPage();
    fp.on('pageerror', e => pageErrors.push(e.message));
    await fp.goto(url, { waitUntil: 'networkidle' });
    assert.deepEqual(await loaded(fp), proof.expected, fault + ': fresh durable-only hydration');
    assert.deepEqual(pageErrors, [], fault + ': no unexpected startup/reload/hydration errors');
    return { fault, hits: proof.hits, result: proof.result, error: proof.error, puts: proof.puts, reload: 'PASS', freshDurableOnly: 'PASS', freshRollbackBeforeRetry: initial.normal ? 'not-applicable' : 'PASS' };
  } finally { await fresh?.close(); await context.close(); }
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const results = [];
  const report = ok => fs.writeFileSync(path.join(DIR, 'execute-mbo-atomicity-result.json'), JSON.stringify({ ok, physicalDevice: false, device: 'iPhone 13', browser: browser?.version(), results }, null, 2));
  try {
    browser = await webkit.launch();
    console.log('Actual WebKit ' + browser.version() + ' / iPhone 13 emulation / real IndexedDB');
    const url = 'http://127.0.0.1:' + server.address().port + '/', raw = await fixture();
    report(false);
    for (const fault of ['normal', ...FAULTS]) {
      results.push(await run(browser, url, raw, fault)); report(false);
      console.log('iPhone WebKit executeMBO ' + fault + ' / atomicity / accounting / reload / fresh durable-only PASS');
    }
    report(true);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
