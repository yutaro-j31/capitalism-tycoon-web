'use strict';

// UI v3 reachability (docs/ui-v3/README.md 6.6 "no buttons that do nothing", task UI3-10b). Loads every v3 module and, in a real
// browser, presses every visible, enabled button of the founding form, the 19 screens (and the buttons of the detail sheets they open)
// and the game-over screen, one at a time, and proves that each press does something: a sheet opens, the screen changes, a file
// chooser or download starts, a toast shows or the display changes.
//  - No money moves: whatever sheet opens (confirmation, amount, name) is cancelled, and the game's week, cash, debt and holdings
//    must equal what they were before the press.
//  - Left out on purpose: the week buttons (they move the game on; weekly-report and home tests press them), the bottom tab bar and the
//    group chips (navigation, checked here by pressing each tab once).
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
const FILES = [];
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const name of FILES) {
  const source = fs.readFileSync(path.join(ROOT, 'js', `${name}.js`), 'utf8');
  assert.doesNotMatch(source, /Math\.random|Date\.now|MutationObserver|registerUIEnhancer/, `${name} uses no RNG, clock, observer or D UI enhancer`);
  assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, `${name} never assigns engine state`);
  assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage|(?<![\w.])confirm\(/, `${name} never saves, stores or uses the browser's confirm()`);
  assert.ok(index.indexOf(`./js/${name}.js`) > index.indexOf('./js/ui3-shell.js') && index.indexOf(`./js/${name}.js`) < index.indexOf('./js/app.js'), `index.html loads ${name} after the shell and before the app`);
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
  const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
  return (0, eval)(`(${source})`)(engine, value);
}, [fn.toString(), arg]);
const digest = page => engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value)));
// the share-count dialog is the v3 amount sheet (UI3-9a)
const cancelDialog = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
async function enterAmount(page, amount) {
  await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#modal-root [data-ui3-amount-input]').fill(String(amount));
  await page.locator('#modal-root [data-ui3-amount-run]').tap();
}

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}
const metrics = page => page.evaluate(() => {
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
  const controls = [...document.querySelectorAll('#app button,#app a[href],#app input,#app select')].filter(visible);
  let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
  return { small: controls.filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.className || element.tagName),
    minFont, overflowX: document.documentElement.scrollWidth > innerWidth, screens: document.documentElement.scrollHeight / innerHeight };
});
const sheetMetrics = page => page.evaluate(() => {
  const root = document.querySelector('#modal-root .u-sheet');
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const small = [...root.querySelectorAll('button')].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.textContent.trim());
  let minFont = 99; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
  return { small, minFont, bottom: Math.round(root.getBoundingClientRect().bottom), primaries: [...root.querySelectorAll('.u-btn.primary')].filter(visible).length };
});

  // a listed company, built the way tests/phase2-buyback-reconciliation-test.js builds it
  const list = page => engineEval(page, engine => {
    const m = globalThis.__capitalismTycoonModules, g = engine.g, price = 100;
    Object.assign(g, { week: 12, companyCash: 500000000, companyDebt: 0, publicCompany: true, sharesOut: 1000000, founderShares: 300000, treasuryBuybackShares: 0, competitorOwnedRatio: 0, stockPrice: price, ticker: 'CPTY', dividendPerShare: 0 });
    g.market = g.market.filter(row => row.id !== 'CPTY');
    g.market.push({ id: 'CPTY', name: g.companyName, sector: 'コングロマリット', price, previous: price, dividendYield: 0, volatility: 0, trend: 0, marketCap: price * 1000000, per: 20, pbr: 2, issuedShares: 1000000, dividendPerShare: 0, shareholders: {}, description: 'test', listingMarket: '東証グロース', priceHistory: [{ week: 12, price }] });
    engine.updateOwnershipRatios();
    g.finance = m.finance.defaultFinanceState(g);
    m.finance.ensureFinance(g);
    engine.emit();
  });

