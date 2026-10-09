'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const { prepareIPO, economic } = require('./fixtures/parent-ipo-atomicity');
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/ma-deal-room-webkit');
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const server = http.createServer((req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1));
    assert.ok(file.startsWith(ROOT + path.sep));
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(file));
  } catch (error) { res.statusCode = 404; res.end(String(error)); }
});
async function helpers(page) {
  await page.evaluate(`globalThis.__prepareIPO = (${prepareIPO.toString()}); globalThis.__ipoEconomic = (${economic.toString()});`);
}
async function checkLoaded(page, expected) {
  await helpers(page);
  const actual = await page.evaluate(() => {
    const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
    if (!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok) throw new Error('hydrated IPO accounting invalid');
    return globalThis.__ipoEconomic(e.g);
  });
  assert.deepEqual(actual, expected, 'actual browser hydration includes both PE effects, cash, shares, journals, RNG and mission state');
}
(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`, results = [];
  let browser;
  try {
    browser = await webkit.launch();
    for (const fault of ['save-false', 'mirror', 'enqueue-false', 'save-throw', 'saved', 'change', 'pe-exit', 'network', 'pending-change', 'pending-network', 'normal']) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' }); await helpers(page);
      const proof = await page.evaluate(async fault => {
        const m = globalThis.__capitalismTycoonModules, key = m.engine.SAVE_KEY;
        if (!m.engine.TycoonEngine.prototype.__peNetworkSourcingInstalled) throw new Error('final IPO wrapper missing');
        const e = globalThis.__prepareIPO(m), project = globalThis.__ipoEconomic;
        if (!e.save()) throw new Error('baseline save failed'); await m.saveStorageIDB.flush();
        const durable = () => new Promise((resolve, reject) => {
          const open = indexedDB.open('capitalism-tycoon', 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get(key);
            tx.oncomplete = () => { const value = get.result; db.close(); resolve(value); };
            tx.onerror = () => reject(tx.error);
          };
        });
        const originalDurable = await durable(), puts = [], basePut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, k) {
          if (this.name === 'saves' && k === key) puts.push(String(value));
          return basePut.call(this, value, k);
        };
        const pending = fault.startsWith('pending-'), kind = pending ? fault.slice(8) : fault;
        // Do not yield: this accepted predecessor remains in the real IDB pending queue at IPO entry.
        if (pending && !e.save()) throw new Error('prior pending save rejected');
        const before = JSON.stringify(e.g), bytes = localStorage.getItem(key), baseline = project(e.g);
        const save = e.save, emit = e.emit, setItem = Storage.prototype.setItem;
        const backend = m.saveStorageIDB, push = Array.prototype.push;
        let hits = 0, returned = null, error = null;
        if (kind === 'save-false') e.save = () => { hits++; return false; };
        if (kind === 'mirror') Storage.prototype.setItem = function (k, value) {
          if (this === localStorage && k === key) { hits++; throw new DOMException('IPO mirror rejected', 'SecurityError'); }
          return setItem.call(this, k, value);
        };
        if (kind === 'enqueue-false') m.saveStorageIDB = { ...backend, writeSync(k, value) {
          backend.writeSync(k, value); hits++; return false;
        } };
        if (kind === 'save-throw') e.save = function (...args) {
          const r = save.apply(this, args);
          if (!this.inTransaction()) { hits++; throw new Error('IPO save accepted then threw'); } return r;
        };
        if (kind === 'saved' || kind === 'change') e.emit = function (type, ...args) {
          if (type === kind && !this.inTransaction()) { hits++; throw new Error(`IPO ${kind} threw`); }
          return emit.call(this, type, ...args);
        };
        if (kind === 'network' || kind === 'pe-exit') Array.prototype.push = function (...args) {
          const target = this === (kind === 'network' ? e.g.peNetwork.nodes : e.g.peFirm.trackRecord.exits);
          const r = push.apply(this, args);
          if (target) { hits++; throw new Error(`IPO ${kind} appended then threw`); } return r;
        };
        try { returned = e.executeIPO('東証グロース'); } catch (ex) { error = ex.stack; }
        finally {
          e.save = save; e.emit = emit; Storage.prototype.setItem = setItem;
          m.saveStorageIDB = backend; Array.prototype.push = push;
        }
        const isNormal = kind === 'normal';
        if (isNormal) {
          if (returned !== true || error || e.g.peNetwork.nodes.length !== baseline.peNetwork.nodes.length + 1)
            throw new Error('normal IPO did not commit both effects');
          if (JSON.stringify(project(JSON.parse(backend.readSync(key)))) !== JSON.stringify(project(e.g)))
            throw new Error('normal saved IPO omits economic state / underwriter node');
        } else {
          if (!hits || (['save-false', 'mirror', 'enqueue-false'].includes(kind) ? returned !== false || error : !error))
            throw new Error(`fault did not reject: ${JSON.stringify({ fault, hits, returned, error })}`);
          if (JSON.stringify(e.g) !== before || localStorage.getItem(key) !== bytes || backend.readSync(key) !== bytes)
            throw new Error(`failed IPO was not fully restored: ${fault}`);
        }
        await backend.flush();
        const finalDurable = await durable(); IDBObjectStore.prototype.put = basePut;
        if (finalDurable !== (isNormal ? backend.readSync(key) : bytes)) throw new Error('durable IPO mismatch after flush');
        if (!isNormal && (puts.length !== (pending ? 1 : 0) || puts.some(raw => JSON.parse(raw).publicCompany)))
          throw new Error('rejected IPO survived in a queued real IDB put');
        if (!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok) throw new Error('IPO accounting invalid');
        const normalized = new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g)));
        const expected = project(normalized.g);
        if (JSON.stringify(project(m.engine.TycoonEngine.load().g)) !== JSON.stringify(expected)) throw new Error('production load mismatch');
        return { fault, hits, returned, error, pending, queuedPutCount: puts.length,
          priorDurableSequence: JSON.parse(originalDurable).saveSequence,
          finalSequence: JSON.parse(finalDurable).saveSequence, expected };
      }, fault);
      await page.reload({ waitUntil: 'networkidle' }); await checkLoaded(page, proof.expected);
      // Real IndexedDB snapshot only; remove the mirror to prove authoritative fresh-context hydration.
      const storageState = await context.storageState({ indexedDB: true });
      for (const origin of storageState.origins) origin.localStorage = [];
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' }); await checkLoaded(freshPage, proof.expected);
      results.push({ ...proof, reload: 'PASS', freshDurableOnlyBrowserContext: 'PASS' });
      console.log(`iPhone WebKit parent IPO ${fault} / reload / fresh real IDB PASS`);
      await fresh.close(); await context.close();
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'parent-ipo-atomicity-result.json'), JSON.stringify({ device: 'iPhone 13', physicalDevice: false, ok: true, results }, null, 2));
    console.log('iPhone WebKit parent IPO atomicity and fresh IndexedDB hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
