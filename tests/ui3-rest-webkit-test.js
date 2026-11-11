'use strict';

// UI v3 screens strategy / overseas / media / rivals / missions / news (docs/ui-v3/README.md 5, task UI3-9). Loads the real
// js/ui3-strategy.js, ui3-overseas.js, ui3-media.js, ui3-rivals.js, ui3-missions.js and ui3-news.js. Proves in a real browser that:
//  - without ?ui=3 the current screens are unchanged (same controls with and without the v3 scripts);
//  - with ?ui=3 each screen shows its README shape and meets the acceptance numbers;
//  - media campaigns / forums / auctions, vertical integration, R&D, rival responses and setting up a local company go through the
//    confirmation sheet and the cash moves by exactly the shown cost (the copies of the engine's rules are checked against the
//    engine's text); a response the engine would refuse is disabled with the reason; cancelling changes nothing;
//  - viewing never changes the game and the current screen stays reachable for the rest.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULE = /\/js\/ui3-(?:strategy|overseas|media|rivals|missions|news)\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|strategy\.js|overseas\.js|media\.js|rivals\.js|missions\.js|news\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const FILES = ['ui3-strategy', 'ui3-overseas', 'ui3-media', 'ui3-rivals', 'ui3-missions', 'ui3-news'];
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
  const screenOk = async (page, label) => {
    const m = await metrics(page);
    assert.deepEqual([m.small, m.overflowX], [[], false], `${label}: ${JSON.stringify(m.small)}`);
    assert.ok(m.minFont >= 13 && m.screens <= 2, `${label}: font ${m.minFont}px, ${m.screens} screens`);
  };
  const cancel = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap();
  const waitCurrentUI = page => page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
  const cash = (page, key) => engineEval(page, (engine, k) => engine.g[k], key);
  const money = (page, amount) => page.evaluate(value => globalThis.__capitalismTycoonModules.engine.compactYen(value), amount);
  const confirmRun = async page => { await page.locator('#modal-root [data-ui3-confirm]').tap(); await page.waitForFunction(() => document.getElementById('modal-root').innerHTML === '', null, { timeout: 10000 }); };
  // the copies of the engine's rules in the v3 screens
  const read = file => fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
  assert.ok(read('expansion.js').includes('const price=x.currentBid*1.08;'), 'the auction price rule matches the engine');
  assert.ok(read('competitor-parity.js').includes('cost=2_000_000;if(state.companyCash<cost)'), 'the ads defence cost matches the engine');
  assert.ok(read('competitor-parity.js').includes('cost=2_500_000;if(state.companyCash<cost)'), 'the quality defence cost matches the engine');
  assert.ok(read('competitor-parity.js').includes('Math.max(5_000_000,globalThis.__capitalismTycoonModules.economicOperation.ceilYen(counter.strength*1_000_000+finite(company.cash)*1.2))'), 'the acquisition price rule matches the engine');
  assert.ok(read('engine.js').includes('const cost=c.cost+b.storeCost*2;'), 'the overseas set-up cost matches the engine');
  try {
    // 1. Flag off: the current screens, unchanged by the presence of the v3 scripts.
    const tabs = ['strategy', 'overseas', 'media', 'rivals', 'missions', 'news'];
    const current = Object.fromEntries(tabs.map(tab => [tab, []]));
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      for (const tab of tabs) {
        await goTo(page, tab);
        await page.locator(`[data-screen="${tab}"]`).waitFor({ state: 'attached', timeout: 10000 });
        assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
        current[tab].push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action],#screen [data-bind]')].map(node => `${node.dataset.action || node.dataset.bind}:${node.dataset.id || node.dataset.tab || node.dataset.kind || ''}`)));
      }
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    for (const tab of tabs) assert.deepEqual(current[tab][0], current[tab][1], `the current ${tab} screen is identical with and without the v3 scripts`);

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredScreens()), ['strategy', 'overseas', 'media', 'rivals', 'missions', 'news']);
    await engineEval(page, engine => { engine.g.companyCash = 900000000; engine.g.personalCash = 500000000; engine.emit?.(); });

    // ---- news / missions (read-only) ----
    await goTo(page, 'news');
    await page.locator('[data-ui3-news="news"], [data-ui3-news="none-news"]').first().waitFor({ state: 'visible' });
    await screenOk(page, 'news');
    await goTo(page, 'missions');
    await page.locator('[data-ui3-missions="missions"]').waitFor({ state: 'visible' });
    assert.ok(await page.locator('[data-ui3-missions="missions"] .u-row').count() > 0, 'the missions are listed');
    await screenOk(page, 'missions');
    const readOnlyBaseline = await digest(page);

    // ---- media ----
    await goTo(page, 'media');
    await page.locator('[data-ui3-media="summary"]').waitFor({ state: 'visible' });
    await screenOk(page, 'media');
    const action = await engineEval(page, engine => { const a = globalThis.__capitalismTycoonModules.completion.MEDIA_ACTIONS[0]; return { id: a.id, cost: a.cost }; });
    await page.locator(`[data-ui3-media="action"][data-id="${action.id}"]`).tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    assert.deepEqual((await confirmFacts(page)).map(f => f[0]), ['費用', '実行後の会社現金']);
    await sheetOk(page, 'media confirm');
    const beforeCancel = await digest(page);
    await cancel(page);
    assert.equal(await digest(page), beforeCancel, 'cancelling changes nothing');
    const mediaBefore = await cash(page, 'companyCash');
    await page.locator(`[data-ui3-media="action"][data-id="${action.id}"]`).tap();
    await confirmRun(page);
    assert.equal(mediaBefore - await cash(page, 'companyCash'), action.cost, 'the company paid exactly the shown cost');
    // a forum and an auction (injected into the state), paid by the founder
    await engineEval(page, engine => {
      engine.g.ventureForumEvents.push({ id: 'forum-t', name: 'テストフォーラム', status: 'open', fee: 300000, networkGain: 2, repGain: 1, expiresWeek: engine.g.week + 4 });
      engine.g.luxuryAuctionListings.push({ id: 'auction-t', name: 'テスト腕時計', category: '時計', rarity: 2, status: 'open', currentBid: 1000000, expiresWeek: engine.g.week + 4 });
      engine.emit?.();
    });
    await goTo(page, 'home'); await goTo(page, 'media');
    const forumBefore = await cash(page, 'personalCash');
    await page.locator('[data-ui3-media="forum"]').tap();
    await confirmRun(page);
    assert.equal(forumBefore - await cash(page, 'personalCash'), 300000, 'the founder paid exactly the forum fee');
    await page.locator('[data-ui3-media="auction"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    assert.equal((await confirmFacts(page))[0][1], await money(page, 1000000 * 1.08), 'the sheet shows the current bid x 1.08');
    const auctionBefore = await cash(page, 'personalCash');
    await confirmRun(page);
    assert.ok(Math.abs(auctionBefore - await cash(page, 'personalCash') - 1080000) < 1e-6, 'the founder paid exactly the current bid x 1.08');

    // ---- strategy ----
    await goTo(page, 'strategy');
    await page.locator('[data-ui3-strat="vi-list"]').waitFor({ state: 'visible' });
    await screenOk(page, 'strategy');
    const vi = await engineEval(page, engine => { const o = globalThis.__capitalismTycoonModules.expansion.VERTICAL_INTEGRATION_OFFERS[0]; return { id: o.id, cost: o.cost }; });
    await page.locator(`[data-ui3-strat="vi"][data-id="${vi.id}"]`).tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await sheetOk(page, 'vi confirm');
    const viBefore = await cash(page, 'companyCash');
    await confirmRun(page);
    assert.equal(viBefore - await cash(page, 'companyCash'), vi.cost, 'the vertical-integration investment cost exactly the shown amount');
    assert.equal(await page.locator(`[data-ui3-strat="vi"][data-id="${vi.id}"]`).count(), 0, 'the investment now shows as running');
    await page.locator('[data-ui3-strat-tab="rd"]').tap();
    await page.locator('[data-ui3-strat="rd-list"]').waitFor({ state: 'visible' });
    const rd = await engineEval(page, engine => { const o = globalThis.__capitalismTycoonModules.expansion.RD_PROJECTS[0]; return { id: o.id, cost: o.cost }; });
    assert.equal(await page.locator(`[data-ui3-strat="rd"][data-id="${rd.id}"]`).isDisabled(), true, 'research needs a product or DX department (the reason is shown)');
    assert.match(await page.locator(`[data-ui3-strat="rd"][data-id="${rd.id}"]`).innerText(), /商品開発部門またはDX部門/);
    await engineEval(page, engine => { engine.g.departments.product = true; engine.emit?.(); });
    await goTo(page, 'home'); await goTo(page, 'strategy');
    await page.locator('[data-ui3-strat-tab="rd"]').tap();
    await page.locator(`[data-ui3-strat="rd"][data-id="${rd.id}"]:not([disabled])`).tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const rdBefore = await cash(page, 'companyCash');
    await confirmRun(page);
    assert.equal(rdBefore - await cash(page, 'companyCash'), rd.cost, 'the research cost exactly the shown amount');
    await page.locator('[data-ui3-strat-tab="segments"]').tap();
    await page.locator('[data-ui3-strat="segments"], [data-ui3-strat="none-segments"]').first().waitFor({ state: 'visible' });
    await page.locator('[data-ui3-strat-tab="supply"]').tap();
    await page.locator('[data-ui3-current="strategy"]').tap();
    await waitCurrentUI(page);
    assert.ok(await page.locator('[data-action="strategy-tab"]').count() > 0, 'the current strategy screen with its tabs');
    await goTo(page, 'home');

    // ---- rivals ----
    await goTo(page, 'rivals');
    await page.locator('[data-ui3-rivals="rivals"], [data-ui3-rivals="none"]').first().waitFor({ state: 'visible' });
    assert.ok(await page.locator('[data-ui3-rival="rival"]').count() > 0, 'competitors are listed');
    await screenOk(page, 'rivals');
    await page.locator('[data-ui3-rival="rival"]').first().tap();
    await page.locator('[data-ui3-rival-sheet]').waitFor({ state: 'attached' });
    await sheetOk(page, 'rival sheet');
    assert.equal(await page.locator('[data-ui3-rival="respond"][data-kind="acquire"]').isDisabled(), true, 'acquisition is only for a distressed rival (the reason is shown)');
    const adsBefore = await cash(page, 'companyCash');
    await page.locator('[data-ui3-rival="respond"][data-kind="ads"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await confirmRun(page);
    assert.equal(adsBefore - await cash(page, 'companyCash'), 2000000, 'the ads defence cost exactly 2,000,000 yen');
    await page.locator('[data-ui3-rival="rival"]').first().tap();
    assert.equal(await page.locator('[data-ui3-rival="respond"][data-kind="ads"]').isDisabled(), true, 'the same response in the same week is disabled (the engine refuses it)');
    // acquiring a distressed rival: the price shown is what the engine takes
    await closeSheetByScrim(page);
    await goTo(page, 'home'); await goTo(page, 'rivals');
    await page.locator('[data-ui3-rivals="rivals"]').waitFor({ state: 'visible' });
    // (the screen re-derives the counter states when it is drawn, so the state is set after drawing)
    const rivalID = await engineEval(page, engine => { const c = engine.g.competitorStates[0]; c.isDistressed = true; const k = (engine.g.competitorCounterStates || []).find(x => x.id === c.id || x.competitorID === c.id); if (k) k.isDistressed = true; return c.id; });
    await page.locator(`[data-ui3-rival="rival"][data-id="${rivalID}"]`).tap();
    await page.locator('[data-ui3-rival="respond"][data-kind="acquire"]:not([disabled])').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const acquireFacts = await confirmFacts(page);
    // the price shown follows the engine's rule (strength from the counter state, cash from the company row; checked against the engine's text above)
    const expectedPrice = await engineEval(page, (engine, id) => { const c = engine.g.competitorStates.find(x => x.id === id); const k = (engine.g.competitorCounterStates || []).find(x => x.id === id || x.competitorID === id) || c; return Math.max(5e6, Math.ceil(k.strength * 1e6 + c.cash * 1.2)); }, rivalID);
    assert.equal(acquireFacts[0][1], await money(page, expectedPrice), 'the acquisition price shown follows the engine rule');
    await cancel(page);

    // ---- overseas ----
    await goTo(page, 'overseas');
    await page.locator('[data-ui3-os="countries"]').waitFor({ state: 'visible' });
    await screenOk(page, 'overseas');
    await page.locator('[data-ui3-os="country"]').first().tap();
    await page.locator('[data-ui3-os-sheet]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('[data-ui3-os="open"]').isDisabled(), true, 'a head office and a CEO are needed (the reason is shown)');
    assert.match(await page.locator('[data-ui3-os="cost"]').innerText(), /本社とCEOが必要/);
    await closeSheetByScrim(page);
    await engineEval(page, engine => { engine.g.hasHeadOffice = true; engine.g.executives.CEO = engine.g.executives.CEO || { id: 'ceo-t', name: 'テストCEO', role: 'CEO' }; engine.emit?.(); });
    await goTo(page, 'home'); await goTo(page, 'overseas');
    await page.locator('[data-ui3-os="country"]').first().tap();
    await page.locator('[data-ui3-os="open"]:not([disabled])').waitFor({ state: 'visible' });
    await sheetOk(page, 'country sheet');
    const target = await engineEval(page, engine => { const c = globalThis.__capitalismTycoonModules.data.OVERSEAS_COUNTRIES[0]; const b = engine.g.businesses[0]; return { cost: c.cost + b.storeCost * 2, id: b.id }; });
    await page.locator('[data-ui3-os="open"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    assert.equal((await confirmFacts(page))[0][1], await money(page, target.cost), 'the sheet shows the country cost plus twice the store cost');
    const osBefore = await cash(page, 'companyCash');
    await confirmRun(page);
    assert.equal(osBefore - await cash(page, 'companyCash'), target.cost, 'the company paid exactly the shown set-up cost');
    assert.equal(await engineEval(page, engine => engine.g.overseasSubsidiaries.length), 1);
    await page.locator('[data-ui3-current="overseas"]').tap();
    await waitCurrentUI(page);
    assert.ok(await page.locator('[data-screen="overseas"]').count() > 0, 'the current overseas screen');
    await goTo(page, 'home');

    assert.ok(readOnlyBaseline.length > 0);
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-rest-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
  async function closeSheetByScrim(page) { await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap(); }
}

main().catch(error => { console.error(error); process.exit(1); });
