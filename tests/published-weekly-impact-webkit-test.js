'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TARGET_URL = process.env.WEEKLY_IMPACT_TARGET_URL || 'https://yutaro-j31.github.io/capitalism-tycoon-web/';
const ARTIFACT_DIR = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'published-iphone-webkit-smoke'));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const DEVICE_NAME = 'iPhone 13';

assert.ok(devices[DEVICE_NAME], `Playwright device descriptor is unavailable: ${DEVICE_NAME}`);

function writeResult(value) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'published-weekly-impact-result.json'), `${JSON.stringify(value, null, 2)}\n`);
}

async function savedGame(page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SAVE_KEY);
}

async function inspectRecap(page, expectedPrevious) {
  const saveBefore = await savedGame(page);
  assert.ok(saveBefore, 'configured save must exist before advancing the week');
  await page.locator('[data-action="advance-week"]').click();
  const modal = page.locator('.summary-modal');
  await modal.waitFor({ state: 'visible', timeout: 20_000 });
  await modal.locator('.weekly-impact-grid').waitFor({ state: 'visible', timeout: 10_000 });

  const cards = modal.locator('.weekly-impact-card');
  assert.equal(await cards.count(), 4, 'published weekly recap must show four metrics');
  const text = await modal.innerText();
  assert.match(text, /週間経営レポート/);
  assert.match(text, /売上/);
  assert.match(text, /利益/);
  assert.match(text, /会社現金/);
  assert.match(text, /企業価値/);
  if (expectedPrevious) {
    assert.doesNotMatch(text, /比較できる前週データがありません/);
  } else {
    assert.match(text, /前週比較なし/);
  }

  const layout = await modal.evaluate(panel => {
    const buttons = [...panel.querySelectorAll('button')];
    const close = buttons.find(button => button.textContent.includes('閉じる'));
    const next = buttons.find(button => button.textContent.includes('次の優先タスクを見る'));
    const panelRect = panel.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();
    const nextRect = next?.getBoundingClientRect();
    const cards = [...panel.querySelectorAll('.weekly-impact-card')].map(card => card.getBoundingClientRect());
    return {
      viewportWidth: innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      closeHeight: closeRect?.height || 0,
      nextHeight: nextRect?.height || 0,
      cardsInside: cards.every(rect => rect.left >= -1 && rect.right <= innerWidth + 1)
    };
  });

  assert.ok(layout.documentScrollWidth <= layout.viewportWidth + 2, `published recap document overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.bodyScrollWidth <= layout.viewportWidth + 2, `published recap body overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.panelLeft >= -1 && layout.panelRight <= layout.viewportWidth + 1, `published recap panel overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.cardsInside, `published recap cards overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.closeHeight >= 43.5, `published recap close target below 44px: ${JSON.stringify(layout)}`);
  assert.ok(layout.nextHeight >= 43.5, `published recap next target below 44px: ${JSON.stringify(layout)}`);

  await modal.locator('button', { hasText: '閉じる' }).click();
  await modal.waitFor({ state: 'hidden', timeout: 10_000 });
  const saveAfter = await savedGame(page);
  assert.equal(saveAfter.saveVersion, 9);
  assert.equal(saveAfter.week, saveBefore.week + 1, 'only the requested week advance may change progression');
  return layout;
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  let browser;
  let page;
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const startedAt = new Date().toISOString();
  let firstLayout;
  let secondLayout;

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

    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.evaluate(key => localStorage.removeItem(key), SAVE_KEY);
    await page.reload({ waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('#setup-form input[name="playerName"]').fill('Published Weekly Tester');
    await page.locator('#setup-form input[name="companyName"]').fill('Published Weekly Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(key => Boolean(localStorage.getItem(key)), SAVE_KEY);

    const initialSave = await savedGame(page);
    assert.equal(initialSave.configured, true);
    assert.equal(initialSave.saveVersion, 9);
    firstLayout = await inspectRecap(page, false);
    secondLayout = await inspectRecap(page, true);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'published-weekly-impact.png'), fullPage: true });
    assert.deepEqual(diagnostics, { consoleErrors: [], pageErrors: [], failedRequests: [] });

    writeResult({
      status: 'passed', startedAt, completedAt: new Date().toISOString(), targetUrl: TARGET_URL,
      device: DEVICE_NAME, browser: 'WebKit', browserVersion: browser.version(), saveVersion: 9,
      firstLayout, secondLayout
    });
    console.log('Published weekly impact WebKit smoke passed');
  } catch (error) {
    if (page) {
      try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'published-weekly-impact-failure.png'), fullPage: true }); } catch (_) {}
    }
    writeResult({ status: 'failed', startedAt, completedAt: new Date().toISOString(), targetUrl: TARGET_URL, error: error?.stack || String(error), diagnostics, firstLayout, secondLayout });
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
