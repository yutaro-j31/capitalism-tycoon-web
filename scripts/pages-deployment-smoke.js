'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAssetPath(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.startsWith('#') || /^(?:https?:|data:|mailto:|javascript:|\/\/)/i.test(raw)) return null;
  const withoutQuery = raw.split(/[?#]/, 1)[0].replace(/^\.\//, '');
  if (!withoutQuery || withoutQuery.startsWith('/') || withoutQuery.includes('\\')) {
    throw new Error(`Unsafe deployment asset path: ${raw}`);
  }
  const normalized = path.posix.normalize(withoutQuery);
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Deployment asset escapes repository root: ${raw}`);
  }
  return normalized;
}

function extractAssetPaths(html) {
  const assets = [];
  const patterns = [
    /<script\b[^>]*\bsrc=(['"])(.*?)\1/gi,
    /<link\b[^>]*\bhref=(['"])(.*?)\1/gi
  ];
  for (const pattern of patterns) {
    for (const match of String(html).matchAll(pattern)) {
      const asset = normalizeAssetPath(match[2]);
      if (asset) assets.push(asset);
    }
  }
  return [...new Set(assets)];
}

function deploymentTargets(root = ROOT) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...new Set(['index.html', 'release-candidate.json', ...extractAssetPaths(html)])];
}

function readLocalAsset(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Deployment target escapes repository root: ${relativePath}`);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Local deployment target is missing: ${relativePath}`);
  }
  return fs.readFileSync(resolved);
}

async function fetchBuffer(url, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is unavailable. Node.js 18 or later is required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache'
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function verifyOnce({
  root = ROOT,
  baseUrl,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = 15_000,
  nonce = `${Date.now()}`
}) {
  const targets = deploymentTargets(root);
  const base = new URL(String(baseUrl));
  if (!base.pathname.endsWith('/')) base.pathname += '/';

  const checks = await Promise.all(targets.map(async relativePath => {
    const local = readLocalAsset(root, relativePath);
    const remoteUrl = new URL(relativePath, base);
    remoteUrl.searchParams.set('__ct_deploy_check', nonce);
    try {
      const remote = await fetchBuffer(remoteUrl, { fetchImpl, timeoutMs: requestTimeoutMs });
      const localHash = sha256(local);
      const remoteHash = sha256(remote);
      return {
        path: relativePath,
        ok: localHash === remoteHash,
        localBytes: local.length,
        remoteBytes: remote.length,
        localHash,
        remoteHash
      };
    } catch (error) {
      return {
        path: relativePath,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));

  return {
    ok: checks.every(check => check.ok),
    baseUrl: base.toString(),
    assetCount: checks.length,
    checks,
    mismatches: checks.filter(check => !check.ok)
  };
}

async function verifyDeployment({
  root = ROOT,
  baseUrl,
  fetchImpl = globalThis.fetch,
  attempts = 20,
  delayMs = 30_000,
  requestTimeoutMs = 15_000,
  sleepImpl = sleep
}) {
  const maxAttempts = positiveInteger(attempts, 20);
  let lastResult = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResult = await verifyOnce({
      root,
      baseUrl,
      fetchImpl,
      requestTimeoutMs: positiveInteger(requestTimeoutMs, 15_000),
      nonce: `${Date.now()}-${attempt}`
    });
    if (lastResult.ok) return { ...lastResult, attempts: attempt };
    if (attempt < maxAttempts) await sleepImpl(Math.max(0, Number(delayMs) || 0));
  }

  const summary = (lastResult?.mismatches || [])
    .slice(0, 8)
    .map(row => `${row.path}: ${row.error || `${row.remoteHash || 'missing'} != ${row.localHash || 'missing'}`}`)
    .join('\n');
  throw new Error(`Published GitHub Pages assets did not match this checkout after ${maxAttempts} attempts.\n${summary}`);
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'release-candidate.json'), 'utf8'));
  const baseUrl = process.env.PAGES_SMOKE_BASE_URL || manifest?.deployment?.url;
  if (!baseUrl) throw new Error('release-candidate.json must define deployment.url');

  const result = await verifyDeployment({
    root: ROOT,
    baseUrl,
    attempts: process.env.PAGES_SMOKE_ATTEMPTS,
    delayMs: process.env.PAGES_SMOKE_DELAY_MS,
    requestTimeoutMs: process.env.PAGES_SMOKE_REQUEST_TIMEOUT_MS
  });

  console.log(JSON.stringify({
    version: manifest.version,
    tag: manifest.tag,
    commit: process.env.GITHUB_SHA || null,
    deployment: result.baseUrl,
    assetCount: result.assetCount,
    attempts: result.attempts
  }, null, 2));
  console.log('GitHub Pages deployment smoke passed.');
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  });
}

module.exports = {
  ROOT,
  sha256,
  normalizeAssetPath,
  extractAssetPaths,
  deploymentTargets,
  readLocalAsset,
  fetchBuffer,
  verifyOnce,
  verifyDeployment
};
