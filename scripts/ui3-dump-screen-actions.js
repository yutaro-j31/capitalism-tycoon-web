#!/usr/bin/env node
'use strict';

/**
 * Lists every control (`data-action` and any other `data-*action*` attribute) that a screen
 * shows, in several game states. It is the inventory step of docs/ui-v3/README.md section 7
 * ("着手したら最初にやること" 2) and feeds docs/ui-v3/migration-ledger.md.
 *
 *   node scripts/ui3-dump-screen-actions.js --screen=home
 *   node scripts/ui3-dump-screen-actions.js --screen=market --states=founding,store-open
 *   node scripts/ui3-dump-screen-actions.js --screen=home --ui=3      # what UI v3 shows instead
 *   node scripts/ui3-dump-screen-actions.js --screen=home --json
 *
 * Options
 *   --screen=<selectedTab id>   required (one of the 19 screens)
 *   --states=a,b,c              default: founding,store-open,crisis,office,listed
 *   --ui=2|3                    2 (default) = the current UI, 3 = UI v3 (adds ?ui=3)
 *   --json                      also print the raw result as one JSON line
 *
 * Environment (same names as scripts/ui3-screen-metrics.js)
 *   UI_METRICS_BROWSER   webkit (default) | chromium
 *   UI_METRICS_CHROME    path to a Chrome/Chromium binary (chromium only)
 *
 * States (each starts from a fresh default founding in its own browser context):
 *   founding    nothing changed
 *   store-open  the cheapest free tenant gets a ramen store, then four weeks are advanced
 *   crisis      g.playerCrisis.status is set to "distressed" (inspection only)
 *   office      store-open, then the cheapest rental office is contracted and departments are established
 *   listed      g.publicCompany is set to true (inspection only: this is NOT a real IPO)
 *
 * This is an inspection tool. "crisis" and "listed" write engine state inside a throw-away
 * browser page to make the screen show what it shows in that state; nothing is saved to the
 * repository and no UI v3 screen may do this. A state that cannot be built is reported as
 * "not checked" with the reason, never skipped silently.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SCREENS = ['home', 'map', 'business', 'office', 'market', 'venture', 'ma', 'overseas', 'assets', 'bank',
  'report', 'founder', 'strategy', 'media', 'legacy', 'missions', 'rivals', 'news', 'settings', 'pe-portfolio'];
const STATES = ['founding', 'store-open', 'crisis', 'office', 'listed'];
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

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

/* Runs in the page. Returns null when the state was built, or a reason string when it could not be. */
function buildState(state) {
  const modules = globalThis.__capitalismTycoonModules;
  const engine = modules.playerEngineBridge.getEngine();
  const g = engine.g;
  if (state === 'founding') return null;
  if (state === 'crisis') {
    modules.playerCrisis.snapshot(g);   // initialises g.playerCrisis
    const crisis = g.playerCrisis || g.crisis;
    if (!crisis) return 'g.playerCrisis does not exist';
    crisis.status = 'distressed'; crisis.graceWeeksRemaining = 4; crisis.reserveThreshold = 5000000;
    return null;
  }
  if (state === 'listed') { g.publicCompany = true; return null; }
  const openStoreAndAdvance = () => {
    const tenant = (g.tenants || []).filter(row => !row.occupiedBy).sort((a, b) => a.deposit - b.deposit)[0];
    if (!tenant) return 'no free tenant';
    if (!engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'probe store', operatingHours: 3 })) return 'openStore refused (cash or conditions)';
    for (let week = 0; week < 4; week += 1) engine.advanceWeek(false);
    return g.stores.some(row => row.status === 'open') ? null : 'the store is not open after four weeks';
  };
  if (state === 'store-open') return openStoreAndAdvance();
  if (state === 'office') {
    // Departments need a head office and at least one open store (DEPARTMENT_UNLOCKS in js/data.js).
    const storeProblem = openStoreAndAdvance();
    if (storeProblem) return `needs an open store first: ${storeProblem}`;
    const office = (g.rentalOffices || []).reduce((a, b) => (a.deposit < b.deposit ? a : b), g.rentalOffices?.[0]);
    if (!office) return 'no rental office';
    if (!engine.contractOffice(office.id)) return 'contractOffice refused (cash or conditions)';
    const established = ['accounting', 'hr', 'product'].filter(id => engine.establishDepartment(id));
    return established.length ? null : 'office contracted, but no department could be established';
  }
  return `unknown state: ${state}`;
}

