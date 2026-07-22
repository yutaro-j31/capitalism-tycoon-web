'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.CEO_DASHBOARD_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'ceo-dashboard-webkit'));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const DEVICE_NAME = 'iPhone 13';
const CARD_IDS = ['overview', 'priority', 'journey', 'finance', 'allocation', 'risk', 'growth'];
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);

assert.ok(devices[DEVICE_NAME], `Playwright device descriptor is unavailable: ${DEVICE_NAME}`);

function writeResult(value) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), `${JSON.stringify(value, null, 2)}\n`);
}

function requestPath(rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, 'http://127.0.0.1').pathname);
  const resolved = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `request escaped repository root: ${pathname}`);
  return resolved;
}

function staticServer() {
  return http.createServer((request, response) => {
    try {
      const requested = requestPath(request.url || '/');
      const target = fs.statSync(requested).isDirectory() ? path.join(requested, 'index.html') : requested;
      const body = fs.readFileSync(target);
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': String(body.length),
        'content-type': MIME.get(path.extname(target).toLowerCase()) || 'application/octet-stream'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error?.code === 'ENOENT' ? 'Not found' : String(error?.message || error));
    }
  });
}

async function startServer(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}/`;
}

async function stopServer(server) {
  await new Promise(resolve => server.close(resolve));
}

async function savedGame(page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SAVE_KEY);
}

async function inspectDashboard(page) {
  const dashboard = page.locator('[data-ceo-dashboard="1"]');
  await dashboard.waitFor({ state: 'visible', timeout: 20_000 });
  const dashboardText = await dashboard.innerText();
  assert.match(dashboardText, /CEO DASHBOARD/i);
  assert.match(dashboardText, /30秒で読む会社ホーム/);
  assert.match(dashboardText, /読み取り専用/);

  for (const id of CARD_IDS) {
    const card = dashboard.locator(`[data-ceo-dashboard-card="${id}"]`);
    assert.equal(await card.count(), 1, `CEO dashboard card missing: ${id}`);
    await card.locator('summary').waitFor({ state: 'visible' });
  }

  const layout = await dashboard.evaluate((root, ids) => {
    const viewportWidth = innerWidth;
    const rootRect = root.getBoundingClientRect();
    const cards = ids.map(id => {
      const card = root.querySelector(`[data-ceo-dashboard-card="${id}"]`);
      const summary = card?.querySelector('summary');
      const cardRect = card?.getBoundingClientRect();
      const summaryRect = summary?.getBoundingClientRect();
      const summaryStyle = summary ? getComputedStyle(summary) : null;
      return {
        id,
        cardLeft: cardRect?.left,
        cardRight: cardRect?.right,
        summaryHeight: summaryRect?.height,
        summaryMinHeight: summaryStyle ? Number.parseFloat(summaryStyle.minHeight) : NaN,
        open: Boolean(card?.open)
      };
    });
    return {
      viewportWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      rootLeft: rootRect.left,
      rootRight: rootRect.right,
      cards
    };
  }, CARD_IDS);

  assert.ok(layout.documentScrollWidth <= layout.viewportWidth + 2, `CEO dashboard document overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.bodyScrollWidth <= layout.viewportWidth + 2, `CEO dashboard body overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.rootLeft >= -1 && layout.rootRight <= layout.viewportWidth + 1, `CEO dashboard root overflow: ${JSON.stringify(layout)}`);
  for (const card of layout.cards) {
    assert.ok(Number.isFinite(card.cardLeft) && Number.isFinite(card.cardRight), `card is not measurable: ${JSON.stringify(card)}`);
    assert.ok(card.cardLeft >= -1 && card.cardRight <= layout.viewportWidth + 1, `card overflows viewport: ${JSON.stringify(card)}`);
    assert.ok(card.summaryHeight >= 43.5 || card.summaryMinHeight >= 44, `card summary tap target is below 44px: ${JSON.stringify(card)}`);
    assert.equal(card.open, true, `card should initially be open: ${JSON.stringify(card)}`);
  }

  await page.waitForTimeout(100);
  const saveBefore = await savedGame(page);
  assert.ok(saveBefore, 'configured save must exist before dashboard interaction');
  const financeCard = dashboard.locator('[data-ceo-dashboard-card="finance"]');
  const financeSummary = financeCard.locator('summary');
  await financeSummary.click();
  await assert.doesNotReject(async () => financeCard.evaluate(card => {
    if (card.open) throw new Error('finance card did not close');
  }));
  await financeSummary.click();
  await assert.doesNotReject(async () => financeCard.evaluate(card => {
    if (!card.open) throw new Error('finance card did not reopen');
  }));
  await page.waitForTimeout(50);
  const saveAfter = await savedGame(page);
  assert.deepEqual(saveAfter, saveBefore, 'folding CEO dashboard cards must not mutate the saved game');
  return layout;
}


async function inspectWeeklyImpactRecap(page, expectedPrevious) {
  const saveBefore = await savedGame(page);
  await page.locator('[data-action="advance-week"]').click();
  const modal = page.locator('.summary-modal');
  await modal.waitFor({ state: 'visible', timeout: 20_000 });
  await modal.locator('.weekly-impact-grid').waitFor({ state: 'visible' });
  const cards = modal.locator('.weekly-impact-card');
  assert.equal(await cards.count(), 4, 'weekly impact recap must show four metrics');
  const text = await modal.innerText();
  assert.match(text, /週間経営レポート/);
  assert.match(text, /売上/);
  assert.match(text, /利益/);
  assert.match(text, /会社現金/);
  assert.match(text, /企業価値/);
  if (expectedPrevious) {
    assert.doesNotMatch(text, /比較できる前週データがありません/, 'second recap should show deltas');
  } else {
    assert.match(text, /前週比較なし/);
    assert.match(text, /比較できる前週データがありません/);
  }
  const layout = await modal.evaluate(panel => {
    const rect = panel.getBoundingClientRect();
    const closeButton = [...panel.querySelectorAll('button')].find(button => button.textContent.includes('閉じる'));
    const nextButton = [...panel.querySelectorAll('button')].find(button => button.textContent.includes('次の優先タスクを見る'));
    const cardRects = [...panel.querySelectorAll('.weekly-impact-card')].map(card => card.getBoundingClientRect());
    const closeRect = closeButton?.getBoundingClientRect();
    const nextRect = nextButton?.getBoundingClientRect();
    const style = getComputedStyle(panel);
    return {
      viewportWidth: innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      panelTop: rect.top,
      panelBottom: rect.bottom,
      panelOverflowY: style.overflowY,
      panelMaxHeight: style.maxHeight,
      cardCount: cardRects.length,
      cardsInside: cardRects.every(r => r.left >= -1 && r.right <= innerWidth + 1),
      closeHeight: closeRect?.height || 0,
      nextHeight: nextRect?.height || 0
    };
  });
  assert.ok(layout.documentScrollWidth <= layout.viewportWidth + 2, `weekly recap document overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.bodyScrollWidth <= layout.viewportWidth + 2, `weekly recap body overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.cardsInside, `weekly recap cards overflow viewport: ${JSON.stringify(layout)}`);
  assert.ok(layout.panelMaxHeight.includes('env(safe-area-inset-bottom)') || layout.panelBottom <= 844, `weekly recap safe area/max height missing: ${JSON.stringify(layout)}`);
  assert.ok(layout.closeHeight >= 43.5, `close button below 44px: ${JSON.stringify(layout)}`);
  assert.ok(layout.nextHeight >= 43.5, `next task button below 44px: ${JSON.stringify(layout)}`);
  await modal.locator('button', { hasText: '閉じる' }).click();
  await modal.waitFor({ state: 'hidden', timeout: 10_000 });
  const afterClose = await savedGame(page);
  assert.equal(afterClose.saveVersion, saveBefore.saveVersion, 'weekly recap close must preserve save version');
  await page.locator('[data-action="advance-week"]').click();
  const nextModal = page.locator('.summary-modal');
  await nextModal.waitFor({ state: 'visible', timeout: 20_000 });
  await nextModal.locator('button', { hasText: '次の優先タスクを見る' }).click();
  await nextModal.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.locator('[data-ceo-dashboard="1"]').waitFor({ state: 'visible', timeout: 10_000 });
  const afterJump = await savedGame(page);
  assert.equal(afterJump.selectedTab, 'home', 'next task CTA must navigate to CEO Dashboard home');
  assert.equal(afterJump.saveVersion, saveBefore.saveVersion, 'weekly recap navigation must preserve save version');
  return layout;
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const server = staticServer();
  const baseUrl = await startServer(server);
  let browser;
  let page;
  let layout = null;
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const startedAt = new Date().toISOString();

  try {
    browser = await webkit.launch();
    const context = await browser.newContext({
      ...devices[DEVICE_NAME],
      locale: 'ja-JP',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Tokyo'
    });
    page = await context.newPage();
    page.on('console', message => message.type() === 'error' && diagnostics.consoleErrors.push(message.text()));
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.locator('#setup-form input[name="playerName"]').fill('Dashboard Tester');
    await page.locator('#setup-form input[name="companyName"]').fill('Dashboard Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(key => Boolean(localStorage.getItem(key)), SAVE_KEY);

    const save = await savedGame(page);
    assert.equal(save.configured, true);
    assert.equal(save.saveVersion, 9);
    assert.equal(save.companyName, 'Dashboard Holdings');

    layout = await inspectDashboard(page);
    const firstWeeklyLayout = await inspectWeeklyImpactRecap(page, false);
    const secondWeeklyLayout = await inspectWeeklyImpactRecap(page, true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'ceo-dashboard-iphone.png'), fullPage: true });
    assert.deepEqual(diagnostics, { consoleErrors: [], pageErrors: [], failedRequests: [] });

    writeResult({
      status: 'passed', startedAt, completedAt: new Date().toISOString(),
      device: DEVICE_NAME, browser: 'WebKit', browserVersion: browser.version(), saveVersion: save.saveVersion,
      cards: CARD_IDS, layout, firstWeeklyLayout, secondWeeklyLayout
    });
    console.log('CEO dashboard iPhone WebKit smoke passed');
  } catch (error) {
    if (page) {
      try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'ceo-dashboard-iphone-failure.png'), fullPage: true }); } catch (_) {}
    }
    writeResult({
      status: 'failed', startedAt, completedAt: new Date().toISOString(),
      error: error?.stack || String(error), layout, diagnostics
    });
    throw error;
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
