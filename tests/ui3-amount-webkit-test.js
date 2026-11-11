'use strict';

// UI v3 amount / quantity input sheet (docs/ui-v3/README.md 5.7, task UI3-9a). Proves in a real browser that:
//  - without ?ui=3 the current dialogs are unchanged (the amount dialog of js/app.js / js/iphone-playtest-fixes.js);
//  - with ?ui=3 every askMoney request, on v3 screens and on screens the current UI still draws, is the v3 sheet
//    and the current dialogs do not appear;
//  - buying shares: the sheet is labelled for shares, offers the chips and "最大", shows the approximate amount
//    (price x shares) and the personal cash afterwards, updates while typing, goes red when the cash would turn
//    negative, and the shares bought equal the number entered;
//  - selling shows the amount received; spending company money names the company wallet;
//  - a value that is not a positive whole number cannot be run (the reason is shown); "やめる" changes nothing;
//    Enter runs it;
//  - the acceptance numbers: text of at least 13px, taps of at least 44px, a 48px input with 20px text, no
//    horizontal overflow, one primary button.
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
const shellSource = fs.readFileSync(path.join(ROOT, 'js', 'ui3-shell.js'), 'utf8');
const appSource = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
assert.match(appSource, /function askMoney\(title,defaultValue,callback\)\{if\(__modules\.ui3\?\.amountSheet\(\{title,initial:defaultValue,submit:callback\}\)\)return;modal\(/, 'js/app.js: one line at the top of askMoney, the current dialog otherwise');
assert.match(fs.readFileSync(path.join(ROOT, 'js', 'iphone-playtest-fixes.js'), 'utf8'), /function interceptMoney\(event\)\{if\(modules\.ui3\?\.enabled\?\.\(\)\)return false;/, 'the iPhone amount dialog gives way while UI v3 is on');
assert.doesNotMatch(shellSource, /Math\.random|MutationObserver|registerUIEnhancer/, 'the shell uses no RNG, observer or D UI enhancer');
for (const css of ['css/ui3.css', 'docs/ui-v3/ui3.css']) {
  const text = fs.readFileSync(path.join(ROOT, css), 'utf8');
  for (const selector of ['.u-field', '.u-input', '.u-error']) assert.ok(text.includes(`.ui3 ${selector}`), `${css} defines ${selector}`);
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
  const modules = globalThis.__capitalismTycoonModules;
  return (0, eval)(`(${source})`)(modules.playerEngineBridge.getEngine(), value, modules);
}, [fn.toString(), arg]);
const digest = page => engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value)));
const yen = (page, value) => engineEval(page, (engine, amount, modules) => modules.engine.compactYen(amount), value);
const sheet = page => page.locator('#modal-root .u-sheet');
const input = page => page.locator('#modal-root [data-ui3-amount-input]');
const run = page => page.locator('#modal-root [data-ui3-amount-run]');
const preview = page => page.locator('#modal-root [data-ui3-amount-preview] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText, node.querySelector('b').classList.contains('u-down')]));

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
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // 1. Flag off: the current dialogs.
    {
      const { context, page, pageErrors } = await newPage();
      await found(page, base);
      await goTo(page, 'market');
      await page.locator('[data-action="buy-stock"]').first().tap();
      await page.locator('#modal-root .modal input').waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('#modal-root .u-sheet').count(), 0, 'without ?ui=3 the current share dialog is shown');
      assert.equal(await page.locator('#modal-root [data-ui3-amount-input]').count(), 0);
      await page.locator('#modal-root [data-action="close-modal"]').first().tap();
      await goTo(page, 'business');
      await engineEval(page, engine => { const tenant = engine.g.tenants.find(item => !item.occupiedBy); engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'テスト店', operatingHours: 3 }); });
      await goTo(page, 'business');
      await page.locator('[data-action="business-invest"]').first().tap();
      await page.locator('#iphone-money-form').waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('#modal-root .u-sheet').count(), 0, 'without ?ui=3 the iPhone amount dialog is shown');
      assert.deepEqual(pageErrors, []);
      await context.close();
    }

    // 2. Flag on.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    await goTo(page, 'market');
    await page.locator('[data-ui3-market="summary"]').waitFor({ state: 'visible' });
    const stock = await engineEval(page, engine => { const row = engine.g.market[0]; return { id: row.id, name: row.name, price: row.price, cash: engine.g.personalCash }; });
    const baseline = await digest(page);

    // Buy: the sheet.
    await page.locator('[data-ui3-mkt="all"]').tap();
    await page.locator('#modal-root [data-ui3-mkt="stock"]').first().tap();
    await page.locator('#modal-root [data-action="buy-stock"]').tap();
    await input(page).waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root #iphone-money-form, #modal-root .modal').count(), 0, 'the current dialogs do not appear');
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), '購入株数');
    assert.equal(await page.locator('#modal-root .u-field > span').innerText(), '株数', 'the field is labelled for shares, not for yen');
    const maxShares = Math.floor(stock.cash / (stock.price * 1.001));
    assert.deepEqual(await page.locator('#modal-root [data-ui3-amount-chip]').allInnerTexts(), ['100', '500', '1,000', '最大']);
    assert.equal(await page.locator('[data-ui3-amount-max]').getAttribute('data-ui3-amount-chip'), String(maxShares), 'the maximum is what the personal cash buys');
    assert.equal(await input(page).inputValue(), '100', 'the initial value is the one askMoney was given');
    assert.equal(await input(page).getAttribute('inputmode'), 'numeric');
    // typing updates the preview
    await input(page).fill('10');
    assert.deepEqual(await preview(page), [['概算の金額', await yen(page, stock.price * 10), false], ['実行後の個人の現金', await yen(page, stock.cash - stock.price * 10), false]], 'price x shares, and the cash afterwards, with the wallet named');
    await input(page).fill('20');
    assert.equal((await preview(page))[0][1], await yen(page, stock.price * 20), 'the preview follows the input');
    // the acceptance numbers
    const measured = await page.evaluate(() => {
      const root = document.querySelector('#modal-root .u-sheet');
      const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
      const small = [...root.querySelectorAll('button')].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.textContent.trim());
      let minFont = 99; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
      const field = root.querySelector('[data-ui3-amount-input]'), style = getComputedStyle(field), box = field.getBoundingClientRect();
      return { small, minFont, inputHeight: Math.round(box.height), inputFont: style.fontSize, bottom: Math.round(root.getBoundingClientRect().bottom), primaries: [...root.querySelectorAll('.u-btn.primary')].filter(visible).length,
        overflowX: document.documentElement.scrollWidth > innerWidth || root.scrollWidth > root.clientWidth, foot: [...root.querySelectorAll('.u-sheet-foot button')].map(button => [button.innerText.trim(), button.dataset.action || '', button.classList.contains('primary')]),
        focused: document.activeElement === field };
    });
    assert.deepEqual(measured.small, [], 'every control is at least 44x44');
    assert.ok(measured.minFont >= 13, `smallest text is ${measured.minFont}px`);
    assert.deepEqual([measured.inputHeight, measured.inputFont, measured.primaries, measured.bottom, measured.overflowX], [48, '20px', 1, device.viewport.height, false]);
    assert.deepEqual(measured.foot, [['やめる', 'close-modal', false], ['実行する', '', true]]);
    assert.equal(measured.focused, true, 'the field is focused');
    // chips
    await page.locator('[data-ui3-amount-chip="500"]').tap();
    assert.equal(await input(page).inputValue(), '500');
    await page.locator('[data-ui3-amount-max]').tap();
    assert.equal(await input(page).inputValue(), String(maxShares));
    assert.equal((await preview(page))[1][2], false, 'the maximum leaves the cash non-negative');
    // beyond the cash: red, but the run is not blocked (the engine decides)
    await input(page).fill(String(maxShares + 5000));
    assert.equal((await preview(page))[1][2], true, 'a negative cash afterwards is shown in red');
    assert.equal(await run(page).isDisabled(), false, 'it does not stop the run');
    // values that cannot be run
    for (const [text, pattern] of [['', /入力/], ['0', /1以上の整数/], ['-5', /1以上の整数/], ['abc', /1以上の整数/], ['1.5', /1以上の整数/]]) {
      await input(page).fill(text);
      assert.equal(await run(page).isDisabled(), true, `"${text}" cannot be run`);
      assert.match(await page.locator('[data-ui3-amount-error]').innerText(), pattern, `"${text}": the reason is shown`);
    }
    await input(page).fill('1,000');
    assert.equal(await run(page).isDisabled(), false, 'commas are accepted, as in the current dialog');
    assert.equal(await page.locator('[data-ui3-amount-error]').innerText(), '');
    // やめる changes nothing
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '');
    assert.equal(await digest(page), baseline, 'やめる changes nothing');
    // buy 10 shares: the number entered is the number bought
    await page.locator('[data-ui3-mkt="all"]').tap();
    await page.locator('#modal-root [data-ui3-mkt="stock"]').first().tap();
    await page.locator('#modal-root [data-action="buy-stock"]').tap();
    await input(page).fill('10');
    await run(page).tap();
    await page.waitForFunction(id => (globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.personalStocks[id]?.qty || 0) === 10, stock.id, { timeout: 10000 });
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '', 'the sheet closed');
    // sell 4: the amount received; Enter runs it
    await page.locator('[data-ui3-market="holdings"] .u-row').first().tap();
    await page.locator('#modal-root [data-action="sell-stock"]:not([disabled])').tap();
    await input(page).fill('4');
    const cashBeforeSell = await engineEval(page, engine => engine.g.personalCash);
    assert.deepEqual(await preview(page), [['概算の受取額', await yen(page, stock.price * 4), false], ['実行後の個人の現金', await yen(page, cashBeforeSell + stock.price * 4), false]]);
    assert.equal(await page.locator('[data-ui3-amount-max]').getAttribute('data-ui3-amount-chip'), '10', 'the maximum of a sale is the holding');
    await input(page).press('Enter');
    await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.personalStocks[id]?.qty === 6, stock.id, { timeout: 10000 });
    assert.equal(await page.evaluate(() => document.getElementById('modal-root').innerHTML), '');

    // Company money: the company wallet is named, the chips are in yen.
    await engineEval(page, engine => { const tenant = engine.g.tenants.find(item => !item.occupiedBy); engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'テスト店', operatingHours: 3 }); });
    await goTo(page, 'business');
    await page.locator('[data-ui3-biz="business"]').tap();
    await page.locator('#modal-root [data-action="business-invest"]').first().tap();
    await input(page).waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root #iphone-money-form').count(), 0, 'the iPhone amount dialog does not appear');
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), '事業投資');
    assert.equal(await page.locator('#modal-root .u-field > span').innerText(), '金額（円）');
    assert.deepEqual(await page.locator('#modal-root [data-ui3-amount-chip]').allInnerTexts(), ['10万', '50万', '100万'], 'no maximum is known for this one');
    const companyCash = await engineEval(page, engine => engine.g.companyCash);
    await input(page).fill('500000');
    assert.deepEqual(await preview(page), [['概算の金額', await yen(page, 500000), false], ['実行後の会社の現金', await yen(page, companyCash - 500000), false]]);
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await engineEval(page, engine => engine.g.companyCash), companyCash, 'やめる changes nothing');

    // In yen: 0 or more, decimals allowed; only a negative value or a non-number cannot be run.
    await page.locator('[data-ui3-biz="business"]').tap();
    await page.locator('#modal-root [data-action="business-invest"]').first().tap();
    await input(page).waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await input(page).getAttribute('inputmode'), 'decimal');
    for (const [text, disabled] of [['-5', true], ['abc', true], ['', true], ['0', false], ['1.5', false], ['1,000', false]]) {
      await input(page).fill(text);
      assert.equal(await run(page).isDisabled(), disabled, `yen "${text}"`);
    }
    await input(page).fill('-5');
    assert.match(await page.locator('[data-ui3-amount-error]').innerText(), /0以上の数値/);
    const cashBeforeNegative = await engineEval(page, engine => engine.g.companyCash);
    await run(page).click({ force: true }).catch(() => {});
    assert.equal(await engineEval(page, engine => engine.g.companyCash), cashBeforeNegative, 'a negative amount cannot be run');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    // A price change names no wallet: no preview, and no yen chips (its initial value is far below 10万円).
    await page.locator('[data-ui3-biz="business"]').tap();
    await page.locator('#modal-root [data-action="business-price"]').tap();
    await input(page).waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root [data-ui3-amount-preview]').count(), 0, 'no preview without a wallet');
    assert.equal(await page.locator('#modal-root [data-ui3-amount-chip]').count(), 0, 'no chips of the wrong magnitude for a price change');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();

    // A dividend of 0 (no dividend) can be set after listing: the engine takes 0 and decimals.
    await engineEval(page, engine => { engine.g.publicCompany = true; });   // test setup: listed
    await goTo(page, 'market');
    await page.locator('[data-ui3-current="market"]').tap();
    await page.waitForFunction(() => document.body.classList.contains('d-ui-active') && !document.body.classList.contains('ui3-native'), null, { timeout: 10000 });
    await page.locator('[data-action="set-dividend"]').first().tap();
    await input(page).waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root .u-sheet-head h1').innerText(), '四半期配当設定');
    assert.equal(await page.locator('#modal-root [data-ui3-amount-chip]').count(), 0, 'no chips for a dividend');
    await input(page).fill('0');
    assert.equal(await run(page).isDisabled(), false, '0 can be run');
    await run(page).tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.dividendPerShare === 0, null, { timeout: 10000 });
    await page.locator('[data-action="set-dividend"]').first().tap();
    await input(page).fill('12.5');
    assert.equal(await run(page).isDisabled(), false, 'a decimal can be run');
    await run(page).tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.dividendPerShare === 12.5, null, { timeout: 10000 });
    await page.evaluate(() => document.querySelector('[data-action="tab"][data-tab="home"]').click());
    await engineEval(page, engine => { engine.g.publicCompany = false; });

    // A screen the current UI still draws (the bank): the request is still the v3 sheet.
    await goTo(page, 'bank');
    await page.locator('[data-action="borrow-company"]').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-action="borrow-company"]').first().tap();
    await input(page).waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#modal-root #iphone-money-form, #modal-root .modal').count(), 0, 'on a current-UI screen the v3 sheet is used as well');
    assert.equal(await page.locator('#modal-root .u-field > span').innerText(), '金額（円）');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-amount-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
