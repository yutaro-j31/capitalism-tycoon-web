'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.resolve(process.env.IPHONE_ACCEPTANCE_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-acceptance'));
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const BASE_DEVICE = 'iPhone 13';
const TABS = [
  'home','map','business','office','market','venture','ma','overseas','assets','bank',
  'report','founder','strategy','media','legacy','missions','rivals','news','settings'
];
const PROFILES = [
  { id: 'iphone-390x844', viewport: { width: 390, height: 844 } },
  { id: 'iphone-430x932', viewport: { width: 430, height: 932 } }
];
const MIME = new Map([
  ['.css','text/css; charset=utf-8'],['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8'],
  ['.png','image/png'],['.svg','image/svg+xml'],['.webp','image/webp']
]);

assert.ok(devices[BASE_DEVICE], `Playwright device descriptor is unavailable: ${BASE_DEVICE}`);

function server() {
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const file = path.resolve(ROOT, relative);
      assert.ok(file === ROOT || file.startsWith(`${ROOT}${path.sep}`), `unsafe request path: ${pathname}`);
      const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
      const body = fs.readFileSync(target);
      res.writeHead(200, {
        'cache-control': 'no-store',
        'content-length': String(body.length),
        'content-type': MIME.get(path.extname(target).toLowerCase()) || 'application/octet-stream'
      });
      res.end(body);
    } catch (error) {
      res.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error?.code === 'ENOENT' ? 'Not found' : String(error?.message || error));
    }
  });
}

async function startServer(srv) {
  await new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', resolve);
  });
  const address = srv.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}/`;
}

async function stopServer(srv) {
  await new Promise(resolve => srv.close(resolve));
}

function observeDiagnostics(page, diagnostics) {
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', request => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });
  page.on('response', response => {
    const status = response.status();
    if (status >= 500) diagnostics.serverErrors.push(`${status} ${response.url()}`);
  });
}

async function closeModalIfPresent(page) {
  const modal = page.locator('#modal-root [data-modal-panel]');
  if (!await modal.count()) return;
  if (!await modal.isVisible().catch(() => false)) return;
  const close = page.locator('#modal-root [data-action="close-modal"]').last();
  if (await close.count()) {
    await close.click();
    await page.waitForFunction(() => !document.querySelector('#modal-root [data-modal-panel]'));
  }
}

async function createConfiguredGame(page, suffix) {
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 20_000 });
  await page.screenshot({ path: path.join(page.artifactDir, '00-setup.png'), fullPage: false });
  await page.locator('#setup-form input[name="playerName"]').fill(`Acceptance Tester ${suffix}`);
  await page.locator('#setup-form input[name="companyName"]').fill(`Acceptance Holdings ${suffix}`);
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.locator('.topbar').waitFor({ state: 'visible', timeout: 20_000 });
  assert.equal(await page.locator('#setup-form').count(), 0, 'setup form must disappear after configuration');
  const stored = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  assert.ok(stored, 'configured game must be saved');
  assert.equal(JSON.parse(stored).configured, true, 'configured save must be marked configured');

  await page.locator('button[data-action="advance-week"]').first().click();
  const summary = page.locator('#modal-root .summary-modal');
  await summary.waitFor({ state: 'visible', timeout: 20_000 });
  assert.match(await summary.innerText(), /週間経営レポート/);
  await closeModalIfPresent(page);

  return page.evaluate(() => {
    const modules = globalThis.__capitalismTycoonModules;
    const engine = modules?.playerEngineBridge?.getEngine?.();
    if (!engine) throw new Error('production player engine bridge is unavailable');
    const existing = engine.g.stores.find(store => store.status !== 'closed');
    if (existing) return { opened: true, existing: true, id: existing.id, status: existing.status };
    const candidates = engine.g.tenants
      .filter(tenant => !tenant.occupiedBy)
      .map(tenant => ({ tenant, estimate: engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'ramen', operatingHours: 3 }) }))
      .filter(row => row.estimate?.affordable)
      .sort((a, b) => a.estimate.upfront - b.estimate.upfront || String(a.tenant.id).localeCompare(String(b.tenant.id)));
    if (!candidates.length) return { opened: false, reason: 'no affordable ramen tenant' };
    const chosen = candidates[0];
    const ok = engine.openStore({
      tenantID: chosen.tenant.id,
      businessID: 'ramen',
      operatingHours: 3,
      name: 'WebKit Acceptance Ramen',
      storeID: 'webkit-acceptance-ramen'
    });
    const store = engine.g.stores.find(row => row.id === 'webkit-acceptance-ramen');
    return {
      opened: ok === true,
      existing: false,
      id: store?.id || null,
      status: store?.status || null,
      tenantID: chosen.tenant.id,
      upfront: chosen.estimate.upfront
    };
  });
}

async function openCommandTab(page, tab) {
  const screen = page.locator('#screen');
  if (await screen.getAttribute('data-screen') === tab) return;
  const toggle = page.locator('[data-d-ui-action="toggle-menu"]:visible').first();
  assert.ok(await toggle.count(), `command menu toggle must be visible before opening ${tab}`);
  await toggle.click();
  const menu = page.locator('#d-ui-command-menu.open');
  await menu.waitFor({ state: 'visible', timeout: 10_000 });
  const target = menu.locator(`[data-tab="${tab}"]`);
  assert.equal(await target.count(), 1, `command menu must expose tab ${tab}`);
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await menu.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.locator(`#screen[data-screen="${tab}"]`).waitFor({ state: 'visible', timeout: 15_000 });
}

