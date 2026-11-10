#!/usr/bin/env node
'use strict';

/**
 * Measures every screen of the running game against the UI v3 acceptance
 * numbers in docs/ui-v3/README.md (section 2).
 *
 *   node scripts/ui3-screen-metrics.js              # measure the default UI, report only
 *   node scripts/ui3-screen-metrics.js --ui=3       # measure UI v3 (adds ?ui=3)
 *   node scripts/ui3-screen-metrics.js --ui=3 --enforce [--screens=home,map]
 *
 * --enforce exits 1 when a measured screen breaks a limit. Without it the
 * script only prints, so it can record a baseline for the UI being replaced.
 *
 * Environment:
 *   UI_METRICS_BROWSER   webkit (default) | chromium
 *   UI_METRICS_CHROME    path to a Chrome/Chromium binary (chromium only)
 *
 * The state measured is a fresh default founding with no week advanced, at
 * 390x664 (iPhone 13 Safari viewport). Screens are selected through the
 * `[data-action="tab"][data-tab]` contract, which both UIs must keep.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SCREENS = ['home', 'map', 'business', 'office', 'market', 'venture', 'ma', 'overseas', 'assets', 'bank',
  'report', 'founder', 'strategy', 'media', 'legacy', 'missions', 'rivals', 'news', 'settings'];
const LIMITS = Object.freeze({ maxScreens: 2, minFontPx: 13, minTapPx: 44 });
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function argument(name, fallback) {
  const hit = process.argv.slice(2).find(value => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
}

function serve() {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      if (!file.startsWith(`${ROOT}${path.sep}`)) throw Object.assign(new Error('outside root'), { code: 'ENOENT' });
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

/* Runs in the page. Counts only what a player can actually see. */
function measure(limits) {
  const visible = element => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const app = document.getElementById('app');
  const controls = [...app.querySelectorAll('button,a[href],input,select,textarea')].filter(visible);
  const inView = controls.filter(element => { const box = element.getBoundingClientRect(); return box.bottom > 0 && box.top < innerHeight; });
  const smallTap = controls.filter(element => { const box = element.getBoundingClientRect(); return box.width < limits.minTapPx || box.height < limits.minTapPx; });
  let smallText = 0;
  let textNodes = 0;
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue.trim() || !node.parentElement || !visible(node.parentElement)) continue;
    textNodes += 1;
    if (parseFloat(getComputedStyle(node.parentElement).fontSize) < limits.minFontPx) smallText += 1;
  }
  const root = document.documentElement;
  return {
    screens: Number((root.scrollHeight / innerHeight).toFixed(1)),
    overflowX: root.scrollWidth > innerWidth,
    controlsInView: inView.length,
    smallTap: smallTap.length,
    smallText,
    textNodes
  };
}

function violations(row) {
  const out = [];
  if (row.screens > LIMITS.maxScreens) out.push(`length ${row.screens} > ${LIMITS.maxScreens} screens`);
  if (row.overflowX) out.push('horizontal overflow');
  if (row.smallTap) out.push(`${row.smallTap} tap targets under ${LIMITS.minTapPx}px`);
  if (row.smallText) out.push(`${row.smallText} text nodes under ${LIMITS.minFontPx}px`);
  return out;
}

async function main() {
  const uiVersion = String(argument('ui', ''));
  const enforce = Boolean(argument('enforce', false));
  const only = String(argument('screens', '')).split(',').filter(Boolean);
  const screens = only.length ? SCREENS.filter(id => only.includes(id)) : SCREENS;
  const browserName = process.env.UI_METRICS_BROWSER || 'webkit';
  const server = await serve();
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI_METRICS_CHROME
    ? { executablePath: process.env.UI_METRICS_CHROME, args: ['--no-sandbox'] } : {});
  const errors = [];
  try {
    const device = playwright.devices['iPhone 13'];
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: browserName !== 'firefox', hasTouch: true, locale: 'ja-JP' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error.message)));
    await page.goto(`http://127.0.0.1:${server.address().port}/${uiVersion ? `?ui=${uiVersion}` : ''}`, { waitUntil: 'load' });
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
    await page.waitForTimeout(3500);   // founding toast
    const rows = [];
    for (const id of screens) {
      const reached = await page.evaluate(tab => {
        const button = document.querySelector(`[data-action="tab"][data-tab="${tab}"]`);
        if (!button) return false;
        button.click();
        scrollTo(0, 0);
        return true;
      }, id);
      if (!reached) { rows.push({ screen: id, missing: true }); continue; }
      await page.waitForTimeout(500);
      rows.push({ screen: id, ...(await page.evaluate(measure, LIMITS)) });
    }
    console.table(rows);
    console.log(JSON.stringify({ ui: uiVersion || 'default', browser: browserName, viewport: device.viewport, limits: LIMITS, rows }));
    let failed = errors.length > 0;
    for (const error of errors) console.error(`page error: ${error}`);
    for (const row of rows) {
      const found = row.missing ? ['screen is not reachable through [data-action="tab"]'] : violations(row);
      if (found.length) { console.log(`${row.screen}: ${found.join('; ')}`); failed = true; }
    }
    if (enforce && failed) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
