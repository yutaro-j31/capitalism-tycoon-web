'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.env.D_UI_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'd-ui-webkit'));
const DIAGNOSTICS = [];

function server() {
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const file = path.resolve(ROOT, relative);
      assert.ok(file === ROOT || file.startsWith(ROOT + path.sep), 'unsafe request path');
      const body = fs.readFileSync(file);
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html';
      res.writeHead(200, { 'cache-control': 'no-store', 'content-type': `${type}; charset=utf-8` });
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500);
      res.end(String(error.message || error));
    }
  });
}

async function createCompany(page, suffix) {
  await page.goto(page.baseURL, { waitUntil: 'networkidle' });
  await page.locator('#setup-form input[name="playerName"]').fill(`D UI Tester ${suffix}`);
  await page.locator('#setup-form input[name="companyName"]').fill(`D UI Company ${suffix}`);
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.locator('.d-kpi-strip').waitFor();
}

async function assertNoRecovery(page, stage, errors) {
  const recovery = page.locator('[data-runtime-recovery-root]');
  if (await recovery.count()) {
    const text = await recovery.innerText().catch(() => 'runtime recovery text unavailable');
    throw new Error(`${stage}: runtime recovery opened\n${text}\npage errors: ${errors.join(' | ')}`);
  }
}

async function openCommandTab(page, tab) {
  await page.locator('[data-d-ui-action="toggle-menu"]').first().click();
  await page.locator('#d-ui-command-menu.open').waitFor();
  await page.locator(`#d-ui-command-menu [data-tab="${tab}"]`).click();
  await page.locator('#screen').waitFor();
  assert.equal(await page.locator('#d-ui-command-menu.open').count(), 0, 'command menu must close after navigation');
}

async function verifyOffice(page, errors, layout) {
  await openCommandTab(page, 'office');
  await page.locator('#screen[data-screen="office"]').waitFor();
  const tabs = page.locator('#screen [data-action="office-tab"]');
  assert.equal(await tabs.count(), 8, `${layout}: office screen must preserve eight subtabs`);
  const overview = page.locator('#screen [data-action="office-tab"][data-id="overview"]');
  assert.ok(await overview.count(), `${layout}: office overview tab must exist`);
  await page.locator('#screen [data-action="office-tab"][data-id="departments"]').click();
  await page.locator('#screen [data-action="office-tab"][data-id="departments"].active').waitFor();
  await overview.click();
  await page.locator('#screen [data-action="office-tab"][data-id="overview"].active').waitFor();
  assert.ok(await page.locator('#screen .card').count() > 0, `${layout}: office overview must render cards even without a contracted HQ`);
  await assertNoRecovery(page, `${layout} office navigation`, errors);
}

async function verifyBank(page, errors, layout) {
  await openCommandTab(page, 'bank');
  await page.locator('#screen[data-screen="bank"]').waitFor();
  assert.equal(await page.locator('#screen [data-action="borrow-company"]').count(), 1, `${layout}: company borrowing action must remain reachable`);
  assert.equal(await page.locator('#screen [data-action="repay-company"]').count(), 1, `${layout}: company repayment action must remain reachable`);
  assert.equal(await page.locator('#screen [data-action="borrow-personal"]').count(), 1, `${layout}: personal borrowing action must remain reachable`);
  assert.equal(await page.locator('#screen [data-action="repay-personal"]').count(), 1, `${layout}: personal repayment action must remain reachable`);
  assert.ok(await page.locator('#screen .forecast').count(), `${layout}: cashflow forecast must remain rendered`);
  assert.ok(await page.locator('#screen .forecast > div').count() > 0, `${layout}: cashflow forecast must retain forecast rows`);
  if (layout === 'iPhone') {
    const forecast = page.locator('#screen .forecast');
    const forecastFits = await forecast.evaluate(node => node.scrollWidth <= node.clientWidth + 1);
    assert.ok(forecastFits, 'iPhone bank forecast must fit its card without an internal horizontal scroller');
    const endingCash = page.locator('#screen .forecast > div > strong').first();
    const metrics = await endingCash.evaluate(node => {
      const computed = getComputedStyle(node);
      return { whiteSpace: computed.whiteSpace, height: node.getBoundingClientRect().height, fontSize: Number.parseFloat(computed.fontSize) };
    });
    assert.equal(metrics.whiteSpace, 'nowrap', 'iPhone forecast ending cash must remain on one line');
    assert.ok(metrics.height <= metrics.fontSize * 1.7, `iPhone forecast ending cash must not wrap vertically: ${metrics.height}px at ${metrics.fontSize}px`);
  }
  await assertNoRecovery(page, `${layout} bank navigation`, errors);
}

