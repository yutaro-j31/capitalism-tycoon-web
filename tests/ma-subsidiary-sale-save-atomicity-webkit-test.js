'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const { prepareSale, economic } = require('./fixtures/ma-subsidiary-sale-atomicity');
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
  await page.evaluate(`globalThis.__prepareSale = (${prepareSale.toString()}); globalThis.__saleEconomic = (${economic.toString()});`);
}
async function checkLoaded(page, expected) {
  await helpers(page);
  const actual = await page.evaluate(async () => {
    const m = globalThis.__capitalismTycoonModules;
    await m.saveStorageIDB.hydrate(); // Fresh contexts have no mirror: explicitly wait for IDB.
    const e = m.engine.TycoonEngine.load();
    if (!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok) throw new Error('hydrated sale accounting invalid');
    return globalThis.__saleEconomic(e.g);
  });
  assert.deepEqual(actual, expected, 'real hydration preserves subsidiary, goodwill, cash, journal and RNG');
}
(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`, results = [];
  let browser;
  try {
    browser = await webkit.launch();
    for (const fault of ['save-false', 'mirror', 'enqueue-false', 'save-throw', 'saved', 'change', 'notify', 'pending-save-false', 'pending-change', 'normal']) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' }); await helpers(page);
      const proof = await page.evaluate(async fault => {
        const m = globalThis.__capitalismTycoonModules, key = m.engine.SAVE_KEY;
        const e = globalThis.__prepareSale(m, fault === 'normal' ? 2 : 1), project = globalThis.__saleEconomic;
        await m.saveStorageIDB.hydrate();
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
        // No yield: predecessor stays queued while the sale is invoked.
        if (pending && !e.save()) throw new Error('prior pending save rejected');
        const before = JSON.stringify(e.g), bytes = localStorage.getItem(key), baseline = project(e.g);
        const save = e.save, emit = e.emit, setItem = Storage.prototype.setItem, backend = m.saveStorageIDB;
        let hits = 0, returned = null, error = null;
        if (kind === 'save-false') e.save = () => { hits++; return false; };
        if (kind === 'mirror') Storage.prototype.setItem = function (k, value) {
          if (this === localStorage && k === key) { hits++; throw new DOMException('MA sale mirror rejected', 'SecurityError'); }
          return setItem.call(this, k, value);
        };
        if (kind === 'enqueue-false') m.saveStorageIDB = { ...backend, writeSync(k, value) {
          backend.writeSync(k, value); hits++; return false;
        } };
        if (kind === 'save-throw') e.save = function (...args) {
          const r = save.apply(this, args);
          if (!this.inTransaction()) { hits++; throw new Error('MA sale save accepted then threw'); } return r;
        };
        if (['saved', 'change', 'notify'].includes(kind)) e.emit = function (type = 'change', ...args) {
          if (type === kind && (kind === 'notify' || !this.inTransaction())) { hits++; throw new Error(`MA sale ${kind} threw`); }
          return emit.call(this, type, ...args);
        };
        const id = e.g.maSubsidiaries[0].id, events = [];
        if (kind === 'normal') for (const type of ['notify', 'saved', 'change']) e.addEventListener(type, () => events.push(type));
        try { returned = e.sellMASubsidiary(id); } catch (ex) { error = { message: ex.message, stack: ex.stack }; }
        finally { e.save = save; e.emit = emit; Storage.prototype.setItem = setItem; m.saveStorageIDB = backend; }
        const isNormal = kind === 'normal';
        if (isNormal) {
          if (returned !== true || error || e.g.maSubsidiaries.length !== baseline.maSubsidiaries.length - 1 || e.g.personalCash !== baseline.personalCash)
            throw new Error('normal sale did not commit company disposal');
          if (JSON.stringify(events) !== JSON.stringify(['notify', 'saved', 'change'])) throw new Error('normal event order changed');
          const completed = JSON.stringify(e.g), stored = backend.readSync(key);
          if (e.sellMASubsidiary(id) !== false || JSON.stringify(e.g) !== completed || backend.readSync(key) !== stored)
            throw new Error('duplicate sale changed state or save');
          if (e.sellMASubsidiary(e.g.maSubsidiaries[0].id) !== true || e.g.maSubsidiaries.length !== 0) throw new Error('consecutive sale failed');
          if (JSON.stringify(project(JSON.parse(backend.readSync(key)))) !== JSON.stringify(project(e.g))) throw new Error('normal stored sale mismatch');
        } else {
          if (!hits || (['save-false', 'mirror', 'enqueue-false'].includes(kind) ? returned !== false || error : !error))
            throw new Error(`fault did not reject: ${JSON.stringify({ fault, hits, returned, error })}`);
          if (JSON.stringify(e.g) !== before || localStorage.getItem(key) !== bytes || backend.readSync(key) !== bytes)
            throw new Error(`failed sale was not fully restored: ${fault}`);
        }
        await backend.flush();
        const finalDurable = await durable(); IDBObjectStore.prototype.put = basePut;
        if (finalDurable !== (isNormal ? backend.readSync(key) : bytes)) throw new Error('durable sale mismatch after flush');
        if (!isNormal && (puts.length !== (pending ? 1 : 0) || puts.some(raw => JSON.parse(raw).maSubsidiaries.length !== 1)))
          throw new Error('rejected sale survived in a queued real IDB put');
        if (isNormal && puts.length !== 2) throw new Error('normal/duplicate/consecutive sales must save exactly twice');
        if (!isNormal) {
          // Recovery save from the ORIGINAL rolled-back live instance must not resurrect the sale.
          if (!e.save()) throw new Error('later normal save rejected'); await backend.flush();
          if (JSON.parse(await durable()).maSubsidiaries.length !== 1) throw new Error('later save revived failed sale');
        }
        if (!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok) throw new Error('sale accounting invalid');
        if (key !== 'capitalism_tycoon_web_v1' || e.g.saveVersion !== 9) throw new Error('save identity changed');
        const expected = project(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g);
        if (JSON.stringify(project(m.engine.TycoonEngine.load().g)) !== JSON.stringify(expected)) throw new Error('production load mismatch');
        return { fault, hits, returned, error, pending, rejectedBoundaryPutCount: puts.length,
          priorDurableSequence: JSON.parse(originalDurable).saveSequence,
          boundaryFinalSequence: JSON.parse(finalDurable).saveSequence, expected };
      }, fault);
      await page.reload({ waitUntil: 'networkidle' }); await checkLoaded(page, proof.expected);
      const storageState = await context.storageState({ indexedDB: true });
      for (const origin of storageState.origins) origin.localStorage = [];
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' }); await checkLoaded(freshPage, proof.expected);
      results.push({ ...proof, reload: 'PASS', freshDurableOnlyBrowserContext: 'PASS' });
      console.log(`iPhone WebKit MA subsidiary sale ${fault} / reload / fresh real IDB PASS`);
      await fresh.close(); await context.close();
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'ma-subsidiary-sale-atomicity-result.json'), JSON.stringify({ device: 'iPhone 13', physicalDevice: false, ok: true, results }, null, 2));
    console.log('iPhone WebKit MA subsidiary sale atomicity and fresh IndexedDB hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