// --- the pressing machinery -----------------------------------------------
// Every visible, enabled button of #app (or of the open sheet) except the left-out ones above.
const LIST_BUTTONS = ({ root, skipNav }) => {
  const scope = document.querySelector(root);
  if (!scope) return [];
  const visible = element => { const box = element.getBoundingClientRect(); const style = getComputedStyle(element); return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; };
  return [...scope.querySelectorAll('button')]
    .filter(button => !button.disabled && visible(button) && !button.closest('[hidden]'))
    .filter(button => !(skipNav && (button.closest('.u-tabbar') || button.closest('.u-dock') || button.closest('nav.u-chips[aria-label$="の画面"]'))))
    .filter(button => !button.closest('.u-scrim') && !button.matches('[data-action="close-modal"]'))
    .map(button => (button.textContent || button.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) + ' [' + (button.dataset.action || Object.keys(button.dataset).filter(key => key.startsWith('ui3')).join(',') || button.className) + ']');
};
const SNAPSHOT = () => {
  const hash = text => { let h = 5381; for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0; return h; };
  const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g;
  return { app: hash(document.getElementById('app').innerHTML), modal: hash(document.getElementById('modal-root').innerHTML), tab: g.selectedTab, toast: hash(document.getElementById('toast-root')?.innerText || ''), body: document.body.className };
};
const MONEY = engine => { const g = engine.g; return JSON.stringify({ week: g.week, companyCash: g.companyCash, personalCash: g.personalCash, companyDebt: g.companyDebt, personalDebt: g.personalDebt, companyStocks: g.companyStocks, personalStocks: g.personalStocks, loans: (g.finance?.loans || []).length, treasury: g.treasuryBuybackShares, dividend: g.dividendPerShare }); };

// The home actions of the founder screen (founder-action) are free; a local event may even pay a little. Everything else must leave the
// week, cash, debt and holdings exactly as they were.
const MOVED = (before, after, tag) => {
  if (before === after) return false;
  if (!tag.includes('[founder-action]')) return true;
  const a = JSON.parse(before), b = JSON.parse(after);
  const rest = ({ personalCash, ...others }) => JSON.stringify(others);
  return rest(a) !== rest(b) || b.personalCash < a.personalCash;
};

