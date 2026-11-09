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
async function checkLoaded(page, qty, personalCash, price, avg) {
  const data = await page.evaluate(() => {
    const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
    return { qty: e.g.personalStocks.CPTY.qty, avg: e.g.personalStocks.CPTY.avg,
      personalCash: e.g.personalCash, price: e.stock('CPTY').price,
      shares: e.g.sharesOut, founder: e.g.founderShares, companyCash: e.g.companyCash,
      receipts: e.g.finance.transactions.length, valid: m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok };
  });
  assert.deepEqual(data, { qty, avg, personalCash, price, shares: 1000000, founder: 600000,
    companyCash: 100000000, receipts: 0, valid: true });
}
// Runs in the actual page against its installed modules: one installed purchase under one fault.
const purchaseCase = async ({ kind: fault, pending, nested, soft, mutation }) => {
        const m = globalThis.__capitalismTycoonModules, key = m.engine.SAVE_KEY;
        // Valid listed-company fixture; the command under test is the installed stock purchase.
        const state = m.engine.createInitialState({ configured: true });
        Object.assign(state, { week: 12, companyCash: 100000000, companyDebt: 0, publicCompany: true,
          sharesOut: 1000000, founderShares: 600000, treasuryBuybackShares: 0, stockPrice: 100, ticker: 'CPTY' });
        state.market = state.market.filter(x => x.id !== 'CPTY');
        state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100, previous: 100,
          dividendYield: 0, volatility: 0, trend: 0, marketCap: 100000000, per: 20, pbr: 2, issuedShares: 1000000,
          dividendPerShare: 0, shareholders: {}, description: 'fixture', listingMarket: '東証グロース',
          priceHistory: [{ week: 12, price: 100 }] });
        state.personalStocks.CPTY = { qty: 20000, avg: 100 };
        state.finance = m.finance.defaultFinanceState(state);
        const e = new m.engine.TycoonEngine(state);
        if (!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok || !e.save()) throw new Error('baseline failed');
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
          e.save = () => { hits++; throw new Error('purchase save before admission threw'); };
          injection = { hits: () => hits, restore() { e.save = save; } };
        } else injection = globalThis.__injectPurchaseFault(e, m, localStorage, key, fault);
        try { result = nested ? e.runTransaction(() => e.buyStock('CPTY', 1000, 'personal')) : e.buyStock('CPTY', 1000, 'personal'); }
        catch (_) { thrown = true; }
        finally { injection.restore(); }
        await m.saveStorageIDB.flush();
        const injected = injection.hits() > 0;
        // The durable copy ends as the last accepted save: the pending predecessor when there is one, else the baseline.
        const rollback = JSON.stringify(e.g) === before && localStorage.getItem(key) === bytes
          && m.saveStorageIDB.readSync(key) === bytes && await durable() === bytes;
        if (!injected) throw new Error(`fault not reached: ${fault}`);
        if (!rollback || (soft.includes(fault) ? result !== false || thrown : !thrown))
          throw new Error(`failure boundary did not roll back: ${JSON.stringify({ fault, pending, nested, rollback, result, thrown })}`);
        if (!e.save() || !e.save()) throw new Error('subsequent save failed');
        await m.saveStorageIDB.flush();
        return { fault, pending, nested, reached: true, rollback, returned: result, thrown, nextSequence: JSON.parse(await durable()).saveSequence };
};
(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  const results = [];
  try {
    browser = await webkit.launch();
    // P3-4 G03: the shared fault set in real WebKit, plus pending-predecessor and nested-transaction variants of the
    // rejected and the admitted save. Every kind is reached by the installed purchase.
    const cases = FAULT_KINDS.map(kind => ({ kind, pending: false, nested: false }));
    for (const kind of ['save-false', 'save-throw']) cases.push({ kind, pending: true, nested: false }, { kind, pending: false, nested: true });
    for (const item of cases) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: 'globalThis.__injectPurchaseFault=' + inject.toString() + ';' });
      const proof = await page.evaluate(purchaseCase, { ...item, soft: SOFT_FAILURES, mutation: null });
      results.push(proof);
      await page.reload({ waitUntil: 'networkidle' }); await checkLoaded(page, 20000, 2000000, 100, 100);
      // Playwright exports both real IndexedDB and mirror bytes, then boots a new browser context.
      const storageState = await context.storageState({ indexedDB: true });
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' }); await checkLoaded(freshPage, 20000, 2000000, 100, 100);
      const normal = await freshPage.evaluate(async () => {
        const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
        const firstQuote = m.engine.stockOrderQuote(e.stock('CPTY'), 1000, 'buy');
        const first = e.buyStock('CPTY', 1000, 'personal');
        const secondQuote = m.engine.stockOrderQuote(e.stock('CPTY'), 1000, 'buy');
        const second = e.buyStock('CPTY', 1000, 'personal');
        const invalid = e.buyStock('CPTY', 0, 'personal');
        await m.saveStorageIDB.flush();
        return { first, second, invalid, qty: e.g.personalStocks.CPTY.qty, treasury: e.g.treasuryBuybackShares,
          cash: e.g.personalCash, avg: e.g.personalStocks.CPTY.avg, price: e.stock('CPTY').price,
          expectedCash: 2000000 - firstQuote.cashAmount - secondQuote.cashAmount,
          expectedAvg: (((2000000 + firstQuote.cashAmount) / 21000) * 21000 + secondQuote.cashAmount) / 22000, expectedPrice: secondQuote.quoteAfter };
      });
      assert.equal(normal.first, true); assert.equal(normal.second, true); assert.equal(normal.invalid, false);
      assert.equal(normal.qty, 22000); assert.equal(normal.treasury, 0);
      assert.equal(normal.cash, normal.expectedCash); assert.equal(normal.avg, normal.expectedAvg);
      assert.equal(normal.price, normal.expectedPrice);
      await freshPage.reload({ waitUntil: 'networkidle' }); await checkLoaded(freshPage, 22000, normal.cash, normal.price, normal.avg);
      await fresh.close(); await context.close();
    }
    // Negative control: with the transaction rollback disabled, the same oracle must reject the purchase boundary.
    {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: 'globalThis.__injectPurchaseFault=' + inject.toString() + ';' });
      await assert.rejects(page.evaluate(purchaseCase, { kind: 'save-false', pending: false, nested: false, soft: SOFT_FAILURES, mutation: 'rollback' }),
        /did not roll back/, 'a disabled rollback is rejected');
      results.push({ mutation: 'rollback disabled rejected', pass: true });
      await context.close();
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'stock-purchase-atomicity-result.json'), JSON.stringify({ device: 'iPhone 13', ok: true, results }, null, 2));
    console.log('iPhone WebKit stock-purchase save/rollback and fresh IndexedDB hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
