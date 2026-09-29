'use strict';

// #726 real-boot regression. Saves are kept in IndexedDB and mirrored to localStorage. Either
// copy can be the newer one: localStorage stops receiving saves once it is full, and an
// IndexedDB write can still be pending when iOS closes the tab. The production page must boot
// the newer copy (by saveSequence) and write it back to the other store. This loads the real
// index.html in WebKit, so it fails if the production engine stops reading through the storage
// module or app.js stops waiting for hydrate().

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
const SEED_PAGE = '/__save-seed__';

// A real save written by the production engine's own save(), with an explicit saveSequence.
function productionSave(weeks, companyName, saveSequence) {
  const loaded = loadGame({ headless: true });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Boot', companyName, difficulty: 'normal', scenario: 'free' });
  for (let week = 1; week < weeks; week++) assert.notEqual(engine.advanceWeek(false), false);
  engine.save();
  const state = JSON.parse(loaded.ctx.__localStorageData.get(KEY));
  assert.equal(state.week, weeks, `${companyName} save is at week ${weeks}`);
  assert.ok(Number.isInteger(state.saveSequence), 'the production save carries saveSequence');
  state.saveSequence = saveSequence;
  return JSON.stringify(state);
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
async function seedStorage({ key, local, durable }) {
  localStorage.setItem(key, local);
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('capitalism-tycoon', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = database.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(durable, key);
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

async function bootScenario(browser, origin, { name, local, durable, expected, other }) {
  const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'ja-JP', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(origin + SEED_PAGE, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(seedStorage, { key: KEY, local, durable });

    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30_000 });
    await page.waitForFunction(names => names.some(name => (document.body?.innerText || '').includes(name)), [expected, other], { timeout: 30_000 });
    const text = await page.evaluate(() => document.body.innerText);
    assert.ok(text.includes(expected), `${name}: the page boots the newer copy (${expected})`);
    assert.ok(!text.includes(other), `${name}: the page does not boot the older copy (${other})`);

    // Both stores end up holding the booted save.
    await page.evaluate(() => globalThis.__capitalismTycoonModules.saveStorageIDB.flush());
    const selection = await page.evaluate(key => globalThis.__capitalismTycoonModules.saveStorageIDB.status().bootSelection[key], KEY);
    const inLocal = JSON.parse(await page.evaluate(key => localStorage.getItem(key), KEY));
    const inDurable = JSON.parse(await page.evaluate(readDurable, KEY));
    assert.equal(inLocal.companyName, expected, `${name}: localStorage holds the booted save`);
    assert.equal(inDurable.companyName, expected, `${name}: IndexedDB holds the booted save`);
    assert.deepEqual(pageErrors, [], `${name}: no uncaught page errors during boot`);
    await page.screenshot({ path: path.join(OUT, `save-newest-copy-boot-${name}.png`), fullPage: true });
    return { name, selection, localSequence: inLocal.saveSequence, durableSequence: inDurable.saveSequence };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const week5 = productionSave(5, 'Local Older Co', 5);
  const week30 = productionSave(30, 'Durable Newer Co', 30);
  const week31 = productionSave(31, 'Local Newer Co', 31);

  const appServer = server();
  await new Promise((resolve, reject) => {
    appServer.once('error', reject);
    appServer.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${appServer.address().port}`;
  let browser;
  try {
    browser = await webkit.launch();
    const results = [];
    // localStorage fell behind (for example it filled up): IndexedDB is newer.
    results.push(await bootScenario(browser, origin, { name: 'durable-newer', local: week5, durable: week30, expected: 'Durable Newer Co', other: 'Local Older Co' }));
    // The last IndexedDB write never landed (tab closed): localStorage is newer.
    results.push(await bootScenario(browser, origin, { name: 'local-newer', local: week31, durable: week30, expected: 'Local Newer Co', other: 'Durable Newer Co' }));
    assert.equal(results[0].selection.source, 'indexeddb');
    assert.equal(results[1].selection.source, 'localStorage');
    fs.writeFileSync(path.join(OUT, 'save-newest-copy-boot-webkit.json'), JSON.stringify({ status: 'passed', device: 'iPhone 13', results }, null, 2) + '\n');
    console.log('newest-copy boot WebKit test passed: ' + results.map(r => `${r.name} -> ${r.selection.source}`).join(', '));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => appServer.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
