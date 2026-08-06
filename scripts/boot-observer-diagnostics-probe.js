'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const baseUrl = process.env.BOOT_DIAG_BASE_URL;
const cut = Number(process.env.BOOT_DIAG_CUT);
const label = process.env.BOOT_DIAG_LABEL || `prefix-${cut}`;
const probeID = process.env.BOOT_DIAG_PROBE_ID || label;
const outputPath = process.env.BOOT_DIAG_RESULT_PATH;
const DEVICE_NAME = 'iPhone 13';

if (!baseUrl || !Number.isFinite(cut) || !outputPath) throw new Error('boot diagnostic probe environment is incomplete');
if (!devices[DEVICE_NAME]) throw new Error(`Playwright device descriptor unavailable: ${DEVICE_NAME}`);

const evidence = {
  label,
  cut,
  probeID,
  startedAt: new Date().toISOString(),
  setupVisible: false,
  responsive: false,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  diagnostics: null
};

function writeResult() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  evidence.finishedAt = new Date().toISOString();
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function deadline(promise, ms, labelText) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${labelText} timed out after ${ms}ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

async function main() {
  let browser;
  let context;
  let page;
  try {
    browser = await webkit.launch();
    context = await browser.newContext({
      ...devices[DEVICE_NAME],
      locale: 'ja-JP',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Tokyo'
    });
    page = await context.newPage();
    page.on('console', message => message.type() === 'error' && evidence.consoleErrors.push(message.text()));
    page.on('pageerror', error => evidence.pageErrors.push(String(error?.message || error)));
    page.on('requestfailed', request => {
      evidence.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
    });

    const url = `${baseUrl}/variant.html?cut=${cut}&boot-diagnostics=force&observer-threshold=10000&probe=${encodeURIComponent(probeID)}`;
    await deadline(page.goto(url, { waitUntil: 'commit', timeout: 8000 }), 9000, 'navigation');
    try {
      await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 8000 });
      evidence.setupVisible = true;
    } catch (error) {
      evidence.setupError = String(error?.message || error);
    }

    // A prefix is healthy only if WebKit remains responsive after the setup paint.
    await new Promise(resolve => setTimeout(resolve, 2500));
    const state = await deadline(page.evaluate(() => ({
      diagnostics: globalThis.__capitalismTycoonBootDiagnostics || null,
      readyState: document.readyState,
      bodyText: document.body?.innerText?.slice(0, 1000) || ''
    })), 5000, 'page responsiveness check');
    evidence.diagnostics = state.diagnostics;
    evidence.readyState = state.readyState;
    evidence.bodyText = state.bodyText;
    evidence.responsive = true;

    try {
      await deadline(page.screenshot({ path: path.join(path.dirname(outputPath), 'screenshot.png'), fullPage: true }), 5000, 'screenshot');
    } catch (error) {
      evidence.screenshotError = String(error?.message || error);
    }
    try {
      const html = await deadline(page.content(), 5000, 'page content');
      fs.writeFileSync(path.join(path.dirname(outputPath), 'page.html'), html);
    } catch (error) {
      evidence.contentError = String(error?.message || error);
    }
    writeResult();
    await deadline(context.close(), 5000, 'context close').catch(() => {});
    await deadline(browser.close(), 5000, 'browser close').catch(() => {});
    process.exit(0);
  } catch (error) {
    evidence.error = String(error?.message || error);
    evidence.stack = String(error?.stack || '');
    writeResult();
    // Do not wait on a starved page during cleanup. The coordinator owns the hard kill.
    process.exit(2);
  }
}

main();