async function verifyMarket(page, errors, layout) {
  await openCommandTab(page, 'market');
  await page.locator('#screen[data-screen="market"]').waitFor();
  assert.equal(await page.locator('#screen select[data-bind="selectedAccount"]').count(), 1, `${layout}: investment account selector must remain reachable`);
  assert.equal(await page.locator('#screen select[data-bind="stockSector"]').count(), 1, `${layout}: stock sector selector must remain reachable`);
  assert.equal(await page.locator('#screen .stock-detail-card').count(), 1, `${layout}: selected stock detail must remain rendered`);
  assert.equal(await page.locator('#screen [data-stock-trade-panel]').count(), 1, `${layout}: selected stock trade panel must remain rendered`);
  assert.ok(await page.locator('#screen .market-row:not(.header)').count() > 0, `${layout}: stock list must retain tradable rows`);
  for (const action of ['buy-stock','sell-stock','favorite-stock']) {
    assert.ok(await page.locator(`#screen [data-stock-trade-panel] [data-action="${action}"]`).count(), `${layout}: selected stock ${action} action must remain reachable`);
  }
  assert.equal(await page.locator('#screen .chart-range [data-action="stock-chart-range"]').count(), 4, `${layout}: all four chart ranges must remain reachable`);
  if (layout === 'iPhone') {
    const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.ok(pageFits, 'iPhone market screen must not create page-level horizontal overflow');
    const tableFits = await page.locator('#screen .market-table').evaluate(node => node.scrollWidth <= node.clientWidth + 1);
    assert.ok(tableFits, 'iPhone market list must fit without the legacy horizontal scroller');
    const firstRow = page.locator('#screen .market-row:not(.header)').first();
    const rowStyle = await firstRow.evaluate(node => ({ display: getComputedStyle(node).display, width: node.getBoundingClientRect().width, parentWidth: node.parentElement.getBoundingClientRect().width }));
    assert.equal(rowStyle.display, 'grid', 'iPhone stock rows must render as D UI cards');
    assert.ok(rowStyle.width <= rowStyle.parentWidth + 1, `iPhone stock row must fit its market table: ${rowStyle.width}px > ${rowStyle.parentWidth}px`);
    for (const selector of ['#screen [data-stock-trade-panel] .btn','#screen .chart-range .btn','#screen .market-row:not(.header) .button-row .btn']) {
      const controls = page.locator(selector);
      const count = await controls.count();
      assert.ok(count > 0, `iPhone market control group must exist: ${selector}`);
      for (let i=0;i<count;i+=1) {
        const box = await controls.nth(i).boundingBox();
        assert.ok(box && box.height >= 44, `iPhone market control must be at least 44px high: ${selector} = ${box?.height}`);
      }
    }
  }
  await assertNoRecovery(page, `${layout} market navigation`, errors);
}

