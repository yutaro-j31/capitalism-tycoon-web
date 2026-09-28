'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./harness');

const SAVE_KEY = 'capitalism_tycoon_web_v1';
const idbSource = fs.readFileSync(path.join(ROOT, 'js', 'save-storage-idb.js'), 'utf8');
const appSource = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const idbIndex = indexHtml.indexOf('./js/save-storage-idb.js');
const appIndex = indexHtml.indexOf('./js/app.js');
assert(idbIndex >= 0 && appIndex >= 0, 'production index must include IDB storage and app');
assert(idbIndex < appIndex, 'IDB storage must register before app boot');

const hydrateIndex = appSource.indexOf('await bootStorage.hydrate()');
const loadIndex = appSource.indexOf('const engine = TycoonEngine.load()');
assert(hydrateIndex >= 0, 'app boot must await durable storage hydration when IndexedDB is available');
assert(loadIndex > hydrateIndex, 'TycoonEngine.load() must run only after the durable cache hydration gate');

function createFakeIndexedDB(durable) {
  const db = {
    objectStoreNames: { contains: name => name === 'saves' },
    createObjectStore() {},
    transaction() {
      const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
      const finish = (request, result, mutate) => {
        queueMicrotask(() => {
          try {
            mutate?.();
            request.result = result;
            request.onsuccess?.();
            queueMicrotask(() => tx.oncomplete?.());
          } catch (error) {
            tx.error = error;
            tx.onerror?.();
          }
        });
      };
      tx.objectStore = () => ({
        getAll() {
          const request = {};
          finish(request, [...durable.values()]);
          return request;
        },
        getAllKeys() {
          const request = {};
          finish(request, [...durable.keys()]);
          return request;
        },
        put(payload, key) {
          const request = {};
          finish(request, key, () => durable.set(String(key), String(payload)));
          return request;
        },
        delete(key) {
          const request = {};
          finish(request, undefined, () => durable.delete(String(key)));
          return request;
        }
      });
      return tx;
    }
  };
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = db;
        request.onsuccess?.();
      });
      return request;
    }
  };
}

function contextFor({ local, durable, withIDB = true }) {
  const localMap = new Map(Object.entries(local || {}));
  const context = {
    console,
    JSON,
    Map,
    Promise,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    indexedDB: withIDB ? createFakeIndexedDB(durable) : undefined,
    localStorage: {
      getItem: key => localMap.has(key) ? localMap.get(key) : null,
      setItem: (key, value) => localMap.set(key, String(value)),
      removeItem: key => localMap.delete(key)
    },
    __capitalismTycoonModules: {},
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(idbSource, context, { filename: 'save-storage-idb.js' });
  return { context, localMap };
}

(async () => {
  const localOld = JSON.stringify({ saveVersion: 9, week: 12, companyCash: 1200 });
  const durableNew = JSON.stringify({ saveVersion: 9, week: 18, companyCash: 1800 });
  const durable = new Map([[SAVE_KEY, durableNew]]);
  const { context } = contextFor({ local: { [SAVE_KEY]: localOld }, durable, withIDB: true });
  const storage = context.__capitalismTycoonModules.saveStorageIDB;

  assert.equal(JSON.parse(storage.readSync(SAVE_KEY)).week, 12, 'before hydration the fallback mirror is the local save');
  const hydrated = await storage.hydrate();
  assert.equal(hydrated.ok, true);
  assert.equal(storage.status().hydrated, true);
  assert.equal(JSON.parse(storage.readSync(SAVE_KEY)).week, 18, 'after hydration the newer durable save is authoritative');

  const found = await storage.findNewerSave({ week: 12 });
  assert.equal(found.week, 18, 'defense-in-depth recovery still detects a newer durable branch');

  const localOnly = JSON.stringify({ saveVersion: 9, week: 7, companyCash: 700 });
  const fallback = contextFor({ local: { [SAVE_KEY]: localOnly }, durable: new Map(), withIDB: false }).context.__capitalismTycoonModules.saveStorageIDB;
  const fallbackResult = await fallback.hydrate();
  assert.equal(fallbackResult.ok, true, 'unavailable IndexedDB falls back cleanly');
  assert.equal(fallbackResult.source, 'localstorage', 'fallback hydration reports localStorage as the source');
  assert.equal(JSON.parse(fallback.readSync(SAVE_KEY)).week, 7, 'localStorage remains authoritative when IDB is unavailable');

  console.log('save storage IDB authoritative boot tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
