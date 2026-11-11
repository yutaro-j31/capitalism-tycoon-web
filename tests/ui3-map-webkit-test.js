'use strict';

// UI v3 map screen and its sheets (docs/ui-v3/README.md 5.2 and 5.3, task UI3-3).
// Loads the real js/ui3-map.js and the real 3D map. Proves in a real browser that:
//  - without ?ui=3 the current map is unchanged (its own markers, no v3 pins);
//  - with ?ui=3 the 3D map fills the area between the top bar and the tab bar, carries only the filter
//    chips, the zoom / list buttons and v3 pins, and names only the selected pin;
//  - tapping a vacant tenant opens the store sheet (58% high, the pin stays visible above it), the
//    industry switch and the breakdown work, and "出店する" opens the existing final confirmation,
//    which opens the store, with taps only;
//  - the other kinds open a sheet that reaches their existing actions;
//  - the list sheet follows the filter; changing prefecture works;
//  - viewing, filtering, listing and the breakdown never change the game;
//  - when the 3D map is unavailable the current UI shows the Canvas2D map.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

// --- static contracts ---------------------------------------------------
const screenSource = fs.readFileSync(path.join(ROOT, 'js', 'ui3-map.js'), 'utf8');
const screenCss = fs.readFileSync(path.join(ROOT, 'css', 'ui3-map.css'), 'utf8');
assert.doesNotMatch(screenSource, /Math\.random|MutationObserver|registerUIEnhancer/, 'the map screen uses no RNG, observer or D UI enhancer');
assert.doesNotMatch(screenSource, /\b(?:g|engine\.g|context\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the map screen never assigns engine state');
assert.doesNotMatch(screenSource, /\.save\(|localStorage|sessionStorage/, 'the map screen never saves or stores anything');
assert.doesNotMatch(screenCss, /#[0-9a-fA-F]{3,8}\b|rgba?\(|font-size/, 'screen CSS carries no colour code or font size');
for (const block of screenCss.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(rule => rule.split('{')[0].trim()).filter(Boolean)) {
  for (const selector of block.replace(/:is\([^)]*\)/g, '').split(',').map(part => part.trim()).filter(Boolean)) {
    assert.match(selector, /^(?:\.ui3\b|body\.ui3-native\b)/, `ui3-map.css selector must stay scoped to UI v3: ${selector}`);
  }
}
assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /ui3-map\.css[\s\S]*ui3-shell\.js[\s\S]*ui3-map\.js/, 'index.html loads the map CSS and script (script after the shell)');

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
const gameDigest = page => page.evaluate(() => {
  const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g;
  const skip = new Set(['lastSaveDate', 'saveSequence']);
  return JSON.stringify(g, (key, value) => (skip.has(key) ? undefined : value));
});
const gameFacts = page => page.evaluate(() => {
  const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g;
  return { stores: g.stores.length, cash: g.companyCash, week: g.week, pref: g.selectedPref, tab: g.selectedTab, businesses: g.stores.map(store => store.businessID) };
});

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}
const waitForPins = page => page.waitForFunction(() => document.querySelectorAll('.ui3 .u-pin:not([hidden])').length > 0, null, { timeout: 30000 });
const visiblePinKinds = page => page.evaluate(() => [...document.querySelectorAll('.ui3 .u-pin:not([hidden])')].map(pin => pin.className.replace('u-pin', '').trim()));
// (a tap within 450ms of the sheet opening is the touch's own trailing click and is ignored by design)
const tapMapAboveSheet = async page => { await page.waitForTimeout(600); await page.locator('#modal-root .u-scrim').tap({ position: { x: 195, y: 160 } }); };
const sheetBox = page => page.locator('#modal-root .u-sheet').boundingBox();

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const launch = browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {};
  const browser = await playwright[browserName].launch(launch);
  const device = playwright.devices['iPhone 13'];
  const viewport = device.viewport;
  const newPage = async (setup) => {
    const context = await browser.newContext({ viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    if (setup) await setup(context);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // 1. Flag off: the current map, byte for byte the current markers.
    {
      const { context, page, pageErrors } = await newPage();
      await found(page, base);
      await goTo(page, 'map');
      await page.locator('.city-lab-marker').first().waitFor({ state: 'attached', timeout: 30000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'without ?ui=3 there is no v3 frame');
      assert.equal(await page.locator('.u-pin').count(), 0, 'without ?ui=3 the current markers are used');
      assert.ok(await page.locator('.city-lab-hud').isVisible(), 'the current map keeps its own HUD');
      assert.deepEqual(pageErrors, []);
      await context.close();
    }

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    await goTo(page, 'map');
    await waitForPins(page);
    const frame = await page.evaluate(() => {
      const box = selector => { const element = document.querySelector(selector); const rect = element.getBoundingClientRect(); return [Math.round(rect.top), Math.round(rect.bottom), Math.round(rect.left), Math.round(rect.right)]; };
      const visible = element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
      const controls = [...document.querySelectorAll('#app button, #app select')].filter(visible).map(element => { const rect = element.getBoundingClientRect(); return [element.className || element.tagName, Math.round(rect.width), Math.round(rect.height)]; });
      let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
      const hidden = ['.city-lab-hud', '.city-lab-context', '.city-lab-footer', '.city-lab-sheet'].map(selector => getComputedStyle(document.querySelector(selector)).display);
      return { map: box('.u-map'), top: box('.u-top'), tabs: box('.u-tabbar'), stage: box('.city-lab-stage'), controls, minFont, hidden,
        overflowX: document.documentElement.scrollWidth > innerWidth, scrollY: document.documentElement.scrollHeight > innerHeight,
        chips: [...document.querySelectorAll('[data-ui3-map-filters] .u-chip')].map(chip => chip.textContent),
        pref: document.querySelector('.u-map-pref select')?.value, zoom: [...document.querySelectorAll('.u-zoom button')].filter(visible).map(button => button.textContent.trim()),
        labels: [...document.querySelectorAll('.u-pin-label')].filter(visible).length,
        pins: [...document.querySelectorAll('.u-pin')].map(pin => pin.getAttribute('aria-label')) };
    });
    assert.equal(frame.map[0], frame.top[1], 'the map starts under the top bar');
    assert.equal(frame.map[1], frame.tabs[0], 'the map ends at the tab bar');
    assert.deepEqual(frame.stage, frame.map, 'the 3D stage fills the map area');
    assert.deepEqual(frame.hidden, ['none', 'none', 'none', 'none'], 'the current HUD, balance card, footer and detail sheet give way to v3 parts');
    assert.deepEqual(frame.chips, ['すべて', '自社店舗', '出店候補', 'オフィス', '不動産', '競合']);
    assert.deepEqual(frame.zoom, ['＋', '−', '一覧'], 'zoom in, zoom out, list');
    assert.ok(frame.minFont >= 13, `smallest text is ${frame.minFont}px`);
    assert.deepEqual(frame.controls.filter(([, width, height]) => width < 44 || height < 44), [], 'every control is at least 44x44');
    assert.deepEqual([frame.overflowX, frame.scrollY], [false, false], 'no horizontal overflow, no page scroll');
    assert.equal(frame.labels, 0, 'no pin carries a name until it is selected');
    assert.ok(frame.pins.length >= 3 && frame.pins.every(label => /^(自社店舗|出店候補|オフィス|不動産|競合) /.test(label)), 'every pin is named for assistive technology');

    // No pin sits under the chip row: its tip is at least 100px below the map's top edge (chip row 12-56px + the pin's 44px).
    const underChips = await page.evaluate(() => { const row = document.querySelector('[data-ui3-map-chips]').getBoundingClientRect(); return [...document.querySelectorAll('.u-pin:not([hidden])')].filter(pin => { const box = pin.getBoundingClientRect(); return box.top < row.bottom && box.bottom > row.top; }).length; });
    assert.equal(underChips, 0, 'no pin is drawn under the filter chips');
    // Pins are hidden only when they are off screen: at the smallest zoom every pin is shown.
    for (let step = 0; step < 4; step += 1) await page.locator('.u-zoom [data-city-camera="out"]').tap();
    await page.waitForTimeout(400);
    const total = await page.locator('.u-pin').count();
    // (a pin whose roof is outside the map, or under the tab bar, is the only one that may be hidden)
    const shown = await page.locator('.u-pin:not([hidden])').count();
    assert.ok(total - shown <= 3, `pins are not hidden by collisions with each other: ${shown} of ${total} shown`);
    const pinRects = await page.evaluate(() => [...document.querySelectorAll('.u-pin:not([hidden])')].map(pin => { const rect = pin.getBoundingClientRect(); return [rect.left, rect.top, rect.right, rect.bottom]; }));
    const overlapping = pinRects.some((a, i) => pinRects.slice(i + 1).some(b => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]));
    assert.ok(overlapping || shown >= 12, 'dense pins stay on screen even where their hit areas overlap');
    for (let step = 0; step < 4; step += 1) await page.locator('.u-zoom [data-city-camera="in"]').tap();
    await page.waitForTimeout(300);

    // Viewing never changes the game.
    const baseline = await gameDigest(page);

    // Filter chips.
    await page.locator('[data-ui3-map-filter="tenant"]').tap();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-ui3-map-filter="tenant"]').getAttribute('aria-pressed'), 'true');
    const tenantKinds = await visiblePinKinds(page);
    assert.ok(tenantKinds.length > 0 && tenantKinds.every(kind => kind === 'tenant'), `only tenant pins remain: ${tenantKinds}`);
    await page.locator('[data-ui3-map-filter="store"]').tap();
    await page.waitForTimeout(300);
    assert.deepEqual(await visiblePinKinds(page), [], 'a founding company has no store pin');
    await page.locator('[data-ui3-map-filter="all"]').tap();
    await page.waitForTimeout(300);
    assert.ok((await visiblePinKinds(page)).length > 0);

    // List sheet follows the filter.
    await page.locator('[data-ui3-map-filter="tenant"]').tap();
    await page.locator('[data-ui3-map-list]').tap();
    const listRows = await page.locator('#modal-root [data-ui3-map-pick]').count();
    const tenantTotal = await page.evaluate(() => globalThis.__capitalismTycoonModules.mapPhase2Canvas.buildMapViewModel(globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g, globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine()).entities.filter(entity => entity.kind === 'tenant').length);
    assert.equal(listRows, tenantTotal, 'the list shows the same filter as the map');
    assert.match(await page.locator('#modal-root .u-sheet').innerText(), /拠点の一覧/);
    const listBox = await sheetBox(page);
    assert.ok(listBox.height <= viewport.height * 0.58 + 1, 'the list sheet is at most 58% high');
    await page.locator('#modal-root [data-ui3-map-pick]').first().tap();
    await page.locator('#modal-root [data-action="open-store"]').waitFor({ state: 'visible', timeout: 10000 });
    await tapMapAboveSheet(page);
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '', 'a tap on the map above the sheet closes it');
    await page.waitForFunction(() => !document.querySelector('.u-pin[aria-pressed="true"]'), null, { timeout: 5000 });
    await page.locator('[data-ui3-map-filter="all"]').tap();

    // Tenant sheet (README 5.3).
    await page.locator('.u-pin.tenant:not([hidden])').first().tap();
    await page.locator('#modal-root [data-action="open-store"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    const sheet = await page.evaluate(() => {
      const root = document.querySelector('#modal-root .u-sheet');
      const text = selector => root.querySelector(selector)?.textContent.trim();
      const visible = element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
      const selected = [...document.querySelectorAll('.u-pin[aria-pressed="true"]')];
      const sheetTop = root.getBoundingClientRect().top;
      const pin = selected[0]?.getBoundingClientRect();
      let minFont = 99; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
      const primaries = [...document.querySelectorAll('#modal-root .u-btn.primary')].filter(visible).length;
      return { eyebrow: text('.u-sheet-head .u-h2'), title: text('.u-sheet-head h1'), subtitle: [...root.querySelectorAll('.u-sheet-head .u-h2')].pop().textContent.trim(),
        badge: text('[data-ui3-map="fit"]'), seg: [...root.querySelectorAll('.u-seg button')].map(button => button.textContent.trim()), pressed: root.querySelector('.u-seg [aria-pressed="true"]')?.textContent.trim(),
        numbers: [...root.querySelectorAll('[data-ui3-map="numbers"] .u-stat')].map(stat => [...stat.children].map(child => child.textContent.trim())), note: text('[data-ui3-map="after"]'),
        actions: [...root.querySelectorAll('.u-sheet-foot button')].map(button => button.textContent.trim()), hiddenInput: root.querySelector('input[type="hidden"]')?.id,
        selectedPins: selected.length, pinInView: Boolean(pin) && pin.top >= 48 && pin.bottom <= sheetTop, labelNames: [...document.querySelectorAll('.u-pin-label')].filter(visible).map(label => label.textContent.trim()),
        height: root.getBoundingClientRect().height, bottom: Math.round(root.getBoundingClientRect().bottom), minFont, primaries, dock: getComputedStyle(document.querySelector('.u-dock')).display,
        overflowX: root.scrollWidth > root.clientWidth };
    });
    assert.equal(sheet.eyebrow, '出店候補');
    assert.ok(sheet.title.length > 0 && /商圏/.test(sheet.subtitle) && /週額賃料/.test(sheet.subtitle), 'heading: name and one supporting line (trade area, traffic, weekly rent)');
    assert.match(sheet.badge, /^適性 /, 'suitability badge');
    assert.deepEqual(sheet.seg, ['ラーメン', 'コンビニ', 'ジム', '不動産仲介'], 'industry switch');
    assert.ok(sheet.pressed, 'one industry is chosen');
    assert.deepEqual(sheet.numbers.map(([label]) => label), ['初期費用', '週の利益見込み', '回収まで'], 'three numbers');
    assert.match(sheet.numbers[1][1], /^[+−]/, 'the profit forecast carries a sign');
    assert.match(sheet.note, /^(出店後の会社現金|資金不足)/);
    assert.match(sheet.note, /開店まで\d+週/);
    assert.deepEqual(sheet.actions, ['試算の内訳', '出店する']);
    assert.match(sheet.hiddenInput, /^business-/, 'open-store reads #business-<tenantID>');
    assert.deepEqual([sheet.selectedPins, sheet.labelNames.length], [1, 1], 'exactly one pin is selected and named');
    assert.ok(sheet.pinInView, 'the selected pin stays visible above the sheet');
    assert.ok(sheet.height <= viewport.height * 0.58 + 1, `the sheet is at most 58% high (${sheet.height}px)`);
    assert.equal(sheet.bottom, viewport.height, 'the sheet is anchored to the bottom edge');
    assert.equal(sheet.primaries, 1, 'one gold primary button');
    assert.ok(sheet.minFont >= 13 && !sheet.overflowX, 'sheet text is at least 13px and does not overflow');
    assert.equal(sheet.dock, 'none', 'the advance dock gives way to the sheet');
    const controlsInSheet = await page.evaluate(() => [...document.querySelectorAll('#modal-root .u-sheet button')].map(button => { const rect = button.getBoundingClientRect(); return [button.textContent.trim(), Math.round(rect.width), Math.round(rect.height)]; }).filter(([, width, height]) => width < 44 || height < 44));
    assert.deepEqual(controlsInSheet, [], 'every sheet control is at least 44x44');

    // Industry switch: numbers follow, the hidden input follows.
    const ramenCost = sheet.numbers[0][1];
    await page.locator('#modal-root [data-ui3-map-business="gym"]').tap();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#modal-root .u-seg [aria-pressed="true"]').innerText(), 'ジム');
    assert.equal(await page.locator('#modal-root input[type="hidden"]').inputValue(), 'gym');
    assert.notEqual(await page.locator('#modal-root [data-ui3-map="numbers"] .u-stat').first().locator('b').innerText(), ramenCost, 'the numbers are the chosen industry\'s');

    // Breakdown sheet.
    await page.locator('#modal-root [data-ui3-map-breakdown]').tap();
    await page.waitForTimeout(300);
    assert.match(await page.locator('#modal-root .u-sheet-head h1').innerText(), /試算の内訳/);
    assert.equal(await page.locator('#modal-root [data-ui3-map="band"]').count(), 3, 'weak, expected and strong cases');
    assert.match(await page.locator('#modal-root .u-sheet').innerText(), /閉店時の返還なし/);
    await page.locator('#modal-root [data-ui3-map-detail]').tap();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#modal-root .u-seg [aria-pressed="true"]').innerText(), 'ジム', 'back to the same sheet with the same choice');

    // Looking at all of this changed nothing in the game.
    assert.equal(await gameDigest(page), baseline, 'selecting, filtering, listing, switching and the breakdown never change the game');

    // Close by tapping the map above the sheet; the selection goes with it.
    await tapMapAboveSheet(page);
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '');
    await page.waitForFunction(() => !document.querySelector('.u-pin[aria-pressed="true"]'), null, { timeout: 5000 });
    // Open the tenant sheet again and open a store with taps only.
    const before = await gameFacts(page);
    await page.locator('.u-pin.tenant:not([hidden])').first().tap();
    await page.locator('#modal-root [data-ui3-map-business="conveni"]').tap();
    await page.locator('#modal-root [data-action="open-store"]').tap();
    await page.locator('#modal-root #modal-ok').waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await page.locator('#modal-root .modal').innerText(), /出店の最終確認/);
    await page.locator('#modal-root #modal-ok').tap();
    await page.waitForFunction(count => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.stores.length > count, before.stores, { timeout: 10000 });
    const after = await gameFacts(page);
    assert.deepEqual([after.stores, after.businesses], [before.stores + 1, ['conveni']], 'one store of the chosen industry was opened');
    assert.ok(after.cash < before.cash, 'opening paid its upfront cost from company cash');
    assert.equal(after.week, before.week, 'opening a store does not advance the week');

    // The new store is a pin; its sheet leads to the store screen.
    await page.waitForTimeout(500);
    await page.locator('[data-ui3-map-filter="store"]').tap();
    await waitForPins(page);
    await page.locator('.u-pin.store:not([hidden])').first().tap();
    await page.locator('#modal-root [data-action="tab"][data-tab="business"]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root .u-sheet-head .u-h2').first().innerText(), '自社店舗');
    await page.locator('#modal-root [data-ui3-map-close]').tap();
    await page.locator('[data-ui3-map-filter="all"]').tap();

    // Other kinds reach their existing actions (nothing is bought or signed by this test).
    const reach = {};
    for (const [kind, expected] of [['office', 'contract-office'], ['realestate', 'negotiate-property-personal'], ['competitor', 'tab']]) {
      await page.locator(`[data-ui3-map-filter="${kind}"]`).tap();
      await page.waitForTimeout(300);
      // reached through the list sheet: the camera may have moved away from the kind's pins
      await page.locator('[data-ui3-map-list]').tap();
      const rows = page.locator('#modal-root [data-ui3-map-pick]');
      if (!(await rows.count())) { reach[kind] = 'none in this game'; await tapMapAboveSheet(page); continue; }
      await rows.first().tap();
      await page.locator('#modal-root .u-sheet [data-ui3-map-sheet]').waitFor({ state: 'attached', timeout: 10000 });
      reach[kind] = await page.evaluate(() => [...document.querySelectorAll('#modal-root .u-sheet [data-action]')].map(node => node.dataset.action));
      assert.ok(reach[kind].includes(expected), `${kind}: ${reach[kind]}`);
      await tapMapAboveSheet(page);
    }
    await page.locator('[data-ui3-map-filter="all"]').tap();
    assert.deepEqual(reach.realestate.sort(), ['buy-property-company', 'buy-property-personal', 'negotiate-property-company', 'negotiate-property-personal'], 'an unowned listing: both ways to buy and both ways to negotiate');
    assert.ok(Array.isArray(reach.office) && Array.isArray(reach.realestate), `office and real-estate pins were reached: ${JSON.stringify(reach)}`);
    console.log('reach', JSON.stringify(reach));

    // States only a longer game reaches, forced on a throwaway game to prove the routing (not saved by this test):
    // an owned property offers selling and the assets screen; with a head office an office is a branch.
    await page.evaluate(() => {
      const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g;
      const property = g.properties.find(item => item.prefID === g.selectedPref);
      property.owner = 'company';
      g.hasHeadOffice = true;
      globalThis.__ui3OwnedProperty = property.id;
    });
    await goTo(page, 'map');
    await waitForPins(page);
    for (const [kind, expected] of [['realestate', ['sell-property', 'tab']], ['office', ['contract-branch-office']]]) {
      await page.locator(`[data-ui3-map-filter="${kind}"]`).tap();
      await page.waitForTimeout(300);
      await page.locator('[data-ui3-map-list]').tap();
      const pick = kind === 'realestate' ? page.locator(`#modal-root [data-ui3-map-pick="realestate:${await page.evaluate(() => globalThis.__ui3OwnedProperty)}"]`) : page.locator('#modal-root [data-ui3-map-pick]').first();
      await pick.tap();
      await page.locator('#modal-root .u-sheet [data-ui3-map-sheet]').waitFor({ state: 'attached', timeout: 10000 });
      const actions = await page.evaluate(() => [...document.querySelectorAll('#modal-root .u-sheet [data-action]')].map(node => node.dataset.action));
      for (const action of expected) assert.ok(actions.includes(action), `${kind}: ${actions}`);
      await tapMapAboveSheet(page);
    }
    await page.locator('[data-ui3-map-filter="all"]').tap();

    // Prefecture switcher (the current map's own select).
    const prefBefore = await page.locator('.u-map-pref select').inputValue();
    const otherPref = await page.locator('.u-map-pref select option').evaluateAll((options, current) => options.map(option => option.value).find(value => value !== current), prefBefore);
    await page.locator('.u-map-pref select').selectOption(otherPref);
    await waitForPins(page);
    assert.equal((await gameFacts(page)).pref, otherPref, 'the prefecture changes through the existing selectedPref binding');
    assert.equal(await page.locator('#modal-root .u-sheet').count(), 0);

    // A critical state keeps the notice above the dock without covering the tab bar.
    await page.evaluate(() => { const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g; g.playerCrisis = { ...(g.playerCrisis || {}), status: 'distressed' }; });
    await goTo(page, 'map');
    await waitForPins(page);
    const crisis = await page.evaluate(() => { const rect = document.querySelector('[data-ui3-crisis]').getBoundingClientRect(); const tabs = document.querySelector('.u-tabbar').getBoundingClientRect(); const dock = document.querySelector('.u-dock').getBoundingClientRect(); return { aboveTabs: rect.bottom <= tabs.top, aboveDock: rect.bottom <= dock.top, inside: rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44 }; });
    assert.deepEqual(crisis, { aboveTabs: true, aboveDock: true, inside: true });
    await page.evaluate(() => { const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g; g.playerCrisis = { ...g.playerCrisis, status: 'stable' }; });

    assert.deepEqual(pageErrors, []);
    await context.close();

    // 3. The 3D map is unavailable: the current UI draws the Canvas2D map (README 6.5).
    {
      const failing = await newPage(ctx => ctx.route(/three-r160\.min\.js/, route => route.abort()));
      await found(failing.page, `${base}?ui=3`);
      await goTo(failing.page, 'map');
      await failing.page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 30000 });
      assert.equal(await failing.page.locator('.ui3').count(), 0, 'the fallback is the current UI');
      assert.ok(await failing.page.locator('[data-screen="map"]').count() > 0, 'the map screen is shown');
      assert.ok(await failing.page.locator('.d-map-workspace').count() > 0, 'the Canvas2D map is drawn');
      await failing.context.close();
    }
    console.log(`ui3-map-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