async function verifyDesktop(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.baseURL = `${base}index.html`;
  const errors = [];
  page.on('pageerror', error => { const text=String(error.message || error); errors.push(text); DIAGNOSTICS.push(`desktop pageerror: ${text}`); });
  page.on('console', message => { if(message.type()==='error')DIAGNOSTICS.push(`desktop console: ${message.text()}`); });
  await createCompany(page, 'desktop');

  await page.locator('#d-ui-sidebar').waitFor();
  await page.locator('#d-ui-dock').waitFor();
  assert.equal(await page.locator('.d-kpi').count(), 5, 'desktop KPI bar must contain five metrics');
  await page.locator('#d-ui-sidebar [data-tab="map"]').click();
  await page.locator('.d-map-workspace').waitFor();
  await page.locator('.d-context-panel').waitFor();
  await page.locator('.d-map-directory').waitFor();
  assert.ok(await page.locator('.d-map-marker').count() > 0, 'D map must expose at least one actionable marker');

  const firstMarker = page.locator('.d-map-marker').first();
  await firstMarker.click();
  assert.ok((await page.locator('.d-context-panel h2').textContent()).trim().length > 0, 'selected marker must populate the context drawer');

  await openCommandTab(page, 'business');
  assert.ok(await page.locator('#screen .card').count() > 0, 'existing business screen must remain rendered');
  await assertNoRecovery(page, 'after business navigation', errors);

  await verifyOffice(page, errors, 'desktop');
  await page.screenshot({ path: path.join(OUT, 'd-ui-office-desktop.png'), fullPage: true });

  await verifyBank(page, errors, 'desktop');
  await page.screenshot({ path: path.join(OUT, 'd-ui-bank-desktop.png'), fullPage: true });

  await verifyMarket(page, errors, 'desktop');
  await page.screenshot({ path: path.join(OUT, 'd-ui-market-desktop.png'), fullPage: true });

  await page.locator('#d-ui-sidebar [data-tab="map"]').click();
  await page.locator('.d-map-workspace').waitFor();
  await page.screenshot({ path: path.join(OUT, 'd-ui-desktop.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await context.close();
}

async function verifyIPhone(browser, base) {
  const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ja-JP', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.baseURL = `${base}index.html`;
  const errors = [];
  page.on('pageerror', error => { const text=String(error.message || error); errors.push(text); DIAGNOSTICS.push(`iphone pageerror: ${text}`); });
  page.on('console', message => { if(message.type()==='error')DIAGNOSTICS.push(`iphone console: ${message.text()}`); });
  await createCompany(page, 'iphone');
  await page.locator('#d-ui-sidebar').waitFor();

  const sidebarPosition = await page.locator('#d-ui-sidebar').evaluate(node => getComputedStyle(node).position);
  assert.equal(sidebarPosition, 'fixed', 'iPhone D navigation must remain fixed');
  await page.locator('#d-ui-sidebar [data-tab="map"]').click();
  await page.locator('.d-map-workspace').waitFor();
  await page.locator('.d-map-stage').waitFor();

  await verifyOffice(page, errors, 'iPhone');
  const firstOfficeTabBox = await page.locator('#screen [data-action="office-tab"]').first().boundingBox();
  assert.ok(firstOfficeTabBox && firstOfficeTabBox.height >= 44, `iPhone office tab must be at least 44px high, got ${firstOfficeTabBox?.height}`);
  const noOfficeHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert.ok(noOfficeHorizontalOverflow, 'iPhone office screen must not create page-level horizontal overflow');
  await page.locator('#screen [data-action="office-tab"][data-id="departments"]').click();
  await page.locator('#screen [data-action="office-tab"][data-id="departments"].active').waitFor();
  await page.screenshot({ path: path.join(OUT, 'd-ui-office-iphone.png'), fullPage: true });
  await assertNoRecovery(page, 'after iPhone office navigation', errors);

  await verifyBank(page, errors, 'iPhone');
  for (const action of ['borrow-company','repay-company','borrow-personal','repay-personal']) {
    const box = await page.locator(`#screen [data-action="${action}"]`).boundingBox();
    assert.ok(box && box.height >= 44, `iPhone ${action} must be at least 44px high, got ${box?.height}`);
  }
  const noBankHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert.ok(noBankHorizontalOverflow, 'iPhone bank screen must not create page-level horizontal overflow');
  await page.screenshot({ path: path.join(OUT, 'd-ui-bank-iphone.png'), fullPage: true });
  await assertNoRecovery(page, 'after iPhone bank navigation', errors);

  await verifyMarket(page, errors, 'iPhone');
  await page.screenshot({ path: path.join(OUT, 'd-ui-market-iphone.png'), fullPage: true, scale: 'css' });
  await assertNoRecovery(page, 'after iPhone market navigation', errors);

  await openCommandTab(page, 'settings');
  assert.ok(await page.locator('#screen .card').count() > 0, 'settings screen must remain usable from the mobile command menu');
  await assertNoRecovery(page, 'after settings navigation', errors);
  await page.screenshot({ path: path.join(OUT, 'd-ui-iphone.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await context.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const appServer = server();
  await new Promise((resolve, reject) => { appServer.once('error', reject); appServer.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${appServer.address().port}/`;
  let browser;
  try {
    browser = await webkit.launch();
    await verifyDesktop(browser, base);
    await verifyIPhone(browser, base);
    fs.writeFileSync(path.join(OUT, 'd-ui-webkit.json'), JSON.stringify({ status: 'passed', layouts: ['desktop', 'iPhone 13'], shell: 'D' }, null, 2) + '\n');
    console.log('D UI desktop and iPhone WebKit smoke passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => appServer.close(resolve));
  }
}

main().catch(error => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'd-ui-webkit-failure.log'), `${String(error.stack || error)}\n\n${DIAGNOSTICS.join('\n')}\n`);
  console.error(error.stack || error);
  process.exit(1);
});
