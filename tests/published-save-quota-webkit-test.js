'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const { createDiagnostics, observePageDiagnostics, runWithPublishedRetry } = require('./published-webkit-transient-retry');

const ROOT = path.resolve(__dirname, '..');
const TARGET_URL = process.env.SAVE_QUOTA_TARGET_URL || 'https://yutaro-j31.github.io/capitalism-tycoon-web/';
const ARTIFACT_DIR = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'published-iphone-webkit-smoke'));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const DEVICE_NAME = 'iPhone 13';

assert.ok(devices[DEVICE_NAME], `Playwright device descriptor is unavailable: ${DEVICE_NAME}`);

function writeResult(value) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'published-save-quota-result.json'), `${JSON.stringify(value, null, 2)}\n`);
}

async function runAttempt(attempt) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  let browser;
  let page;
  const diagnostics = createDiagnostics();
  const startedAt = new Date().toISOString();
  let evidence = null;

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
    observePageDiagnostics(page, { published: true, targetUrl: TARGET_URL, diagnostics });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.evaluate(key => localStorage.removeItem(key), SAVE_KEY);
    await page.reload({ waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('#setup-form input[name="playerName"]').fill('Quota Tester');
    await page.locator('#setup-form input[name="companyName"]').fill('Quota Safe Holdings');
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });

    evidence = await page.evaluate(key => {
      const modules = globalThis.__capitalismTycoonModules;
      const engine = modules?.playerEngineBridge?.getEngine?.();
      if (!modules?.saveStorage?.__installed) throw new Error('saveStorage module is not installed on published Pages');
      if (!engine) throw new Error('active engine is unavailable');
      const before = localStorage.getItem(key);
      const companyCash = engine.g.companyCash;
      const personalCash = engine.g.personalCash;
      engine.g.history = Array.from({ length: 500 }, (_, index) => `quota-history-${index}-${'x'.repeat(5000)}`);
      engine.g.news = Array.from({ length: 300 }, (_, index) => `quota-news-${index}-${'y'.repeat(3000)}`);
      engine.g.reports = Array.from({ length: 520 }, (_, index) => ({ week: index + 1, note: 'z'.repeat(3000) }));
      const oversizedBytes = JSON.stringify(engine.g).length * 2;
      const originalSetItem = Storage.prototype.setItem;
      let quotaThrows = 0;
      Storage.prototype.setItem = function(storageKey, value) {
        if (storageKey === key && String(value).length > 650000) {
          quotaThrows++;
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        return originalSetItem.call(this, storageKey, value);
      };
      let saved;
      try {
        saved = engine.save();
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
      const raw = localStorage.getItem(key);
      const stored = raw ? JSON.parse(raw) : null;
      return {
        saved,
        quotaThrows,
        oversizedBytes,
        storedBytes: raw ? raw.length * 2 : 0,
        mode: engine._lastSaveStorageInfo?.mode || null,
        beforeExisted: Boolean(before),
        saveVersion: stored?.saveVersion,
        companyCashBefore: companyCash,
        companyCashAfter: stored?.companyCash,
        personalCashBefore: personalCash,
        personalCashAfter: stored?.personalCash,
        historyLength: stored?.history?.length,
        newsLength: stored?.news?.length,
        reportsLength: stored?.reports?.length
      };
    }, SAVE_KEY);

    assert.equal(evidence.saved, true, 'published quota-safe save must return true');
    assert.ok(evidence.quotaThrows >= 1, `test must reproduce QuotaExceededError: ${JSON.stringify(evidence)}`);
    assert.ok(evidence.storedBytes < evidence.oversizedBytes, `stored save must be compacted: ${JSON.stringify(evidence)}`);
    assert.ok(['normal', 'emergency', 'critical'].includes(evidence.mode), `unexpected storage mode: ${JSON.stringify(evidence)}`);
    assert.equal(evidence.saveVersion, 9);
    assert.equal(evidence.companyCashAfter, evidence.companyCashBefore);
    assert.equal(evidence.personalCashAfter, evidence.personalCashBefore);
    assert.ok(evidence.historyLength <= 260);
    assert.ok(evidence.newsLength <= 160);
    assert.ok(evidence.reportsLength <= 104);

    await page.reload({ waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
    const reloaded = await page.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key));
      const engine = globalThis.__capitalismTycoonModules?.playerEngineBridge?.getEngine?.();
      return { saveVersion: state.saveVersion, companyCash: engine?.g?.companyCash, personalCash: engine?.g?.personalCash };
    }, SAVE_KEY);
    assert.equal(reloaded.saveVersion, 9);
    assert.equal(reloaded.companyCash, evidence.companyCashBefore);
    assert.equal(reloaded.personalCash, evidence.personalCashBefore);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'published-save-quota.png'), fullPage: true });
    assert.deepEqual(diagnostics, { consoleErrors: [], pageErrors: [], failedRequests: [], requiredAssetServerErrors: [] });
    writeResult({ status: 'passed', attempt, published: true, requiredAssetServerErrors: diagnostics.requiredAssetServerErrors, startedAt, completedAt: new Date().toISOString(), targetUrl: TARGET_URL, device: DEVICE_NAME, browser: 'WebKit', browserVersion: browser.version(), evidence, reloaded });
    console.log('Published iPhone save quota recovery WebKit smoke passed');
  } catch (error) {
    if (page) {
      try { await page.screenshot({ path: path.join(ARTIFACT_DIR, 'published-save-quota-failure.png'), fullPage: true }); } catch (_) {}
    }
    writeResult({ status: 'failed', attempt, published: true, startedAt, completedAt: new Date().toISOString(), targetUrl: TARGET_URL, error: error?.stack || String(error), diagnostics, evidence });
    error.publishedWebKitDiagnostics = diagnostics;
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() { await runWithPublishedRetry({ published: true, resultPath: path.join(ARTIFACT_DIR, 'published-save-quota-result.json'), runAttempt }); }

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
