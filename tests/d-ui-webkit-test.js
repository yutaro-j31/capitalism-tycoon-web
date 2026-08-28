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
  const sectorTabs = page.locator('#screen .d-market-sector-tabs');
  assert.equal(await sectorTabs.count(), 1, `${layout}: stock sector tabs must remain reachable`);
  const sectorInputs = sectorTabs.locator('input[data-bind="stockSector"]');
  assert.ok(await sectorInputs.count() > 1, `${layout}: stock sector tabs must expose multiple sector choices`);
  assert.equal(await sectorTabs.locator('input[data-bind="stockSector"]:checked').count(), 1, `${layout}: exactly one stock sector tab must stay selected`);
  assert.equal(await page.locator('#screen .stock-detail-card').count(), 1, `${layout}: selected stock detail must remain rendered`);
  assert.equal(await page.locator('#screen [data-stock-trade-panel]').count(), 1, `${layout}: selected stock trade panel must remain rendered`);
  const track = page.locator('#screen .d-market-carousel-track');
  assert.equal(await track.count(), 1, `${layout}: stock carousel track must remain rendered`);
  const stockCards = track.locator('.market-row:not(.header)');
  assert.ok(await stockCards.count() > 0, `${layout}: stock carousel must retain tradable company cards`);
  assert.equal(await page.locator('#screen .d-market-carousel-pager').count(), 1, `${layout}: stock carousel pager must remain rendered`);
  for (const action of ['buy-stock','sell-stock','favorite-stock']) {
    assert.ok(await page.locator(`#screen [data-stock-trade-panel] [data-action="${action}"]`).count(), `${layout}: selected stock ${action} action must remain reachable`);
  }
  assert.equal(await page.locator('#screen .chart-range [data-action="stock-chart-range"]').count(), 4, `${layout}: all four chart ranges must remain reachable`);
  if (layout === 'iPhone') {
    const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.ok(pageFits, 'iPhone market screen must not create page-level horizontal overflow');
    const sectorStyle = await sectorTabs.evaluate(node => ({ overflowX: getComputedStyle(node).overflowX, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
    assert.ok(['auto','scroll'].includes(sectorStyle.overflowX), `iPhone sector tabs must provide internal horizontal scrolling, got ${sectorStyle.overflowX}`);
    const trackStyle = await track.evaluate(node => ({ overflowX: getComputedStyle(node).overflowX, scrollSnapType: getComputedStyle(node).scrollSnapType, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
    assert.ok(['auto','scroll'].includes(trackStyle.overflowX), `iPhone company carousel must provide internal horizontal scrolling, got ${trackStyle.overflowX}`);
    assert.ok(trackStyle.scrollWidth > trackStyle.clientWidth + 1, `iPhone company carousel must contain horizontally swipeable cards: ${trackStyle.scrollWidth}px <= ${trackStyle.clientWidth}px`);
    assert.ok(String(trackStyle.scrollSnapType).includes('x'), `iPhone company carousel must preserve horizontal scroll snap, got ${trackStyle.scrollSnapType}`);
    const firstRow = stockCards.first();
    const rowStyle = await firstRow.evaluate(node => ({ display: getComputedStyle(node).display, width: node.getBoundingClientRect().width, parentWidth: node.parentElement.getBoundingClientRect().width }));
    assert.equal(rowStyle.display, 'grid', 'iPhone stock rows must render as D UI cards');
    assert.ok(rowStyle.width < rowStyle.parentWidth - 8, `iPhone stock card must leave the next company visibly peeking: ${rowStyle.width}px / ${rowStyle.parentWidth}px`);
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

async function verifyVenture(page, errors, layout) {
  await openCommandTab(page, 'venture');
  await page.locator('#screen[data-screen="venture"]').waitFor();
  assert.ok(await page.locator('#screen > .card').count() >= 2, `${layout}: venture summary and subsidiary cards must remain rendered`);
  const startupGrid = page.locator('#screen > .grid.two').first();
  assert.ok(await startupGrid.count(), `${layout}: startup portfolio grid must remain rendered`);
  const startupCards = startupGrid.locator(':scope > .card');
  assert.ok(await startupCards.count() > 0, `${layout}: startup portfolio must retain investable companies`);
  for (const action of ['invest-startup-company','invest-startup-personal']) {
    assert.ok(await page.locator(`#screen [data-action="${action}"]`).count() > 0, `${layout}: venture ${action} action must remain reachable`);
  }
  if (layout === 'iPhone') {
    const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.ok(pageFits, 'iPhone venture screen must not create page-level horizontal overflow');
    const firstCard = startupCards.first();
    const cardMetrics = await firstCard.evaluate(node => ({ width: node.getBoundingClientRect().width, parentWidth: node.parentElement.getBoundingClientRect().width }));
    assert.ok(cardMetrics.width <= cardMetrics.parentWidth + 1, `iPhone venture card must fit its grid: ${cardMetrics.width}px > ${cardMetrics.parentWidth}px`);
    const controls = page.locator('#screen > .grid.two > .card .button-row .btn');
    const count = await controls.count();
    assert.ok(count > 0, 'iPhone venture startup controls must remain rendered');
    for (let i=0;i<count;i+=1) {
      const box = await controls.nth(i).boundingBox();
      assert.ok(box && box.height >= 44, `iPhone venture control must be at least 44px high, got ${box?.height}`);
    }
  }
  await assertNoRecovery(page, `${layout} venture navigation`, errors);
}

async function verifyMA(page, errors, layout) {
  await openCommandTab(page, 'ma');
  await page.locator('#screen[data-screen="ma"]').waitFor();
  assert.ok(await page.locator('#screen > .card').count() >= 5, `${layout}: M&A dashboard and portfolio cards must remain rendered`);
  assert.equal(await page.locator('#screen [data-action="generate-ma"]').count(), 1, `${layout}: M&A target discovery action must remain reachable`);
  assert.ok(await page.locator('#screen .ma-pmi-kpis .stat').count() >= 8, `${layout}: M&A dashboard must retain its KPI set`);
  assert.equal(await page.locator('#screen > section > .section-title').count(), 1, `${layout}: M&A candidate section must remain rendered`);
  assert.ok(await page.locator('#screen .empty').count() > 0, `${layout}: fresh-company M&A empty states must remain readable`);
  if (layout === 'iPhone') {
    const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.ok(pageFits, 'iPhone M&A screen must not create page-level horizontal overflow');
    const discoverBox = await page.locator('#screen [data-action="generate-ma"]').boundingBox();
    assert.ok(discoverBox && discoverBox.height >= 44, `iPhone M&A discovery control must be at least 44px high, got ${discoverBox?.height}`);
    const candidateGrid = page.locator('#screen > section > .grid.two');
    if (await candidateGrid.count()) {
      const columns = await candidateGrid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
      assert.equal(columns, 1, 'iPhone M&A candidate grid must collapse to one column');
    }
  }
  await assertNoRecovery(page, `${layout} M&A navigation`, errors);
}

async function verifyOverseas(page, errors, layout) {
  await openCommandTab(page, 'overseas');
  await page.locator('#screen[data-screen="overseas"]').waitFor();
  assert.ok(await page.locator('#screen > .card').count() >= 2, `${layout}: overseas hero and subsidiary cards must remain rendered`);
  const countryGrid = page.locator('#screen > .grid.three');
  assert.equal(await countryGrid.count(), 1, `${layout}: overseas country grid must remain rendered`);
  const countryCards = countryGrid.locator(':scope > .card');
  const countryCount = await countryCards.count();
  assert.ok(countryCount > 0, `${layout}: overseas screen must retain expansion countries`);
  assert.equal(await page.locator('#screen [data-action="open-overseas"]').count(), countryCount, `${layout}: every overseas country must retain its establishment action`);
  assert.equal(await page.locator('#screen select[id^="overseas-business-"]').count(), countryCount, `${layout}: every overseas country must retain its business selector`);
  assert.ok(await page.locator('#screen > .card:last-child .empty').count() > 0, `${layout}: fresh-company overseas subsidiary empty state must remain readable`);
  if (layout === 'iPhone') {
    const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    assert.ok(pageFits, 'iPhone overseas screen must not create page-level horizontal overflow');
    const columns = await countryGrid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length);
    assert.equal(columns, 1, 'iPhone overseas country grid must collapse to one column');
    for (const selector of ['#screen [data-action="open-overseas"]', '#screen select[id^="overseas-business-"]']) {
      const controls = page.locator(selector);
      const count = await controls.count();
      assert.ok(count > 0, `iPhone overseas control group must exist: ${selector}`);
      for (let i=0;i<count;i+=1) {
        const box = await controls.nth(i).boundingBox();
        assert.ok(box && box.height >= 44, `iPhone overseas control must be at least 44px high: ${selector} = ${box?.height}`);
      }
    }
  }
  await assertNoRecovery(page, `${layout} overseas navigation`, errors);
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

  await verifyVenture(page, errors, 'desktop');
  await page.screenshot({ path: path.join(OUT, 'd-ui-venture-desktop.png'), fullPage: true });

  await verifyMA(page, errors, 'desktop');
  await page.screenshot({ path: path.join(OUT, 'd-ui-ma-desktop.png'), fullPage: true });

  await verifyOverseas(page, errors, 'desktop');
  await page.screenshot({ path: path.join(OUT, 'd-ui-overseas-desktop.png'), fullPage: true });

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

  await verifyVenture(page, errors, 'iPhone');
  await page.screenshot({ path: path.join(OUT, 'd-ui-venture-iphone.png'), fullPage: true, scale: 'css' });
  await assertNoRecovery(page, 'after iPhone venture navigation', errors);

  await verifyMA(page, errors, 'iPhone');
  await page.screenshot({ path: path.join(OUT, 'd-ui-ma-iphone.png'), fullPage: true, scale: 'css' });
  await assertNoRecovery(page, 'after iPhone M&A navigation', errors);

  await verifyOverseas(page, errors, 'iPhone');
  await page.screenshot({ path: path.join(OUT, 'd-ui-overseas-iphone.png'), fullPage: true, scale: 'css' });
  await assertNoRecovery(page, 'after iPhone overseas navigation', errors);

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
