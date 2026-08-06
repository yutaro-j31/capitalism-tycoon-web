'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const ARTIFACT_DIR = path.resolve(process.env.BOOT_DIAGNOSTICS_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'boot-observer-diagnostics'));
const DEVICE_NAME = 'iPhone 13';
const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);

assert.ok(devices[DEVICE_NAME], `Playwright device descriptor unavailable: ${DEVICE_NAME}`);

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9_.-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

function requestFile(rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, 'http://127.0.0.1').pathname);
  const resolved = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `request escaped root: ${pathname}`);
  return resolved;
}

function scriptMetadata(indexHtml) {
  return [...indexHtml.matchAll(SCRIPT_RE)].map((match, index) => {
    const tag = match[0];
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';
    const data = tag.match(/\b(data-[\w-]+)/i)?.[1] || '';
    return {
      index,
      tag,
      src,
      label: src || (data ? `inline:${data}` : `inline:${index + 1}`),
      start: match.index,
      end: match.index + tag.length
    };
  });
}

function variantHtml(indexHtml, scripts, cut) {
  assert.ok(scripts.length > 0, 'index.html must contain scripts');
  const first = scripts[0];
  const last = scripts[scripts.length - 1];
  const count = Math.max(0, Math.min(scripts.length, Number(cut)));
  const html = `${indexHtml.slice(0, first.start)}${scripts.slice(0, count).map(item => item.tag).join('')}${indexHtml.slice(last.end)}`;
  // The variant is served at /variant.html so the canonical ./js and ./css paths
  // resolve from the repository root exactly as they do for index.html.
  return html;
}

function staticServer(indexHtml, scripts) {
  return http.createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/variant.html') {
        const cut = Number(url.searchParams.get('cut') || scripts.length);
        const body = Buffer.from(variantHtml(indexHtml, scripts, cut));
        response.writeHead(200, {
          'cache-control': 'no-store',
          'content-length': String(body.length),
          'content-type': 'text/html; charset=utf-8'
        });
        response.end(body);
        return;
      }

      const requested = url.pathname === '/' ? INDEX_PATH : requestFile(url.pathname);
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
      response.end(error?.code === 'ENOENT' ? 'Not found' : String(error?.stack || error));
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
  return `http://127.0.0.1:${address.port}`;
}

async function stopServer(server) {
  await new Promise(resolve => server.close(resolve));
}

async function readDiagnostics(page) {
  try {
    return await page.evaluate(() => globalThis.__capitalismTycoonBootDiagnostics || null);
  } catch (error) {
    return { readError: String(error?.message || error) };
  }
}

async function runVariant(browser, baseUrl, scripts, cut, label) {
  const directory = path.join(ARTIFACT_DIR, safeName(label));
  ensureDirectory(directory);
  const context = await browser.newContext({
    ...devices[DEVICE_NAME],
    locale: 'ja-JP',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    timezoneId: 'Asia/Tokyo'
  });
  const page = await context.newPage();
  const evidence = {
    label,
    cut,
    lastScript: scripts[Math.max(0, cut - 1)]?.label || null,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    startedAt: new Date().toISOString(),
    setupVisible: false,
    bootResponsive: false,
    diagnostics: null
  };

  page.on('console', message => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => evidence.pageErrors.push(String(error?.message || error)));
  page.on('requestfailed', request => {
    evidence.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });

  const url = `${baseUrl}/variant.html?cut=${cut}&boot-diagnostics=force&observer-threshold=10000`;
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 10_000 });
    try {
      await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 12_000 });
      evidence.setupVisible = true;
    } catch (_) {}
    evidence.diagnostics = await readDiagnostics(page);
    evidence.bootResponsive = !evidence.diagnostics?.readError;
    try {
      evidence.readyState = await page.evaluate(() => document.readyState);
      evidence.bodyText = (await page.locator('body').innerText({ timeout: 2_000 })).slice(0, 1000);
    } catch (error) {
      evidence.domReadError = String(error?.message || error);
    }
  } catch (error) {
    evidence.navigationError = String(error?.message || error);
    evidence.diagnostics = await readDiagnostics(page);
  }

  try {
    await page.screenshot({ path: path.join(directory, 'screenshot.png'), fullPage: true, timeout: 5_000 });
  } catch (error) {
    evidence.screenshotError = String(error?.message || error);
  }
  try {
    fs.writeFileSync(path.join(directory, 'page.html'), await page.content());
  } catch (error) {
    evidence.contentError = String(error?.message || error);
  }
  evidence.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(directory, 'result.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  await context.close();

  const diagnostics = evidence.diagnostics || {};
  evidence.unhealthy =
    Boolean(diagnostics.forceDisconnected) ||
    Number(diagnostics.observerCallbacks || 0) >= 10000 ||
    (!evidence.setupVisible && !evidence.pageErrors.length && !evidence.failedRequests.length);
  return evidence;
}

