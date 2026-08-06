'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const PROBE_PATH = path.join(__dirname, 'boot-observer-diagnostics-probe.js');
const ARTIFACT_DIR = path.resolve(process.env.BOOT_DIAGNOSTICS_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'boot-observer-diagnostics'));
const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);
const PROBE_TIMEOUT_MS = 25000;
const MAX_BODY_BYTES = 1024 * 1024;
const pulses = new Map();

function ensureDirectory(directory) { fs.mkdirSync(directory, { recursive: true }); }
function safeName(value) { return String(value).replace(/[^a-z0-9_.-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100); }

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
    return { index, tag, src, label: src || (data ? `inline:${data}` : `inline:${index + 1}`), start: match.index, end: match.index + tag.length };
  });
}

function variantHtml(indexHtml, scripts, cut) {
  const count = Math.max(0, Math.min(scripts.length, Number(cut)));
  return `${indexHtml.slice(0, scripts[0].start)}${scripts.slice(0, count).map(item => item.tag).join('')}${indexHtml.slice(scripts.at(-1).end)}`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('diagnostic pulse exceeds size limit'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function staticServer(indexHtml, scripts) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (request.method === 'POST' && url.pathname === '/__boot-diagnostics/pulse') {
        const probeID = url.searchParams.get('probe') || 'unknown';
        const raw = await readBody(request);
        const value = JSON.parse(raw || '{}');
        pulses.set(probeID, value);
        response.writeHead(204, { 'cache-control': 'no-store' });
        response.end();
        return;
      }
      if (url.pathname === '/variant.html') {
        const body = Buffer.from(variantHtml(indexHtml, scripts, Number(url.searchParams.get('cut') || scripts.length)));
        response.writeHead(200, { 'cache-control': 'no-store', 'content-length': String(body.length), 'content-type': 'text/html; charset=utf-8' });
        response.end(body);
        return;
      }
      const requested = url.pathname === '/' ? INDEX_PATH : requestFile(url.pathname);
      const target = fs.statSync(requested).isDirectory() ? path.join(requested, 'index.html') : requested;
      const body = fs.readFileSync(target);
      response.writeHead(200, { 'cache-control': 'no-store', 'content-length': String(body.length), 'content-type': MIME.get(path.extname(target).toLowerCase()) || 'application/octet-stream' });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error?.code === 'ENOENT' ? 'Not found' : String(error?.stack || error));
    }
  });
}

async function startServer(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}
async function stopServer(server) { await new Promise(resolve => server.close(resolve)); }

function runChild(baseUrl, scripts, cut, label) {
  return new Promise(resolve => {
    const directory = path.join(ARTIFACT_DIR, safeName(label));
    ensureDirectory(directory);
    const resultPath = path.join(directory, 'child-result.json');
    const probeID = `${safeName(label)}-${process.pid}-${Date.now()}`;
    const child = spawn(process.execPath, [PROBE_PATH], {
      cwd: ROOT,
      env: {
        ...process.env,
        BOOT_DIAG_BASE_URL: baseUrl,
        BOOT_DIAG_CUT: String(cut),
        BOOT_DIAG_LABEL: label,
        BOOT_DIAG_PROBE_ID: probeID,
        BOOT_DIAG_RESULT_PATH: resultPath
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-20000); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-20000); });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, PROBE_TIMEOUT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      let childResult = null;
      try { childResult = JSON.parse(fs.readFileSync(resultPath, 'utf8')); } catch (_) {}
      const pulse = pulses.get(probeID) || null;
      const result = {
        label,
        cut,
        lastScript: scripts[Math.max(0, cut - 1)]?.label || null,
        timedOut,
        exitCode: code,
        signal,
        stdout,
        stderr,
        pulse,
        ...(childResult || {})
      };
      const diagnostics = result.diagnostics || pulse || {};
      result.unhealthy = timedOut || code !== 0 || !result.setupVisible || !result.responsive || Boolean(diagnostics.forceDisconnected);
      fs.writeFileSync(path.join(directory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
      resolve(result);
    });
  });
}

async function main() {
  ensureDirectory(ARTIFACT_DIR);
  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  const scripts = scriptMetadata(indexHtml);
  assert.ok(scripts.length > 0, 'index.html must contain scripts');
  const appIndex = scripts.findIndex(item => item.src === './js/app.js');
  assert.ok(appIndex >= 0, 'app.js script must exist');
  assert.equal(scripts[0]?.src, './js/boot-diagnostics.js', 'boot diagnostics must be the first script');
  assert.equal(scripts[1]?.src, './js/boot-recovery.js', 'boot recovery must follow diagnostics');

  const server = staticServer(indexHtml, scripts);
  const baseUrl = await startServer(server);
  const probes = [];
  try {
    const appCut = appIndex + 1;
    const appPrefix = await runChild(baseUrl, scripts, appCut, `prefix-${appCut}-through-app`);
    probes.push(appPrefix);
    assert.equal(appPrefix.unhealthy, false, `app.js prefix must remain healthy: ${JSON.stringify(appPrefix, null, 2)}`);

    const full = await runChild(baseUrl, scripts, scripts.length, `prefix-${scripts.length}-full`);
    probes.push(full);
    let firstUnhealthyCut = null;
    if (full.unhealthy) {
      let low = appCut + 1;
      let high = scripts.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const result = await runChild(baseUrl, scripts, middle, `prefix-${middle}-bisect`);
        probes.push(result);
        if (result.unhealthy) high = middle;
        else low = middle + 1;
      }
      firstUnhealthyCut = low;
      if (!probes.some(item => item.cut === low)) probes.push(await runChild(baseUrl, scripts, low, `prefix-${low}-first-unhealthy`));
      if (low > appCut + 1 && !probes.some(item => item.cut === low - 1)) probes.push(await runChild(baseUrl, scripts, low - 1, `prefix-${low - 1}-last-healthy`));
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      scriptCount: scripts.length,
      appCut,
      appPrefixHealthy: !appPrefix.unhealthy,
      fullHealthy: !full.unhealthy,
      firstUnhealthyCut,
      firstUnhealthyScript: firstUnhealthyCut ? scripts[firstUnhealthyCut - 1] : null,
      probes: probes.sort((a, b) => a.cut - b.cut).map(item => ({
        label: item.label,
        cut: item.cut,
        lastScript: item.lastScript,
        unhealthy: item.unhealthy,
        timedOut: item.timedOut,
        exitCode: item.exitCode,
        setupVisible: item.setupVisible,
        responsive: item.responsive,
        diagnostics: item.diagnostics || item.pulse || null,
        pageErrors: item.pageErrors || [],
        consoleErrors: item.consoleErrors || [],
        failedRequests: item.failedRequests || []
      }))
    };
    assert.ok(!full.unhealthy || firstUnhealthyCut, 'unhealthy full entry must produce a bisection boundary');
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await stopServer(server);
  }
}

main().catch(error => {
  ensureDirectory(ARTIFACT_DIR);
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'fatal.json'), `${JSON.stringify({ message: String(error?.message || error), stack: String(error?.stack || '') }, null, 2)}\n`);
  console.error(error?.stack || error);
  process.exitCode = 1;
});
