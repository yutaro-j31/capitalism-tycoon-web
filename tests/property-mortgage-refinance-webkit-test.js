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
    // #1079: real iPhone WebKit save rollback and fresh IndexedDB-only hydration of weekly shortfalls.
    for (const owner of ['personal', 'company']) for (const fault of ['none', 'save-false', 'save-throw', 'post-save-throw']) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const expected = await page.evaluate(async ({ owner, fault }) => {
        const m = globalThis.__capitalismTycoonModules, state = m.engine.createInitialState({ configured: true });
        Object.assign(state, { week: 10, companyCash: 400000000, personalCash: 400000000, companyDebt: 0, personalDebt: 7000000 });
        state.properties = [{ ...state.properties[0], id: 'shortfall-webkit', owner, marketValue: 300000000, value: 300000000,
          purchasePrice: 300000000, mortgageBalance: 0, mortgageProductID: '', mortgageRemainingWeeks: 0,
          realEstate: { landBookValue: 100000000, buildingBookValue: 200000000, landValue: 100000000, buildingValue: 200000000 } }];
        state.finance = m.finance.defaultFinanceState(state);
        const e = new m.engine.TycoonEngine(state), key = m.engine.SAVE_KEY;
        if (!e.refinancePropertyMortgage('shortfall-webkit', 'fixed')) throw new Error('origination failed');
        e.g.week++;
        if (owner === 'company') m.finance.event(e.g, 'otherOperating', e.g.companyCash,
          { cashEffect: -e.g.companyCash, profitEffect: -e.g.companyCash, sourceType: 'shortfall-fixture' });
        e.g[owner === 'company' ? 'companyCash' : 'personalCash'] = 0;
        if (!e.save()) throw new Error('baseline save failed'); await m.saveStorageIDB.flush();
        const before = JSON.stringify(e.g), mirror = localStorage.getItem(key), save = e.save;
        if (fault !== 'none') e.save = function (...args) {
          if (fault === 'save-false') return false;
          if (fault === 'save-throw') throw new Error('injected shortfall save');
          save.apply(this, args); throw new Error('injected shortfall post-save');
        };
        let result, thrown = false;
        try { result = e.runTransaction(() => {
          m.realEstateMortgageRefinancing.processWeek(e);
          if (!m.finance.validate(e.g).ok || !m.finance.debtRollforwardStatus(e.g).ok) throw new Error('shortfall books incorrect');
          return true;
        }); }
        catch (_) { thrown = true; } finally { e.save = save; }
        await m.saveStorageIDB.flush();
        if (fault !== 'none') {
          if (JSON.stringify(e.g) !== before || localStorage.getItem(key) !== mirror || m.saveStorageIDB.readSync(key) !== mirror)
            throw new Error('shortfall failure changed live/mirror/cache');
          if (fault === 'save-false' ? result !== false || thrown : !thrown) throw new Error('shortfall fault not exercised');
        } else {
          const p = e.g.properties[0];
          if (result !== true || thrown || p.mortgageRemainingWeeks !== 520 || p.mortgageDelinquentWeeks !== 1 ||
            p.mortgageUnpaidInterest !== (owner === 'personal' ? 120000 : 0) ||
            p.mortgageBalance !== (owner === 'personal' ? 195000000 : 195120000)) throw new Error('shortfall state incorrect');
        }
        // Loading clears derived statement/validation caches; compare the identical normalization path.
        const loaded = new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g)));
        return JSON.parse(JSON.stringify({ property: loaded.g.properties[0], finance: loaded.g.finance, companyCash: loaded.g.companyCash,
          personalCash: loaded.g.personalCash, companyDebt: loaded.g.companyDebt, personalDebt: loaded.g.personalDebt, saveVersion: loaded.g.saveVersion }));
      }, { owner, fault });
      const storageState = await context.storageState({ indexedDB: true });
      for (const origin of storageState.origins) origin.localStorage = [];
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' });
      const hydrated = await freshPage.evaluate(async () => {
        const m = globalThis.__capitalismTycoonModules; await m.saveStorageIDB.hydrate();
        const e = m.engine.TycoonEngine.load();
        return JSON.parse(JSON.stringify({ property: e.g.properties.find(p => p.id === 'shortfall-webkit'), finance: e.g.finance,
          companyCash: e.g.companyCash, personalCash: e.g.personalCash, companyDebt: e.g.companyDebt,
          personalDebt: e.g.personalDebt, saveVersion: e.g.saveVersion }));
      });
      assert.deepEqual(hydrated, expected, `${owner}/${fault}: shortfall durable-only fresh context`);
      await fresh.close(); await context.close();
    }
    console.log('iPhone WebKit mortgage refinance/shortfall rollback and durable-only hydration PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
