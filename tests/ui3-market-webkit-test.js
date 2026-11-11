'use strict';

// UI v3 market screen (docs/ui-v3/README.md 5.5, task UI3-5). Loads the real js/ui3-market.js. Proves in a real
// browser that:
//  - without ?ui=3 the current market screen is unchanged (same controls with and without the v3 script);
//  - with ?ui=3 the screen shows the README 5.5 shape (cash / market value / unrealised gain for the chosen
//    account; holdings and favourites; a way to every stock) and meets the acceptance numbers;
//  - the stock sheet reaches buying and selling through the current dialogs (the number of shares is asked
//    first, so those dialogs are the confirmation), for the personal and for the company account, and the
//    holdings change by exactly the number entered;
//  - favourites work, viewing never changes the game, and the current screen stays reachable for the rest
//    (own-stock operations, chart, margin, capital allocation), with any tab action bringing v3 back.
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
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 market test */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 market screen */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // 1. Flag off: the current screen, unchanged by the presence of the v3 script.
    const current = [];
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      await goTo(page, 'market');
      await page.locator('[data-screen="market"]').waitFor({ state: 'attached', timeout: 10000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
      current.push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action],#screen [data-bind]')].map(node => `${node.dataset.action || node.dataset.bind}:${node.dataset.id || node.dataset.tab || ''}`)));
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    assert.deepEqual(current[0], current[1], 'the current market screen is identical with and without the v3 script');

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredScreens()), ['market']);
    await goTo(page, 'market');
    await page.locator('[data-ui3-market="summary"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.ui3 #screen > h1').innerText(), '投資');
    assert.deepEqual(await page.locator('.ui3 .u-chips .u-chip').allInnerTexts(), ['株式', 'ベンチャー', 'M&A', '不動産'], 'the hub chips: PE stays hidden until it is unlocked');
    assert.deepEqual(await page.locator('[data-ui3-market="summary"] .u-stat > span').allInnerTexts(), ['個人の現金', '保有の時価', '含み損益'], 'README 5.5: cash, market value, unrealised gain; the wallet is named');
    assert.deepEqual(await page.locator('[data-ui3-market="account"] button').evaluateAll(nodes => nodes.map(node => [node.innerText, node.getAttribute('aria-pressed')])), [['個人口座', 'true'], ['会社口座', 'false']]);
    assert.equal(await page.locator('[data-ui3-market="none"]').count(), 1, 'no holdings or favourites yet');
    const founding = await metrics(page);
    assert.deepEqual([founding.small, founding.overflowX], [[], false]);
    assert.ok(founding.minFont >= 13 && founding.screens <= 2, `font ${founding.minFont}px, ${founding.screens} screens`);
    const stockCount = await engineEval(page, engine => engine.g.market.length);
    assert.match(await page.locator('[data-ui3-mkt="all"]').innerText(), new RegExp(`${stockCount}銘柄`));

    const baseline = await digest(page);

    // All stocks sheet with the sector filter.
    await page.locator('[data-ui3-mkt="all"]').tap();
    await page.locator('[data-ui3-market="all-stocks"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-ui3-market="all-stocks"] .u-row').count(), stockCount, 'every stock is listed');
    const sectors = await page.locator('[data-ui3-market="sectors"] .u-chip').allInnerTexts();
    assert.equal(sectors[0], '全業種');
    assert.ok(sectors.length > 3);
    const allSheet = await sheetMetrics(page);
    assert.deepEqual([allSheet.small, allSheet.primaries, allSheet.bottom], [[], 1, device.viewport.height]);
    assert.ok(allSheet.minFont >= 13);
    await page.locator('[data-ui3-market="sectors"] .u-chip').nth(1).tap();
    const sectorRows = await page.locator('[data-ui3-market="all-stocks"] .u-row').count();
    assert.ok(sectorRows > 0 && sectorRows < stockCount, 'the sector filter narrows the list');
    assert.equal(await page.locator('[data-ui3-market="sectors"] .u-chip').nth(1).getAttribute('aria-pressed'), 'true');

    // Stock sheet.
    await page.locator('[data-ui3-market="all-stocks"] .u-row').first().tap();
    await page.locator('#modal-root [data-action="buy-stock"]').waitFor({ state: 'visible' });
    const stock = await page.evaluate(() => { const id = document.querySelector('#modal-root [data-action="buy-stock"]').dataset.id; const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine(); const row = engine.g.market.find(item => item.id === id); return { id, name: row.name, price: row.price }; });
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), stock.name);
    assert.deepEqual(await page.locator('#modal-root .u-stats .u-stat > span').allInnerTexts(), ['株価', '前週比', '保有（個人）']);
    assert.deepEqual(await page.locator('#modal-root .u-sheet-foot button').evaluateAll(nodes => nodes.map(node => [node.innerText.trim(), node.dataset.action, node.classList.contains('primary'), node.disabled])),
      [['売る', 'sell-stock', false, true], ['買う', 'buy-stock', true, false]], 'selling needs a holding; one primary button');
    const stockSheet = await sheetMetrics(page);
    assert.deepEqual([stockSheet.small, stockSheet.primaries, stockSheet.bottom], [[], 1, device.viewport.height]);
    assert.equal(await digest(page), baseline, 'looking at stocks changes nothing');

    // Favourite: the sheet follows, the stock shows in the list.
    await page.locator('#modal-root [data-action="favorite-stock"]').tap();
    await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.favoriteStockIds.includes(id), stock.id, { timeout: 10000 });
    await page.waitForFunction(() => /外す/.test(document.querySelector('#modal-root [data-action="favorite-stock"]')?.innerText || ''), null, { timeout: 5000 });
    await page.locator('#modal-root [data-action="close-modal"]').first().tap({ position: { x: 100, y: 40 } });
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '');
    assert.match(await page.locator('[data-ui3-market="holdings"] .u-row').first().innerText(), /お気に入り/);

    // Buy 10 shares with the personal account, through the current dialog.
    const before = await engineEval(page, (engine, id) => ({ cash: engine.g.personalCash, qty: engine.g.personalStocks[id]?.qty || 0, company: engine.g.companyStocks[id]?.qty || 0 }), stock.id);
    await page.locator('[data-ui3-market="holdings"] .u-row').first().tap();
    await page.locator('#modal-root [data-action="buy-stock"]').tap();
    await enterAmount(page, 10);
    await page.waitForFunction(([id, qty]) => (globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.personalStocks[id]?.qty || 0) === qty + 10, [stock.id, before.qty], { timeout: 10000 });
    const bought = await engineEval(page, (engine, id) => ({ cash: engine.g.personalCash, company: engine.g.companyStocks[id]?.qty || 0 }), stock.id);
    assert.ok(bought.cash < before.cash, 'the personal cash paid for the shares');
    assert.equal(bought.company, before.company, 'the company holding did not move');
    await page.locator('[data-ui3-market="holdings"] .u-row').first().waitFor({ state: 'visible' });
    assert.match(await page.locator('[data-ui3-market="holdings"] .u-row').first().innerText(), /保有10株/);
    assert.notEqual(await page.locator('[data-ui3-market="summary"] .u-stat').nth(1).locator('b').innerText(), '0円', 'the market value counts the holding');

    // Sell 4 of them.
    await page.locator('[data-ui3-market="holdings"] .u-row').first().tap();
    await page.locator('#modal-root [data-action="sell-stock"]:not([disabled])').tap();
    await enterAmount(page, 4);
    await page.waitForFunction(([id]) => (globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.personalStocks[id]?.qty || 0) === 6, [stock.id], { timeout: 10000 });

    // The company account: its own cash and holdings; a trade goes to the company.
    await page.locator('[data-ui3-mkt-account="company"]').tap();
    await page.waitForFunction(() => /会社の現金/.test(document.querySelector('[data-ui3-market="summary"]')?.innerText || ''), null, { timeout: 10000 });
    assert.equal(await page.locator('[data-ui3-mkt-account="company"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-ui3-market="none"]').count(), 0, 'the favourite shows in the company account too');
    const companyBefore = await engineEval(page, (engine, id) => ({ cash: engine.g.companyCash, qty: engine.g.companyStocks[id]?.qty || 0, personal: engine.g.personalStocks[id]?.qty || 0 }), stock.id);
    await page.locator('[data-ui3-market="holdings"] .u-row').first().tap();
    assert.equal((await page.locator('#modal-root .u-stats .u-stat > span').allInnerTexts())[2], '保有（会社）');
    // The game's own rule (the current stock panel's condition): a company account trades only with the
    // investment department. Without it the screen says so first and the sheet's buttons are off.
    assert.equal(await engineEval(page, engine => Boolean(engine.g.departments.investment)), false);
    const warn = await page.locator('[data-ui3-market="blocked"]').evaluate(node => [node.className, node.dataset.action, node.dataset.tab, node.querySelector('b').innerText]);
    assert.deepEqual(warn, ['u-action warn', 'tab', 'office', '会社口座の売買には投資部門が必要です'], 'the warning card sits under the account switch and leads to the office');
    assert.equal(await page.locator('[data-ui3-market="account"] ~ [data-ui3-market="blocked"]').count(), 1);
    assert.deepEqual(await page.locator('#modal-root .u-sheet-foot button').evaluateAll(nodes => nodes.map(node => [node.innerText.trim(), node.disabled])), [['売る', true], ['買う', true]], 'both buttons are off');
    assert.match(await page.locator('#modal-root [data-ui3-market="blocked-note"]').innerText(), /投資部門が必要です/);
    await page.locator('#modal-root .u-scrim').tap({ position: { x: 100, y: 8 } });
    assert.equal(await engineEval(page, (engine, id) => engine.g.companyStocks[id]?.qty || 0, stock.id), companyBefore.qty, 'nothing was bought');
    await engineEval(page, engine => { engine.g.departments.investment = true; });   // test setup: the investment department exists
    await goTo(page, 'market');
    await page.locator('[data-ui3-market="summary"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-ui3-market="blocked"]').count(), 0, 'with the department the warning is gone');
    await page.locator('[data-ui3-market="holdings"] .u-row').first().tap();
    await page.locator('#modal-root [data-action="buy-stock"]').tap();
    await enterAmount(page, 3);
    await page.waitForFunction(([id, qty]) => (globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyStocks[id]?.qty || 0) === qty + 3, [stock.id, companyBefore.qty], { timeout: 10000 });
    const companyAfter = await engineEval(page, (engine, id) => ({ cash: engine.g.companyCash, personal: engine.g.personalStocks[id]?.qty || 0 }), stock.id);
    assert.ok(companyAfter.cash < companyBefore.cash && companyAfter.personal === companyBefore.personal, 'the company paid; the personal holding did not move');
    // Cancelling a dialog changes nothing.
    const beforeCancel = await digest(page);
    await page.locator('[data-ui3-market="holdings"] .u-row').first().tap();
    await page.locator('#modal-root [data-action="buy-stock"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    await cancelDialog(page);
    assert.equal(await digest(page), beforeCancel, 'cancelling the share dialog changes nothing');
    await page.locator('[data-ui3-mkt-account="personal"]').tap();
    await page.waitForFunction(() => /個人の現金/.test(document.querySelector('[data-ui3-market="summary"]')?.innerText || ''), null, { timeout: 10000 });

    // The current screen as the way to the rest; any tab action brings v3 back.
    await page.locator('[data-ui3-current="market"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    assert.ok(await page.locator('[data-screen="market"]').count() > 0, 'the current market screen is shown');
    assert.ok(await page.locator('[data-action="select-stock"]').count() > 0, 'with its stock table');
    await page.evaluate(() => document.querySelector('[data-action="tab"][data-tab="home"]').click());
    await goTo(page, 'market');
    await page.locator('[data-ui3-market="summary"]').waitFor({ state: 'visible', timeout: 10000 });

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-market-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
