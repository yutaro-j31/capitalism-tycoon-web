'use strict';

// UI v3 founding form and game-over screen (docs/ui-v3/README.md 5.6, task UI3-8b). Loads the real js/ui3-setup.js and
// js/ui3-gameover.js. Proves in a real browser that:
//  - without ?ui=3 the current founding form and game-over overlay are unchanged (same controls with and without the v3 scripts);
//  - with ?ui=3 the form has the same fields with the same names, fits one screen with the button fixed at the bottom, and has no
//    top bar, tab bar or advance button;
//  - submitting it through the current handler founds the company with the chosen values and starts at the top of the page;
//  - the game-over screen shows the reason, starting over and loading a slot are confirmations, and starting over returns to the form.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULE = /\/js\/ui3-(?:setup|gameover)\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|setup\.js|gameover\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const FILES = ['ui3-setup', 'ui3-gameover'];
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const name of FILES) {
  const source = fs.readFileSync(path.join(ROOT, 'js', `${name}.js`), 'utf8');
  assert.doesNotMatch(source, /Math\.random|Date\.now|MutationObserver|registerUIEnhancer/, `${name} uses no RNG, clock, observer or D UI enhancer`);
  assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, `${name} never assigns engine state`);
  assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage|(?<![\w.])confirm\(/, `${name} never saves, stores or uses the browser's confirm()`);
  assert.ok(index.indexOf(`./js/${name}.js`) > index.indexOf('./js/ui3-shell.js') && index.indexOf(`./js/${name}.js`) < index.indexOf('./js/app.js'), `index.html loads ${name} after the shell and before the app`);
}

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
  const offenders = []; let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) { const f = parseFloat(getComputedStyle(node.parentElement).fontSize); if (f < 13) offenders.push(node.parentElement.outerHTML.slice(0, 140)); minFont = Math.min(minFont, f); } }
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
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 setup test */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 setup screens */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  const formShape = page => page.evaluate(() => [...document.querySelectorAll('#setup-form input,#setup-form select')].map(node => `${node.tagName}:${node.name}:${[...(node.options || [])].map(o => o.value).join('|')}`));
  const sheetOk = async (page, label) => {
    const sheet = await sheetMetrics(page);
    assert.deepEqual([sheet.small, sheet.primaries, sheet.bottom], [[], 1, device.viewport.height], label);
    assert.ok(sheet.minFont >= 13, `${label}: font ${sheet.minFont}px`);
  };
  try {
    // 1. Flag off: the current form and overlay, unchanged by the presence of the v3 scripts.
    const current = [];
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await page.goto(base, { waitUntil: 'load' });
      await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
      const shape = await formShape(page);
      await page.locator('#setup-form').evaluate(form => form.requestSubmit());
      await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
      await engineEval(page, engine => { engine.g.gameOver = true; engine.g.gameOverReason = 'テスト倒産'; engine.emit(); });
      await page.locator('.game-over').waitFor({ state: 'visible' });
      current.push([shape, await page.evaluate(() => [...document.querySelectorAll('.game-over [data-action]')].map(node => `${node.dataset.action}:${node.dataset.tab || ''}`))]);
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    assert.deepEqual(current[0], current[1], 'the current form and overlay are identical with and without the v3 scripts');

    // 2. Flag on: the founding form.
    const { context, page, pageErrors } = await newPage();
    await page.goto(`${base}?ui=3`, { waitUntil: 'load' });
    await page.locator('[data-ui3-setup] #setup-form').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);   // let the start-up notices settle before measuring
    assert.deepEqual(await formShape(page), current[0][0], 'the same fields, names and options as the current form');
    assert.equal(await page.locator('[data-action="tab"], [data-action="advance-week"], .u-tabbar, .u-dock, .u-top').count(), 0, 'no tab bar, advance button or top bar');
    const form = await page.evaluate(() => {
      const button = document.querySelector('#setup-form button[type="submit"]').getBoundingClientRect();
      const controls = [...document.querySelectorAll('#setup-form input,#setup-form select,#setup-form button')];
      const offenders = []; let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, element = node.parentElement;
        if (!node.nodeValue.trim() || element.tagName === 'OPTION' || element.getBoundingClientRect().width <= 0) continue;
        const size = parseFloat(getComputedStyle(element).fontSize);
        if (size < 13) offenders.push(element.outerHTML.slice(0, 140));
        minFont = Math.min(minFont, size);
      }
      return { offenders, screens: document.documentElement.scrollHeight / innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth, buttonBottom: Math.round(button.bottom), viewport: innerHeight,
        small: controls.filter(c => { const b = c.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).map(c => c.name || c.tagName), minFont, label: document.querySelector('#setup-form button[type="submit"]').innerText.trim() };
    });
    assert.equal(await page.locator('[data-setup-recovery]').count(), 1, 'one recovery block (the page bootstrap does not add a second, unstyled one)');
    assert.equal(await page.locator('[data-setup-recovery] [data-action="import-save"]').count(), 1, 'the JSON import button');
    assert.equal(await page.locator('#import-file').count(), 1, 'one file input for the existing import-save action');
    assert.equal(form.label, '創業する');
    assert.ok(form.screens <= 1.01, `the form fits one screen (${form.screens})`);
    assert.deepEqual([form.small, form.overflowX], [[], false]);
    assert.ok(form.minFont >= 13, `smallest font ${form.minFont}px: ${JSON.stringify(form.offenders)}`);
    assert.ok(form.buttonBottom >= form.viewport - 20 && form.buttonBottom <= form.viewport, 'the button is fixed at the bottom');
    // Submit through the current handler with chosen values.
    await page.locator('input[name="playerName"]').fill('テスト太郎');
    await page.locator('input[name="companyName"]').fill('テスト商会');
    await page.locator('select[name="difficulty"]').selectOption('hard');
    await page.evaluate(() => scrollTo(0, 200));
    await page.locator('#setup-form button[type="submit"]').tap();
    await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
    const founded = await engineEval(page, engine => ({ player: engine.g.playerName, company: engine.g.companyName, difficulty: engine.g.difficulty, configured: engine.g.configured }));
    assert.deepEqual(founded, { player: 'テスト太郎', company: 'テスト商会', difficulty: 'hard', configured: true }, 'the company was founded with the chosen values');
    assert.equal(await page.evaluate(() => scrollY), 0, 'a new game starts at the top of the page');
    assert.equal(await page.locator('[data-ui3-setup]').count(), 0, 'the form is gone');

    // 3. Game over.
    await engineEval(page, engine => { engine.g.gameOver = true; engine.g.gameOverReason = 'テスト倒産'; engine.emit(); });
    await page.locator('[data-ui3-gameover-body]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.game-over').count(), 0, 'the current overlay is not drawn');
    assert.equal(await page.locator('[data-ui3-gameover="reason"]').innerText(), 'テスト倒産');
    const over = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('#app button')].filter(b => b.getBoundingClientRect().width > 0);
      return { small: controls.filter(c => { const b = c.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).length, overflowX: document.documentElement.scrollWidth > innerWidth, screens: document.documentElement.scrollHeight / innerHeight };
    });
    assert.deepEqual([over.small, over.overflowX], [0, false]);
    assert.ok(over.screens <= 2);
    const before = await digest(page);
    await page.locator('[data-ui3-gameover-confirm="load-slot"][data-id="1"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await sheetOk(page, 'load slot confirm');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap();
    await page.locator('[data-ui3-gameover-confirm="reset"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap();
    assert.equal(await digest(page), before, 'cancelling changes nothing');
    await page.waitForTimeout(500);
    await page.locator('[data-ui3-gameover-confirm="reset"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.locator('[data-ui3-setup] #setup-form').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('[data-ui3-gameover-body]').count(), 0);

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-setup-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
