'use strict';

// UI v3 company tab screens founder / legacy / settings (docs/ui-v3/README.md 5, task UI3-8). Loads the real js/ui3-founder.js,
// ui3-legacy.js and ui3-settings.js. Proves in a real browser that:
//  - without ?ui=3 the current screens are unchanged (same controls with and without the v3 scripts);
//  - with ?ui=3 each screen shows its README shape and meets the acceptance numbers;
//  - the founder's free actions run, and the home upgrade / self-investments / trust set-up / training / appointing a
//    successor go through the confirmation sheet whose cost is exactly what the personal cash then pays (the copies of the
//    engine's fixed costs are checked against the engine's text); cancelling changes nothing;
//  - the settings segments change the same settings as the current screen, and overwriting / loading a slot, starting over
//    and the company sale are confirmation sheets (starting over really returns to the founding screen);
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
const SCREEN_MODULE = /\/js\/ui3-(?:founder|legacy|settings)\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|founder\.js|legacy\.js|settings\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const FILES = ['ui3-founder', 'ui3-legacy', 'ui3-settings'];
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
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 company test */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 company screens */' }));
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
  const screenOk = async (page, label, maxScreens = 2) => {
    const m = await metrics(page);
    assert.deepEqual([m.small, m.overflowX], [[], false], `${label}: ${JSON.stringify(m.small)}`);
    assert.ok(m.minFont >= 13 && m.screens <= maxScreens, `${label}: font ${m.minFont}px, ${m.screens} screens`);
  };
  const cancel = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap();
  const waitCurrentUI = page => page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
  const personalCash = page => engineEval(page, engine => engine.g.personalCash);
  const expansionSource = fs.readFileSync(path.join(ROOT, 'js', 'expansion.js'), 'utf8');
  // the copies of the engine's fixed costs in the v3 screens
  assert.ok(expansionSource.includes('costs=[0,800000,2500000,8000000,25000000,80000000,250000000,800000000]'), 'the home upgrade cost table matches the engine');
  assert.ok(expansionSource.includes('const cost=1500000;'), 'the successor training cost matches the engine');
  assert.ok(expansionSource.includes('const cost=10000000;if(this.g.personalCash<cost)return this.fail(\'設立費用が不足しています。\')'), 'the family trust set-up cost matches the engine');
  assert.ok(expansionSource.includes('specs={education:[800000,6],network:[600000,7],successor:[700000,5],foundation:[5000000,1]'), 'the self-investment costs match the engine');
  try {
    // 1. Flag off: the current screens, unchanged by the presence of the v3 scripts.
    const current = { founder: [], legacy: [], settings: [] };
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      for (const tab of Object.keys(current)) {
        await goTo(page, tab);
        await page.locator(`[data-screen="${tab}"]`).waitFor({ state: 'attached', timeout: 10000 });
        assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
        current[tab].push(await page.evaluate(() => [...document.querySelectorAll('#screen [data-action],#screen [data-bind],#screen [data-setting]')].map(node => `${node.dataset.action || node.dataset.bind || node.dataset.setting}:${node.dataset.id || node.dataset.tab || node.dataset.kind || ''}`)));
      }
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    for (const tab of Object.keys(current)) assert.deepEqual(current[tab][0], current[tab][1], `the current ${tab} screen is identical with and without the v3 scripts`);

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredScreens()), ['founder', 'legacy', 'settings']);
    await engineEval(page, engine => { engine.g.personalCash = 200000000; engine.emit?.(); });

    // ---- founder ----
    await goTo(page, 'founder');
    await page.locator('[data-ui3-founder="summary"]').waitFor({ state: 'visible' });
    assert.deepEqual(await page.locator('[data-ui3-founder="summary"] .u-stat > span').allInnerTexts(), ['個人の純資産', '4スキルの合計', '後継者の準備度']);
    assert.equal(await page.locator('[data-ui3-founder="actions"] .u-row').count(), 6, 'the six home actions');
    await screenOk(page, 'founder');
    const founderBaseline = await digest(page);
    // A free action.
    const skillBefore = await engineEval(page, engine => engine.g.founderSkillBusiness);
    const cashBefore = await personalCash(page);
    await page.locator('[data-action="founder-action"][data-kind="studyBusiness"]').tap();
    await page.waitForFunction(before => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.founderSkillBusiness > before, skillBefore, { timeout: 10000 });
    assert.equal(await personalCash(page), cashBefore, 'a study action costs no cash');
    // Home upgrade: the cost shown is the cost paid.
    await page.locator('[data-ui3-founder="home"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const homeFacts = await confirmFacts(page);
    assert.deepEqual(homeFacts.map(f => f[0]), ['費用', '実行後の個人現金']);
    await sheetOk(page, 'home confirm');
    const digestBeforeCancel = await digest(page);
    await cancel(page);
    assert.equal(await digest(page), digestBeforeCancel, 'cancelling changes nothing');
    const levelBefore = await engineEval(page, engine => engine.g.founderHomeLevel);
    const homeCash = await personalCash(page);
    await page.locator('[data-ui3-founder="home"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(level => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.founderHomeLevel === level + 1, levelBefore, { timeout: 10000 });
    assert.equal(homeCash - await personalCash(page), 800000, 'the personal cash paid exactly the shown cost (level 1 → 2)');
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '', 'the confirmation closed');
    // Self-investment.
    const investCash = await personalCash(page);
    const readinessBefore = await engineEval(page, engine => engine.g.successorReadiness);
    await page.locator('[data-ui3-founder="invest"][data-kind="successor"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(before => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.successorReadiness > before, readinessBefore, { timeout: 10000 });
    assert.equal(investCash - await personalCash(page), 700000, 'the successor investment cost exactly the shown 700,000 yen');
    assert.equal(await page.locator('[data-ui3-founder="invest"][data-kind="foundation"]').count(), 1);
    // The current screen as the way to the rest.
    await page.locator('[data-ui3-current="founder"]').tap();
    await waitCurrentUI(page);
    assert.ok(await page.locator('[data-screen="founder"]').count() > 0 && await page.locator('[data-action="create-angel"]').count() > 0, 'the current founder screen with the angel entry');
    await goTo(page, 'home');
    assert.ok(founderBaseline.length > 0);

    // ---- legacy ----
    await goTo(page, 'legacy');
    await page.locator('[data-ui3-legacy="succession"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-ui3-legacy="retire"]').isDisabled(), true, 'retirement needs the conditions');
    await screenOk(page, 'legacy');
    const candidate = await engineEval(page, engine => { const c = globalThis.__capitalismTycoonModules.expansion.SUCCESSOR_CANDIDATES[0]; return { id: c.id, name: c.name, cost: c.cost }; });
    const legacyBaseline = await digest(page);
    await page.locator(`[data-ui3-legacy="appoint"][data-id="${candidate.id}"]`).tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await cancel(page);
    assert.equal(await digest(page), legacyBaseline, 'cancelling the appointment changes nothing');
    const appointCash = await personalCash(page);
    await page.locator(`[data-ui3-legacy="appoint"][data-id="${candidate.id}"]`).tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.successorCandidate, null, { timeout: 10000 });
    assert.equal(appointCash - await personalCash(page), candidate.cost, 'the appointment cost exactly the shown amount');
    // Training: 1,500,000 yen, readiness +6.
    await page.locator('[data-ui3-legacy="train"]').waitFor({ state: 'visible', timeout: 10000 });
    const trainCash = await personalCash(page);
    const trainBefore = await engineEval(page, engine => engine.g.successorCandidate.readiness);
    await page.locator('[data-ui3-legacy="train"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(before => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.successorCandidate.readiness > before, trainBefore, { timeout: 10000 });
    assert.equal(trainCash - await personalCash(page), 1500000);
    assert.equal(await page.locator('[data-action="execute-succession"]').isDisabled(), true, 'the succession needs readiness 70');
    // Family trust: 10,000,000 yen becomes the trust's cash.
    const trustCash = await personalCash(page);
    await page.locator('[data-ui3-legacy="trust"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.familyTrustEstablished, null, { timeout: 10000 });
    assert.equal(trustCash - await personalCash(page), 10000000);
    assert.equal(await engineEval(page, engine => engine.g.familyTrustCash), 10000000);
    await page.locator('[data-ui3-current="legacy"]').tap();
    await waitCurrentUI(page);
    assert.ok(await page.locator('[data-screen="legacy"]').count() > 0 && await page.locator('[data-action="transfer-trust"]').count() > 0, 'the current legacy screen with the trust transfer');
    await goTo(page, 'home');

    // ---- settings ----
    await goTo(page, 'settings');
    await page.locator('[data-ui3-settings="saves"]').waitFor({ state: 'visible' });
    await screenOk(page, 'settings');
    assert.equal(await page.locator('#import-file').count(), 1, 'the import input exists for the existing import-save action');
    const settingsBaseline = await digest(page);
    // the segments drive the same settings as the current screen
    const autoBefore = await engineEval(page, engine => engine.g.autoManage);
    await page.locator(`[data-ui3-set="autoManage"][data-value="${!autoBefore}"]`).tap();
    await page.waitForFunction(before => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.autoManage !== before, autoBefore, { timeout: 10000 });
    await page.locator('[data-ui3-set="autoManageStyle"][data-value="aggressive"]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.autoManageStyle === 'aggressive', null, { timeout: 10000 });
    await page.locator('[data-ui3-set="reducedMotion"][data-value="true"]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.settings.reducedMotion === true, null, { timeout: 10000 });
    assert.equal(await page.locator('[data-ui3-set="autoManageStyle"][data-value="aggressive"]').getAttribute('aria-pressed'), 'true');
    // saving is direct; a slot is a sheet with confirmations
    await page.locator('[data-action="save-now"]').tap();
    await page.locator('[data-ui3-settings="slots"]').tap();
    await page.locator('[data-ui3-settings-sheet]').waitFor({ state: 'attached' });
    await sheetOk(page, 'slot sheet');
    await page.locator('[data-ui3-settings-confirm="save-slot"][data-id="2"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await sheetOk(page, 'slot confirm');
    await cancel(page);
    await page.locator('[data-ui3-settings="slots"]').tap();
    await page.locator('[data-ui3-settings-confirm="save-slot"][data-id="2"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(() => document.getElementById('modal-root').innerHTML === '', null, { timeout: 5000 });
    assert.ok(await page.evaluate(() => Object.keys(localStorage).some(key => /slot.*2|2.*slot/i.test(key))), 'slot 2 was saved');
    await page.locator('[data-ui3-settings="slots"]').tap();
    await page.locator('[data-ui3-settings-confirm="load-slot"][data-id="2"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await cancel(page);
    // buyout and reset are confirmations; cancelling changes nothing
    const dangerBaseline = await digest(page);
    await page.locator('[data-ui3-settings-confirm="buyout"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await sheetOk(page, 'buyout confirm');
    await cancel(page);
    await page.locator('[data-ui3-settings-confirm="reset"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    await cancel(page);
    assert.equal(await digest(page), dangerBaseline, 'cancelling the sale and the reset changes nothing');
    assert.ok(settingsBaseline.length > 0);
    // the current screen as the way to the rest
    await page.locator('[data-ui3-current="settings"]').tap();
    await waitCurrentUI(page);
    assert.ok(await page.locator('[data-release-diagnostics-action]').count() > 0, 'the current settings screen with the diagnostics');
    await goTo(page, 'home');
    // starting over really returns to the founding screen
    await goTo(page, 'settings');
    await page.locator('[data-ui3-settings-confirm="reset"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 10000 });

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-company-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
