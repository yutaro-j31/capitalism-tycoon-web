'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const { inject } = require('./fixtures/pe-fund-acquisition-faults');
const { FAULT_KINDS, SOFT_FAILURES } = require('./helpers/transaction-fault-case');
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
// Runs in the actual page against its installed modules: one installed investor offer acceptance under one fault.
const investorOfferCase = async ({ fault, pending, nested, soft, mutation }) => {
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
        if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
        // A pending predecessor is queued in this task, before any microtask can start its durable write.
        if (pending && !e.save()) throw new Error('pending predecessor rejected');
        const before = JSON.stringify(e.g), bytes = localStorage.getItem(key);
        let injection, result = null, thrown = false;
        if (fault === 'save-before-throw') {
          const save = e.save; let hits = 0;
          e.save = () => { hits++; throw new Error('investor offer acceptance save before admission threw'); };
          injection = { hits: () => hits, restore() { e.save = save; } };
        } else injection = globalThis.__injectInvestorFault(e, m, localStorage, key, fault);
        try { result = nested ? e.runTransaction(() => e.acceptInvestorOffer(offer.id)) : e.acceptInvestorOffer(offer.id); }
        catch (_) { thrown = true; }
        finally { injection.restore(); }
        await m.saveStorageIDB.flush();
        if (!(injection.hits() > 0)) throw new Error(`fault not reached: ${fault}`);
        // The durable copy ends as the last accepted save: the pending predecessor when there is one, else the baseline.
        const rollback = JSON.stringify(e.g) === before && localStorage.getItem(key) === bytes
          && m.saveStorageIDB.readSync(key) === bytes && await durable() === bytes;
        if (!rollback || (soft.includes(fault) ? result !== false || thrown : !thrown))
          throw new Error(`failure boundary did not roll back: ${JSON.stringify({ fault, pending, nested, rollback, result, thrown })}`);
        if (!e.save() || !e.save()) throw new Error('subsequent save failed');
        await m.saveStorageIDB.flush();
        return { fault, pending, nested, rollback, returned: result, thrown, shares, expectedShares, nextSequence: JSON.parse(await durable()).saveSequence };
};
(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  const results = [];
  try {
    browser = await webkit.launch();
    // P3-4 G06: the shared fault set in real WebKit, plus pending-predecessor and nested-transaction variants of the
    // rejected and the admitted save. Every kind is reached by the installed investor offer acceptance.
    const cases = FAULT_KINDS.map(fault => ({ fault, pending: false, nested: false }));
    for (const fault of ['save-false', 'save-throw']) cases.push({ fault, pending: true, nested: false }, { fault, pending: false, nested: true });
    for (const { fault, pending, nested } of cases) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: 'globalThis.__injectInvestorFault=' + inject.toString() + ';' });
      const proof = await page.evaluate(investorOfferCase, { fault, pending, nested, soft: SOFT_FAILURES, mutation: null });
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
    // Negative control: with the transaction rollback disabled, the same oracle must reject the boundary.
    {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: 'globalThis.__injectInvestorFault=' + inject.toString() + ';' });
      await assert.rejects(page.evaluate(investorOfferCase, { fault: 'save-false', pending: false, nested: false, soft: SOFT_FAILURES, mutation: 'rollback' }),
        /did not roll back/, 'a disabled rollback is rejected');
      results.push({ mutation: 'rollback disabled rejected', pass: true });
      await context.close();
    }
    // P3-4 G35: the auxiliary offer commands (refresh, decline) under the same fault set in the same browser.
    await require('./investor-offer-aux-webkit-case').run({ browser, url, options, inject, FAULT_KINDS, SOFT_FAILURES, results });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'investor-offer-atomicity-result.json'), JSON.stringify({ device: 'iPhone 13', ok: true, results }, null, 2));
    console.log('iPhone WebKit investor-offer save/rollback and fresh IndexedDB hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
