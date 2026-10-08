'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/ma-deal-room-webkit');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const server = http.createServer((req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1));
    assert.ok(file.startsWith(ROOT + path.sep));
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(file));
  } catch (error) { res.statusCode = 404; res.end(String(error)); }
});
async function checkLoaded(page, expectedShares, expectedStatus) {
  const data = await page.evaluate(() => {
    const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
    return { shares: e.g.sharesOut, status: e.g.investorOffers[0].status, valid: m.finance.validate(e.g).ok };
  });
  assert.equal(data.shares, expectedShares); assert.equal(data.status, expectedStatus); assert.equal(data.valid, true);
}
(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  const results = [];
  try {
    browser = await webkit.launch();
    for (const fault of ['mirror', 'change']) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const proof = await page.evaluate(async fault => {
        const m = globalThis.__capitalismTycoonModules, e = new m.engine.TycoonEngine(), key = m.engine.SAVE_KEY;
        e.g.configured = true;
        const office = e.g.rentalOffices.reduce((a, b) => a.deposit < b.deposit ? a : b);
        if (!e.contractOffice(office.id) || !e.refreshInvestorOffers() || !e.save()) throw new Error('baseline office/offer/save failed');
        const offer = e.g.investorOffers[0], shares = e.g.sharesOut;
        const expectedShares = shares + Math.max(1, Math.round(shares * offer.amount / offer.preMoneyValuation));
        await m.saveStorageIDB.flush();
        const durable = () => new Promise((resolve, reject) => {
          const open = indexedDB.open('capitalism-tycoon', 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get(key);
            tx.oncomplete = () => { const value = get.result; db.close(); resolve(value); };
            tx.onerror = () => reject(tx.error);
          };
        });
        const before = JSON.stringify(e.g), bytes = localStorage.getItem(key), priorDurable = await durable();
        let injected = false, result = null, thrown = false;
        const emit = e.emit, setItem = Storage.prototype.setItem;
        if (fault === 'mirror') Storage.prototype.setItem = function (k, value) {
          if (this === localStorage && k === key && !injected) { injected = true; throw new DOMException('injected save rejection', 'SecurityError'); }
          return setItem.call(this, k, value);
        };
        else e.emit = function (type, ...args) {
          if (type === undefined || type === 'change') { injected = true; throw new Error('injected post-save change failure'); }
          return emit.call(this, type, ...args);
        };
        try { result = e.acceptInvestorOffer(offer.id); } catch (_) { thrown = true; }
        finally { Storage.prototype.setItem = setItem; e.emit = emit; }
        await m.saveStorageIDB.flush();
        const rollback = JSON.stringify(e.g) === before && localStorage.getItem(key) === bytes
          && m.saveStorageIDB.readSync(key) === bytes && await durable() === priorDurable;
        if (!injected || !rollback || (fault === 'mirror' ? result !== false || thrown : !thrown))
          throw new Error(`failure boundary did not roll back: ${JSON.stringify({ injected, rollback, result, thrown })}`);
        if (!e.save() || !e.save()) throw new Error('subsequent save failed');
        await m.saveStorageIDB.flush();
        return { fault, injected, rollback, returned: result, thrown, shares, expectedShares, nextSequence: JSON.parse(await durable()).saveSequence };
      }, fault);
      results.push(proof);
      await page.reload({ waitUntil: 'networkidle' }); await checkLoaded(page, proof.shares, 'pending');
      // Playwright exports both real IndexedDB and mirror bytes, then boots a new browser context.
      const storageState = await context.storageState({ indexedDB: true });
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' }); await checkLoaded(freshPage, proof.shares, 'pending');
      const normal = await freshPage.evaluate(async () => {
        const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
        const offer = e.g.investorOffers[0], ok = e.acceptInvestorOffer(offer.id), duplicate = e.acceptInvestorOffer(offer.id);
        await m.saveStorageIDB.flush();
        return { ok, duplicate, equity: e.g.finance.transactions.filter(t => t.sourceType === 'investorOffer' && t.sourceID === offer.id).length };
      });
      assert.deepEqual(normal, { ok: true, duplicate: false, equity: 1 });
      await freshPage.reload({ waitUntil: 'networkidle' }); await checkLoaded(freshPage, proof.expectedShares, 'accepted');
      await fresh.close(); await context.close();
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'investor-offer-atomicity-result.json'), JSON.stringify({ device: 'iPhone 13', ok: true, results }, null, 2));
    console.log('iPhone WebKit investor-offer save/rollback and fresh IndexedDB hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
