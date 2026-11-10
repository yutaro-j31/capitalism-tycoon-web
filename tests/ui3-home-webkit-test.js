'use strict';

// UI v3 home screen (docs/ui-v3/README.md 5.1, task UI3-1).
// Unlike tests/ui3-shell-webkit-test.js, this test loads the REAL screen module (js/ui3-home.js).
// It proves in a real browser that:
//  - without ?ui=3 the home is the current D UI, byte for byte the same with and without the v3 home script;
//  - with ?ui=3 the home renders exactly what 5.1 lists, within the acceptance numbers of section 2;
//  - its controls reach the existing actions (founding guide, news, secretary task);
//  - the order is critical task (warn) -> founding guide -> remaining tasks, three at most;
//  - a cash crisis hands the home back to the current UI, which carries the recovery actions;
//  - rendering reads state only (week, cash, RNG and the saved bytes are untouched).
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).
//
// Some states are made by writing engine state inside the throw-away test page (cash, listing
// flag, crisis status). That is inspection setup for this test only; no v3 screen does it.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const HOME_MODULE = /\/js\/ui3-home\.js(?:\?.*)?$/;
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

// --- static contracts ---------------------------------------------------
const homeSource = fs.readFileSync(path.join(ROOT, 'js', 'ui3-home.js'), 'utf8');
assert.doesNotMatch(homeSource, /Math\.random|MutationObserver|registerUIEnhancer/, 'the v3 home uses no RNG, observer or D UI enhancer');
assert.doesNotMatch(homeSource, /\b(?:g|engine\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the v3 home never assigns engine state');
assert.doesNotMatch(homeSource, /\.save\(|setItem\(|localStorage|confirm\(/, 'the v3 home never saves, stores or uses confirm()');
assert.doesNotMatch(homeSource, /#[0-9a-fA-F]{3,8}\b|font-size|:\s*\d+px/, 'the v3 home writes no colour or font size (tokens live in ui3.css)');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(indexSource.indexOf('./js/ui3-shell.js') > 0 && indexSource.indexOf('./js/ui3-home.js') > indexSource.indexOf('./js/ui3-shell.js')
  && indexSource.indexOf('./js/ui3-home.js') < indexSource.indexOf('./js/app.js'), 'index.html loads ui3-home.js after the shell and before app.js');

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

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
  await page.waitForTimeout(3500);   // founding toast
}
const goTo = (page, tab) => page.evaluate(id => document.querySelector(`[data-action="tab"][data-tab="${id}"]`).click(), tab);
const engineState = page => page.evaluate(key => {
  const modules = globalThis.__capitalismTycoonModules;
  const g = modules.playerEngineBridge.getEngine().g;
  // The tab action saves on every press, which refreshes lastSaveDate (and the save counter); compare the rest.
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  delete saved.lastSaveDate; delete saved.saveSequence; delete saved.selectedTab;
  const text = JSON.stringify(saved);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return { week: g.week, tab: g.selectedTab, cash: g.companyCash, rng: JSON.stringify(g.simulationRng), save: `${text.length}:${hash >>> 0}`,
    acknowledged: Boolean(g.foundingTutorialProgress?.dashboardAcknowledged) };
}, SAVE_KEY);
const frame = page => page.evaluate(() => {
  const app = document.querySelector('#app > .ui3.u-app');
  return { native: Boolean(app), screen: app?.dataset.ui3Screen || null, crisisPanel: Boolean(document.getElementById('player-crisis-panel')) };
});
const screenShape = page => page.locator('.ui3 #screen > *').evaluateAll(nodes => nodes.map(node => node.tagName + (node.className ? '.' + node.className.split(/\s+/).join('.') : '')));
const actionCards = page => page.locator('.ui3 #screen .u-action').evaluateAll(nodes => nodes.map(node => ({
  warn: node.classList.contains('warn'), action: node.dataset.action, tab: node.dataset.tab || '', step: node.dataset.step || '',
  title: node.querySelector('b').innerText.trim(), tag: node.tagName
})));

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async ({ withoutHome = false } = {}) => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    if (withoutHome) await context.route(HOME_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 home */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // 1. Flag off: the current home is the same with and without the v3 home script.
    const currentHome = async options => {
      const { context, page, pageErrors } = await newPage(options);
      await found(page, base);
      await goTo(page, 'home');
      await page.waitForTimeout(800);
      const result = await page.evaluate(() => {
        const modules = globalThis.__capitalismTycoonModules;
        const actions = [...document.querySelectorAll('#screen [data-action]')].map(node => [node.dataset.action, node.dataset.tab || '', node.dataset.step || '', node.innerText.trim()]);
        return { registered: modules.ui3.registeredScreens(), enabled: modules.ui3.enabled(), native: Boolean(document.querySelector('#app > .ui3')),
          bodyDUI: document.body.classList.contains('d-ui-active'), dashboard: Boolean(document.querySelector('[data-ceo-dashboard="1"]')),
          actions, screenText: document.getElementById('screen').innerText.replace(/\s+/g, ' ').trim() };
      });
      assert.deepEqual(pageErrors, []);
      await context.close();
      return result;
    };
    const withHome = await currentHome();
    const withoutHome = await currentHome({ withoutHome: true });
    assert.deepEqual([withHome.registered, withoutHome.registered], [['home'], []], 'the real home module registers only when its script loads');
    assert.deepEqual([withHome.enabled, withHome.native, withHome.bodyDUI, withHome.dashboard], [false, false, true, true], 'without ?ui=3 the current D UI renders the home');
    assert.deepEqual(withHome.actions, withoutHome.actions, 'without ?ui=3 the home controls are identical with and without the v3 home script');
    assert.equal(withHome.screenText, withoutHome.screenText, 'without ?ui=3 the home text is identical with and without the v3 home script');

    // 2. Flag on: founding state.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.deepEqual(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.registeredScreens()), ['home']);
    assert.deepEqual(await frame(page), { native: true, screen: 'home', crisisPanel: false }, 'the home is native right after founding');
    assert.deepEqual(await screenShape(page), ['H1.u-h1', 'SECTION.u-card', 'H2.u-h2', 'BUTTON.u-action', 'H2.u-h2', 'DIV.u-list', 'H2.u-h2', 'DIV.u-list'], 'README 5.1: heading+badge, number card, this week\'s actions, news, the missions entry; nothing else');
    assert.equal(await page.locator('.ui3 #screen > h1').innerText().then(text => text.replace(/\s+/g, ' ').trim()), 'ポケット商事 実家起業', 'company name and growth stage badge (last achieved milestone)');
    const card = await page.locator('.ui3 #screen .u-card').innerText().then(text => text.replace(/\s+/g, ' ').trim());
    assert.match(card, /^今週の利益 0円 前週比較なし 売上 0円 企業価値 800\.0万円 店舗数 0店$/, 'number card: profit (hero, with previous-week note), sales, company value, stores');
    assert.deepEqual(await actionCards(page), [{ warn: false, action: 'founding-tutorial-jump', tab: 'home', step: 'dashboard', title: '創業ガイド 1/10：会社の現在地を確認', tag: 'BUTTON' }],
      'founding guide current step is the only action at founding, through the existing action');
    const news = await page.locator('.ui3 #screen .u-row[data-tab="news"]').evaluateAll(nodes => nodes.map(node => [node.dataset.action, node.dataset.tab, node.querySelector('b').innerText.trim(), node.querySelector('small')?.innerText.trim() || '']));
    assert.deepEqual(news, [['tab', 'news', 'ポケット商事を創業しました。', '第1週'], ['tab', 'news', '会社を設立しました。最初の店舗を探しましょう。', '']], 'two news rows that open the news screen');
    assert.equal(await page.locator('.ui3 #screen .u-chips').count(), 0, 'the home hub has no chip row');
    assert.equal(await page.locator('.ui3 .u-btn.primary, .ui3 #screen .u-advance').count(), 0, 'no primary button inside the screen (the only gold control is the dock)');
    assert.deepEqual(await page.locator('.ui3 [data-action="advance-week"]').evaluateAll(nodes => nodes.length), 1, 'one advance control (the shell dock)');

    // Acceptance numbers (README 2).
    const metrics = await page.evaluate(() => {
      const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
      const controls = [...document.querySelectorAll('#app button')].filter(visible);
      const small = controls.filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.className);
      let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
      return { screens: document.documentElement.scrollHeight / innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth, small, minFont,
        cards: document.querySelectorAll('.ui3 #screen .u-card').length, actions: document.querySelectorAll('.ui3 #screen .u-action').length,
        money: [...document.querySelectorAll('.ui3 #screen .u-money')].every(node => getComputedStyle(node).whiteSpace === 'nowrap') };
    });
    assert.ok(metrics.screens <= 2, `length ${metrics.screens} screens`);
    assert.ok(metrics.minFont >= 13, `smallest text ${metrics.minFont}px`);
    assert.deepEqual([metrics.overflowX, metrics.small, metrics.cards <= 2, metrics.actions <= 3, metrics.money], [false, [], true, true, true]);

    // Reading only: re-rendering changes neither the game nor the saved bytes.
    const before = await engineState(page);
    await goTo(page, 'home');
    await goTo(page, 'home');
    const after = await engineState(page);
    assert.deepEqual([after.week, after.cash, after.rng, after.save], [before.week, before.cash, before.rng, before.save], 'rendering the home never changes week, cash, RNG or the saved game (apart from the save time and selected tab)');

    // 3. The founding guide card runs the existing action.
    await page.locator('.ui3 #screen .u-action').tap();
    await page.waitForTimeout(500);
    const guided = await engineState(page);
    assert.deepEqual([guided.tab, guided.acknowledged], ['home', true], 'the founding guide card runs founding-tutorial-jump (dashboard step acknowledged)');
    assert.equal((await frame(page)).native, true, 'the home stays native after the guide action');

    // 4. A critical secretary task comes first and is warned; the guide follows; three at most.
    await page.evaluate(() => { globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyCash = 1000000; });   // inspection setup
    await goTo(page, 'home');
    const warned = await actionCards(page);
    assert.ok(warned.length >= 2 && warned.length <= 3, `at most three actions: ${warned.length}`);
    assert.deepEqual([warned[0].warn, warned[0].action, warned[0].tab], [true, 'secretary-jump', 'bank'], 'a critical task is first, with the warn style, through secretary-jump');
    assert.equal(warned.filter(row => row.warn).length, 1);
    await page.locator('.ui3 #screen .u-action.warn').tap();
    await page.waitForTimeout(500);
    assert.equal((await engineState(page)).tab, 'bank', 'the warn card runs secretary-jump to its target screen');
    await page.evaluate(() => { globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyCash = 8000000; });
    await goTo(page, 'home');

    // 5. News rows open the news screen (the current UI until UI3-9).
    await page.locator('.ui3 #screen .u-list .u-row').first().tap();
    await page.waitForTimeout(500);
    assert.equal((await engineState(page)).tab, 'news');
    assert.equal((await frame(page)).native, false, 'the news screen is not ported yet, so the current UI renders it');
    await goTo(page, 'home');

    // 6. A finished or summarised founding guide leaves no "成長ロードマップ" action; the missions entry is always there.
    const missionsRow = () => page.locator('.ui3 #screen [data-ui3-home="missions"]').evaluate(node => [node.dataset.action, node.dataset.tab, node.querySelector('b').innerText.trim(), node.querySelector('small').innerText.trim()]);
    const missionsNow = await missionsRow();
    assert.deepEqual(missionsNow.slice(0, 3), ['tab', 'missions', '進行・目標'], 'a permanent entry to the missions screen under the heading 目標');
    assert.ok(missionsNow[3].length > 0, 'its note names the next unachieved milestone');
    assert.equal(await page.locator('.ui3 #screen h2').filter({ hasText: '目標' }).count(), 1);
    await page.evaluate(() => { globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.publicCompany = true; });   // inspection setup
    await goTo(page, 'home');
    const afterGuide = await actionCards(page);
    assert.ok(afterGuide.every(card => card.tab !== 'missions' && card.title !== '成長ロードマップ'), 'the growth-roadmap card is not an action any more');
    assert.deepEqual((await missionsRow()).slice(0, 3), ['tab', 'missions', '進行・目標']);
    await page.locator('.ui3 #screen [data-ui3-home="missions"]').tap();
    await page.waitForTimeout(500);
    assert.equal((await engineState(page)).tab, 'missions');
    await goTo(page, 'home');
    await page.evaluate(() => { globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.publicCompany = false; });

    // 7. A cash crisis hands the home to the current UI (shell rule), which carries the recovery actions.
    await page.evaluate(() => {
      const modules = globalThis.__capitalismTycoonModules;
      const g = modules.playerEngineBridge.getEngine().g;
      modules.playerCrisis.snapshot(g);   // initialises g.playerCrisis
      Object.assign(g.playerCrisis, { status: 'distressed', graceWeeksRemaining: 4, reserveThreshold: 5000000 });   // inspection setup
    });
    await goTo(page, 'home');
    await page.waitForTimeout(800);
    assert.deepEqual(await frame(page), { native: false, screen: null, crisisPanel: true }, 'during a crisis the home is the current UI with the recovery panel');
    assert.ok(await page.locator('[data-player-crisis-action="founder-capital"]').count() > 0, 'the recovery actions stay reachable');
    await page.evaluate(() => { globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.playerCrisis.status = 'stable'; });
    await goTo(page, 'home');
    assert.deepEqual(await frame(page), { native: true, screen: 'home', crisisPanel: false }, 'the v3 home returns when the crisis is over');

    // 8. After a store opens: the stage badge, the store count and the sign rules follow the game.
    await page.evaluate(() => {
      const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine(), g = engine.g;
      const tenant = g.tenants.filter(row => !row.occupiedBy).sort((a, b) => a.deposit - b.deposit)[0];
      engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'テスト1号店', operatingHours: 3 });
      for (let week = 0; week < 4; week += 1) engine.advanceWeek(false);
    });
    await page.evaluate(() => { for (const button of document.querySelectorAll('#modal-root [data-action="close-modal"]')) button.click(); });
    await goTo(page, 'home');
    assert.equal(await page.locator('.ui3 #screen > h1').innerText().then(text => text.replace(/\s+/g, ' ').trim()), 'ポケット商事 初店舗', 'the badge follows the last achieved milestone');
    const hero = await page.locator('.ui3 #screen .u-stat.hero').evaluate(node => ({ value: node.querySelector('b').innerText.trim(), valueClass: node.querySelector('b').className, delta: node.querySelector('.u-delta').innerText.trim(), deltaClass: node.querySelector('.u-delta').className }));
    assert.match(hero.value, /^(?:[+−][0-9.,]+\S*|0円)$/, `profit is signed with + or − (U+2212): ${hero.value}`);
    assert.equal(hero.value.startsWith('+'), hero.valueClass.includes('u-up'), 'the up colour goes with the + sign');
    assert.equal(hero.value.startsWith('−'), hero.valueClass.includes('u-down'), 'the down colour goes with the − sign');
    assert.match(hero.delta, /^前週比 (?:[+−][0-9.,]+\S*|変化なし)$|^前週比較なし$/, `week-over-week note: ${hero.delta}`);
    assert.match(await page.locator('.ui3 #screen .u-stats').innerText().then(text => text.replace(/\s+/g, ' ')), /店舗数 1店/);
    assert.ok((await actionCards(page)).length <= 3);

    // Loss and a worse week: both numbers carry the U+2212 minus sign and the down colour; an improvement carries +.
    const readHero = () => page.locator('.ui3 #screen .u-stat.hero').evaluate(node => ({ value: node.querySelector('b').innerText.trim(), valueClass: node.querySelector('b').className,
      delta: node.querySelector('.u-delta').innerText.trim(), deltaClass: node.querySelector('.u-delta').className }));
    const setReports = reports => page.evaluate(rows => { globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.reports = rows; }, reports);   // inspection setup
    await setReports([{ week: 8, profit: -300000, sales: 1000000 }, { week: 7, profit: 100000, sales: 1000000 }]);
    await goTo(page, 'home');
    let loss = await readHero();
    assert.deepEqual([loss.value, loss.delta], ['−30.0万円', '前週比 −40.0万円'], 'a loss and a worse week are written with the − sign');
    assert.ok(loss.valueClass.includes('u-down') && loss.deltaClass.includes('u-down') && !loss.valueClass.includes('u-up'), 'down colour for a loss');
    await setReports([{ week: 8, profit: 500000, sales: 1000000 }, { week: 7, profit: 100000, sales: 1000000 }]);
    await goTo(page, 'home');
    loss = await readHero();
    assert.deepEqual([loss.value, loss.delta], ['+50.0万円', '前週比 +40.0万円'], 'a profit and a better week are written with the + sign');
    assert.ok(loss.valueClass.includes('u-up') && loss.deltaClass.includes('u-up'), 'up colour for a profit');
    await setReports([{ week: 8, profit: 100000, sales: 1000000 }, { week: 7, profit: 100000, sales: 1000000 }]);
    await goTo(page, 'home');
    loss = await readHero();
    assert.deepEqual([loss.value, loss.delta], ['+10.0万円', '前週比 変化なし'], 'no change is written without a sign');

    // The frame survives a week advance through the dock.
    await page.locator('.ui3 .u-advance').tap();
    await page.waitForTimeout(1500);
    await page.evaluate(() => { for (const button of document.querySelectorAll('#modal-root [data-action="close-modal"]')) button.click(); });
    assert.equal((await frame(page)).native, true);

    // ?ui=2 returns the device to the current UI.
    await page.goto(`${base}?ui=2`, { waitUntil: 'load' });
    await page.locator('.topbar').waitFor({ state: 'attached', timeout: 30000 });
    assert.equal(await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.enabled()), false);
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-home-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
