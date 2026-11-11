'use strict';

// UI v3 report screen (docs/ui-v3/README.md 5.5, task UI3-7). Loads the real js/ui3-report.js. Proves in a real
// browser that: without ?ui=3 the current report screen is unchanged; with ?ui=3 the card is sales / net income /
// ending cash of the chosen period and equals what the current screen's statements say; every period chip changes
// the numbers; each statement sheet lists the lines of the current screen and has no control that changes the game;
// viewing changes nothing; the chart and glossary stay reachable through the current screen, with any tab action
// bringing v3 back.
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

const SCREEN_MODULE = /\/js\/ui3-report\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|report\.js)[^/?]+\.js(?:\?.*)?$/;
const source = fs.readFileSync(path.join(ROOT, 'js', 'ui3-report.js'), 'utf8');
assert.doesNotMatch(source, /Math\.random|Date\.now|MutationObserver|registerUIEnhancer/, 'the report screen uses no RNG, wall clock, observer or D UI enhancer');
assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g|ctx\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the report screen never assigns engine state');
assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage/, 'the report screen saves and stores nothing');

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
      await goTo(page, 'report');
      await page.locator('[data-screen="report"]').waitFor({ state: 'attached', timeout: 10000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
      current.push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action],#screen [data-bind]')].map(node => `${node.dataset.action || node.dataset.bind}:${node.dataset.id || node.dataset.tab || ''}`)));
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    assert.deepEqual(current[0], current[1], 'the current report screen is identical with and without the v3 script');

    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    await goTo(page, 'report');
    await page.locator('[data-ui3-report="periods"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-ui3-report="none"]').count(), 1, 'before the first week there is nothing to show');
    assert.deepEqual(await page.locator('[data-ui3-report="periods"] .u-chip').evaluateAll(nodes => nodes.map(node => [node.innerText, node.getAttribute('aria-pressed')])), [['今週', 'false'], ['13週', 'true'], ['四半期', 'false'], ['年度', 'false'], ['52週', 'false']]);

    // one week later
    await page.locator('.ui3 .u-advance').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.week >= 2, null, { timeout: 30000 });
    await page.evaluate(() => document.querySelector('#modal-root [data-action="close-modal"]')?.click());
    await goTo(page, 'report');
    await page.locator('[data-ui3-report="summary"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.ui3 #screen > h1').innerText(), '会社');
    assert.deepEqual(await page.locator('[data-ui3-report="summary"] .u-stat > span').allInnerTexts(), ['売上', '利益', '現金'], 'README 5.5: sales, profit, cash');
    assert.equal(await page.locator('#screen .u-list [data-action]').count(), 0, 'the report has no control that changes the game');
    const numbers = async period => engineEval(page, (engine, id, modules) => { const fs = modules.finance.buildStatements(engine.g, id), money = modules.engine.compactYen; return [money(fs.profitAndLoss.revenue), fs.profitAndLoss.netIncome, money(fs.cashFlow.endingCash)]; }, period);
    const shown = async () => page.locator('[data-ui3-report="summary"] .u-stat b').allInnerTexts();
    for (const [id, label] of [['13', '13週'], ['week', '今週'], ['quarter', '四半期'], ['year', '年度'], ['52', '52週']]) {
      await page.locator(`[data-ui3-report-period="${id}"]`).tap();
      await page.waitForFunction(value => document.querySelector(`[data-ui3-report-period="${value}"]`)?.getAttribute('aria-pressed') === 'true', id, { timeout: 10000 });
      const [revenue, income, cash] = await numbers(id);
      const cells = await shown();
      assert.equal(cells[0], revenue, `${label}: sales equal the current statements`);
      assert.equal(cells[2], cash, `${label}: cash equals the current statements`);
      assert.equal(cells[1].replace(/^[+−]/, ''), (await yen(page, Math.abs(income))), `${label}: profit equals the current statements`);
    }
    await page.locator('[data-ui3-report-period="13"]').tap();
    await page.waitForFunction(() => document.querySelector('[data-ui3-report-period="13"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 10000 });
    const size = await metrics(page);
    assert.deepEqual([size.small, size.overflowX], [[], false]);
    assert.ok(size.minFont >= 13 && size.screens <= 2, `font ${size.minFont}px, ${size.screens} screens`);
    const baseline = await digest(page);

    // statement sheets: the lines of the current screen
    const expected = { pl: ['損益計算書', 17], bs: ['貸借対照表', 15], cf: ['キャッシュフロー計算書', 15], ratios: ['財務指標', 10], wc: ['運転資本', 6], dividend: ['配当可能額', 4] };
    for (const [id, [title, count]] of Object.entries(expected)) {
      await page.locator(`[data-ui3-report-sheet="${id}"]`).tap();
      await page.locator('[data-ui3-report="lines"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), title);
      assert.equal(await page.locator('[data-ui3-report="lines"] .u-row').count(), count, `${title}: ${count} lines`);
      assert.equal(await page.locator('#modal-root [data-action]:not([data-action="close-modal"])').count(), 0, 'no control that changes the game');
      const sheet = await sheetMetrics(page);
      assert.deepEqual([sheet.small, sheet.primaries, sheet.bottom], [[], 1, device.viewport.height]);
      assert.ok(sheet.minFont >= 13);
      await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    }
    await page.locator('[data-ui3-report-sheet="history"]').tap();
    assert.ok(await page.locator('[data-ui3-report="lines"] .u-row').count() >= 1, 'the weekly history lists the week that passed');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await digest(page), baseline, 'looking at the report changes nothing');

    // the current screen for the rest
    await page.locator('[data-ui3-current="report"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    assert.ok(await page.locator('#report-chart').count() > 0, 'the current report screen, with its chart');
    await page.evaluate(() => document.querySelector('[data-action="tab"][data-tab="home"]').click());
    await goTo(page, 'report');
    await page.locator('[data-ui3-report="summary"]').waitFor({ state: 'visible', timeout: 10000 });

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-report-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