async function main() {
  ensureDirectory(ARTIFACT_DIR);
  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  const scripts = scriptMetadata(indexHtml);
  const appIndex = scripts.findIndex(item => item.src.endsWith('/js/app.js') || item.src === './js/app.js');
  assert.ok(appIndex >= 0, 'app.js script must exist');
  assert.equal(scripts[0]?.src, './js/boot-diagnostics.js', 'boot diagnostics must be the first script');
  assert.equal(scripts[1]?.src, './js/boot-recovery.js', 'boot recovery must follow diagnostics');

  const server = staticServer(indexHtml, scripts);
  const baseUrl = await startServer(server);
  let browser;
  try {
    browser = await webkit.launch();
    const appCut = appIndex + 1;
    const appPrefix = await runVariant(browser, baseUrl, scripts, appCut, `prefix-${appCut}-through-app`);
    const full = await runVariant(browser, baseUrl, scripts, scripts.length, `prefix-${scripts.length}-full`);

    assert.ok(appPrefix.setupVisible, `app.js prefix must render setup: ${JSON.stringify(appPrefix, null, 2)}`);

    const probes = [appPrefix];
    let firstUnhealthyCut = null;
    if (full.unhealthy) {
      let low = appCut + 1;
      let high = scripts.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const result = await runVariant(browser, baseUrl, scripts, middle, `prefix-${middle}-bisect`);
        probes.push(result);
        if (result.unhealthy) high = middle;
        else low = middle + 1;
      }
      firstUnhealthyCut = low;
      if (!probes.some(item => item.cut === low)) {
        probes.push(await runVariant(browser, baseUrl, scripts, low, `prefix-${low}-first-unhealthy`));
      }
      if (low > appCut + 1 && !probes.some(item => item.cut === low - 1)) {
        probes.push(await runVariant(browser, baseUrl, scripts, low - 1, `prefix-${low - 1}-last-healthy`));
      }
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      scriptCount: scripts.length,
      appCut,
      appScript: scripts[appIndex],
      appPrefix: {
        setupVisible: appPrefix.setupVisible,
        unhealthy: appPrefix.unhealthy,
        diagnostics: appPrefix.diagnostics
      },
      full: {
        setupVisible: full.setupVisible,
        unhealthy: full.unhealthy,
        diagnostics: full.diagnostics
      },
      firstUnhealthyCut,
      firstUnhealthyScript: firstUnhealthyCut ? scripts[firstUnhealthyCut - 1] : null,
      probes: probes
        .sort((a, b) => a.cut - b.cut)
        .map(item => ({
          label: item.label,
          cut: item.cut,
          lastScript: item.lastScript,
          setupVisible: item.setupVisible,
          unhealthy: item.unhealthy,
          diagnostics: item.diagnostics,
          consoleErrors: item.consoleErrors,
          pageErrors: item.pageErrors,
          failedRequests: item.failedRequests,
          navigationError: item.navigationError || null
        }))
    };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (browser) await browser.close();
    await stopServer(server);
  }
}

main().catch(error => {
  ensureDirectory(ARTIFACT_DIR);
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'fatal.json'), `${JSON.stringify({
    message: String(error?.message || error),
    stack: String(error?.stack || '')
  }, null, 2)}\n`);
  console.error(error?.stack || error);
  process.exitCode = 1;
});
