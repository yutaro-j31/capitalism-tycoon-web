'use strict';

// UI v3 investment screens venture / ma / assets / pe-portfolio (docs/ui-v3/README.md 5, task UI3-6). Loads the real
// js/ui3-venture.js, ui3-ma.js, ui3-assets.js and ui3-pe-portfolio.js. Proves in a real
// browser that:
//  - without ?ui=3 the current screens are unchanged (same controls with and without the v3 scripts);
//  - with ?ui=3 each screen shows its README shape and meets the acceptance numbers;
//  - the startup sheet invests through the amount sheet and the company / personal cash moves by exactly the
//    number entered; due diligence, secondary sale, subsidiary conversion and property sale go through the
//    confirmation sheet (the facts shown match what happens; cancel changes nothing);
//  - M&A candidates are refreshed through a confirmation and a deal room opens from a candidate;
//  - the PE tab appears only after the PE firm is unlocked;
//  - viewing never changes the game and the current screen stays reachable for what is not ported.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULE = /\/js\/ui3-(?:venture|ma|assets|pe-portfolio)\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|venture\.js|ma\.js|assets\.js|pe-portfolio\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const FILES = ['ui3-venture', 'ui3-ma', 'ui3-assets', 'ui3-pe-portfolio'];
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
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 investment test */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 investment screens */' }));
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
  const screenOk = async (page, label) => {
    const m = await metrics(page);
    assert.deepEqual([m.small, m.overflowX], [[], false], `${label}: ${JSON.stringify(m.small)}`);
    assert.ok(m.minFont >= 13 && m.screens <= 2, `${label}: font ${m.minFont}px, ${m.screens} screens`);
  };
  const closeSheet = page => page.locator('#modal-root [data-action="close-modal"]').first().tap({ position: { x: 100, y: 40 } });
  try {
    // 1. Flag off: the current screens, unchanged by the presence of the v3 scripts.
    const current = { venture: [], ma: [], assets: [] };
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      await engineEval(page, engine => { engine.g.departments.investment = true; });
      for (const tab of Object.keys(current)) {
        await goTo(page, tab);
        await page.locator(`[data-screen="${tab}"]`).waitFor({ state: 'attached', timeout: 10000 });
        assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
        current[tab].push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action],#screen [data-bind]')].map(node => `${node.dataset.action || node.dataset.bind}:${node.dataset.id || node.dataset.tab || ''}`)));
      }
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    for (const tab of Object.keys(current)) assert.deepEqual(current[tab][0], current[tab][1], `the current ${tab} screen is identical with and without the v3 scripts`);

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredScreens()), ['venture', 'ma', 'assets', 'pe-portfolio']);
    await engineEval(page, engine => { engine.g.companyCash = 300000000; engine.g.personalCash = 200000000; engine.g.departments.investment = true; engine.emit?.(); });

    // ---- venture ----
    await goTo(page, 'venture');
    await page.locator('[data-ui3-venture="summary"]').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('[data-ui3-venture="summary"] .u-stat > span').allInnerTexts(), ['投資先', '会社の持分評価', '個人の持分評価']);
    assert.ok(await page.locator('[data-ui3-venture="candidates"] .u-row').count() > 0, 'candidates are listed');
    await screenOk(page, 'venture');
    const ventureBaseline = await digest(page);
    const target = await engineEval(page, engine => { const s = engine.g.startups.find(x => x.alive && !x.ownedCompany && !x.ownedPersonal); return { id: s.id, name: s.name, minTicket: s.minTicket }; });
    await page.locator(`[data-ui3-vc="startup"][data-id="${target.id}"]`).tap();
    await page.locator('[data-ui3-venture-sheet]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), target.name);
    assert.deepEqual(await page.locator('#modal-root .u-sheet-foot button').evaluateAll(nodes => nodes.map(node => [node.innerText.trim(), node.dataset.action, node.classList.contains('primary')])),
      [['個人で投資', 'invest-startup-personal', false], ['会社で投資', 'invest-startup-company', true]]);
    await sheetOk(page, 'startup sheet');
    assert.equal(await digest(page), ventureBaseline, 'looking at a startup changes nothing');

    // Detailed due diligence: a confirmation with the cost and the personal cash afterwards.
    const ddCost = Math.round(target.minTicket * 0.05);
    const personalBefore = await engineEval(page, engine => engine.g.personalCash);
    await page.locator('[data-ui3-vc="dd"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const ddFacts = await confirmFacts(page);
    assert.equal(ddFacts[0][0], '費用');
    assert.equal(ddFacts[1][0], '実行後の個人現金');
    await sheetOk(page, 'dd confirm');
    await page.locator('#modal-root [data-action="close-modal"]').first().tap();
    assert.equal(await digest(page), ventureBaseline, 'cancelling the confirmation changes nothing');
    await page.locator(`[data-ui3-vc="startup"][data-id="${target.id}"]`).tap();
    await page.locator('[data-ui3-vc="dd"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.startups.find(s => s.id === id).dueDiligence?.done, target.id, { timeout: 10000 });
    assert.equal(await engineEval(page, engine => engine.g.personalCash), personalBefore - ddCost, 'the personal cash paid exactly the shown cost');
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '', 'the confirmation closed');

    // Invest with the company through the amount sheet.
    const companyBefore = await engineEval(page, engine => engine.g.companyCash);
    await page.locator(`[data-ui3-vc="startup"][data-id="${target.id}"]`).tap();
    await page.locator('#modal-root [data-action="invest-startup-company"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    assert.ok(await page.locator('#modal-root .u-sheet').innerText().then(text => /会社/.test(text)), 'the amount sheet names the company wallet');
    await enterAmount(page, target.minTicket);
    await page.locator('#modal-root [data-ui3-amount-confirm]').tap();   // UI3-12b: the investment is confirmed once more after the amount
    await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.startups.find(s => s.id === id).ownedCompany > 0, target.id, { timeout: 10000 });
    const invested = await engineEval(page, (engine, id) => ({ cash: engine.g.companyCash, personal: engine.g.personalCash, owned: engine.g.startups.find(s => s.id === id).ownedCompany, personalOwned: engine.g.startups.find(s => s.id === id).ownedPersonal }), target.id);
    assert.equal(invested.cash, companyBefore - target.minTicket, 'the company cash paid exactly the amount entered');
    assert.equal(invested.personalOwned, 0, 'the personal stake did not move');
    assert.match(await page.locator('[data-ui3-venture="held"]').innerText(), new RegExp(target.name));

    // Secondary sale of the company stake: the facts shown are what happens.
    await page.locator(`[data-ui3-vc="startup"][data-id="${target.id}"]`).tap();
    await page.locator('[data-ui3-vc="secondary"][data-owner="company"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const saleFacts = await confirmFacts(page);
    assert.equal(saleFacts[0][0], '売却額');
    assert.equal(saleFacts[1][0], '実行後の会社現金');
    const proceeds = await engineEval(page, (engine, id) => Math.round(engine.previewStartupSecondarySale(id, 'company').proceeds), target.id);
    const cashBeforeSale = await engineEval(page, engine => engine.g.companyCash);
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.startups.find(s => s.id === id).ownedCompany === 0, target.id, { timeout: 10000 });
    assert.equal(await engineEval(page, engine => engine.g.companyCash), cashBeforeSale + proceeds, 'the company received exactly the proceeds');

    // Subsidiary conversion and IPO.
    await engineEval(page, (engine, id) => { const s = engine.g.startups.find(x => x.id === id); s.ownedCompany = 0.6; s.totalInvestedCompany = 10000000; s.valuation = 600000000; engine.emit?.(); }, target.id);
    await goTo(page, 'home'); await goTo(page, 'venture');
    await page.locator(`[data-ui3-vc="startup"][data-id="${target.id}"]`).tap();
    await page.locator('[data-ui3-vc="subsidiary-make"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.subsidiaries.length === 1, null, { timeout: 10000 });
    await page.locator('[data-ui3-venture="subsidiaries"] .u-row').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-ui3-venture="subsidiaries"] .u-row').tap();
    await page.locator('[data-ui3-venture="ipo-status"]').waitFor({ state: 'visible' });
    assert.match(await page.locator('[data-ui3-venture="ipo-status"]').innerText(), /IPO/, 'the subsidiary sheet shows the IPO status');
    assert.equal(await page.locator('#modal-root [data-ui3-vc="ipo"]').count(), 0, 'the staged IPO is not a one-tap action in v3');
    await sheetOk(page, 'subsidiary sheet');
    await closeSheet(page);

    // The current screen as the way to the rest.
    await page.locator('[data-ui3-current="venture"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    assert.ok(await page.locator('[data-screen="venture"]').count() > 0 && await page.locator('[data-new-business-analysis-action]').count() > 0, 'the current venture screen with new-business analysis');
    await goTo(page, 'home');

    // ---- assets ----
    await goTo(page, 'assets');
    await page.locator('[data-ui3-assets="summary"]').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('[data-ui3-assets="summary"] .u-stat > span').allInnerTexts(), ['保有物件', '時価', '賃料収入（週）']);
    assert.equal(await page.locator('[data-ui3-assets="none"]').count(), 1);
    await screenOk(page, 'assets (none)');
    const property = await engineEval(page, engine => { const p = engine.g.properties.find(x => !x.owner); const ok = engine.buyProperty(p.id, 'company'); return { ok, id: p.id }; });
    assert.ok(property.ok !== false, 'a property was bought for the test');
    await goTo(page, 'home'); await goTo(page, 'assets');
    await page.locator('[data-ui3-assets="properties"] .u-row').waitFor({ state: 'visible', timeout: 10000 });
    await screenOk(page, 'assets (one property)');
    const assetsBaseline = await digest(page);
    await page.locator('[data-ui3-assets="properties"] .u-row').tap();
    await page.locator('[data-ui3-asset="sell"]').waitFor({ state: 'visible' });
    await sheetOk(page, 'property sheet');
    await page.locator('[data-ui3-asset="sell"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const sellFacts = await confirmFacts(page);
    assert.equal(sellFacts[1][0], '実行後の会社現金');
    await page.locator('#modal-root [data-action="close-modal"]').first().tap();
    assert.equal(await digest(page), assetsBaseline, 'cancelling the sale changes nothing');
    const value = await engineEval(page, (engine, id) => engine.g.properties.find(x => x.id === id).value, property.id);
    const cashBeforeSell = await engineEval(page, engine => engine.g.companyCash);
    await page.locator('[data-ui3-assets="properties"] .u-row').tap();
    await page.locator('[data-ui3-asset="sell"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(id => !globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.properties.find(x => x.id === id).owner, property.id, { timeout: 10000 });
    const sold = await engineEval(page, engine => engine.g.companyCash);
    assert.ok(sold > cashBeforeSell, 'the company received the sale');
    // The sale amount on the confirmation sheet is a copy of the engine's rule (js/engine.js sellProperty: 97% of the value).
    // The company cash must rise by exactly the amount the sheet showed (taxes, if any, are reported in the notice).
    const expectedProceeds = Math.ceil(value * 0.97);
    assert.equal(sold - cashBeforeSell, expectedProceeds, 'the cash rose by exactly the sale amount shown (97% of the value)');
    const shown = await page.evaluate(amount => globalThis.__capitalismTycoonModules.engine.compactYen(amount), expectedProceeds);
    assert.equal(sellFacts[0][1], shown, 'the confirmation sheet showed that amount');
    assert.match(fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8'), /proceeds=ceilYen\(p\.value\*\.97\)/, 'the 97% copy matches the engine rule');
    await page.locator('[data-ui3-current="assets"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    assert.ok(await page.locator('[data-action="asset-tab"]').count() > 0, 'the current assets screen with its sub-tabs');
    await goTo(page, 'home');

    // ---- ma ----
    await goTo(page, 'ma');
    await page.locator('[data-ui3-ma="none-deals"]').waitFor({ state: 'visible' });
    await screenOk(page, 'ma');
    const idsBefore = await engineEval(page, engine => engine.g.acquisitionTargets.map(t => t.id));
    await page.locator('[data-ui3-ma="refresh"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(ids => { const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g; return g.acquisitionTargets.length > 0 && !g.acquisitionTargets.some(t => ids.includes(t.id)); }, idsBefore, { timeout: 10000 });
    await page.locator('[data-ui3-ma="targets"] .u-row').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-ui3-ma="targets"] .u-row').first().tap();
    await page.locator('#modal-root [data-action="ma-open-deal"]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.maDealRooms.length === 1, null, { timeout: 10000 });
    await page.locator('[data-ui3-ma="deals"] .u-row').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-ui3-ma="deals"] .u-row').tap();
    await page.locator('#modal-root [data-ui3-current="ma"]').waitFor({ state: 'visible' });
    await sheetOk(page, 'deal sheet');
    await closeSheet(page);
    await page.locator('[data-ui3-current="ma"]').first().tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    assert.ok(await page.locator('[data-ma-open-deal],[data-action="ma-start-dd"],[data-ma-dd-scope]').count() > 0, 'the current M&A screen shows the deal room');
    await goTo(page, 'home');

    // ---- pe-portfolio ----
    await goTo(page, 'ma');
    assert.equal(await page.locator('.ui3 .u-chips .u-chip').count(), 4, 'PE stays hidden until it is unlocked');
    await engineEval(page, engine => { engine.g.peFirm.unlocked = true; engine.g.peFirm.funds = [{ id: 'FUND-T', status: 'investing', cash: 120000000, deals: [{ id: 'DEAL-T', status: 'active', companyName: 'テスト食品', portfolioCompany: { cash: 5000000, weeklyProfit: 120000, storeCount: 2, improvementScore: 55, priceMultiplier: 1, qualityInvestment: 0 } }] }]; engine.emit?.(); });
    await goTo(page, 'home'); await goTo(page, 'ma');
    assert.equal(await page.locator('.ui3 .u-chips .u-chip').count(), 5, 'PE appears after the unlock');
    await goTo(page, 'pe-portfolio');
    await page.locator('[data-ui3-pe="summary"]').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('[data-ui3-pe="summary"] .u-stat > span').allInnerTexts(), ['ファンドの現金', '投資先', '週次損益（合計）']);
    await screenOk(page, 'pe-portfolio');
    const peBaseline = await digest(page);
    await page.locator('[data-ui3-pe="deal"]').tap();
    await page.locator('[data-ui3-pe-sheet]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), 'テスト食品');
    await sheetOk(page, 'pe deal sheet');
    assert.equal(await digest(page), peBaseline, 'looking at a portfolio company changes nothing');
    await closeSheet(page);

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-invest-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
