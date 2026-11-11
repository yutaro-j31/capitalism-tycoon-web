'use strict';

// UI v3 foundation (docs/ui-v3/README.md, task UI3-0).
// Proves in a real browser that:
//  - without ?ui=3 nothing changes, even when a v3 screen is registered;
//  - with ?ui=3 a registered screen is rendered inside the v3 frame, the D UI
//    enhancer pipeline does not touch it, and an unregistered screen still
//    renders the current D UI in full;
//  - every screen stays reachable through [data-action="tab"][data-tab];
//  - the UI preference never enters the save.
// The page is loaded without the real screen modules (see SCREEN_MODULE), so porting a
// screen never changes what this test observes.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const SCREEN_MODULE = /\/js\/ui3-(?!shell\.js)[^/?]+\.js(?:\?.*)?$/;
const SCREENS = ['home', 'map', 'business', 'office', 'market', 'venture', 'ma', 'overseas', 'assets', 'bank',
  'report', 'founder', 'strategy', 'media', 'legacy', 'missions', 'rivals', 'news', 'settings'];
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

// --- static contracts ---------------------------------------------------
const canonicalCss = fs.readFileSync(path.join(ROOT, 'docs', 'ui-v3', 'ui3.css'));
assert.ok(canonicalCss.equals(fs.readFileSync(path.join(ROOT, 'css', 'ui3.css'))), 'css/ui3.css must stay byte-identical to docs/ui-v3/ui3.css');
const shellSource = fs.readFileSync(path.join(ROOT, 'js', 'ui3-shell.js'), 'utf8');
for (const [url, excluded] of [['/js/ui3-home.js', true], ['/js/ui3-home.js?rev=abc', true], ['/js/ui3-shell.js', false], ['/js/ui3-shell.js?rev=abc', false], ['/js/app.js', false], ['/css/ui3-home.css', false]]) {
  assert.equal(SCREEN_MODULE.test(url), excluded, `screen-module filter for ${url}`);
}
assert.doesNotMatch(shellSource, /Math\.random|MutationObserver|registerUIEnhancer/, 'the v3 shell uses no RNG, observer or D UI enhancer');
assert.doesNotMatch(shellSource, /\b(?:g|engine\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the v3 shell never assigns engine state');
assert.doesNotMatch(shellSource, /\.save\(|setItem\((?!PREFERENCE_KEY)/, 'the v3 shell never saves the game or writes another storage key');
for (const rule of canonicalCss.toString('utf8').split('}').map(block => block.split('{')[0].trim()).filter(Boolean)) {
  for (const selector of rule.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map(part => part.trim()).filter(Boolean)) {
    assert.match(selector, /^(?:\.ui3\b|body\.ui3-native\b|body:has\(#modal-root \.u-sheet\) \.ui3\b|body:has\(#modal-root \.u-sheet\) \.toast$)/, `ui3.css selector must stay scoped to UI v3: ${selector}`);
  }
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

// Runs in the page: registers two throwaway screens the way a real screen module will.
function registerProbeScreens() {
  const ui3 = globalThis.__capitalismTycoonModules.ui3;
  for (const id of ['home', 'market']) {
    if (ui3.registeredScreens().includes(id)) continue;
    ui3.registerScreen(id, { useCurrentUI: id === 'market' ? () => globalThis.__ui3ProbeUseCurrentUI === true : undefined, render: ({ g, esc, money }) => `<section class="u-card" data-probe="${esc(id)}"><div class="u-stat"><span>会社現金</span><b class="u-money">${esc(money(g.companyCash))}</b></div></section>` });
  }
}
// Runs in the page: registers a throw-away sheet the way a real sheet module (js/ui3-weekly-report.js) does.
function registerProbeSheet() {
  const ui3 = globalThis.__capitalismTycoonModules.ui3;
  if (ui3.registeredSheets().includes('weekly-report')) return;
  ui3.registerSheet('weekly-report', { render: ({ g, summary, esc, money }) => ({ eyebrow: '第' + (summary?.week ?? g.week) + '週の結果', title: 'probe report', body: '<p>' + esc(money(g.companyCash)) + '</p>', actions: '<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>' }) });
}
const renderProbeSheet = () => {
  const m = globalThis.__capitalismTycoonModules, engine = m.playerEngineBridge.getEngine();
  return m.ui3.renderSheet('weekly-report', { engine, engineModule: m.engine, summary: { week: 7 } });
};
const goTo = (page, tab) => page.evaluate(id => document.querySelector(`[data-action="tab"][data-tab="${id}"]`).click(), tab);
const snapshot = page => page.evaluate(key => {
  const modules = globalThis.__capitalismTycoonModules;
  const g = modules.playerEngineBridge.getEngine().g;
  const frame = document.querySelector('#app > .ui3.u-app');
  return {
    native: Boolean(frame), frameScreen: frame?.dataset.ui3Screen || null, frameGroup: frame?.dataset.ui3Group || null,
    bodyNative: document.body.classList.contains('ui3-native'), bodyDUI: document.body.classList.contains('d-ui-active'),
    sidebar: Boolean(document.getElementById('d-ui-sidebar')), screen: document.getElementById('screen')?.dataset.screen || null,
    selectedTab: g.selectedTab, week: g.week, pipelineRuns: modules.uiEnhancerRegistry.stats().pipelineRuns,
    save: localStorage.getItem(key) || '', preference: localStorage.getItem(modules.ui3.PREFERENCE_KEY)
  };
}, SAVE_KEY);

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    // This test is about the shell, not about any real screen. Real screen modules
    // (js/ui3-<screen>.js) are kept out of the page so that the registered set is exactly
    // the probes below, however many screens have been ported. Each real screen is
    // covered by its own tests/ui3-<screen>-webkit-test.js.
    await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 shell test */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // 1. Flag off: a registered v3 screen changes nothing.
    {
      const { context, page, pageErrors } = await newPage();
      await found(page, base);
      assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.enabled()), false);
      await page.evaluate(registerProbeScreens);
      // A registered sheet is not shown either: renderSheet answers '' so js/app.js keeps its current modal.
      assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredSheets()), [], 'no real sheet module is loaded in the shell test');
      await page.evaluate(registerProbeSheet);
      assert.equal(await page.evaluate(renderProbeSheet), '', 'without ?ui=3 renderSheet is empty, even for a registered sheet');
      await goTo(page, 'home');
      const off = await snapshot(page);
      assert.deepEqual([off.native, off.bodyNative, off.bodyDUI, off.sidebar, off.screen], [false, false, true, true, 'home'], 'without ?ui=3 the current D UI renders, even for a registered screen');
      assert.equal(off.preference, null);
      assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.amountSheet({ title: '購入株数', initial: 100, submit() {} })), false, 'without ?ui=3 the amount sheet takes nothing (askMoney keeps its dialog)');
      assert.deepEqual(pageErrors, []);
      await context.close();
    }

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.enabled()), true);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredScreens()), [], 'no real screen module is loaded in the shell test');
    const before = await snapshot(page);
    assert.deepEqual([before.native, before.bodyDUI, before.sidebar], [false, true, true], 'a screen that is not registered renders the current D UI in full');
    assert.equal(before.preference, '3', '?ui=3 is remembered on the device');

    await page.evaluate(registerProbeScreens);
    await goTo(page, 'home');
    const home = await snapshot(page);
    assert.deepEqual([home.native, home.frameScreen, home.frameGroup, home.screen], [true, 'home', 'home', 'home']);
    assert.deepEqual([home.bodyNative, home.bodyDUI, home.sidebar], [true, false, false], 'the D UI shell does not touch a native screen');
    assert.ok(!/capitalism_tycoon_ui|ui3/.test(home.save) && JSON.parse(home.save).saveVersion === 9, 'the UI preference never enters the save');
    assert.match(await page.locator('.ui3 .u-top').innerText(), /第1週/);
    assert.match(await page.locator('.ui3 .u-top').innerText(), /800\.0万/);
    assert.deepEqual(await page.locator('.ui3 .u-tabbar .u-tab').allInnerTexts().then(list => list.map(text => text.replace(/\s+/g, '').replace(/^[^ぁ-んァ-ヶ一-龠]+/, ''))), ['ホーム', 'マップ', '事業', '投資', '会社']);
    assert.equal(await page.locator('.ui3 .u-chips').count(), 0, 'the home hub has no chip row');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-ui3-all-screens] [data-tab]')].map(node => node.dataset.tab).sort()), [...SCREENS].sort(), 'every unlocked screen is reachable by id; PE stays hidden until unlocked');

    // Re-rendering a native screen does not run the D UI enhancer pipeline.
    await goTo(page, 'home');
    assert.equal((await snapshot(page)).pipelineRuns, home.pipelineRuns);

    // Frame meets the measurable acceptance numbers.
    const frame = await page.evaluate(() => {
      const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
      const controls = [...document.querySelectorAll('#app button')].filter(visible).map(element => { const box = element.getBoundingClientRect(); return [element.className, Math.round(box.width), Math.round(box.height)]; });
      let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
      const dock = document.querySelector('.ui3 .u-dock').getBoundingClientRect(), tabs = document.querySelector('.ui3 .u-tabbar').getBoundingClientRect();
      return { controls, minFont, overflowX: document.documentElement.scrollWidth > innerWidth, dockAboveTabs: dock.bottom <= tabs.top, tabsAtBottom: Math.round(tabs.bottom) === innerHeight };
    });
    assert.ok(frame.minFont >= 13, `smallest text is ${frame.minFont}px`);
    assert.deepEqual(frame.controls.filter(([, width, height]) => width < 44 || height < 44), [], 'every control is at least 44x44');
    assert.deepEqual([frame.overflowX, frame.dockAboveTabs, frame.tabsAtBottom], [false, true, true]);

    // Tab bar -> registered hub screen with chips; chip -> unregistered screen falls back to the D UI.
    await page.locator('.ui3 .u-tab[data-ui3-group="invest"]').tap();
    const market = await snapshot(page);
    assert.deepEqual([market.native, market.frameScreen, market.frameGroup, market.selectedTab], [true, 'market', 'invest', 'market']);
    assert.deepEqual(await page.locator('.ui3 .u-chips .u-chip').allInnerTexts(), ['株式', 'ベンチャー', 'M&A', '不動産']);
    assert.equal(await page.locator('.ui3 .u-chip[aria-current="page"]').innerText(), '株式');
    assert.deepEqual(await page.locator('.ui3 #screen > *').evaluateAll(nodes => nodes.map(node => node.tagName + (node.className ? '.' + node.className : ''))), ['H1.u-h1', 'NAV.u-chips', 'SECTION.u-card'], 'a hub screen is heading, chips, then the screen body');
    assert.equal(await page.locator('.ui3 #screen > h1').innerText(), '投資');
    await page.locator('.ui3 .u-chip[data-tab="venture"]').tap();
    await page.waitForFunction(() => Boolean(document.getElementById('d-ui-sidebar')), null, { timeout: 10000 });
    const venture = await snapshot(page);
    assert.deepEqual([venture.native, venture.bodyNative, venture.bodyDUI, venture.sidebar, venture.screen, venture.selectedTab], [false, false, true, true, 'venture', 'venture'], 'an unregistered screen renders the complete current UI');
    assert.ok(venture.pipelineRuns > market.pipelineRuns, 'the enhancer pipeline resumes on the current UI');

    // Back from the current UI into a native screen; the invest tab remembers its last native screen.
    await goTo(page, 'home');
    assert.equal((await snapshot(page)).native, true);
    assert.equal(await page.locator('.ui3 .u-tab[data-ui3-group="invest"]').getAttribute('data-tab'), 'market');

    // The dock advances the week through the existing action; the frame survives.
    await page.locator('.ui3 .u-advance').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.week === 2, null, { timeout: 10000 });
    await page.evaluate(() => document.querySelector('#modal-root [data-action="close-modal"]')?.click());
    const advanced = await snapshot(page);
    assert.deepEqual([advanced.native, advanced.week, advanced.bodyDUI], [true, 2, false]);
    assert.match(await page.locator('.ui3 .u-top').innerText(), /第2週/);

    // A screen can hand a state back to the current UI (README 6.5), and takes it back afterwards.
    await page.evaluate(() => { globalThis.__ui3ProbeUseCurrentUI = true; });
    await goTo(page, 'market');
    await page.waitForFunction(() => Boolean(document.getElementById('d-ui-sidebar')), null, { timeout: 10000 });
    const handedBack = await snapshot(page);
    assert.deepEqual([handedBack.native, handedBack.bodyDUI, handedBack.screen], [false, true, 'market'], 'useCurrentUI() renders the complete current UI for a registered screen');
    await page.evaluate(() => { globalThis.__ui3ProbeUseCurrentUI = false; });
    await goTo(page, 'market');
    assert.deepEqual([(await snapshot(page)).native, await page.locator('.ui3 [data-ui3-crisis]').count()], [true, 0]);

    // Cash crisis: the registered home falls back to the current UI, which carries the recovery
    // panel, and every other native screen points there. The status is forced on a throwaway
    // game purely to exercise the routing; nothing is saved by this test afterwards.
    await page.evaluate(() => { const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g; g.playerCrisis = { ...(g.playerCrisis || {}), status: 'distressed' }; });
    await goTo(page, 'market');
    assert.equal((await snapshot(page)).native, true);
    assert.match(await page.locator('.ui3 [data-ui3-crisis="distressed"]').innerText(), /資金繰り危機/);
    await page.locator('.ui3 [data-ui3-crisis]').tap();
    await page.waitForFunction(() => Boolean(document.getElementById('d-ui-sidebar')), null, { timeout: 10000 });
    const crisisHome = await snapshot(page);
    assert.deepEqual([crisisHome.native, crisisHome.bodyDUI, crisisHome.screen], [false, true, 'home'], 'during a cash crisis the home screen is the current UI');
    assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.usesCurrentUI('home', globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g)), true);
    await page.evaluate(() => { const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g; g.playerCrisis = { ...g.playerCrisis, status: 'stable' }; });
    await goTo(page, 'home');
    assert.equal((await snapshot(page)).native, true, 'home returns to v3 once the crisis is over');

    // A screen may attach something markup cannot carry: `mount` runs once, after js/app.js has put the
    // screen's markup into #app, with the host element and the game; it must be a function.
    await page.evaluate(() => {
      const ui3 = globalThis.__capitalismTycoonModules.ui3;
      globalThis.__ui3Mounts = [];
      ui3.registerScreen('map', { render: () => '<section data-probe="map-host"></section>', mount: ({ host, g, engine }) => { globalThis.__ui3Mounts.push([host.dataset.ui3Screen, Boolean(host.querySelector('[data-probe="map-host"]')), g.selectedTab, engine.g === g]); } });
      try { ui3.registerScreen('assets', { render: () => '', mount: 5 }); globalThis.__ui3MountError = 'none'; } catch (error) { globalThis.__ui3MountError = error.name; }
    });
    assert.equal(await page.evaluate(() => globalThis.__ui3MountError), 'TypeError', 'mount must be a function');
    await goTo(page, 'map');
    await page.waitForFunction(() => globalThis.__ui3Mounts.length === 1, null, { timeout: 10000 });
    assert.deepEqual(await page.evaluate(() => globalThis.__ui3Mounts), [['map', true, 'map', true]], 'mount runs once, after the markup is in the page');
    await goTo(page, 'home');
    assert.equal(await page.evaluate(() => globalThis.__ui3Mounts.length), 1, 'a screen without mount, or another screen, does not run it');

    // Sheet: hides the dock, closes through the existing close-modal action.
    await page.evaluate(() => { document.getElementById('modal-root').innerHTML = globalThis.__capitalismTycoonModules.ui3.sheet({ eyebrow: '確認', title: 'probe sheet', body: '<p>本文</p>', actions: '<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>' }); });
    assert.equal(await page.locator('.ui3 .u-dock').evaluate(node => getComputedStyle(node).display), 'none');
    const sheetBox = await page.locator('#modal-root .u-sheet').boundingBox();
    assert.equal(Math.round(sheetBox.y + sheetBox.height), device.viewport.height, 'the sheet is anchored to the bottom edge');
    // While a sheet is open the toast goes to the top edge, so it never covers the sheet's foot.
    await page.evaluate(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().notify('probe toast'));
    await page.locator('.toast').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500);
    const toastBox = await page.locator('.toast').boundingBox();
    assert.ok(toastBox.y < 40 && toastBox.y + toastBox.height < sheetBox.y, `the toast is at the top edge, above the sheet (y=${toastBox.y})`);
    await page.locator('#modal-root .u-btn.primary').tap();
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '');
    assert.notEqual(await page.locator('.ui3 .u-dock').evaluate(node => getComputedStyle(node).display), 'none');

    // Sheet registry: only known ids, a render function, no duplicates; renderSheet is '' until one is registered.
    assert.equal(await page.evaluate(renderProbeSheet), '', 'an unregistered sheet renders as an empty string');
    const sheetErrors = await page.evaluate(() => {
      const ui3 = globalThis.__capitalismTycoonModules.ui3, errors = [];
      for (const attempt of [() => ui3.registerSheet('nope', { render: () => ({}) }), () => ui3.registerSheet('weekly-report', {}), () => ui3.registerSheet('weekly-report', { render: 1 })]) {
        try { attempt(); errors.push('no error'); } catch (error) { errors.push(error.constructor.name); }
      }
      return errors;
    });
    assert.deepEqual(sheetErrors, ['RangeError', 'TypeError', 'TypeError'], 'unknown id, missing render and non-function render are refused');
    await page.evaluate(registerProbeSheet);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredSheets()), ['weekly-report']);
    const duplicate = await page.evaluate(() => {
      try { globalThis.__capitalismTycoonModules.ui3.registerSheet('weekly-report', { render: () => ({}) }); return 'no error'; } catch (error) { return error.constructor.name; }
    });
    assert.equal(duplicate, 'Error', 'a second registration of the same sheet is refused');
    const rendered = await page.evaluate(renderProbeSheet);
    assert.match(rendered, /^<div class="ui3"><div class="u-scrim" data-action="close-modal"><\/div><section class="u-sheet"/, 'with ?ui=3 renderSheet returns the v3 sheet markup');
    assert.match(rendered, /第7週の結果/);
    assert.equal(await page.evaluate(() => { const m = globalThis.__capitalismTycoonModules; return m.ui3.renderSheet('weekly-report', { engine: { g: { configured: false } }, engineModule: m.engine }); }), '', 'an unconfigured game renders no sheet');

    // A row the user chose to open the current screen from (README 6.5, data-ui3-current): the current UI shows
    // that screen until the next tab action, which brings v3 back.
    await page.evaluate(() => {
      const ui3 = globalThis.__capitalismTycoonModules.ui3;
      ui3.registerScreen('business', { render: () => '<button type="button" class="u-btn" data-ui3-current="business">probe: current screen</button>' });
      try { ui3.openCurrentUI('nowhere'); globalThis.__ui3OpenError = 'none'; } catch (error) { globalThis.__ui3OpenError = error.name; }
    });
    assert.equal(await page.evaluate(() => globalThis.__ui3OpenError), 'RangeError', 'an unknown screen id is refused');
    await goTo(page, 'business');
    await page.locator('[data-ui3-current="business"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-ui3-current="business"]').tap();
    await page.waitForFunction(() => Boolean(document.getElementById('d-ui-sidebar')), null, { timeout: 10000 });
    const detour = await snapshot(page);
    assert.deepEqual([detour.native, detour.bodyDUI, detour.screen], [false, true, 'business'], 'the row opens the complete current screen');
    await goTo(page, 'business');
    assert.equal((await snapshot(page)).native, true, 'the next tab action brings the v3 screen back');
    // Recall crisis: while the response is open (respond-recall-crisis), the business screen is the current UI.
    const setRecall = responded => page.evaluate(responded => { const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g; g.activeRecallCrisis = responded === null ? null : { id: 'probe-recall', status: 'active', businessID: 'ramen', storeID: null, startedWeek: g.week, baseResolveWeek: g.week + 7, resolveWeek: g.week + 7, salesMultiplier: .6, responded }; }, responded);
    await setRecall(false);
    assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.usesCurrentUI('business', globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g)), true);
    assert.deepEqual(await page.evaluate(() => { const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g; return Object.keys(g.activeRecallCrisis).sort().join(); }), ['baseResolveWeek', 'businessID', 'id', 'resolveWeek', 'responded', 'salesMultiplier', 'startedWeek', 'status', 'storeID'].sort().join(), 'the shell rule itself never normalises the state');
    await goTo(page, 'business');
    await page.waitForFunction(() => Boolean(document.getElementById('d-ui-sidebar')), null, { timeout: 10000 });
    assert.deepEqual([(await snapshot(page)).native, await page.locator('[data-action="respond-recall-crisis"]').count()], [false, 1], 'with an open recall crisis the current business screen carries the response');
    await setRecall(true);
    assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.usesCurrentUI('business', globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g)), false, 'responded: the response is no longer needed');
    await setRecall(null);
    await goTo(page, 'business');
    assert.equal((await snapshot(page)).native, true);

    // Amount sheet (README 5.7): the unit follows the title unless a context says otherwise; a context is used once
    // and expires; the value must be a positive whole number.
    const amount = await page.evaluate(async () => {
      const ui3 = globalThis.__capitalismTycoonModules.ui3, root = document.getElementById('modal-root'), seen = [];
      const open = (title, initial) => { const taken = ui3.amountSheet({ title, initial, submit(value) { seen.push(value); } }); return { taken, label: root.querySelector('.u-field > span')?.textContent, preview: Boolean(root.querySelector('[data-ui3-amount-preview]')) }; };
      const result = { shares: open('購入株数', 100), stores: open('加盟店募集数', 1), yen: open('価格変更', 5000) };
      ui3.setAmountContext({ unit: '円', wallet: 'company', direction: 'spend' });
      result.withContext = open('事業投資', 1000000);
      result.contextUsedOnce = open('事業投資', 1000000).preview;
      ui3.setAmountContext({ unit: '円', wallet: 'company', direction: 'spend' });
      await new Promise(resolve => setTimeout(resolve, 3300));
      result.expired = open('事業投資', 1000000).preview;
      const states = (title, initial, texts) => { open(title, initial); const input = root.querySelector('[data-ui3-amount-input]'), run = root.querySelector('[data-ui3-amount-run]'); return texts.map(text => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); return [text, run.disabled]; }); };
      result.yenStates = states('事業投資', 1000000, ['', 'x', '-1', '0', '1.5', '12', '1,000']);
      result.shareStates = states('購入株数', 100, ['', '0', '1.5', 'x', '-1', '12', '1,000']);
      const chips = (title, initial, context) => { if (context) ui3.setAmountContext(context); open(title, initial); return [...root.querySelectorAll('[data-ui3-amount-chip]')].map(chip => chip.textContent); };
      result.chipsSmall = chips('価格変更', 5000);
      result.chipsSmallDividend = chips('四半期配当設定', 10);
      result.chipsLarge = chips('事業投資', 1000000);
      result.chipsPresets = chips('価格変更', 5000, { unit: '円', presets: [{ value: 500, label: '500円' }, { value: 1000, label: '1,000円' }] });
      ui3.setAmountContext({ unit: '円', max: 3120000, preview: value => [{ label: '残り', value: `${value}円` }] });
      open('会社借入', 10000000);
      const capped = root.querySelector('[data-ui3-amount-input]');
      result.cappedInitial = capped.value;
      capped.value = '3120000'; capped.dispatchEvent(new Event('input', { bubbles: true }));
      result.atMax = [...root.querySelectorAll('[data-ui3-amount-preview] b')].map(node => node.classList.contains('u-down'));
      capped.value = '3120001'; capped.dispatchEvent(new Event('input', { bubbles: true }));
      result.overMax = [...root.querySelectorAll('[data-ui3-amount-preview] b')].map(node => node.classList.contains('u-down'));
      result.overMaxRunnable = !root.querySelector('[data-ui3-amount-run]').disabled;
      ui3.setAmountContext({ unit: '円', max: 5000000 });
      open('会社借入', 1000000);
      result.belowMaxKept = root.querySelector('[data-ui3-amount-input]').value;
      ui3.setAmountContext({ unit: '円', preview: value => [{ label: '返済後残高', value: `${value}円` }, { label: '利用可能枠', value: '9円', tone: 'down' }] });
      open('会社借入', 1000000);
      const input = root.querySelector('[data-ui3-amount-input]'), run = root.querySelector('[data-ui3-amount-run]');
      input.value = '250'; input.dispatchEvent(new Event('input', { bubbles: true }));
      result.preview = [...root.querySelectorAll('[data-ui3-amount-preview] .u-stat')].map(stat => [stat.querySelector('span').textContent, stat.querySelector('b').textContent, stat.querySelector('b').classList.contains('u-down')]);
      result.inputmode = [root.querySelector('[data-ui3-amount-input]').getAttribute('inputmode'), (open('購入株数', 100), root.querySelector('[data-ui3-amount-input]').getAttribute('inputmode'))];
      open('配当', 12);
      const field = root.querySelector('[data-ui3-amount-input]'), button = root.querySelector('[data-ui3-amount-run]');
      field.value = '0'; field.dispatchEvent(new Event('input', { bubbles: true })); button.click();
      result.submitted = seen; result.closed = root.innerHTML === '';
      return result;
    });
    assert.deepEqual([amount.shares.taken, amount.shares.label, amount.stores.label, amount.yen.label], [true, '株数', '店数', '金額（円）'], 'the unit follows the title');
    assert.deepEqual([amount.withContext.preview, amount.contextUsedOnce, amount.expired], [true, false, false], 'a context is used once and expires');
    assert.deepEqual(amount.yenStates, [['', true], ['x', true], ['-1', true], ['0', false], ['1.5', false], ['12', false], ['1,000', false]], 'yen: 0 or more, decimals allowed; only a negative value or a non-number is refused');
    assert.deepEqual(amount.shareStates, [['', true], ['0', true], ['1.5', true], ['x', true], ['-1', true], ['12', false], ['1,000', false]], 'shares: a whole number of 1 or more');
    assert.deepEqual([amount.chipsSmall, amount.chipsSmallDividend, amount.chipsLarge, amount.chipsPresets], [[], [], ['10万', '50万', '100万'], ['500円', '1,000円']], 'yen chips only from a 10万円 start; presets replace them');
    assert.deepEqual([amount.cappedInitial, amount.atMax, amount.overMax, amount.overMaxRunnable, amount.belowMaxKept], ['3120000', [false], [true], true, '1000000'], 'an initial value above the maximum starts at the maximum; a value above it is shown in red but can still be run; one below it is kept');
    assert.deepEqual(amount.preview, [['返済後残高', '250円', false], ['利用可能枠', '9円', true]], 'a screen\'s preview replaces the default rows');
    assert.deepEqual(amount.inputmode, ['decimal', 'numeric'], 'the keyboard follows the unit');
    assert.deepEqual([amount.submitted, amount.closed], [[0], true], '0 yen can be submitted (a dividend of 0)');

    // Confirmation sheet (README 2: money that moves for good is confirmed first): cost and cash afterwards,
    // one cancel button and one primary button carrying the existing action; it closes after the action ran.
    await page.evaluate(() => { document.getElementById('modal-root').innerHTML = globalThis.__capitalismTycoonModules.ui3.confirmSheet({ title: 'probe <confirm>', subtitle: 'sub', facts: [{ label: '費用', value: '1万円' }, { label: '実行後の会社現金', value: '−2万円', tone: 'down' }], note: '注意書き', confirm: { label: '実行する', attributes: { 'data-action': 'ui3-probe-confirm', 'data-id': 'a"b' } } }); });
    assert.deepEqual(await page.locator('#modal-root [data-ui3-confirm-facts] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText, node.querySelector('b').classList.contains('u-down')])), [['費用', '1万円', false], ['実行後の会社現金', '−2万円', true]]);
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), 'probe <confirm>', 'titles are escaped');
    assert.equal(await page.locator('#modal-root [data-ui3-confirm-note]').innerText(), '注意書き');
    assert.deepEqual(await page.locator('#modal-root .u-sheet-foot button').evaluateAll(nodes => nodes.map(node => [node.innerText.trim(), node.dataset.action || '', node.classList.contains('primary'), node.dataset.id || ''])),
      [['やめる', 'close-modal', false, ''], ['実行する', 'ui3-probe-confirm', true, 'a"b']]);
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '', 'やめる closes the sheet');
    await page.evaluate(() => { globalThis.__ui3ConfirmRan = 0; document.addEventListener('click', event => { if (event.target.closest('[data-action="ui3-probe-confirm"]')) globalThis.__ui3ConfirmRan += 1; }); document.getElementById('modal-root').innerHTML = globalThis.__capitalismTycoonModules.ui3.confirmSheet({ title: 'probe', confirm: { attributes: { 'data-action': 'ui3-probe-confirm' } } }); });
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(() => document.getElementById('modal-root').innerHTML === '', null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => globalThis.__ui3ConfirmRan), 1, 'the primary button\'s action was dispatched once, then the sheet closed');

    // ?ui=2 returns the device to the current UI.
    await page.goto(`${base}?ui=2`, { waitUntil: 'load' });
    await page.locator('.topbar').waitFor({ state: 'attached', timeout: 30000 });
    assert.deepEqual(await page.evaluate(() => [globalThis.__capitalismTycoonModules.ui3.enabled(), localStorage.getItem(globalThis.__capitalismTycoonModules.ui3.PREFERENCE_KEY)]), [false, null]);
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-shell-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
