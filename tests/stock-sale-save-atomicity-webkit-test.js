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
async function checkLoaded(page, account, expected) {
  const data = await page.evaluate(account => {
    const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
    const key = account === 'company' ? 'companyStocks' : 'personalStocks';
    return { qty: e.g[key].CPTY.qty, avg: e.g[key].CPTY.avg,
      cash: e.g[account === 'company' ? 'companyCash' : 'personalCash'],
      pl: e.g[account === 'company' ? 'realizedCompanyStockPL' : 'realizedPersonalStockPL'],
      price: e.stock('CPTY').price, receipts: e.g.finance.transactions.length,
      otherCash: e.g[account === 'company' ? 'personalCash' : 'companyCash'],
      shares: e.g.sharesOut, founder: e.g.founderShares,
      valid: m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok };
  }, account);
  assert.deepEqual(data, { ...expected, otherCash: account === 'company' ? 2000000 : 100000000,
    shares: 1000000, founder: 600000, valid: true });
}
// Runs in the actual page against its installed modules: one installed sale under one fault.
const saleCase = async ({ fault, account, pending, nested, soft, mutation }) => {
        const m = globalThis.__capitalismTycoonModules, key = m.engine.SAVE_KEY;
        // Valid listed-company fixture; the command under test is the installed stock sale.
        const state = m.engine.createInitialState({ configured: true });
        Object.assign(state, { week: 12, companyCash: 100000000, companyDebt: 0, publicCompany: true,
          sharesOut: 1000000, founderShares: 600000, treasuryBuybackShares: 0, stockPrice: 100, ticker: 'CPTY' });
        state.market = state.market.filter(x => x.id !== 'CPTY');
        state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100, previous: 100,
          dividendYield: 0, volatility: 0, trend: 0, marketCap: 100000000, per: 20, pbr: 2, issuedShares: 1000000,
          dividendPerShare: 0, shareholders: {}, description: 'fixture', listingMarket: '東証グロース',
          priceHistory: [{ week: 12, price: 100 }] });
        state.personalStocks.CPTY = { qty: 20000, avg: 100 };
        if (account === 'company') { state.departments.investment = true; state.companyStocks.CPTY = { qty: 20000, avg: 100 }; }
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
          e.save = () => { hits++; throw new Error('sale save before admission threw'); };
          injection = { hits: () => hits, restore() { e.save = save; } };
        } else injection = globalThis.__injectSaleFault(e, m, localStorage, key, fault);
        try { result = nested ? e.runTransaction(() => e.sellStock('CPTY', 1000, account)) : e.sellStock('CPTY', 1000, account); }
        catch (_) { thrown = true; }
        finally { injection.restore(); }
        await m.saveStorageIDB.flush();
        if (!(injection.hits() > 0)) throw new Error(`fault not reached: ${fault}`);
        // The durable copy ends as the last accepted save: the pending predecessor when there is one, else the baseline.
        const rollback = JSON.stringify(e.g) === before && localStorage.getItem(key) === bytes
          && m.saveStorageIDB.readSync(key) === bytes && await durable() === bytes;
        if (!rollback || (soft.includes(fault) ? result !== false || thrown : !thrown))
          throw new Error(`failure boundary did not roll back: ${JSON.stringify({ account, fault, pending, nested, rollback, result, thrown })}`);
        if (!e.save() || !e.save()) throw new Error('subsequent save failed');
        await m.saveStorageIDB.flush();
        return { account, fault, pending, nested, rollback, returned: result, thrown, nextSequence: JSON.parse(await durable()).saveSequence };
};
(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  const results = [];
  try {
    browser = await webkit.launch();
    // P3-4 G04: the shared fault set in real WebKit for both accounts, plus pending-predecessor and nested-transaction
    // variants of the rejected and the admitted save (personal account). Every kind is reached by the installed sale.
    const cases = [];
    for (const account of ['personal', 'company']) for (const fault of FAULT_KINDS) cases.push({ account, fault, pending: false, nested: false });
    for (const fault of ['save-false', 'save-throw']) cases.push({ account: 'personal', fault, pending: true, nested: false }, { account: 'personal', fault, pending: false, nested: true });
    for (const { account, fault, pending, nested } of cases) {
      const baseline = { qty: 20000, avg: 100, cash: account === 'company' ? 100000000 : 2000000, pl: 0, price: 100, receipts: 0 };
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: 'globalThis.__injectSaleFault=' + inject.toString() + ';' });
      const proof = await page.evaluate(saleCase, { fault, account, pending, nested, soft: SOFT_FAILURES, mutation: null });
      results.push(proof);
      await page.reload({ waitUntil: 'networkidle' }); await checkLoaded(page, account, baseline);
      // Playwright exports both real IndexedDB and mirror bytes, then boots a new browser context.
      const storageState = await context.storageState({ indexedDB: true });
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' }); await checkLoaded(freshPage, account, baseline);
      const normal = await freshPage.evaluate(async account => {
        const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
        const key = account === 'company' ? 'companyStocks' : 'personalStocks';
        const baseCash = e.g[account === 'company' ? 'companyCash' : 'personalCash'];
        const firstQuote = m.engine.stockOrderQuote(e.stock('CPTY'), 1000, 'sell');
        const first = e.sellStock('CPTY', 1000, account);
        const secondQuote = m.engine.stockOrderQuote(e.stock('CPTY'), 1000, 'sell');
        const second = e.sellStock('CPTY', 1000, account);
        const buyQuote = m.engine.stockOrderQuote(e.stock('CPTY'), 1000, 'buy');
        const bought = e.buyStock('CPTY', 1000, account);
        const expectedAvg = (18000 * 100 + buyQuote.cashAmount) / 19000;
        const thirdQuote = m.engine.stockOrderQuote(e.stock('CPTY'), 1000, 'sell');
        const third = e.sellStock('CPTY', 1000, account);
        const invalid = e.sellStock('CPTY', 0, account), excess = e.sellStock('CPTY', 18001, account);
        await m.saveStorageIDB.flush();
        return { first, second, bought, third, invalid, excess,
          expected: { qty: 18000, avg: expectedAvg,
            cash: baseCash + firstQuote.cashAmount + secondQuote.cashAmount - buyQuote.cashAmount + thirdQuote.cashAmount,
            pl: (firstQuote.cashAmount - 100000) + (secondQuote.cashAmount - 100000) + (thirdQuote.cashAmount - expectedAvg * 1000),
            price: thirdQuote.quoteAfter, receipts: account === 'company' ? 4 : 0 },
          actual: { qty: e.g[key].CPTY.qty, avg: e.g[key].CPTY.avg,
            cash: e.g[account === 'company' ? 'companyCash' : 'personalCash'],
            pl: e.g[account === 'company' ? 'realizedCompanyStockPL' : 'realizedPersonalStockPL'],
            price: e.stock('CPTY').price, receipts: e.g.finance.transactions.length } };
      }, account);
      for (const name of ['first', 'second', 'bought', 'third']) assert.equal(normal[name], true);
      assert.equal(normal.invalid, false); assert.equal(normal.excess, false);
      assert.deepEqual(normal.actual, normal.expected);
      await freshPage.reload({ waitUntil: 'networkidle' }); await checkLoaded(freshPage, account, normal.expected);
      await fresh.close(); await context.close();
    }
    // Negative control: with the transaction rollback disabled, the same oracle must reject the sale boundary.
    {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: 'globalThis.__injectSaleFault=' + inject.toString() + ';' });
      await assert.rejects(page.evaluate(saleCase, { fault: 'save-false', account: 'personal', pending: false, nested: false, soft: SOFT_FAILURES, mutation: 'rollback' }),
        /did not roll back/, 'a disabled rollback is rejected');
      results.push({ mutation: 'rollback disabled rejected', pass: true });
      await context.close();
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'stock-sale-atomicity-result.json'), JSON.stringify({ device: 'iPhone 13', ok: true, results }, null, 2));
    console.log('iPhone WebKit stock-sale save/rollback and fresh IndexedDB hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