async function measureScreen(page, tab) {
  const metrics = await page.evaluate(tabName => {
    const screen = document.querySelector('#screen');
    const screenRect = screen?.getBoundingClientRect();
    const navigation = [...document.querySelectorAll('.d-sidebar,#d-ui-dock,.tabs')].find(node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const navigationRect = navigation?.getBoundingClientRect();
    const visibleControls = [...document.querySelectorAll('#screen button,#screen input,#screen select,#screen textarea,#screen [role="button"]')]
      .filter(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
    const visibleText = String(screen?.innerText || '').replace(/\s+/g, ' ').trim();
    return {
      tab: tabName,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      screen: screenRect ? { left: screenRect.left, right: screenRect.right, width: screenRect.width, height: screenRect.height } : null,
      navigation: navigationRect ? { left: navigationRect.left, right: navigationRect.right, top: navigationRect.top, bottom: navigationRect.bottom, width: navigationRect.width, height: navigationRect.height } : null,
      visibleControlCount: visibleControls.length,
      canvasCount: screen?.querySelectorAll('canvas').length || 0,
      textLength: visibleText.length,
      textSample: visibleText.slice(0, 240),
      runtimeRecoveryCount: document.querySelectorAll('[data-runtime-recovery-root]').length
    };
  }, tab);

  assert.ok(metrics.screen, `${tab}: #screen must exist`);
  assert.equal(metrics.runtimeRecoveryCount, 0, `${tab}: runtime recovery UI must not appear`);
  assert.ok(metrics.documentScrollWidth <= metrics.viewportWidth + 2, `${tab}: document horizontal overflow ${metrics.documentScrollWidth} > ${metrics.viewportWidth}`);
  assert.ok(metrics.bodyScrollWidth <= metrics.viewportWidth + 2, `${tab}: body horizontal overflow ${metrics.bodyScrollWidth} > ${metrics.viewportWidth}`);
  assert.ok(metrics.screen.left >= -2 && metrics.screen.right <= metrics.viewportWidth + 2, `${tab}: screen is horizontally outside viewport: ${JSON.stringify(metrics.screen)}`);
  assert.ok(metrics.textLength > 0 || metrics.canvasCount > 0, `${tab}: rendered screen is empty`);
  assert.ok(metrics.navigation, `${tab}: a visible iPhone bottom navigation must remain rendered`);
  assert.ok(metrics.navigation.width >= metrics.viewportWidth * 0.85, `${tab}: bottom navigation must span the usable viewport: ${JSON.stringify(metrics.navigation)}`);
  assert.ok(metrics.navigation.height >= 56, `${tab}: bottom navigation must remain tappable: ${JSON.stringify(metrics.navigation)}`);
  assert.ok(metrics.navigation.left >= -2 && metrics.navigation.right <= metrics.viewportWidth + 2, `${tab}: bottom navigation is horizontally outside viewport`);
  assert.ok(metrics.navigation.top < metrics.viewportHeight && metrics.navigation.bottom <= metrics.viewportHeight + 2, `${tab}: bottom navigation is not visible inside the iPhone viewport`);

  return metrics;
}

async function exerciseScreenSpecificUI(page, tab) {
  if (tab === 'office') {
    const departments = page.locator('#screen [data-action="office-tab"][data-id="departments"]');
    const overview = page.locator('#screen [data-action="office-tab"][data-id="overview"]');
    if (await departments.count() && await overview.count()) {
      await departments.click();
      await page.locator('#screen [data-action="office-tab"][data-id="departments"].active').waitFor({ state: 'visible' });
      await overview.click();
      await page.locator('#screen [data-action="office-tab"][data-id="overview"].active').waitFor({ state: 'visible' });
    }
  }
  if (tab === 'settings') {
    const save = page.locator('#screen button[data-action="save-now"]');
    assert.equal(await save.count(), 1, 'settings must expose save-now');
    await save.click();
    const persisted = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    assert.ok(persisted, 'settings save-now must leave a durable localStorage save');
  }
  if (tab === 'market') {
    assert.ok(await page.locator('#screen [data-stock-trade-panel]').count(), 'market must render stock trade panel');
  }
  if (tab === 'map') {
    assert.ok((await page.locator('#screen canvas').count()) > 0 || (await page.locator('#screen .d-map-overlay').count()) > 0, 'map screen must render map canvas/overlay');
  }
}

async function runProfile(browser, baseUrl, profile) {
  const profileDir = path.join(ARTIFACT_DIR, profile.id);
  fs.mkdirSync(profileDir, { recursive: true });
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], serverErrors: [] };
  const context = await browser.newContext({
    ...devices[BASE_DEVICE],
    viewport: profile.viewport,
    screen: profile.viewport,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    reducedMotion: 'reduce',
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  page.artifactDir = profileDir;
  observeDiagnostics(page, diagnostics);
  const result = { profile, screens: [], diagnostics, startedAt: new Date().toISOString() };

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    const store = await createConfiguredGame(page, profile.id);
    result.store = store;
    assert.equal(store.opened, true, `production openStore writer must open an affordable ramen store: ${JSON.stringify(store)}`);

    for (let index = 0; index < TABS.length; index += 1) {
      const tab = TABS[index];
      await openCommandTab(page, tab);
      await exerciseScreenSpecificUI(page, tab);
      await page.waitForTimeout(80);
      const metrics = await measureScreen(page, tab);
      result.screens.push(metrics);
      const prefix = String(index + 1).padStart(2, '0');
      await page.screenshot({ path: path.join(profileDir, `${prefix}-${tab}.png`), fullPage: false });
    }

    const beforeReload = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
    await page.locator('#screen').waitFor({ state: 'visible', timeout: 20_000 });
    assert.equal(await page.locator('#setup-form').count(), 0, 'reload must not return a configured game to setup');
    const afterReload = JSON.parse(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY));
    assert.equal(afterReload.companyName, beforeReload.companyName, 'company identity must survive reload');
    assert.equal(afterReload.week, beforeReload.week, 'week must survive reload');
    assert.ok(afterReload.stores.some(store => store.id === 'webkit-acceptance-ramen'), 'created ramen store must survive reload');
    await page.screenshot({ path: path.join(profileDir, '99-reload.png'), fullPage: false });

    assert.deepEqual(diagnostics.consoleErrors, [], `${profile.id}: console errors`);
    assert.deepEqual(diagnostics.pageErrors, [], `${profile.id}: page errors`);
    assert.deepEqual(diagnostics.failedRequests, [], `${profile.id}: failed requests`);
    assert.deepEqual(diagnostics.serverErrors, [], `${profile.id}: server errors`);
    result.reload = { week: afterReload.week, selectedTab: afterReload.selectedTab || null, storeCount: afterReload.stores.length };
    result.ok = true;
    result.finishedAt = new Date().toISOString();
    return result;
  } catch (error) {
    result.ok = false;
    result.error = error?.stack || String(error);
    result.finishedAt = new Date().toISOString();
    try { await page.screenshot({ path: path.join(profileDir, 'failure.png'), fullPage: false }); } catch (_) {}
    throw Object.assign(error, { acceptanceResult: result });
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const srv = server();
  let browser;
  const results = [];
  try {
    const baseUrl = await startServer(srv);
    browser = await webkit.launch();
    for (const profile of PROFILES) {
      try {
        results.push(await runProfile(browser, baseUrl, profile));
      } catch (error) {
        if (error.acceptanceResult) results.push(error.acceptanceResult);
        throw error;
      }
    }
    const summary = {
      ok: true,
      browser: 'WebKit',
      browserVersion: browser.version(),
      baseDevice: BASE_DEVICE,
      primaryScreens: TABS,
      profiles: results,
      finishedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`iPhone full acceptance passed: ${PROFILES.length} profiles x ${TABS.length} screens`);
  } catch (error) {
    const summary = {
      ok: false,
      browser: 'WebKit',
      browserVersion: browser?.version?.() || null,
      baseDevice: BASE_DEVICE,
      primaryScreens: TABS,
      profiles: results,
      error: error?.stack || String(error),
      finishedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), `${JSON.stringify(summary, null, 2)}\n`);
    throw error;
  } finally {
    if (browser) await browser.close();
    await stopServer(srv);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
