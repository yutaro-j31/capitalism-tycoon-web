'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
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
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await webkit.launch();
    for (const fault of ['lower-target', 'save-false', 'save-throw', 'post-save-throw']) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const expected = await page.evaluate(async fault => {
        const m = globalThis.__capitalismTycoonModules, state = m.engine.createInitialState({ configured: true });
        const old = fault === 'lower-target' ? 216_000_000 : 0;
        Object.assign(state, { week: 10, companyCash: 100_000_000, personalCash: 100_000_000, companyDebt: 0, personalDebt: 0 });
        state.properties = [{ ...state.properties[0], id: 'mortgage-regression', owner: 'personal',
          marketValue: 300_000_000, purchasePrice: 300_000_000, value: 300_000_000,
          mortgageBalance: old, mortgageProductID: old ? 'variable' : '', mortgageRemainingWeeks: old ? 416 : 0 }];
        state.finance = m.finance.defaultFinanceState(state);
        const e = new m.engine.TycoonEngine(state), key = m.engine.SAVE_KEY;
        if (!e.save()) throw new Error('baseline save failed'); await m.saveStorageIDB.flush();
        const before = JSON.stringify(e.g), mirror = localStorage.getItem(key);
        const save = e.save; let injected = false, result, thrown = false;
        if (fault !== 'lower-target') e.save = function (...args) {
          injected = true;
          if (fault === 'save-false') return false;
          if (fault === 'save-throw') throw new Error('injected save throw');
          save.apply(this, args); throw new Error('injected post-save throw');
        };
        try { result = e.refinancePropertyMortgage('mortgage-regression', fault === 'lower-target' ? 'conservative' : 'fixed'); }
        catch (_) { thrown = true; } finally { e.save = save; }
        await m.saveStorageIDB.flush();
        if (JSON.stringify(e.g) !== before || localStorage.getItem(key) !== mirror || m.saveStorageIDB.readSync(key) !== mirror)
          throw new Error('mortgage failure changed live/mirror/cache');
        if (fault === 'lower-target' ? result !== false || thrown : !injected || (fault === 'save-false' ? result !== false || thrown : !thrown))
          throw new Error('fault/rejection not exercised');
        return { mortgageBalance: old, companyCash: 100_000_000, personalCash: 100_000_000, saveVersion: 9 };
      }, fault);
      // IndexedDB export is read from actual WebKit, excluding localStorage to force durable-only hydration.
      const storageState = await context.storageState({ indexedDB: true });
      for (const origin of storageState.origins) origin.localStorage = [];
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' });
      const hydrated = await freshPage.evaluate(async () => {
        const m = globalThis.__capitalismTycoonModules; await m.saveStorageIDB.hydrate();
        const e = m.engine.TycoonEngine.load();
        return { mortgageBalance: e.g.properties.find(p => p.id === 'mortgage-regression').mortgageBalance,
          companyCash: e.g.companyCash, personalCash: e.g.personalCash, saveVersion: e.g.saveVersion };
      });
      assert.deepEqual(hydrated, expected, `${fault}: durable-only fresh context`);
      await fresh.close(); await context.close();
    }
    console.log('iPhone WebKit mortgage refinance rejection/rollback and durable-only hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
