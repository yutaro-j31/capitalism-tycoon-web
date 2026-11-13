'use strict';

// UI3-12b: money-moving operations are confirmed, and the numbers that go in are checked (play-test B11, B12, B18, O4, B3, O6).
//  - borrowing, the welfare investment, the founder's injection, an office contract and a venture investment show a confirmation sheet
//    (the amounts, the cash afterwards) and change nothing until it is confirmed; the company's operations never move personal cash and
//    the founder's own never move the company's more than shown;
//  - an office whose weekly rent is above the latest weekly profit warns that every week will run at a loss;
//  - a confirmation that leaves the company cash under the engine's reserve says so in one line (it never blocks);
//  - the venture amount sheet shows the minimum ticket and keeps the run button off below it, with the reason;
//  - a store price is saved as whole yen (what the sheet shows is what is saved); a far price is confirmed with a warning;
//  - the listing dialog of the current UI shows the estimated raise and the founder's proceeds from the engine's own formulas.
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
for (const [file, pattern, why] of [
  ['ui3-bank.js', /confirm:value=>\(\{title:`\$\{f\.name\}で/, 'borrowing confirms the amount'],
  ['ui3-office.js', /福利厚生に投資/, 'the welfare investment confirms the amount'],
  ['ui3-crisis.js', /創業者資金\$\{money\(value\)\}を注入/, "the founder's injection confirms the amount"],
  ['ui3-map.js', /data-ui3-map-contract/, 'an office contract goes through the confirmation sheet'],
  ['ui3-venture.js', /min:finite\(s\.minTicket\)/, 'the venture sheet carries the engine minimum ticket'],
  ['ui3-business.js', /integer:true/, 'a price is saved as whole yen'],
  ['ui3-rivals.js', /reserveNote/, 'the competitor responses warn about the reserve'],
]) assert.match(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8'), pattern, `${file}: ${why}`);
assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'js', 'ui3-shell.js'), 'utf8'), /Math\.random|Date\.now/, 'the shell uses no RNG or clock');

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
async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}
const yen = (page, value) => page.evaluate(amount => globalThis.__capitalismTycoonModules.engine.compactYen(amount), value);
const facts = page => page.locator('#modal-root [data-ui3-confirm-facts] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText]));
const note = page => page.locator('#modal-root [data-ui3-confirm-note]').innerText().catch(() => '');
// click an existing action through a hidden button (the app's delegated handler runs it, as for any row)
const press = (page, action, id = '') => page.evaluate(([a, i]) => { const b = document.createElement('button'); b.dataset.action = a; if (i) b.dataset.id = i; b.hidden = true; document.getElementById('app').appendChild(b); b.click(); b.remove(); }, [action, id]);
const snapshot = page => engineEval(page, engine => ({ company: engine.g.companyCash, personal: engine.g.personalCash, debt: engine.g.companyDebt, week: engine.g.week }));

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const launch = browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {};
  const browser = await playwright[browserName].launch(launch);
  const device = playwright.devices['iPhone 13'];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);

    // ---- B12: borrowing -------------------------------------------------------------------------------------------
    await goTo(page, 'bank');
    let start = await snapshot(page);
    await page.locator('[data-action="borrow-company"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').fill('1000000');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.locator('#modal-root [data-ui3-amount-confirm]').waitFor({ state: 'visible', timeout: 10000 });
    let rows = await facts(page);
    assert.deepEqual(rows.map(row => row[0]), ['借入額', '借入後の残高', '実行後の会社の現金', '残りの借入余力'], 'borrowing: the confirmation names the amount, the debt, the cash and the capacity');
    assert.equal(rows[2][1], await yen(page, start.company + 1000000), 'borrowing: the cash afterwards is the cash plus the amount');
    assert.deepEqual(await snapshot(page), start, 'borrowing: nothing changed before the confirmation');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.deepEqual(await snapshot(page), start, 'borrowing: cancelling changes nothing');
    await page.locator('[data-action="borrow-company"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').fill('1000000');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.locator('#modal-root [data-ui3-amount-confirm]').tap();
    await page.waitForFunction(debt => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyDebt === debt + 1000000, start.debt, { timeout: 10000 });
    let end = await snapshot(page);
    assert.deepEqual([end.company - start.company, end.personal - start.personal], [1000000, 0], 'borrowing: the company receives exactly the amount, the personal cash does not move');

    // ---- B12 / O4: welfare investment and the reserve warning -------------------------------------------------------
    start = await snapshot(page);
    await engineEval(page, engine => { engine.g.companyCash = 4000000; engine.emit(); });
    await press(page, 'workforce-invest');
    await page.locator('#modal-root [data-ui3-amount-input]').fill('2000000');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.locator('#modal-root [data-ui3-amount-confirm]').waitFor({ state: 'visible', timeout: 10000 });
    rows = await facts(page);
    assert.equal(rows[0][0], '投資額');
    assert.equal(rows[1][1], await yen(page, 2000000), 'welfare: the cash afterwards is the cash minus the amount');
    const reserve = await engineEval(page, engine => globalThis.__capitalismTycoonModules.playerCrisis.snapshot(engine.g).reserveThreshold);
    assert.ok(reserve > 2000000, `setup: the reserve is ${reserve}`);
    assert.match(await note(page), /必要準備/, 'welfare: a cash afterwards under the reserve is warned about');
    assert.match(await note(page), new RegExp((await yen(page, reserve)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'welfare: the warning names the engine reserve');
    const before = await snapshot(page);
    assert.equal(before.company, 4000000);
    await page.locator('#modal-root [data-ui3-amount-confirm]').tap();
    await page.waitForFunction(() => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyCash === 2000000, null, { timeout: 10000 });
    assert.equal((await snapshot(page)).personal, before.personal, 'welfare: the personal cash does not move');
    // plenty of cash: no warning
    await engineEval(page, (engine, value) => { engine.g.companyCash = value; engine.emit(); }, reserve * 10);
    await press(page, 'workforce-invest');
    await page.locator('#modal-root [data-ui3-amount-input]').fill('1000000');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.locator('#modal-root [data-ui3-amount-confirm]').waitFor({ state: 'visible', timeout: 10000 });
    assert.doesNotMatch(await note(page), /必要準備/, 'welfare: no reserve warning when the cash stays above the reserve');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();

    // ---- B18: the venture minimum ticket ----------------------------------------------------------------------------
    await page.evaluate(() => {
      const ui3 = globalThis.__capitalismTycoonModules.ui3;
      ui3.setAmountContext({ unit: '円', wallet: 'company', direction: 'spend', min: 5000000, note: '最低額 500万円' });
      ui3.amountSheet({ title: 'ベンチャー会社投資', initial: 1000000, submit() { window.__ventureRan = true; } });
    });
    await page.locator('#modal-root [data-ui3-amount-input]').fill('1000000');
    assert.equal(await page.locator('#modal-root [data-ui3-amount-run]').isDisabled(), true, 'below the minimum the run button is off');
    assert.match(await page.locator('#modal-root [data-ui3-amount-error]').innerText(), /最低額は500(\.0)?万円/, 'the reason names the minimum');
    await page.locator('#modal-root [data-ui3-amount-input]').fill('5000000');
    assert.equal(await page.locator('#modal-root [data-ui3-amount-run]').isDisabled(), false, 'at the minimum the run button is on');
    await page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
    assert.equal(await page.evaluate(() => window.__ventureRan === true), false, 'cancelling runs nothing');
    // and the real venture row passes the engine's own minimum ticket
    const ventureMin = await engineEval(page, engine => (engine.g.startups || []).map(startup => startup.minTicket));
    assert.ok(ventureMin.length > 0 && ventureMin.every(value => value >= 5000000), `the engine's minimum tickets are ${ventureMin}`);

    // ---- B3: a store price is whole yen; a far price is confirmed --------------------------------------------------------
    const storeID = await engineEval(page, engine => {
      const g = engine.g, tenant = g.tenants.find(item => !item.occupiedBy);
      engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '価格検査店', operatingHours: 3 });
      const store = g.stores.find(item => item.name === '価格検査店'); store.status = 'open'; engine.emit(); return store.id;
    });
    await press(page, 'store-price', storeID);
    await page.locator('#modal-root [data-ui3-amount-input]').fill('1234.6');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.stores.find(store => store.id === id).priceOverride === 1235, storeID, { timeout: 10000 });
    assert.equal(await page.locator('#modal-root [data-ui3-amount-confirm]').count(), 0, 'a price near the current one is not confirmed again');
    // 0.4 yen rounds to 0: refused with the reason
    await press(page, 'store-price', storeID);
    await page.locator('#modal-root [data-ui3-amount-input]').fill('0.4');
    assert.equal(await page.locator('#modal-root [data-ui3-amount-run]').isDisabled(), true, 'a price that rounds to 0 yen cannot be run');
    assert.match(await page.locator('#modal-root [data-ui3-amount-error]').innerText(), /1円以上/);
    // 5 times the current price: the confirmation warns
    await page.locator('#modal-root [data-ui3-amount-input]').fill('6175');
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.locator('#modal-root [data-ui3-amount-confirm]').waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await note(page), /3倍以上/, 'a far price is confirmed with a warning');
    assert.equal(await engineEval(page, (engine, id) => engine.g.stores.find(store => store.id === id).priceOverride, storeID), 1235, 'nothing is saved before the confirmation');
    await page.locator('#modal-root [data-ui3-amount-confirm]').tap();
    await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.stores.find(store => store.id === id).priceOverride === 6175, storeID, { timeout: 10000 });

    // ---- B12: the founder's injection (crisis sheet) ------------------------------------------------------------------
    await engineEval(page, engine => {
      const m = globalThis.__capitalismTycoonModules;
      delete engine.g.playerCrisis; delete engine.g.playerCrisisActions;
      engine.g.week = 2; engine.g.companyCash = -1000000; engine.g.personalCash = 50000000; engine.g.companyCredit = 80;
      engine.g.finance = m.finance.defaultFinanceState(engine.g);
      m.playerCrisis.evaluate(engine.g);
      engine.crisisLiquidityOptions(); engine.emit();
    });
    await goTo(page, 'home');
    await page.locator('[data-ui3-crisis-open]').first().tap();
    await page.locator('#modal-root [data-ui3-cr="founder"]').tap();
    assert.equal(await page.locator('#modal-root [data-ui3-amount-input]').inputValue(), '1000000', 'the injection starts at 1,000,000 yen (the current screen\'s default)');
    const inj = await snapshot(page);
    await page.locator('#modal-root [data-ui3-amount-run]').tap();
    await page.locator('#modal-root [data-ui3-amount-confirm]').waitFor({ state: 'visible', timeout: 10000 });
    rows = await facts(page);
    assert.deepEqual(rows, [['注入額', await yen(page, 1000000)], ['実行後の会社現金', await yen(page, inj.company + 1000000)], ['実行後の個人現金', await yen(page, inj.personal - 1000000)]], "the injection's confirmation shows both wallets afterwards");
    assert.deepEqual(await snapshot(page), inj, 'nothing moved before the confirmation');
    await page.locator('#modal-root [data-ui3-amount-confirm]').tap();
    await page.waitForFunction(cash => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.companyCash === cash, inj.company + 1000000, { timeout: 10000 });
    assert.equal((await snapshot(page)).personal, inj.personal - 1000000, 'the personal cash fell by exactly the amount');

    assert.deepEqual(pageErrors, [], 'no page errors');
    await context.close();

    // ---- B11: an office contract -------------------------------------------------------------------------------------
    {
      const { context: officeContext, page: officePage, pageErrors: officeErrors } = await newPage();
      await found(officePage, `${base}?ui=3`);
      await goTo(officePage, 'map');
      await officePage.waitForFunction(() => document.querySelectorAll('.ui3 .u-pin:not([hidden])').length > 0, null, { timeout: 30000 });
      await officePage.locator('[data-ui3-map-filter="office"]').tap();
      await officePage.waitForTimeout(300);
      const openOffice = async () => {
        await officePage.locator('[data-ui3-map-list]').tap();
        await officePage.locator('#modal-root [data-ui3-map-pick]').first().tap();
        await officePage.locator('#modal-root .u-sheet [data-ui3-map-sheet]').waitFor({ state: 'attached', timeout: 10000 });
      };
      await openOffice();
      assert.equal(await officePage.locator('#modal-root [data-action="contract-office"]').count(), 0, 'the contract button does not sign by itself');
      const startOffice = await snapshot(officePage);
      const target = await engineEval(officePage, engine => { const id = document.querySelector('#modal-root [data-ui3-map-contract]').dataset.id; const o = engine.g.rentalOffices.find(item => item.id === id); return { id, deposit: Math.ceil(o.deposit), rent: o.rent }; });
      await officePage.locator('#modal-root [data-ui3-map-contract]').tap();
      await officePage.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible', timeout: 10000 });
      const sheet = await facts(officePage);
      assert.deepEqual(sheet.slice(0, 2), [['保証金', await yen(officePage, target.deposit)], ['毎週の家賃', await yen(officePage, target.rent)]], 'the confirmation shows the deposit and the weekly rent');
      assert.equal(sheet[3][1], await yen(officePage, startOffice.company - target.deposit), 'the cash afterwards is the cash minus the deposit');
      assert.match(await note(officePage), /毎週赤字になる見込み/, 'a rent above the latest weekly profit is warned about');
      assert.deepEqual(await snapshot(officePage), startOffice, 'nothing moved before the confirmation');
      await officePage.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
      assert.deepEqual(await snapshot(officePage), startOffice, 'cancelling changes nothing');
      // a profit above the rent: no warning (the home card's own number is stubbed for this one sheet)
      await officePage.evaluate(() => { const dashboard = globalThis.__capitalismTycoonModules.ceoDashboard; const original = dashboard.weeklyImpact; window.__restoreImpact = () => { dashboard.weeklyImpact = original; }; dashboard.weeklyImpact = (...args) => { const r = original(...args); return { ...r, metrics: r.metrics.map(m => (m.id === 'profit' ? { ...m, value: 1e9 } : m)) }; }; });
      await openOffice();
      await officePage.locator('#modal-root [data-ui3-map-contract]').tap();
      await officePage.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible', timeout: 10000 });
      assert.doesNotMatch(await note(officePage), /毎週赤字/, 'a profit above the rent: no loss warning');
      await officePage.evaluate(() => window.__restoreImpact());
      // the engine's progression rewards (a first-office milestone grant) are not part of the contract; switch the reward check off for this one call
      await engineEval(officePage, engine => { engine.evaluateProgression = () => true; });
      await officePage.locator('#modal-root [data-ui3-confirm]').tap();
      await officePage.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.contractedOfficeID === id, target.id, { timeout: 10000 });
      const signed = await snapshot(officePage);
      assert.equal(signed.company, startOffice.company - target.deposit, `the deposit was charged exactly as shown (${JSON.stringify({ startOffice, signed, target })})`);
      assert.deepEqual(officeErrors, [], 'no page errors');
      await officeContext.close();
    }

    // ---- O6: the IPO estimate (the current UI's dialog) ---------------------------------------------------------------
    {
      const { context: ipoContext, page: ipoPage, pageErrors: ipoErrors } = await newPage();
      await found(ipoPage, base);
      await press(ipoPage, 'execute-ipo');
      await ipoPage.locator('#ipo-estimate').waitFor({ state: 'visible', timeout: 10000 });
      const expected = await engineEval(ipoPage, engine => {
        const g = engine.g, ceilYen = globalThis.__capitalismTycoonModules.economicOperation.ceilYen;
        const out = {};
        for (const market of ['東証グロース', '東証スタンダード', '東証プライム']) {
          const multiple = market === '東証プライム' ? 1.25 : market === '東証スタンダード' ? 1.1 : 1;
          const price = Math.max(100, engine.companyValue() * multiple / g.sharesOut);
          const sellFloor = Math.max(1, Math.round(g.founderShares * .05)), sellCeil = Math.max(sellFloor, Math.round(g.founderShares * .4));
          const sell = Math.min(sellCeil, Math.max(sellFloor, Math.floor(Math.max(1, Math.round(g.founderShares * .1))) || sellFloor));
          const newShares = Math.max(1, Math.round(g.sharesOut * .2));
          out[market] = [ceilYen(price * newShares * .955), ceilYen(price * sell * .955)];
        }
        return out;
      });
      for (const market of Object.keys(expected)) {
        await ipoPage.locator('#ipo-market').selectOption(market);
        const text = await ipoPage.locator('#ipo-estimate').innerText();
        assert.ok(text.includes(await yen(ipoPage, expected[market][0])) && text.includes(await yen(ipoPage, expected[market][1])), `${market}: the estimate shows the raise and the founder's proceeds (${text})`);
      }
      assert.match(await ipoPage.locator('#ipo-estimate').innerText(), /株価は上場時の会社価値で決まります/, 'the estimate says the real price is set at listing');
      assert.deepEqual(ipoErrors, [], 'no page errors');
      await ipoContext.close();
    }
    console.log(`ui3-12b-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