/* Runs in the page. Every control of #screen that carries an *action* attribute. */
function collect() {
  const visible = element => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && (box.width > 0 || box.height > 0 || element.closest('[hidden]') === null);
  };
  const screen = document.getElementById('screen');
  if (!screen) return { error: '#screen is missing' };
  const rows = [];
  for (const element of screen.querySelectorAll('*')) {
    const attributes = element.getAttributeNames().filter(name => /^data-.*action/.test(name));
    if (!attributes.length) continue;
    const region = element.closest('section[id],article[id],details[id],[id]')?.id
      || element.closest('section,article,details,nav')?.className?.toString().split(/\s+/)[0] || '';
    for (const name of attributes) {
      rows.push({
        attribute: name, value: element.getAttribute(name), tab: element.dataset.tab || '', step: element.dataset.step || '',
        focus: (element.dataset.focus || '').slice(0, 60), region, visible: visible(element),
        text: (element.innerText || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 36)
      });
    }
  }
  const seen = new Set();
  const unique = rows.filter(row => { const key = [row.attribute, row.value, row.tab, row.step, row.text].join('|'); if (seen.has(key)) return false; seen.add(key); return true; });
  return { rows: unique, nativeV3: Boolean(document.querySelector('#app > .ui3.u-app')), screenID: screen.dataset.screen || '' };
}

async function inspect(browser, base, ui, screen, state) {
  const device = playwright.devices['iPhone 13'];
  const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error.message)));
  try {
    await page.goto(`${base}${ui === '3' ? '?ui=3' : ''}`, { waitUntil: 'load' });
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#setup-form').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
    await page.waitForTimeout(3500);   // founding toast
    const reason = await page.evaluate(buildState, state);
    if (reason) return { state, notChecked: reason };
    const reached = await page.evaluate(tab => {
      const modules = globalThis.__capitalismTycoonModules;
      modules.playerEngineBridge.getEngine().emit();
      const button = document.querySelector(`[data-action="tab"][data-tab="${tab}"]`);
      if (!button) return false;
      button.click();
      return true;
    }, screen);
    if (!reached) return { state, notChecked: `screen "${screen}" is not reachable through [data-action="tab"]` };
    await page.waitForTimeout(800);
    const result = await page.evaluate(collect);
    return { state, ...result, pageErrors: errors };
  } catch (error) {
    return { state, notChecked: `error while building or reading the state: ${String(error.message).split('\n')[0]}` };
  } finally {
    await context.close();
  }
}

function table(result) {
  const lines = [`### 状態：${result.state}`, ''];
  if (result.notChecked) return [...lines, `未確認：${result.notChecked}`, ''].join('\n');
  if (result.error) return [...lines, `未確認：${result.error}`, ''].join('\n');
  lines.push(`画面：\`${result.screenID}\`／v3の枠：${result.nativeV3 ? 'あり' : 'なし（現行UI）'}／操作：${result.rows.length}`, '');
  if (!result.rows.length) return [...lines, '（操作なし）', ''].join('\n');
  lines.push('| 属性 | 値 | data-tab | data-step | 場所 | 表示 | 文言 |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of result.rows) {
    lines.push(`| \`${row.attribute}\` | \`${row.value}\` | ${row.tab ? `\`${row.tab}\`` : ''} | ${row.step ? `\`${row.step}\`` : ''} | ${row.region ? `\`${row.region}\`` : ''} | ${row.visible ? '○' : '隠れ'} | ${row.text.replace(/\|/g, '/')} |`);
  }
  if (result.pageErrors?.length) lines.push('', `ページエラー：${result.pageErrors.join(' / ')}`);
  return [...lines, ''].join('\n');
}

async function main() {
  const screen = String(argument('screen', ''));
  if (!SCREENS.includes(screen)) { console.error(`--screen=<id> is required. One of: ${SCREENS.join(', ')}`); process.exit(2); }
  const ui = String(argument('ui', '2'));
  if (!['2', '3'].includes(ui)) { console.error('--ui must be 2 or 3'); process.exit(2); }
  const states = String(argument('states', STATES.join(','))).split(',').filter(Boolean);
  const unknown = states.filter(state => !STATES.includes(state));
  if (unknown.length) { console.error(`unknown state(s): ${unknown.join(', ')}. One of: ${STATES.join(', ')}`); process.exit(2); }
  const browserName = process.env.UI_METRICS_BROWSER || 'webkit';
  const server = await serve();
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI_METRICS_CHROME
    ? { executablePath: process.env.UI_METRICS_CHROME, args: ['--no-sandbox'] } : {});
  const results = [];
  try {
    const base = `http://127.0.0.1:${server.address().port}/`;
    for (const state of states) results.push(await inspect(browser, base, ui, screen, state));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`## ${screen}（${ui === '3' ? 'UI v3' : '現行UI'}、${browserName}、390×664）\n`);
  for (const result of results) console.log(table(result));
  if (argument('json', false)) console.log(JSON.stringify({ screen, ui, browser: browserName, results }));
}

main().catch(error => { console.error(error); process.exit(1); });