// UI3-10b: a value in a 3-column .u-stats must never run into its neighbour. A text value wraps to two lines (ui3.css); a number never
// breaks. Anything wider than its cell, or touching the next cell, is listed with its text.
const STATS_OVERFLOW = () => {
  const out = [];
  for (const group of document.querySelectorAll('.ui3 .u-stats')) {
    const cells = [...group.querySelectorAll(':scope > .u-stat > b')].filter(node => node.getBoundingClientRect().width > 0);
    for (const node of cells) { if (node.scrollWidth > node.clientWidth + 1) out.push(`wider than its cell: ${node.textContent.trim().slice(0, 30)}`); }
    for (let i = 0; i < cells.length; i += 1) for (let j = i + 1; j < cells.length; j += 1) {
      const a = cells[i].getBoundingClientRect(), b = cells[j].getBoundingClientRect();
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`overlaps: ${cells[i].textContent.trim().slice(0, 20)} / ${cells[j].textContent.trim().slice(0, 20)}`);
    }
  }
  return out;
};

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async () => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP', acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    const events = { count: 0 };
    page.on('filechooser', () => { events.count += 1; });
    page.on('download', () => { events.count += 1; });
    page.on('dialog', dialog => { events.count += 1; dialog.dismiss().catch(() => {}); });
    page.on('popup', popup => { events.count += 1; popup.close().catch(() => {}); });
    return { context, page, pageErrors, events };
  };
  const money = page => engineEval(page, MONEY);
  const snapshot = page => page.evaluate(SNAPSHOT);
  const modalOpen = page => page.evaluate(() => document.getElementById('modal-root').innerHTML.trim() !== '');
  const closeModal = async page => {
    for (let attempt = 0; attempt < 4 && await modalOpen(page); attempt += 1) {
      const foot = page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first();
      if (await foot.count()) await foot.click({ timeout: 5000 }).catch(() => {});
      else await page.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; });
      await page.waitForTimeout(80);
    }
  };
  const isNativeScreen = (page, screen) => page.evaluate(id => document.body.classList.contains('ui3-native') && globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.selectedTab === id, screen);
  const backTo = async (page, screen) => {
    await closeModal(page);
    for (let attempt = 0; attempt < 3 && !await isNativeScreen(page, screen); attempt += 1) {
      if (await page.locator('#ui3-return').count()) await page.locator('#ui3-return').click({ timeout: 5000 }).catch(() => {});
      else await page.evaluate(id => (document.querySelector(`[data-ui3-all-screens] [data-action="tab"][data-tab="${id}"]`) || document.querySelector(`[data-action="tab"][data-tab="${id}"]`))?.click(), screen);
      await page.waitForTimeout(400);
    }
    assert.equal(await isNativeScreen(page, screen), true, `could not get back to the v3 ${screen} screen`);
  };
  // press the n-th button of `root` and say whether anything happened
  async function pressNth(page, events, root, skipNav, n) {
    const before = await snapshot(page);
    const eventsBefore = events.count;
    const handle = await page.evaluateHandle(({ root: rootSelector, skipNav: skip, n: index }) => {
      const scope = document.querySelector(rootSelector);
      if (!scope) return null;
      const visible = element => { const box = element.getBoundingClientRect(); const style = getComputedStyle(element); return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; };
      const list = [...scope.querySelectorAll('button')]
        .filter(button => !button.disabled && visible(button) && !button.closest('[hidden]'))
        .filter(button => !(skip && (button.closest('.u-tabbar') || button.closest('.u-dock') || button.closest('nav.u-chips[aria-label$="の画面"]'))))
        .filter(button => !button.closest('.u-scrim') && !button.matches('[data-action="close-modal"]'));
      return list[index] || null;
    }, { root, skipNav, n });
    const element = handle.asElement();
    if (!element) return { pressed: false };
    // a button that is not under the finger's reach once scrolled to (a map pin panned out of the map, a row hidden by a fixed part)
    // is listed, not pressed; the list is printed so it can be looked at
    const reachable = await element.evaluate(node => {
      node.scrollIntoView({ block: 'center', inline: 'center' });
      const box = node.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
      const top = document.elementFromPoint(x, y);
      return Boolean(top) && (top === node || node.contains(top));
    });
    if (!reachable) return { pressed: false, skipped: true };
    const selected = await element.evaluate(node => node.getAttribute('aria-pressed') === 'true' || node.getAttribute('aria-current') !== null && node.getAttribute('aria-current') !== 'false');
    let obscured = false;
    try { await element.click({ timeout: 4000 }); }
    catch (error) { obscured = true; await element.evaluate(node => node.click()); }
    let changed = false;
    for (let wait = 0; wait < 8 && !changed; wait += 1) {
      await page.waitForTimeout(wait === 0 ? 120 : 150);
      const after = await snapshot(page);
      changed = Object.keys(before).some(key => before[key] !== after[key]) || events.count > eventsBefore;
    }
    return { pressed: true, changed, obscured, selected };
  }
  const isCancellable = page => page.evaluate(() => Boolean(document.querySelector('#modal-root [data-ui3-confirm], #modal-root [data-ui3-amount-input], #modal-root [data-ui3-text-input], #modal-root #modal-text, #modal-root #modal-money')));
  const report = { screens: {}, dead: [], moved: [], obscured: [], skipped: [], selectedAgain: 0, overflow: [] };

  // Press everything on `screen` (one level into the sheets it opens). `open` brings the page back to the state the n-th press starts from.
  async function sweep(page, events, label, screen, root = '#app') {
    const names = await page.evaluate(LIST_BUTTONS, { root, skipNav: true });
    report.screens[label] = names.length;
    for (const problem of await page.evaluate(STATS_OVERFLOW)) report.overflow.push(`${label}: ${problem}`);
    for (let n = 0; n < Math.min(names.length, 80); n += 1) {
      const before = await money(page);
      const result = await pressNth(page, events, root, true, n);
      const tag = `${label} #${n} ${names[n] || ''}`;
      if (!result.pressed) { if (result.skipped) report.skipped.push(tag); continue; }
      if (result.obscured) report.obscured.push(tag);
      if (result.changed) for (const problem of await page.evaluate(STATS_OVERFLOW)) report.overflow.push(`${label} #${n} ${names[n] || ''}: ${problem}`);
      if (!result.changed) { if (!result.selected) report.dead.push(tag); else report.selectedAgain += 1; continue; }
      // a detail sheet: press its own buttons too (one level), reopening it each time
      if (await modalOpen(page) && !await isCancellable(page)) {
        const inner = await page.evaluate(LIST_BUTTONS, { root: '#modal-root .u-sheet', skipNav: false });
        for (let k = 0; k < Math.min(inner.length, 12); k += 1) {
          const sub = await pressNth(page, events, '#modal-root .u-sheet', false, k);
          if (!sub.pressed) { await backTo(page, screen); break; }
          const subTag = `${tag} > ${inner[k] || ''}`;
          if (sub.pressed && sub.changed) for (const problem of await page.evaluate(STATS_OVERFLOW)) report.overflow.push(`${subTag}: ${problem}`);
          if (sub.pressed && !sub.changed && !sub.selected) report.dead.push(subTag);
          if (sub.skipped) report.skipped.push(subTag);
          if (MOVED(before, await money(page), subTag)) report.moved.push(subTag);
          await backTo(page, screen);
          if (k < inner.length - 1) await pressNth(page, events, root, true, n);   // reopen the sheet for the next inner button
        }
      }
      if (MOVED(before, await money(page), tag)) report.moved.push(tag);
      await backTo(page, screen);
    }
  }

  try {
    // 1. The founding form: every button is pressed except the one that founds the company, which is pressed last.
    {
      const { context, page, pageErrors, events } = await newPage();
      await page.goto(`${base}?ui=3`, { waitUntil: 'load' });
      await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
      const names = await page.evaluate(() => [...document.querySelectorAll('#app button')].filter(button => !button.disabled && button.getBoundingClientRect().width > 0).map(button => `${(button.textContent || '').trim().slice(0, 30)} [${button.type}|${button.dataset.action || ''}]`));
      report.screens.setup = names.length;
      assert.ok(names.length >= 2, `the founding form has buttons: ${JSON.stringify(names)}`);
      const buttons = page.locator('#app button:not([disabled])');
      const total = await buttons.count();
      for (let i = 0; i < total; i += 1) {
        const button = buttons.nth(i);
        const label = (await button.innerText()).trim();
        if (label.includes('創業する')) continue;
        const before = await snapshot(page); const eventsBefore = events.count;
        await button.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
        const after = await snapshot(page);
        const happened = Object.keys(before).some(key => before[key] !== after[key]) || events.count > eventsBefore;
        if (!happened) report.dead.push(`setup ${label}`);
        await closeModal(page);
      }
      await page.locator('#setup-form').evaluate(form => form.requestSubmit());
      await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
      assert.deepEqual(pageErrors, []);
      await context.close();
    }

    // 2. The 19 screens, in a game with a head office, departments and a store, and again as a listed company.
    const { context, page, pageErrors, events } = await newPage();
    await found(page, `${base}?ui=3`);
    await engineEval(page, engine => {
      const g = engine.g;
      g.companyCash = 900000000; g.personalCash = 900000000; g.hasHeadOffice = true; g.officeCapacity = 80;
      g.officeName = 'とても長い名前の本社オフィスビルディング東京'; // long names must wrap, not run into the next number
      g.completedMissionIDs = globalThis.__capitalismTycoonModules.data.MISSION_DEFS.map(mission => mission.id); g.activeMissionIDs = [];
      const tenant = g.tenants.find(item => !item.occupiedBy);
      engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'とても長い名前の1号店 渋谷駅前スクランブル交差点店', operatingHours: 3 });
      engine.establishDepartment('accounting'); engine.establishDepartment('investment');
      const listing = g.properties.find(item => !item.owner && item.prefID === g.selectedPref); if (listing) engine.buyProperty(listing.id, 'personal');
      engine.emit?.();
    });
    const ALL = await page.evaluate(() => [...document.querySelectorAll('[data-ui3-all-screens] [data-action="tab"]')].map(button => button.dataset.tab));
    assert.equal(ALL.length, 19, `all 19 screens are reachable: ${ALL}`);
    for (const tab of ALL) {
      await goTo(page, tab);
      await page.waitForFunction(id => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.selectedTab === id && document.body.classList.contains('ui3-native'), tab, { timeout: 15000 });
      await page.waitForTimeout(300);
      await sweep(page, events, tab, tab);
    }
    // the five tab-bar buttons and the group chips: each one changes the screen
    const bar = await page.evaluate(() => [...document.querySelectorAll('.u-tabbar .u-tab')].map(button => button.dataset.tab));
    for (const tab of bar) {
      const current = await page.evaluate(id => document.querySelector(`.u-tabbar .u-tab[data-tab="${id}"]`).getAttribute('aria-current') === 'page', tab);
      const before = await snapshot(page);
      await page.evaluate(id => document.querySelector(`.u-tabbar .u-tab[data-tab="${id}"]`).click(), tab);
      await page.waitForTimeout(350);
      const after = await snapshot(page);
      if (!current && Object.keys(before).every(key => before[key] === after[key])) report.dead.push(`tab bar ${tab}`);
    }
    report.screens['tab bar'] = bar.length;
    // 3. A listed company: the shareholder-returns rows
    await list(page);
    await goTo(page, 'market');
    await page.waitForTimeout(400);
    await sweep(page, events, 'market (listed)', 'market');
    // 4. The game-over screen
    await engineEval(page, engine => { engine.g.gameOver = true; engine.g.gameOverReason = 'テスト倒産'; engine.emit(); });
    await page.locator('[data-ui3-gameover-confirm], [data-ui3-gameover]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    const goNames = await page.evaluate(() => [...document.querySelectorAll('#app button')].filter(button => !button.disabled && button.getBoundingClientRect().width > 0).length);
    report.screens.gameover = goNames;
    assert.ok(goNames >= 4, `the game-over screen has its buttons (${goNames})`);
    const goButtons = page.locator('#app button:not([disabled])');
    const goTotal = await goButtons.count();
    for (let i = 0; i < goTotal; i += 1) {
      const button = goButtons.nth(i);
      const label = (await button.innerText()).trim();
      const before = await snapshot(page); const eventsBefore = events.count; const moneyBefore = await money(page);
      await button.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(450);
      const after = await snapshot(page);
      const happened = Object.keys(before).some(key => before[key] !== after[key]) || events.count > eventsBefore;
      if (!happened) report.dead.push(`gameover ${label}`);
      await closeModal(page);
      if (await money(page) !== moneyBefore) report.moved.push(`gameover ${label}`);
    }
    assert.deepEqual(pageErrors, []);
    await context.close();

    const total = Object.values(report.screens).reduce((sum, count) => sum + count, 0);
    console.log(`ui3-reachability: ${total} buttons pressed on ${Object.keys(report.screens).length} screens; obscured by a fixed part: ${report.obscured.length}`);
    console.log(`  an already-selected chip pressed again (nothing to change): ${report.selectedAgain}; not reachable once scrolled to (not pressed): ${report.skipped.length}`);
    if (report.skipped.length) console.log(`  not reachable: ${report.skipped.join(' | ')}`);
    if (report.obscured.length) console.log(`  obscured: ${report.obscured.join(' | ')}`);
    assert.deepEqual(report.overflow, [], `a value runs into its neighbour in a .u-stats row:\n  ${[...new Set(report.overflow)].join('\n  ')}`);
    assert.deepEqual(report.dead, [], `buttons that do nothing:\n  ${report.dead.join('\n  ')}`);
    assert.deepEqual(report.moved, [], `presses that changed the week, cash, debt or holdings:\n  ${report.moved.join('\n  ')}`);
    console.log(`ui3-reachability-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
