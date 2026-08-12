// Save storage backed by IndexedDB, with localStorage kept as a mirror.
//
// A late-game save outgrew the roughly 5MB localStorage quota on iOS, which left players
// unable to save at all. IndexedDB has no comparable limit, but it is asynchronous while
// the engine's load() and save() are synchronous and called from everywhere. Rather than
// make the whole engine async, this module hydrates IndexedDB into a synchronous cache
// once before the app boots, and writes back asynchronously afterwards:
//
//   boot   await hydrate() -> cache  ->  TycoonEngine.load() reads the cache synchronously
//   save   engine.save() returns immediately; the write is queued to IndexedDB
//
// localStorage keeps receiving the same payload while it still fits, so an existing save
// stays readable by older builds and nothing is stranded if IndexedDB is unavailable. If
// IndexedDB cannot be opened at all — private browsing on some versions, or a storage
// policy — everything falls back to the previous localStorage-only behaviour.
(function () {
  'use strict';
  if (!globalThis.__capitalismTycoonModules) {
    throw new Error('Capitalism Tycoon runtime.js must be loaded before save-storage-idb.js.');
  }
  const modules = globalThis.__capitalismTycoonModules;
  if (modules.saveStorageIDB) throw new Error('save storage IDB is already installed.');

  const DB_NAME = 'capitalism-tycoon';
  const DB_VERSION = 1;
  const STORE_NAME = 'saves';
  const SAVE_KEY = 'capitalism_tycoon_web_v1';

  let cache = new Map();
  let hydrated = false;
  let databasePromise = null;
  let unavailableReason = null;
  let pendingWrite = Promise.resolve();
  let lastWriteError = null;

  function indexedDBAvailable() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (error) {
      return false;
    }
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (!indexedDBAvailable()) {
      unavailableReason = 'IndexedDB is not available in this browser context.';
      databasePromise = Promise.resolve(null);
      return databasePromise;
    }
    databasePromise = new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      // A browser that never fires either event would hang the boot, so give up and let
      // localStorage carry the save rather than leave the player on a blank screen.
      const timer = setTimeout(() => {
        unavailableReason = 'IndexedDB did not respond in time.';
        finish(null);
      }, 3000);
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          finish(request.result);
        };
        request.onerror = () => {
          clearTimeout(timer);
          unavailableReason = request.error?.message || 'IndexedDB could not be opened.';
          finish(null);
        };
        request.onblocked = () => {
          clearTimeout(timer);
          unavailableReason = 'IndexedDB is blocked by another tab.';
          finish(null);
        };
      } catch (error) {
        clearTimeout(timer);
        unavailableReason = error?.message || String(error);
        finish(null);
      }
    });
    return databasePromise;
  }

  function runTransaction(mode, work) {
    return openDatabase().then(database => {
      if (!database) return null;
      return new Promise((resolve, reject) => {
        let result = null;
        const transaction = database.transaction(STORE_NAME, mode);
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
        try {
          const request = work(transaction.objectStore(STORE_NAME));
          if (request) request.onsuccess = () => { result = request.result; };
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // Read every stored save into the synchronous cache. Called once before the app boots.
  async function hydrate() {
    if (hydrated) return { ok: true, source: 'cache', entries: cache.size };
    try {
      const entries = await runTransaction('readonly', store => store.getAll());
      const keys = await runTransaction('readonly', store => store.getAllKeys());
      if (Array.isArray(entries) && Array.isArray(keys)) {
        for (let index = 0; index < keys.length; index += 1) {
          if (typeof entries[index] === 'string') cache.set(String(keys[index]), entries[index]);
        }
      }
      hydrated = true;
      return { ok: true, source: entries ? 'indexeddb' : 'localstorage', entries: cache.size };
    } catch (error) {
      unavailableReason = error?.message || String(error);
      hydrated = true;
      return { ok: false, source: 'localstorage', reason: unavailableReason, entries: 0 };
    }
  }

  // Synchronous read used by the engine. IndexedDB first, then whatever localStorage holds,
  // so an existing save written by an older build is still found on the first run.
  function readSync(key = SAVE_KEY) {
    const cached = cache.get(key);
    if (typeof cached === 'string' && cached.length) return cached;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  // Synchronous from the caller's point of view: the cache is updated at once and the
  // durable write is queued. Failures surface through lastWriteError and the save-error
  // event rather than by blocking the game loop.
  function writeSync(key, payload) {
    cache.set(key, payload);
    pendingWrite = pendingWrite
      .then(() => runTransaction('readwrite', store => store.put(payload, key)))
      .then(() => { lastWriteError = null; })
      .catch(error => { lastWriteError = error?.message || String(error); });
    return true;
  }

  function removeSync(key) {
    cache.delete(key);
    pendingWrite = pendingWrite
      .then(() => runTransaction('readwrite', store => store.delete(key)))
      .catch(error => { lastWriteError = error?.message || String(error); });
    return true;
  }

  function flush() {
    return pendingWrite;
  }

  // The engine loads synchronously from localStorage before hydration can finish, so a save
  // that only reached IndexedDB — which is exactly what happens once localStorage is full —
  // would be invisible at boot. After hydration, compare what was loaded against what
  // IndexedDB holds and report a newer one so the player can be asked, rather than silently
  // continuing from an older week.
  async function findNewerSave(loadedState, key = SAVE_KEY) {
    await hydrate();
    const stored = cache.get(key);
    if (typeof stored !== 'string' || !stored.length) return null;
    let parsed = null;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      return null;
    }
    const storedState = parsed?.state && typeof parsed.state === 'object' ? parsed.state : parsed;
    const storedWeek = Number(storedState?.week);
    const loadedWeek = Number(loadedState?.week);
    if (!Number.isFinite(storedWeek)) return null;
    if (Number.isFinite(loadedWeek) && storedWeek <= loadedWeek) return null;
    return { week: storedWeek, loadedWeek: Number.isFinite(loadedWeek) ? loadedWeek : 0, payload: stored };
  }

  function status() {
    return {
      hydrated,
      available: indexedDBAvailable() && !unavailableReason,
      unavailableReason,
      cachedKeys: [...cache.keys()],
      lastWriteError
    };
  }

  function resetForTests() {
    cache = new Map();
    hydrated = false;
    databasePromise = null;
    unavailableReason = null;
    pendingWrite = Promise.resolve();
    lastWriteError = null;
  }

  modules.saveStorageIDB = Object.freeze({
    DB_NAME, DB_VERSION, STORE_NAME, SAVE_KEY,
    hydrate, readSync, writeSync, removeSync, flush, status, findNewerSave, resetForTests,
    __installed: true
  });
})();
