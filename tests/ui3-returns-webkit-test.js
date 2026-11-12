'use strict';

// UI v3 shareholder returns on the market screen (docs/ui-v3/README.md 10.3, task UI3-9b-2). Loads the real js/ui3-market.js. Proves in
// a real browser that:
//  - before listing there is no "株主還元" section; after listing it shows the current panel's own numbers (the same capacity read);
//  - "配当を設定" goes through the existing set-dividend action and the amount sheet; the dividend per share becomes what was entered,
//    zero included (no dividend), and the sheet's preview (planned total) is the engine's;
//  - "自社株買い" goes through the existing buyback action and the amount sheet; the company cash falls by exactly the cost of the
//    shares the engine bought (the amount entered when it divides into whole shares), as the sheet previewed;
//  - the buy-back is disabled like the current button (safe amount below one share) and shows why; cancelling changes nothing.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULE = /\/js\/ui3-market\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|market\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const source = fs.readFileSync(path.join(ROOT, 'js', 'ui3-market.js'), 'utf8');
assert.doesNotMatch(source, /Math\.random|MutationObserver|registerUIEnhancer/, 'the market screen uses no RNG, observer or D UI enhancer');
assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the market screen never assigns engine state');
assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage|(?<![\w.])confirm\(/, 'the market screen never saves, stores or uses the browser\'s confirm()');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(index.indexOf('./js/ui3-market.js') > index.indexOf('./js/ui3-shell.js') && index.indexOf('./js/ui3-market.js') < index.indexOf('./js/app.js'), 'index.html loads the script after the shell and before app.js');

