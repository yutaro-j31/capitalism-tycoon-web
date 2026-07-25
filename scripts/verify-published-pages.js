'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const release = JSON.parse(fs.readFileSync(path.join(root, 'release-candidate.json'), 'utf8'));
const baseUrl = new URL(release.deployment.url);
const expectedRef = process.env.GITHUB_SHA || process.env.EXPECTED_SHA || 'manual';
const attempts = Number(process.env.PAGES_VERIFY_ATTEMPTS || 12);
const delayMs = Number(process.env.PAGES_VERIFY_DELAY_MS || 15000);
const criticalFiles = [
  'release-candidate.json',
  'play.html',
  'index.html',
  'js/save-v9.js',
  'js/save-storage.js',
  'js/save-storage-ui.js',
  'js/engine.js'
];

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPublished(relativePath) {
  const url = new URL(relativePath, baseUrl);
  url.searchParams.set('verify', `${expectedRef}-${Date.now()}`);
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache, no-store, must-revalidate',
      pragma: 'no-cache'
    }
  });
  if (!response.ok) {
    throw new Error(`${relativePath}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function verifyOnce() {
  const mismatches = [];
  for (const relativePath of criticalFiles) {
    const local = fs.readFileSync(path.join(root, relativePath));
    const published = await fetchPublished(relativePath);
    const localHash = digest(local);
    const publishedHash = digest(published);
    if (localHash !== publishedHash) {
      mismatches.push({ relativePath, localHash, publishedHash, localBytes: local.length, publishedBytes: published.length });
    }
  }
  return mismatches;
}

(async () => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const mismatches = await verifyOnce();
      if (mismatches.length === 0) {
        console.log(JSON.stringify({
          ok: true,
          deploymentUrl: baseUrl.toString(),
          expectedRef,
          files: criticalFiles,
          attempt
        }, null, 2));
        return;
      }
      lastError = new Error(`published files do not match main: ${JSON.stringify(mismatches)}`);
    } catch (error) {
      lastError = error;
    }

    console.warn(`[pages-attestation] attempt ${attempt}/${attempts} failed: ${lastError.message}`);
    if (attempt < attempts) await sleep(delayMs);
  }

  console.error(JSON.stringify({
    ok: false,
    deploymentUrl: baseUrl.toString(),
    expectedRef,
    error: lastError ? lastError.message : 'unknown error'
  }, null, 2));
  process.exitCode = 1;
})();
