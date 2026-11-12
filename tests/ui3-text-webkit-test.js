'use strict';

// UI v3 text input sheet (docs/ui-v3/README.md 10.5, task UI3-9b-4). Proves in a real browser that:
//  - without ?ui=3 askText shows the current dialog (#modal-text) and passes the typed text on;
//  - with ?ui=3 the seven askText callers (new store, land development, IT/digital business, product, CXO directive,
//    department campaign, PE deal) open the v3 text sheet with the same title, label and initial value, and the typed text
//    reaches the same engine call; cancelling calls nothing; the text is shown as text (escaped);
//  - allowEmpty / maxLength rules passed by a caller are enforced, the default accepts anything (as the current dialog does);
//  - the sheet meets the tap-target / font / bottom-edge numbers.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULE = /\/js\/ui3-NOSUCH\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const FILES = [];
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

const CALLERS = [
  { action: 'build-property', id: 'land-1', title: '土地開発', label: '建物種別', initial: '本社ビル', call: 'buildOnLand', expect: (a, text) => a[0] === 'land-1' && a[1] === text },
  { action: 'found-digital-business', id: 'app', title: 'IT・デジタル事業を創業', label: 'プロダクト名', call: 'foundDigitalBusiness', expect: (a, text) => a[0] === 'app' && a[1] === text },
  { action: 'launch-product', id: 'app', title: 'プロダクト開発', label: 'プロダクト名', call: 'launchProduct', expect: (a, text) => a[0] === 'app' && a[1] === text },
  { action: 'create-pe', id: '', kind: 'x', title: 'PE案件組成', label: '業界', initial: 'テック', next: 'amount' },
  { action: 'add-directive', id: 'CEO', title: 'CXO指示', label: '指示内容', initial: '成長投資', next: 'amount' },
  { action: 'start-campaign', id: 'hr', title: '部門施策', label: '施策名', initial: '重点改善キャンペーン', next: 'amount' },
];

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 test */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  // a button with the real data-action goes through the app's own delegated handler; the engine calls are recorded
  const press = (page, spec) => page.evaluate(s => {
    const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
    globalThis.__textCalls = [];
    for (const name of ['buildOnLand', 'foundDigitalBusiness', 'launchProduct', 'addDirective', 'startCampaign', 'createPEDeal', 'openStore']) engine[name] = (...args) => { globalThis.__textCalls.push([name, ...args]); return true; };
    document.getElementById('probe')?.remove();
    const button = document.createElement('button');
    button.id = 'probe'; button.dataset.action = s.action; button.dataset.id = s.id; if (s.kind) button.dataset.kind = s.kind;
    document.getElementById('app').append(button); button.click();
  }, { action: spec.action, id: spec.id, kind: spec.kind });
  const calls = page => page.evaluate(() => globalThis.__textCalls);
  const sheetOk = async (page, label) => {
    const m = await page.evaluate(() => {
      const root = document.querySelector('#modal-root .u-sheet');
      const visible = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const small = [...root.querySelectorAll('button,input')].filter(visible).filter(e => { const b = e.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).map(e => e.className);
      let minFont = 99; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode; if (n.nodeValue.trim() && visible(n.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(n.parentElement).fontSize)); }
      return { small, minFont, bottom: Math.round(root.getBoundingClientRect().bottom) };
    });
    assert.deepEqual([m.small, m.bottom], [[], device.viewport.height], `${label}: tap targets and bottom edge ${JSON.stringify(m)}`);
    assert.ok(m.minFont >= 13, `${label}: font ${m.minFont}px`);
  };
  try {
    // 1. Flag off: the current dialog.
    {
      const { context, page, pageErrors } = await newPage();
      await found(page, base);
      await press(page, CALLERS[0]);
      await page.locator('#modal-text').waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('.ui3, #modal-root .u-sheet').count(), 0, 'no v3 sheet without ?ui=3');
      assert.equal(await page.locator('#modal-text').inputValue(), '本社ビル');
      await page.locator('#modal-text').fill('テスト棟');
      await page.locator('#modal-ok').click();
      assert.deepEqual(await calls(page), [['buildOnLand', 'land-1', 'テスト棟']], 'the current dialog passes the text on');
      assert.deepEqual(pageErrors, []);
      await context.close();
    }

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    const typed = '名前 "<b>&';
    for (const spec of CALLERS) {
      await press(page, spec);
      await page.locator('#modal-root [data-ui3-text-input]').waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('#modal-text').count(), 0, `${spec.title}: the current dialog is not shown`);
      assert.equal(await page.locator('#modal-root .u-sheet h1').first().innerText(), spec.title);
      assert.equal(await page.locator('#modal-root .u-field > span').innerText(), spec.label);
      if (spec.initial !== undefined) assert.equal(await page.locator('#modal-root [data-ui3-text-input]').inputValue(), spec.initial, `${spec.title}: initial value`);
      await sheetOk(page, spec.title);
      await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
      assert.deepEqual(await calls(page), [], `${spec.title}: cancelling calls nothing`);
      await press(page, spec);
      await page.locator('#modal-root [data-ui3-text-input]').fill(typed);
      await page.locator('#modal-root [data-ui3-text-run]').tap();
      if (spec.next === 'amount') {
        await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
        assert.deepEqual(await calls(page), [], `${spec.title}: nothing is called before the amount is entered`);
        await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
      } else {
        const made = await calls(page);
        assert.equal(made.length, 1, `${spec.title}: one engine call`);
        assert.equal(made[0][0], spec.call);
        assert.ok(spec.expect(made[0].slice(1), typed), `${spec.title}: the typed text reaches the engine ${JSON.stringify(made)}`);
      }
      assert.equal(await page.locator('#modal-root').innerHTML(), '', `${spec.title}: the sheet is closed`);
    }
    // the new-store flow (confirmOpenStore falls back to askText when there is no estimate)
    await page.evaluate(() => {
      const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
      globalThis.__textCalls = [];
      engine.estimateStoreOpening = () => null; engine.openStore = args => { globalThis.__textCalls.push(['openStore', args]); return true; };
      document.getElementById('probe')?.remove();
      const select = document.createElement('select'); select.id = 'business-t1'; select.innerHTML = '<option value="ramen">r</option>'; document.getElementById('app').append(select);
      const button = document.createElement('button'); button.id = 'probe'; button.dataset.action = 'open-store'; button.dataset.id = 't1'; document.getElementById('app').append(button); button.click();
    });
    await page.locator('#modal-root [data-ui3-text-input]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root .u-field > span').innerText(), '店舗名');
    await page.locator('#modal-root [data-ui3-text-input]').fill('渋谷店');
    await page.locator('#modal-root [data-ui3-text-run]').tap();
    const stores = await calls(page);
    assert.equal(stores[0][0], 'openStore'); assert.equal(stores[0][1].name, '渋谷店'); assert.equal(stores[0][1].tenantID, 't1');

    // the text is shown as text, never as markup
    await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.textSheet({ title: 'T', label: 'L', initial: '"><img src=x onerror=alert(1)>', submit() {} }));
    assert.equal(await page.locator('#modal-root img').count(), 0, 'the initial value is escaped');
    assert.equal(await page.locator('#modal-root [data-ui3-text-input]').inputValue(), '"><img src=x onerror=alert(1)>');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();

    // a caller's own rules: allowEmpty=false and maxLength
    await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.textSheet({ title: 'T', label: 'L', initial: '', allowEmpty: false, maxLength: 5, submit(v) { (globalThis.__texted = globalThis.__texted || []).push(v); } }));
    assert.equal(await page.locator('#modal-root [data-ui3-text-run]').isDisabled(), true, 'empty is refused when allowEmpty is false');
    assert.equal(await page.locator('#modal-root [data-ui3-text-error]').innerText(), '入力してください。');
    assert.equal(await page.locator('#modal-root [data-ui3-text-input]').getAttribute('maxlength'), '5');
    await page.locator('#modal-root [data-ui3-text-input]').fill('abcde');
    assert.equal(await page.locator('#modal-root [data-ui3-text-run]').isDisabled(), false);
    await page.locator('#modal-root [data-ui3-text-input]').press('Enter');
    assert.deepEqual(await page.evaluate(() => globalThis.__texted), ['abcde'], 'Enter runs the sheet');
    // the default accepts an empty text, as the current dialog does
    await page.evaluate(() => globalThis.__capitalismTycoonModules.ui3.textSheet({ title: 'T', label: 'L', initial: 'x', submit(v) { (globalThis.__texted = globalThis.__texted || []).push(v); } }));
    await page.locator('#modal-root [data-ui3-text-input]').fill('');
    assert.equal(await page.locator('#modal-root [data-ui3-text-run]').isDisabled(), false, 'the default accepts empty');
    await page.locator('#modal-root [data-ui3-text-run]').tap();
    assert.deepEqual(await page.evaluate(() => globalThis.__texted), ['abcde', '']);
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-text-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
