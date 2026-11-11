'use strict';

// UI v3 bank screen (docs/ui-v3/README.md 5.5, task UI3-7). Loads the real js/ui3-bank.js. Proves in a real browser that:
//  - without ?ui=3 the current bank screen is unchanged;
//  - with ?ui=3 the card is debt / next repayment / borrowing capacity (the personal view names the personal cash);
//  - borrowing and repaying go through the amount sheet of UI3-9a, whose preview shows the balance after and the
//    remaining capacity (or the cash after), the maximum chip is the capacity (or what can be repaid), and the
//    debt and cash move by exactly the amount entered, for the company and the personal account;
//  - a borrow row is off without capacity and a repay row without debt;
//  - the loan list and the 13-week forecast are read-only sheets; viewing never changes the game.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

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
  const modules = globalThis.__capitalismTycoonModules;
  return (0, eval)(`(${source})`)(modules.playerEngineBridge.getEngine(), value, modules);
}, [fn.toString(), arg]);
const digest = page => engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value)));
const yen = (page, value) => engineEval(page, (engine, amount, modules) => modules.engine.compactYen(amount), value);
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

const SCREEN_MODULE = /\/js\/ui3-bank\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|bank\.js)[^/?]+\.js(?:\?.*)?$/;
const source = fs.readFileSync(path.join(ROOT, 'js', 'ui3-bank.js'), 'utf8');
assert.doesNotMatch(source, /Math\.random|Date\.now|MutationObserver|registerUIEnhancer/, 'the bank screen uses no RNG, wall clock, observer or D UI enhancer');
assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g|ctx\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the bank screen never assigns engine state');
assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage|(?<![\w.])confirm\(/, 'the bank screen never saves, stores or uses the browser\'s confirm()');
assert.ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').indexOf('./js/ui3-bank.js') > fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').indexOf('./js/ui3-shell.js'), 'index.html loads the script after the shell');

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async ({ withoutScreen = false } = {}) => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 screen */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };

  try {
    const current = [];
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      await goTo(page, 'bank');
      await page.locator('[data-screen="bank"]').waitFor({ state: 'attached', timeout: 10000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
      current.push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action],#screen [data-bind]')].map(node => `${node.dataset.action || node.dataset.bind}:${node.dataset.id || node.dataset.tab || ''}`)));
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    assert.deepEqual(current[0], current[1], 'the current bank screen is identical with and without the v3 script');

    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    await goTo(page, 'bank');
    await page.locator('[data-ui3-bank="summary"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.ui3 #screen > h1').innerText(), '会社');
    assert.deepEqual(await page.locator('[data-ui3-bank="summary"] .u-stat > span').allInnerTexts(), ['借入残高', '週の返済', '借入余力'], 'README 5.5: debt, repayment, capacity');
    assert.deepEqual(await page.locator('[data-ui3-bank="account"] button').evaluateAll(nodes => nodes.map(node => [node.innerText, node.getAttribute('aria-pressed')])), [['会社', 'true'], ['個人', 'false']]);
    assert.deepEqual(await page.locator('[data-ui3-bank="operations"] .u-row').evaluateAll(nodes => nodes.map(node => [node.dataset.action, node.disabled])), [['borrow-company', false], ['repay-company', true]], 'a repay row is off without debt');
    const founding = await metrics(page);
    assert.deepEqual([founding.small, founding.overflowX], [[], false]);
    assert.ok(founding.minFont >= 13 && founding.screens <= 2, `font ${founding.minFont}px, ${founding.screens} screens`);
    const baseline = await digest(page);

    // read-only sheets
    await page.locator('[data-ui3-bank="forecast"]').tap();
    await page.locator('[data-ui3-bank="forecast-rows"]').waitFor({ state: 'visible' });
    assert.ok(await page.locator('[data-ui3-bank="forecast-rows"] .u-row').count() >= 13, 'thirteen weeks');
    assert.equal(await page.locator('#modal-root [data-action]:not([data-action="close-modal"])').count(), 0, 'no control that changes the game');
    const forecastSheet = await sheetMetrics(page);
    assert.deepEqual([forecastSheet.small, forecastSheet.primaries, forecastSheet.bottom], [[], 1, device.viewport.height]);
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    await page.locator('[data-ui3-bank="loans"]').tap();
    await page.locator('#modal-root .u-sheet-head h1').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), '借入金の一覧');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await digest(page), baseline, 'looking at the bank changes nothing');

    // Borrow (company): the amount sheet.
    const before = await engineEval(page, (engine, _arg, modules) => ({ debt: engine.g.companyDebt, cash: engine.g.companyCash, capacity: Math.max(0, engine.companyCreditLimit() - engine.g.companyDebt) }));
    await page.locator('[data-action="borrow-company"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), '会社借入');
    assert.equal(await page.locator('#modal-root #iphone-money-form').count(), 0, 'no iPhone dialog');
    assert.equal(await page.locator('[data-ui3-amount-max]').getAttribute('data-ui3-amount-chip'), String(Math.floor(before.capacity)), 'the maximum is the borrowing capacity');
    assert.match(await page.locator('#modal-root [data-ui3-amount-note]').innerText(), /借入余力/);
    assert.equal(await page.locator('#modal-root [data-ui3-amount-input]').inputValue(), String(Math.floor(before.capacity)), 'the dialog starts at the capacity, not at the 10M of askMoney');
    await page.locator('#modal-root [data-ui3-amount-input]').fill('1000000');
    const rows = await page.locator('#modal-root [data-ui3-amount-preview] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText, node.querySelector('b').classList.contains('u-down')]));
    assert.deepEqual(rows, [['借入後の残高', await yen(page, before.debt + 1000000), false], ['残りの借入余力', await yen(page, before.capacity - 1000000), false]]);
    await page.locator('#modal-root [data-ui3-amount-input]').fill(String(Math.floor(before.capacity) + 1000000));
    assert.deepEqual(await page.locator('#modal-root [data-ui3-amount-preview] .u-stat b').nth(1).evaluate(node => [node.innerText, node.classList.contains('u-down')]), ['0円', true], 'beyond the capacity: the remaining capacity is shown as 0, in red (the engine decides whether it runs)');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await digest(page), baseline, 'cancelling changes nothing');
    await page.locator('[data-action="borrow-company"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').fill('1000000');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.waitForFunction(debt => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyDebt === debt + 1000000, before.debt, { timeout: 10000 });
    const borrowed = await engineEval(page, engine => ({ debt: engine.g.companyDebt, cash: engine.g.companyCash }));
    assert.equal(borrowed.cash, before.cash + 1000000, 'the company received exactly the amount');
    assert.equal(await page.locator('[data-ui3-bank="summary"] .u-stat b').first().innerText(), await yen(page, borrowed.debt), 'the card follows');

    // Repay 400,000: the preview names the cash afterwards.
    assert.equal(await page.locator('[data-action="repay-company"]').isDisabled(), false, 'with debt the repay row is on');
    await page.locator('[data-action="repay-company"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').fill('400000');
    assert.deepEqual(await page.locator('#modal-root [data-ui3-amount-preview] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText])),
      [['返済後の残高', await yen(page, borrowed.debt - 400000)], ['実行後の会社の現金', await yen(page, borrowed.cash - 400000)]]);
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.waitForFunction(debt => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyDebt === debt - 400000, borrowed.debt, { timeout: 10000 });
    assert.equal(await engineEval(page, engine => engine.g.companyCash), borrowed.cash - 400000, 'the company paid exactly the amount');

    // Personal account.
    await page.locator('[data-ui3-bank-account="personal"]').tap();
    await page.waitForFunction(() => /個人の現金/.test(document.querySelector('[data-ui3-bank="summary"]')?.innerText || ''), null, { timeout: 10000 });
    assert.deepEqual(await page.locator('[data-ui3-bank="summary"] .u-stat > span').allInnerTexts(), ['借入残高', '個人の現金', '借入余力']);
    const personal = await engineEval(page, engine => ({ debt: engine.g.personalDebt, cash: engine.g.personalCash }));
    await page.locator('[data-action="borrow-personal"]').tap();
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), '個人借入');
    await page.locator('#modal-root [data-ui3-amount-input]').fill('100000');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.waitForFunction(debt => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.personalDebt === debt + 100000, personal.debt, { timeout: 10000 });
    assert.equal(await engineEval(page, engine => engine.g.personalCash), personal.cash + 100000);
    assert.equal(await engineEval(page, engine => engine.g.companyDebt), borrowed.debt - 400000, 'the company debt did not move');

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-bank-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
