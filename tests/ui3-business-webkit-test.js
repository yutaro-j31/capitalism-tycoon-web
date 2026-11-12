'use strict';

// UI v3 business and office screens, and the shared confirmation sheet (docs/ui-v3/README.md 5.5, task UI3-4).
// Loads the real js/ui3-business.js and js/ui3-office.js. Proves in a real browser that:
//  - without ?ui=3 both current screens are unchanged (same controls with and without the v3 scripts);
//  - with ?ui=3 the screens show the README 5.5 shape and meet the acceptance numbers;
//  - a store opens the store sheet, whose money-moving rows go through the confirmation sheet (cost and
//    company cash afterwards shown; "やめる" changes nothing; the primary button runs the existing action
//    and closes the sheet), and whose other rows reach the existing actions;
//  - the business sheet reaches the investment, price and franchise actions, the IT/digital sheet reaches
//    the founding / launch actions;
//  - the office screen reaches welfare investment, remote work and cancelling the head office;
//  - looking at sheets never changes the game;
//  - "ほかの詳細（現行の画面）" shows the current screen, and any tab action brings the v3 screen back.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULES = /\/js\/ui3-(?:business|office)\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|business\.js|office\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
for (const file of ['ui3-business.js', 'ui3-office.js']) {
  const source = fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');
  assert.doesNotMatch(source, /Math\.random|MutationObserver|registerUIEnhancer/, `${file} uses no RNG, observer or D UI enhancer`);
  assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g|state\(\))\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, `${file} never assigns engine state`);
  assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage|(?<![\w.])confirm\(/, `${file} never saves, stores or uses the browser's confirm()`);
}
// The franchise head-office cost shown by the screen is a copy of the engine's constant: they must not drift apart.
{
  const engineSource = fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8');
  const engineCost = /startFranchise\(businessID\)[\s\S]*?companyCash<([\d_]+)\)return this\.fail\('FC本部整備費/.exec(engineSource)?.[1];
  const screenCost = /FRANCHISE_HQ_COST=([\d_]+)/.exec(fs.readFileSync(path.join(ROOT, 'js', 'ui3-business.js'), 'utf8'))?.[1];
  assert.ok(engineCost && screenCost, 'both franchise costs were found');
  assert.equal(Number(screenCost.replace(/_/g, '')), Number(engineCost.replace(/_/g, '')), 'ui3-business.js FRANCHISE_HQ_COST equals the cost in engine.startFranchise');
  const charged = /companyCash-=([\d_]+)/.exec(engineSource.slice(engineSource.indexOf('startFranchise(businessID)')))?.[1];
  assert.equal(Number(charged.replace(/_/g, '')), Number(engineCost.replace(/_/g, '')), 'the engine charges what it checks');
}
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(index.indexOf('./js/ui3-business.js') > index.indexOf('./js/ui3-shell.js') && index.indexOf('./js/ui3-office.js') < index.indexOf('./js/app.js'), 'index.html loads both scripts after the shell and before app.js');

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
// the current dialogs: amount dialogs on iPhone have their own cancel button, the others use close-modal
// the amount dialogs are v3 sheets now (UI3-9a); the name dialog of the IT business is still the current one
const cancelDialog = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"], #modal-root .modal [data-action="close-modal"]').first().tap();
const sheetText = page => page.locator('#modal-root .u-sheet').innerText();
const rowTexts = (page, selector) => page.locator(selector).evaluateAll(nodes => nodes.map(node => node.querySelector('b')?.innerText.trim() || node.innerText.trim()));
const actionsIn = (page, selector) => page.evaluate(selector => [...document.querySelectorAll(`${selector} [data-action]`)].map(node => `${node.dataset.action}${node.dataset.kind ? ':' + node.dataset.kind : ''}${node.disabled ? '(disabled)' : ''}`), selector);

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
  return { small, minFont, height: root.getBoundingClientRect().height, bottom: Math.round(root.getBoundingClientRect().bottom), primaries: [...root.querySelectorAll('.u-btn.primary')].filter(visible).length };
});

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async ({ withoutScreens = false } = {}) => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 business test */' }));
    if (withoutScreens) await context.route(SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 business and office screens */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // 1. Flag off: the current screens, unchanged by the presence of the v3 scripts.
    const current = {};
    for (const withoutScreens of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreens });
      await found(page, base);
      for (const tab of ['business', 'office']) {
        await goTo(page, tab);
        await page.locator(`[data-screen="${tab}"]`).waitFor({ state: 'attached', timeout: 10000 });
        assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
        const shape = await page.evaluate(() => [...document.querySelectorAll('#screen [data-action],#screen [data-bind]')].map(node => `${node.dataset.action || node.dataset.bind}:${node.dataset.tab || node.dataset.id || ''}`));
        (current[tab] ||= []).push(shape);
      }
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    for (const tab of ['business', 'office']) assert.deepEqual(current[tab][0], current[tab][1], `${tab}: the current screen is identical with and without the v3 scripts`);

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredScreens().sort()), ['business', 'office']);
    await goTo(page, 'business');
    await page.locator('[data-ui3-business="summary"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.ui3 #screen > h1').innerText(), '事業');
    assert.deepEqual(await page.locator('[data-ui3-business="summary"] .u-stat > span').allInnerTexts(), ['店舗', '週の利益', '最も稼ぐ店'], 'README 5.5: stores, weekly profit, best store');
    assert.deepEqual(await page.locator('.ui3 #screen .u-h2').allInnerTexts().then(list => list.filter(text => text.length < 8)), ['店舗', '未出店の業種', 'そのほか']);
    assert.deepEqual(await actionsIn(page, '[data-ui3-business="idle"]'), ['tab', 'tab', 'tab', 'tab'], 'not-started businesses go to the map, as the current screen does');
    assert.deepEqual(await rowTexts(page, '.ui3 #screen .u-list:last-of-type .u-row'), ['IT・デジタル事業', 'ほかの詳細（現行の画面）']);
    const founding = await metrics(page);
    assert.deepEqual([founding.small, founding.overflowX], [[], false]);
    assert.ok(founding.minFont >= 13 && founding.screens <= 2, `font ${founding.minFont}px, ${founding.screens} screens`);

    const baseline = await digest(page);

    // IT / digital sheet at founding: the founding action, through the current name dialog.
    await page.locator('[data-ui3-biz="digital"]').tap();
    await page.locator('[data-ui3-business="digital-actions"]').waitFor({ state: 'visible' });
    assert.ok((await actionsIn(page, '#modal-root')).every(action => action.startsWith('found-digital-business') || action === 'close-modal'), 'at founding: found-digital-business rows');
    const digitalSheet = await sheetMetrics(page);
    assert.deepEqual([digitalSheet.small, digitalSheet.primaries, digitalSheet.bottom], [[], 1, device.viewport.height]);
    await page.locator('#modal-root [data-action="found-digital-business"]:not([disabled])').first().tap();
    await page.locator('#modal-root .modal input').waitFor({ state: 'visible', timeout: 10000 });
    await cancelDialog(page);
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '');
    assert.equal(await digest(page), baseline, 'looking at sheets never changes the game');

    // 3. A store: open one through the engine (test setup), let four weeks pass.
    await engineEval(page, engine => {
      const tenant = engine.g.tenants.find(item => !item.occupiedBy);
      engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'テスト1号店', operatingHours: 3 });
    });
    for (let step = 0; step < 1; step += 1) {
      await page.locator('.ui3 .u-advance4').tap();
      await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.week >= 5, null, { timeout: 30000 });
      await page.evaluate(() => document.querySelector('#modal-root [data-action="close-modal"]')?.click());
    }
    await goTo(page, 'business');
    await page.locator('[data-ui3-business="stores"]').waitFor({ state: 'visible' });
    const storeRows = await page.locator('[data-ui3-business="stores"] .u-row').evaluateAll(nodes => nodes.map(node => [node.querySelector('b').innerText.trim(), node.querySelector('small').innerText.trim(), node.querySelector('.u-end').innerText.trim()]));
    assert.equal(storeRows.length, 1);
    assert.equal(storeRows[0][0], 'テスト1号店');
    assert.match(storeRows[0][1], /^ラーメン · (営業中|開業準備中)/);
    assert.match(storeRows[0][2], /^[+−]?[\d.,]+(万|円)/, 'the row ends with a signed profit');
    assert.equal(await page.locator('[data-ui3-business="summary"] .u-stat').nth(2).locator('b').innerText(), 'テスト1号店', 'the best store is named');
    assert.match(await page.locator('[data-ui3-business="summary"] .u-stat').first().locator('b').innerText(), /^1店$/);
    await engineEval(page, engine => { engine.g.stores[0].name = '観光カフェ駅前再開発ビル地下一階ラーメン横丁第一号店'; });
    await goTo(page, 'business');
    assert.equal(await page.evaluate(() => { const card = document.querySelector('[data-ui3-business="summary"]').getBoundingClientRect(); return [...document.querySelectorAll('[data-ui3-business="summary"] .u-stat')].every(stat => { const box = stat.getBoundingClientRect(); return box.right <= card.right && box.left >= card.left && stat.scrollWidth <= stat.clientWidth + 1; }); }), true, 'a long store name stays inside the card');
    assert.equal((await metrics(page)).overflowX, false);
    await engineEval(page, engine => { engine.g.stores[0].name = 'テスト1号店'; });
    await goTo(page, 'business');
    assert.deepEqual(await rowTexts(page, '[data-ui3-business="businesses"] .u-row'), ['ラーメン'], 'the started business');

    const beforeSheets = await digest(page);
    await page.locator('[data-ui3-biz="store"]').tap();
    await page.locator('[data-ui3-business="store-actions"]').waitFor({ state: 'visible' });
    const storeSheet = await sheetMetrics(page);
    assert.deepEqual([storeSheet.small, storeSheet.primaries, storeSheet.bottom], [[], 1, device.viewport.height]);
    assert.ok(storeSheet.minFont >= 13 && storeSheet.height <= device.viewport.height * 0.92 + 1);
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), 'テスト1号店');
    assert.deepEqual(await page.locator('#modal-root .u-stats .u-stat > span').allInnerTexts(), ['今週の売上', '今週の利益', '設備']);
    const storeActions = await page.evaluate(() => [...document.querySelectorAll('#modal-root [data-ui3-business="store-actions"] .u-row')].map(node => node.dataset.ui3Biz || node.dataset.action));
    for (const expected of ['concept', 'equipment', 'store-price', 'close-store']) assert.ok(storeActions.includes(expected), `store sheet row: ${expected} in ${storeActions}`);
    assert.equal(await digest(page), beforeSheets, 'opening the store sheet changes nothing');

    // Equipment: the shared confirmation sheet.
    const plan = await engineEval(page, engine => { const row = engine.storeEquipmentPlan(engine.g.stores[0].id); return { cost: row.cost, level: row.currentLevel, cash: engine.g.companyCash, id: engine.g.stores[0].id }; });
    await page.locator('#modal-root [data-ui3-biz="equipment"]').tap();
    await page.locator('[data-ui3-confirm]').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('#modal-root [data-ui3-confirm-facts] .u-stat > span').allInnerTexts(), ['費用', '実行後の会社現金'], 'the sheet states the cost and the cash afterwards');
    assert.match(await page.locator('#modal-root .u-sheet-head h1').innerText(), /設備強化/);
    const confirmMetrics = await sheetMetrics(page);
    assert.deepEqual([confirmMetrics.small, confirmMetrics.primaries, confirmMetrics.bottom], [[], 1, device.viewport.height], 'cancel + one primary button, anchored to the bottom');
    assert.deepEqual(await page.locator('#modal-root .u-sheet-foot button').evaluateAll(nodes => nodes.map(node => [node.innerText.trim(), node.dataset.action || '', node.classList.contains('primary')])).then(list => list.map(([text, action, primary]) => [text, action, primary])),
      [['やめる', 'close-modal', false], ['強化する', 'upgrade-store-equipment', true]]);
    assert.equal(await page.locator('[data-ui3-confirm]').getAttribute('data-id'), plan.id, 'the existing action and its id');
    // やめる: nothing happens.
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '');
    assert.equal(await digest(page), beforeSheets, 'やめる changes nothing');
    // 実行: the existing action runs once, the sheet closes.
    await page.locator('[data-ui3-biz="store"]').tap();
    await page.locator('#modal-root [data-ui3-biz="equipment"]').tap();
    await page.locator('[data-ui3-confirm]').tap();
    await page.waitForFunction(() => !document.querySelector('#modal-root [data-ui3-confirm]'), null, { timeout: 10000 });
    const afterEquipment = await engineEval(page, engine => ({ level: engine.storeEquipmentPlan(engine.g.stores[0].id).currentLevel, cash: engine.g.companyCash }));
    assert.equal(afterEquipment.level, plan.level + 1, 'the store\'s equipment went up one level');
    assert.equal(afterEquipment.cash, plan.cash - plan.cost, 'company cash fell by exactly the cost the sheet showed');
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '', 'the confirmation sheet closed itself');

    // Concept change: confirm sheet with the cost and the note.
    await page.locator('[data-ui3-biz="store"]').tap();
    await page.locator('#modal-root [data-ui3-biz="concept"]').first().tap();
    assert.match(await page.locator('#modal-root [data-ui3-confirm-note]').innerText(), /移行ペナルティ/);
    assert.equal(await page.locator('[data-ui3-confirm]').getAttribute('data-action'), 'store-concept');
    assert.ok(await page.locator('[data-ui3-confirm]').getAttribute('data-kind'));
    const conceptBefore = await engineEval(page, engine => { const id = engine.g.stores[0].id, plan = engine.getStoreConceptPlan(id); return { id, current: plan.currentID, cost: plan.cost, cash: engine.g.companyCash }; });
    const conceptKind = await page.locator('[data-ui3-confirm]').getAttribute('data-kind');
    await page.locator('[data-ui3-confirm]').tap();
    await page.waitForFunction(() => !document.querySelector('#modal-root [data-ui3-confirm]'), null, { timeout: 10000 });
    const conceptAfter = await engineEval(page, (engine, id) => ({ current: engine.getStoreConceptPlan(id).currentID, cash: engine.g.companyCash }), conceptBefore.id);
    assert.deepEqual([conceptAfter.current, conceptAfter.cash], [conceptKind, conceptBefore.cash - conceptBefore.cost], 'the concept changed and cash fell by exactly the cost shown');

    // Other rows reach the existing dialogs: store price (amount dialog) and closing (the current confirmation).
    await page.locator('[data-ui3-biz="store"]').tap();
    await page.locator('#modal-root [data-action="store-price"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    await cancelDialog(page);
    await page.locator('[data-ui3-biz="store"]').tap();
    await page.locator('#modal-root [data-action="close-store"]').tap();
    await page.locator('#modal-root .modal').waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await page.locator('#modal-root .modal').innerText(), /閉店/);
    await cancelDialog(page);
    assert.equal((await engineEval(page, engine => engine.g.stores.filter(store => store.status !== 'closed').length)), 1, 'cancelling the closing dialog keeps the store');

    // Business sheet.
    await page.locator('[data-ui3-biz="business"]').tap();
    await page.locator('[data-ui3-business="business-actions"]').waitFor({ state: 'visible' });
    assert.deepEqual(await actionsIn(page, '[data-ui3-business="business-actions"]'),
      ['business-invest:quality', 'business-invest:brand', 'business-invest:efficiency', 'business-invest:dx', 'business-price'], 'investments and price; the franchise row waits for three stores');
    assert.equal(await page.locator('[data-ui3-business="business-actions"] [data-ui3-biz="franchise"]').isDisabled(), true, 'the franchise head office needs three open stores');
    assert.deepEqual((await sheetMetrics(page)).small, []);
    await page.locator('#modal-root [data-action="business-invest"]').first().tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    await cancelDialog(page);
    // The franchise confirmation, with three stores forced on a throwaway game (not saved by this test).
    await engineEval(page, engine => { const open = engine.g.stores.find(store => store.businessID === 'ramen'); for (let i = 0; i < 2; i += 1) engine.g.stores.push({ ...open, id: `${open.id}-extra-${i}`, name: `追加${i}` }); engine.g.companyCash = 20000000; });
    await goTo(page, 'business');
    await page.locator('[data-ui3-biz="business"]').tap();
    await page.locator('#modal-root [data-ui3-biz="franchise"]').tap();
    assert.deepEqual(await page.locator('#modal-root [data-ui3-confirm-facts] .u-stat > span').allInnerTexts(), ['費用', '実行後の会社現金']);
    assert.equal(await page.locator('[data-ui3-confirm]').getAttribute('data-action'), 'start-franchise');
    const franchiseCash = await engineEval(page, engine => engine.g.companyCash);
    const franchiseCost = Number(/FRANCHISE_HQ_COST=([\d_]+)/.exec(fs.readFileSync(path.join(ROOT, 'js', 'ui3-business.js'), 'utf8'))[1].replace(/_/g, ''));
    await page.locator('[data-ui3-confirm]').tap();
    await page.waitForFunction(() => !document.querySelector('#modal-root [data-ui3-confirm]'), null, { timeout: 10000 });
    assert.deepEqual(await engineEval(page, engine => [engine.g.franchiseStoresByBusinessID.ramen, engine.g.companyCash]), [0, franchiseCash - franchiseCost], 'the franchise head office was set up for exactly the cost shown');

    // 4. Office.
    await goTo(page, 'office');
    await page.locator('[data-ui3-office="summary"]').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('[data-ui3-office="summary"] .u-stat > span').allInnerTexts(), ['本社', '社員数', '週の固定費'], 'README 5.5: head office, headcount, fixed cost');
    assert.deepEqual(await page.locator('.ui3 #screen h2.u-h2').allInnerTexts(), ['部門', 'CXO', '操作']);
    assert.deepEqual(await actionsIn(page, '[data-ui3-office="operations"]'), ['workforce-invest', 'toggle-remote'], 'no head-office cancellation while there is no head office');
    const officeMetrics = await metrics(page);
    assert.deepEqual([officeMetrics.small, officeMetrics.overflowX], [[], false]);
    assert.ok(officeMetrics.minFont >= 13 && officeMetrics.screens <= 2);
    const remoteBefore = await engineEval(page, engine => engine.g.remoteWorkEnabled);
    await page.locator('[data-action="toggle-remote"]').tap();
    await page.waitForFunction(before => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.remoteWorkEnabled !== before, remoteBefore, { timeout: 10000 });
    await page.locator('[data-action="toggle-remote"]').tap();
    await page.waitForFunction(before => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.remoteWorkEnabled === before, remoteBefore, { timeout: 10000 });
    await page.locator('[data-action="workforce-invest"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    await cancelDialog(page);
    // With a head office: the cancellation row appears (existing confirmation), departments and CXOs are listed.
    await engineEval(page, engine => { engine.g.hasHeadOffice = true; engine.g.officeName = 'テスト本社'; engine.g.departments.hr = true; engine.g.executives = { cfo: { role: 'CFO', name: '財務太郎', rank: 'A', trait: '堅実' } }; });
    await goTo(page, 'office');
    assert.deepEqual(await actionsIn(page, '[data-ui3-office="operations"]'), ['workforce-invest', 'toggle-remote', 'cancel-office']);
    assert.equal(await page.locator('[data-ui3-office="summary"] .u-stat').first().locator('b').innerText(), 'テスト本社');
    assert.ok((await rowTexts(page, '[data-ui3-office="departments"] .u-row')).length >= 1);
    assert.deepEqual(await rowTexts(page, '[data-ui3-office="executives"] .u-row'), ['CFO 財務太郎']);
    await page.locator('[data-action="cancel-office"]').tap();
    await page.locator('#modal-root .modal').waitFor({ state: 'visible', timeout: 10000 });
    await cancelDialog(page);

    // 5. The current screen as the way to what is not ported; any tab action brings v3 back.
    await page.locator('[data-ui3-current="office"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    assert.ok(await page.locator('[data-screen="office"]').count() > 0, 'the current office screen is shown');
    assert.ok(await page.locator('[data-action="office-tab"]').count() >= 6, 'with all its tabs');
    await page.evaluate(() => document.querySelector('[data-action="tab"][data-tab="home"]').click());
    await goTo(page, 'office');
    await page.locator('[data-ui3-office="summary"]').waitFor({ state: 'visible', timeout: 10000 });
    await goTo(page, 'business');
    await page.locator('[data-ui3-current="business"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    assert.ok(await page.locator('[data-screen="business"]').count() > 0, 'the current business screen is shown');
    // README 10.6: the return button sits above the current UI's bottom navigation (measured at 390x664), 48px high, and brings v3 back
    await page.locator('#ui3-return').waitFor({ state: 'visible', timeout: 10000 });
    const place = await page.evaluate(() => {
      const box = document.getElementById('ui3-return').getBoundingClientRect();
      const fixed = [...document.querySelectorAll('body *')].filter(element => element.id !== 'ui3-return' && getComputedStyle(element).position === 'fixed' && !element.closest('.toast, #toast-root')).map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
      return { height: Math.round(box.height), overlaps: fixed.filter(rect => box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top).length, fixed: fixed.length, rects: fixed.map(rect => [Math.round(rect.left), Math.round(rect.top), Math.round(rect.right), Math.round(rect.bottom)]), btn: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)], vh: innerHeight };
    });
    assert.deepEqual([place.height >= 48, place.overlaps], [true, 0], `the return button does not overlap the current UI's fixed parts: ${JSON.stringify(place)}`);
    await page.locator('#ui3-return').tap();
    await page.waitForFunction(() => document.body.classList.contains('ui3-native') && !document.getElementById('ui3-return'), null, { timeout: 10000 });
    assert.equal(await page.locator('[data-ui3-business="summary"]').count(), 1, 'the return button brings the v3 business screen back');
    await page.locator('[data-ui3-current="business"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    await page.evaluate(() => document.querySelector('[data-action="tab"][data-tab="business"]').click());
    await page.locator('[data-ui3-business="summary"]').waitFor({ state: 'visible', timeout: 10000 });

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-business-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