function serve() {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      assert.ok(file.startsWith(`${ROOT}${path.sep}`));
      const body = fs.readFileSync(file);
      response.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch (error) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const goTo = (page, tab) => page.evaluate(id => document.querySelector(`[data-action="tab"][data-tab="${id}"]`).click(), tab);
const engineEval = (page, fn, arg) => page.evaluate(([source, value]) => {
  const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
  return (0, eval)(`(${source})`)(engine, value);
}, [fn.toString(), arg]);
const digest = page => engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value)));
// the share-count dialog is the v3 amount sheet (UI3-9a)
const cancelDialog = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
async function enterAmount(page, amount) {
  await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#modal-root [data-ui3-amount-input]').fill(String(amount));
  await page.locator('#modal-root [data-ui3-amount-run]').tap();
}

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}
const metrics = page => page.evaluate(() => {
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
  const controls = [...document.querySelectorAll('#app button,#app a[href],#app input,#app select')].filter(visible);
  let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
  return { small: controls.filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.className || element.tagName),
    minFont, overflowX: document.documentElement.scrollWidth > innerWidth, screens: document.documentElement.scrollHeight / innerHeight };
});
const sheetMetrics = page => page.evaluate(() => {
  const root = document.querySelector('#modal-root .u-sheet');
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const small = [...root.querySelectorAll('button')].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.textContent.trim());
  let minFont = 99; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
  return { small, minFont, bottom: Math.round(root.getBoundingClientRect().bottom), primaries: [...root.querySelectorAll('.u-btn.primary')].filter(visible).length };
});

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async ({ withoutScreen = false } = {}) => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 returns test */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 market screen */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  // a listed company, built the way tests/phase2-buyback-reconciliation-test.js builds it
  const list = page => engineEval(page, engine => {
    const m = globalThis.__capitalismTycoonModules, g = engine.g, price = 100;
    Object.assign(g, { week: 12, companyCash: 500000000, companyDebt: 0, publicCompany: true, sharesOut: 1000000, founderShares: 300000, treasuryBuybackShares: 0, competitorOwnedRatio: 0, stockPrice: price, ticker: 'CPTY', dividendPerShare: 0 });
    g.market = g.market.filter(row => row.id !== 'CPTY');
    g.market.push({ id: 'CPTY', name: g.companyName, sector: 'コングロマリット', price, previous: price, dividendYield: 0, volatility: 0, trend: 0, marketCap: price * 1000000, per: 20, pbr: 2, issuedShares: 1000000, dividendPerShare: 0, shareholders: {}, description: 'test', listingMarket: '東証グロース', priceHistory: [{ week: 12, price }] });
    engine.updateOwnershipRatios();
    g.finance = m.finance.defaultFinanceState(g);
    m.finance.ensureFinance(g);
    engine.emit();
  });
  const compact = (page, amount) => page.evaluate(value => globalThis.__capitalismTycoonModules.engine.compactYen(value), amount);
  const facts = page => engineEval(page, engine => {
    const cap = engine.shareholderReturnCapacity(), g = engine.g;
    return { safe: cap.safeAmount, shares: cap.outstandingShares, max: cap.maxDividendPerShare, cash: g.companyCash, dividend: g.dividendPerShare, treasury: g.treasuryBuybackShares, price: g.stockPrice };
  });
  const cancelSheet = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap();
  const waitCurrentUI = page => page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
  try {
    // 1. Flag off: the current market screen (with its shareholder-returns panel) is unchanged by the presence of the v3 script.
    const current = [];
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      await list(page);
      await goTo(page, 'market');
      await page.locator('[data-shareholder-returns-ui]').waitFor({ state: 'attached', timeout: 10000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
      current.push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action]')].map(node => `${node.dataset.action}:${node.disabled}`).filter(text => /dividend|buyback/.test(text))));
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    assert.deepEqual(current[0], current[1], 'the current panel is identical with and without the v3 script');
    assert.deepEqual(current[0], ['set-dividend:false', 'buyback:false']);

    // 2. Flag on: not listed → no section.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    await goTo(page, 'market');
    await page.locator('[data-ui3-market="summary"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-ui3-market="returns"]').count(), 0, 'no shareholder section before listing');

    // 3. Listed: the section shows the current panel's numbers.
    await list(page);
    await goTo(page, 'home'); await goTo(page, 'market');
    await page.locator('[data-ui3-market="returns"]').waitFor({ state: 'visible', timeout: 10000 });
    const start = await facts(page);
    assert.deepEqual(await page.locator('[data-ui3-market="returns"] .u-stat > span').allInnerTexts(), ['安全還元可能額', '設定配当', '次回予定総額', '直近実支払', '自己株式', '自己株式簿価']);
    assert.ok((await page.locator('[data-ui3-market="returns"]').innerText()).includes(await compact(page, start.safe)), 'the safe amount is the engine\'s');
    const metricsNow = await metrics(page);
    assert.deepEqual([metricsNow.small, metricsNow.overflowX], [[], false]);
    assert.ok(metricsNow.minFont >= 13 && metricsNow.screens <= 2, `font ${metricsNow.minFont}px, ${metricsNow.screens} screens`);

    // 4. Dividend: the amount sheet, the engine's planned total in the preview, the value entered (zero included).
    const baseline = await digest(page);
    await page.locator('[data-ui3-returns="dividend"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#modal-root [data-ui3-amount-input]').fill('3');
    assert.ok((await page.locator('#modal-root .u-sheet').innerText()).includes(await compact(page, 3 * start.shares)), 'the preview shows the planned total (per share x outstanding shares)');
    await cancelSheet(page);
    assert.equal(await digest(page), baseline, 'cancelling changes nothing');
    await page.locator('[data-ui3-returns="dividend"]').tap();
    await enterAmount(page, 3);
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.dividendPerShare === 3, null, { timeout: 10000 });
    await page.locator('[data-ui3-returns="dividend"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#modal-root [data-ui3-amount-input]').fill('0');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.dividendPerShare === 0, null, { timeout: 10000 });

    // 5. Buy-back: exactly the cost of the shares bought, as previewed.
    const before = await facts(page);
    await page.locator('[data-ui3-returns="buyback"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#modal-root [data-ui3-amount-input]').fill('10000000');
    const sheetText = await page.locator('#modal-root .u-sheet').innerText();
    assert.ok(sheetText.includes('100,000株'), 'the preview shows the shares it will buy');
    assert.ok(sheetText.includes(await compact(page, before.cash - 10000000)), 'the preview shows the company cash afterwards');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.treasuryBuybackShares === 100000, null, { timeout: 10000 });
    const after = await facts(page);
    assert.equal(before.cash - after.cash, 10000000, 'the company cash fell by exactly the amount (it divides into whole shares)');

    // 6. Disabled like the current button, with the reason.
    await engineEval(page, engine => { engine.g.companyCash = 100; engine.emit(); });
    await goTo(page, 'home'); await goTo(page, 'market');
    await page.locator('[data-ui3-returns="buyback"]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('[data-ui3-returns="buyback"]').isDisabled(), true);
    assert.match(await page.locator('[data-ui3-returns="buyback"]').innerText(), /1株の価格に足りません/);
    assert.equal(await engineEval(page, engine => engine.shareholderReturnCapacity().safeAmount < Math.max(1, engine.g.stockPrice)), true, 'the current button is disabled by the same rule');

    // 7. The rest stays reachable through the current screen.
    await page.locator('[data-ui3-current="market"]').tap();
    await waitCurrentUI(page);
    assert.ok(await page.locator('[data-shareholder-returns-ui]').count() > 0, 'the current panel is still reachable');

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-returns-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
