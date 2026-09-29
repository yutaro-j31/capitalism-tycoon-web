'use strict';

// #726 real-boot regression. When IndexedDB holds a newer save than localStorage (for example
// after localStorage was cleared or fell behind a quota failure), the production page must boot
// the IndexedDB save, and booting must not overwrite it with the older localStorage copy.
// tests/save-storage-idb-authoritative-boot-test.js checks the source order and the storage
// module in a VM; this test loads the real index.html in WebKit, so it fails if app.js stops
// waiting for hydrate() in any way.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const rc = require('../release-candidate.json');
const { loadGame } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.env.IPHONE_WEBKIT_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'iphone-webkit-smoke'));
const KEY = rc.save.key;
const SEED_PAGE = '/__idb-seed__';

// Real saves written by the production engine's own save(), not hand-built JSON.
function productionSave(weeks, companyName) {
  const loaded = loadGame({ headless: true });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Boot', companyName, difficulty: 'normal', scenario: 'free' });
  for (let week = 1; week < weeks; week++) assert.notEqual(engine.advanceWeek(false), false);
  engine.save();
  const saved = loaded.ctx.__localStorageData.get(KEY);
  assert.equal(JSON.parse(saved).week, weeks, `${companyName} save is at week ${weeks}`);
  return saved;
}

function server() {
  return http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      if (pathname === SEED_PAGE) {
        res.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><meta charset="utf-8"><title>seed</title>');
        return;
      }
      const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      assert.ok(file.startsWith(ROOT + path.sep));
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css'
          : file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : 'text/html'
      });
      res.end(body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(String(error.message || error));
    }
  });
}

// Runs in the page: the production module's database, store and key.
async function seedStorage({ key, older, newer }) {
  localStorage.setItem(key, older);
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('capitalism-tycoon', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = database.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(newer, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

async function readDurable(key) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('capitalism-tycoon', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const value = await new Promise((resolve, reject) => {
    const request = database.transaction('saves', 'readonly').objectStore('saves').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const older = productionSave(5, 'Local Older Co');
  const newer = productionSave(30, 'Durable Newer Co');

  const appServer = server();
  await new Promise((resolve, reject) => {
    appServer.once('error', reject);
    appServer.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${appServer.address().port}`;
  let browser;
  try {
    browser = await webkit.launch();
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ja-JP', serviceWorkers: 'block' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto(origin + SEED_PAGE, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(seedStorage, { key: KEY, older, newer });
    assert.equal(JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY)).week, 5, 'precondition: localStorage holds week 5');
    assert.equal(JSON.parse(await page.evaluate(readDurable, KEY)).week, 30, 'precondition: IndexedDB holds week 30');

    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30_000 });
    await page.waitForFunction(() => /Durable Newer Co|Local Older Co/.test(document.body?.innerText || ''), null, { timeout: 30_000 });
    const text = await page.evaluate(() => document.body.innerText);
    assert.match(text, /Durable Newer Co/, 'the page boots the newer IndexedDB save');
    assert.doesNotMatch(text, /Local Older Co/, 'the page does not boot the older localStorage save');

    // Let any boot-time save reach IndexedDB, then check the newer save was not overwritten.
    await page.waitForTimeout(1_500);
    const durable = JSON.parse(await page.evaluate(readDurable, KEY));
    assert.equal(durable.companyName, 'Durable Newer Co', 'booting keeps the newer save in IndexedDB');
    assert.ok(durable.week >= 30, `IndexedDB still holds week 30 or later (week ${durable.week})`);
    assert.deepEqual(pageErrors, [], 'no uncaught page errors during boot');

    await page.screenshot({ path: path.join(OUT, 'idb-authoritative-boot-webkit.png'), fullPage: true });
    fs.writeFileSync(path.join(OUT, 'idb-authoritative-boot-webkit.json'), JSON.stringify({
      status: 'passed', device: 'iPhone 13', localStorageWeek: 5, indexedDBWeek: 30, bootedWeekAfter: durable.week
    }, null, 2) + '\n');
    console.log(`IndexedDB-authoritative boot WebKit test passed (booted week ${durable.week})`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => appServer.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
