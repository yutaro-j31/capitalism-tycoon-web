'use strict';

// UI v3 office departments (docs/ui-v3/README.md 10.4, task UI3-9b-3). Loads the real js/ui3-office.js. Proves in a real browser that:
//  - without ?ui=3 the current departments tab is unchanged (same controls with and without the v3 script);
//  - with ?ui=3 every department is listed (set up: headcount and weekly cost; not set up: set-up cost);
//  - setting up, hiring one person and closing go through the confirmation sheet and the company cash moves by exactly the shown
//    amount (the engine's hire cost is checked against the engine's text, the closing figures against departmentClosurePlan);
//  - what the engine would refuse is disabled with the reason; cancelling changes nothing;
//  - setting up the investment department removes the market screen's company-account warning.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULE = /\/js\/ui3-office\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|office\.js|market\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const FILES = ['ui3-office'];
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
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 test */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 screens */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  const confirmFacts = page => page.locator('#modal-root [data-ui3-confirm-facts] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText]));
  const sheetOk = async (page, label) => {
    const sheet = await sheetMetrics(page);
    assert.deepEqual([sheet.small, sheet.primaries, sheet.bottom], [[], 1, device.viewport.height], `${label}: tap targets, one primary button, bottom edge`);
    assert.ok(sheet.minFont >= 13, `${label}: smallest font ${sheet.minFont}px`);
  };
  const cancel = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap();
  const confirmRun = async page => { await page.locator('#modal-root [data-ui3-confirm]').tap(); await page.waitForFunction(() => document.getElementById('modal-root').innerHTML === '', null, { timeout: 10000 }); };
  const cash = page => engineEval(page, engine => engine.g.companyCash);
  const money = (page, amount) => page.evaluate(value => globalThis.__capitalismTycoonModules.engine.compactYen(value), amount);
  const openRow = (page, id) => page.locator(`[data-ui3-dept="open"][data-id="${id}"]`).tap();
  const read = file => fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
  assert.ok(read('engine.js').includes('const cost=count*300000;'), 'the hire cost matches the engine');
  assert.ok(read('ui3-office.js').includes('const HIRE_COST=300000;'), 'the v3 hire cost is the engine cost');
  try {
    // 1. Flag off: the current departments tab, unchanged by the presence of the v3 script.
    const current = [];
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      await engineEval(page, engine => { engine.g.hasHeadOffice = true; engine.g.officeCapacity = 60; engine.emit?.(); });
      await goTo(page, 'office');
      await page.evaluate(() => document.querySelector('[data-action="office-tab"][data-id="departments"]').click());
      await page.locator('[data-screen="office"]').waitFor({ state: 'attached', timeout: 10000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
      current.push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action]')].map(node => `${node.dataset.action}:${node.dataset.id || ''}`)));
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    assert.deepEqual(current[0], current[1], 'the current departments tab is identical with and without the v3 script');
    assert.ok(current[0].includes('establish-department:accounting'), 'the current tab offers the set-up action');

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    await engineEval(page, engine => { engine.g.companyCash = 900000000; /* a mission reward would move the cash too: complete them all in the set-up */ engine.g.completedMissionIDs = globalThis.__capitalismTycoonModules.data.MISSION_DEFS.map(m => m.id); engine.g.activeMissionIDs = []; engine.g.hasHeadOffice = false; engine.g.officeCapacity = 60; engine.emit?.(); });
    await goTo(page, 'office');
    await page.locator('[data-ui3-office="departments"]').waitFor({ state: 'visible' });
    const masters = await engineEval(page, () => globalThis.__capitalismTycoonModules.data.MASTER.departments.map(d => ({ id: d.id, name: d.name, setupCost: d.setupCost, weeklyCost: d.weeklyCost })));
    assert.equal(await page.locator('[data-ui3-dept="open"]').count(), masters.length, 'every department is listed');
    const firstNote = await page.locator(`[data-ui3-dept="open"][data-id="${masters[0].id}"] small`).innerText();
    assert.ok(firstNote.includes(await money(page, masters[0].setupCost)), 'a department not set up shows its set-up cost');

    // without a head office the set-up is disabled with the reason
    await openRow(page, 'accounting');
    await page.locator('#modal-root [data-ui3-dept-sheet]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#modal-root [data-ui3-dept="establish"]').isDisabled(), true, 'no set-up without a head office');
    assert.equal(await page.locator('#modal-root [data-ui3-dept="reason"]').innerText(), '本社オフィスが必要です');
    await cancel(page);
    await engineEval(page, engine => { engine.g.hasHeadOffice = true; engine.emit?.(); });
    await goTo(page, 'home'); await goTo(page, 'office');

    // the market screen warns about the company account until the investment department is set up
    await goTo(page, 'market');
    await page.locator('[data-ui3-mkt-account="company"]').tap();
    await page.locator('[data-ui3-market="blocked"]').waitFor({ state: 'visible' });

    // set up the accounting department
    await goTo(page, 'office');
    await openRow(page, 'accounting');
    await sheetOk(page, 'department sheet');
    const acct = masters.find(d => d.id === 'accounting');
    const stores = await engineEval(page, engine => engine.g.stores.length);
    const reason = await page.locator('#modal-root [data-ui3-dept="reason"]').count() ? await page.locator('#modal-root [data-ui3-dept="reason"]').innerText() : '';
    if (stores === 0) assert.equal(reason, '', 'the store-zero route may set up accounting');
    await page.locator('#modal-root [data-ui3-dept="establish"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    assert.deepEqual((await confirmFacts(page)).map(f => f[0]), ['設置費', '週の費用', '実行後の会社現金']);
    await sheetOk(page, 'establish confirm');
    const baseline = await engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value)));
    await cancel(page);
    assert.equal(await engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value))), baseline, 'cancelling changes nothing');
    await openRow(page, 'accounting');
    await page.locator('#modal-root [data-ui3-dept="establish"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    assert.equal((await confirmFacts(page))[0][1], await money(page, acct.setupCost), 'the sheet shows the set-up cost');
    const before = await cash(page);
    await confirmRun(page);
    assert.equal(before - await cash(page), acct.setupCost, 'the company paid exactly the set-up cost');
    assert.equal(await engineEval(page, engine => Boolean(engine.g.departments.accounting)), true);

    // hire one person
    await page.locator('[data-ui3-dept="open"][data-id="accounting"] small').waitFor({ state: 'visible' });
    await openRow(page, 'accounting');
    await page.locator('#modal-root [data-ui3-dept="hire"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    assert.equal((await confirmFacts(page))[0][1], await money(page, 300000), 'the sheet shows 300,000 per person');
    const staffBefore = await engineEval(page, engine => engine.g.departmentStaff.accounting);
    const hireBefore = await cash(page);
    await confirmRun(page);
    assert.equal(hireBefore - await cash(page), 300000, 'the company paid exactly the hire cost');
    assert.equal(await engineEval(page, engine => engine.g.departmentStaff.accounting), staffBefore + 1, 'one more person');

    // no capacity: hiring is disabled with the reason
    await engineEval(page, engine => { engine.g.officeCapacity = Object.values(engine.g.departmentStaff).reduce((a, n) => a + n, 0) + Object.keys(engine.g.executives).length; engine.emit?.(); });
    await goTo(page, 'home'); await goTo(page, 'office');
    await openRow(page, 'accounting');
    assert.equal(await page.locator('#modal-root [data-ui3-dept="hire"]').isDisabled(), true, 'no hiring without capacity');
    assert.equal(await page.locator('#modal-root [data-ui3-dept="reason"]').innerText(), 'オフィス定員が足りません');
    await cancel(page);
    await engineEval(page, engine => { engine.g.officeCapacity = 60; engine.emit?.(); });
    await goTo(page, 'home'); await goTo(page, 'office');

    // the investment department (store-zero or three stores) clears the market warning
    // a newly founded company has no store: the engine's store-zero route lets the investment department be set up
    assert.equal(await engineEval(page, engine => engine.g.stores.length), 0, 'the founded test company has no store');
    await openRow(page, 'investment');
    await page.locator('#modal-root [data-ui3-dept="establish"]').tap();
    await confirmRun(page);
    assert.equal(await engineEval(page, engine => Boolean(engine.g.departments.investment)), true);
    await goTo(page, 'market');
    await page.locator('[data-ui3-mkt-account="company"]').tap();
    assert.equal(await page.locator('[data-ui3-market="blocked"]').count(), 0, 'the company-account warning is gone');

    // close: the sheet shows departmentClosurePlan; the company pays exactly the severance; the department is gone
    await goTo(page, 'office');
    await openRow(page, 'accounting');
    await page.locator('#modal-root [data-ui3-dept="close"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const plan = await engineEval(page, engine => engine.departmentClosurePlan('accounting'));
    const facts = await confirmFacts(page);
    assert.deepEqual(facts.map(f => f[0]), ['在籍人員', '退職金', '週の費用の削減', '実行後の会社現金']);
    assert.equal(facts[0][1], `${plan.headcount}名`);
    assert.equal(facts[1][1], await money(page, plan.severance));
    assert.equal(facts[2][1], await money(page, plan.weeklyCost));
    await sheetOk(page, 'close confirm');
    const closeBefore = await cash(page);
    await confirmRun(page);
    assert.equal(closeBefore - await cash(page), plan.severance, 'the company paid exactly the severance');
    assert.equal(await engineEval(page, engine => Boolean(engine.g.departments.accounting)), false, 'the department is closed');
    assert.equal(await page.locator('.d-dialog, .modal-card, #modal-ok').count(), 0, 'no second (current-UI) dialog opened');

    // the screen still meets the numbers
    const m = await metrics(page);
    assert.deepEqual([m.small, m.overflowX], [[], false], JSON.stringify(m.small));
    assert.ok(m.minFont >= 13 && m.screens <= 2.2, `font ${m.minFont}px, ${m.screens} screens`);
    // the current office screen stays reachable for the rest
    await page.locator('[data-ui3-current="office"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    await goTo(page, 'home');
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-departments-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
