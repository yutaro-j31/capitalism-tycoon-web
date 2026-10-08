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
  let queuedWrites = new Set();
  let lastWriteError = null;
  let lastSequence = new Map();
  let bootSelection = {};

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

  // Which copy is newer (#726). Every save carries saveSequence, a counter that grows by one on
  // each save of that key. Unlike lastSaveDate it does not depend on the device clock. A copy
  // written before the counter existed is compared by lastSaveDate, then by week. On a full tie
  // the durable (IndexedDB) copy is kept.
  const SEQUENCE_PATTERN = /"saveSequence":(\d+)/;
  function sequenceOf(payload) {
    if (typeof payload !== 'string') return null;
    const match = SEQUENCE_PATTERN.exec(payload);
    return match ? Number(match[1]) : null;
  }
  function metaOf(payload) {
    try {
      const state = JSON.parse(payload);
      if (!state || typeof state !== 'object') return null;
      const savedAt = Date.parse(state.lastSaveDate);
      const week = Number(state.week);
      return { savedAt: Number.isFinite(savedAt) ? savedAt : -Infinity, week: Number.isFinite(week) ? week : -Infinity };
    } catch (error) {
      return null;
    }
  }
  function newerCopy(durable, mirror) {
    const hasDurable = typeof durable === 'string' && durable.length > 0;
    const hasMirror = typeof mirror === 'string' && mirror.length > 0;
    if (!hasMirror) return 'indexeddb';
    if (!hasDurable) return 'localStorage';
    if (durable === mirror) return 'indexeddb';
    const durableSequence = sequenceOf(durable), mirrorSequence = sequenceOf(mirror);
    if (durableSequence !== null && mirrorSequence !== null) return mirrorSequence > durableSequence ? 'localStorage' : 'indexeddb';
    const durableMeta = metaOf(durable), mirrorMeta = metaOf(mirror);
    if (!mirrorMeta) return 'indexeddb';
    if (!durableMeta) return 'localStorage';
    if (mirrorMeta.savedAt !== durableMeta.savedAt) return mirrorMeta.savedAt > durableMeta.savedAt ? 'localStorage' : 'indexeddb';
    return mirrorMeta.week > durableMeta.week ? 'localStorage' : 'indexeddb';
  }

  function mirrorRead(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }
  function mirrorSaveKeys() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key === SAVE_KEY || (typeof key === 'string' && key.startsWith(SAVE_KEY + '_slot_'))) keys.push(key);
      }
    } catch (error) {}
    return keys;
  }
  function noteSequence(key, sequence) {
    if (Number.isFinite(sequence) && sequence > (lastSequence.get(key) || 0)) lastSequence.set(key, sequence);
  }

  // Boot the newer copy and write it back to the other store, so both hold the same save.
  function reconcile() {
    const selection = {};
    for (const key of new Set([...cache.keys(), ...mirrorSaveKeys()])) {
      const durable = cache.get(key), mirror = mirrorRead(key);
      const source = newerCopy(durable, mirror);
      const chosen = source === 'localStorage' ? mirror : durable;
      if (source === 'localStorage') writeSync(key, mirror);
      else if (mirror !== durable) {
        try { localStorage.setItem(key, durable); } catch (error) {}
      }
      noteSequence(key, sequenceOf(chosen));
      selection[key] = { source, sequence: sequenceOf(chosen) };
    }
    return selection;
  }

  // The next saveSequence for a key: one more than the highest seen in either store.
  function nextSequence(key = SAVE_KEY) {
    if (!lastSequence.has(key)) lastSequence.set(key, Math.max(sequenceOf(cache.get(key)) || 0, sequenceOf(mirrorRead(key)) || 0));
    const next = lastSequence.get(key) + 1;
    lastSequence.set(key, next);
    return next;
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
        bootSelection = reconcile();
      }
      hydrated = true;
      return { ok: true, source: entries ? 'indexeddb' : 'localstorage', entries: cache.size };
    } catch (error) {
      unavailableReason = error?.message || String(error);
      hydrated = true;
      return { ok: false, source: 'localstorage', reason: unavailableReason, entries: 0 };
    }
  }

  // Synchronous read used by the engine. After hydrate() the cache holds the newer of the two
  // copies; without IndexedDB (or before hydration) whatever localStorage holds is used.
  function readSync(key = SAVE_KEY) {
    const cached = cache.get(key);
    if (typeof cached === 'string' && cached.length) return cached;
    return mirrorRead(key);
  }

  // Synchronous from the caller's point of view: the cache is updated at once and the
  // durable write is queued. Failures surface through lastWriteError and the save-error
  // event rather than by blocking the game loop.
  function writeSync(key, payload) {
    const write = { key, cancelled: false };
    queuedWrites.add(write);
    cache.set(key, payload);
    noteSequence(key, sequenceOf(payload));
    pendingWrite = pendingWrite
      .then(() => write.cancelled ? null : runTransaction('readwrite', store => store.put(payload, key)))
      .then(() => { if (!write.cancelled) lastWriteError = null; })
      .catch(error => { lastWriteError = error?.message || String(error); })
      .finally(() => queuedWrites.delete(write));
    return true;
  }

  // Economic boundaries are synchronous: rollback runs before their queued IDB transactions
  // can start. Cancel only writes added by this boundary, keeping earlier accepted saves queued.
  // Do not rewind saveSequence: failed attempts must never reuse a sequence already observed.
  function checkpoint(key = SAVE_KEY) {
    const hadCache = cache.has(key), previous = cache.get(key), earlier = new Set(queuedWrites);
    return () => {
      for (const write of queuedWrites) if (write.key === key && !earlier.has(write)) write.cancelled = true;
      if (hadCache) cache.set(key, previous); else cache.delete(key);
    };
  }

  function removeSync(key) {
    const write = { key, cancelled: false };
    queuedWrites.add(write);
    cache.delete(key);
    pendingWrite = pendingWrite
      .then(() => write.cancelled ? null : runTransaction('readwrite', store => store.delete(key)))
      .catch(error => { lastWriteError = error?.message || String(error); })
      .finally(() => queuedWrites.delete(write));
    return true;
  }

  function flush() {
    return pendingWrite;
  }

  // Defense-in-depth for legacy/alternate boot paths that did not wait for hydration:
  // compare the loaded state with the durable cache and surface any newer IndexedDB branch.
  // Production app boot now awaits hydrate() before TycoonEngine.load() (#726).
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
      lastWriteError,
      bootSelection
    };
  }

  function resetForTests() {
    cache = new Map();
    hydrated = false;
    databasePromise = null;
    unavailableReason = null;
    pendingWrite = Promise.resolve();
    queuedWrites = new Set();
    lastWriteError = null;
    lastSequence = new Map();
    bootSelection = {};
  }

  // Creates a fully separate durable backend for measurement tools.  The caller chooses a
  // database and store that cannot alias the production save database; none of the production
  // cache, key, pending-write chain, or fallback localStorage paths are shared.
  function createIsolatedBackend({ databaseName, storeName, version = 1 } = {}) {
    if (!databaseName || databaseName === DB_NAME) throw new Error('isolated storage requires a non-production database name');
    if (!storeName || storeName === STORE_NAME) throw new Error('isolated storage requires a non-production store name');
    let isolatedCache = new Map(), dbPromise = null, pending = Promise.resolve(), reason = null, ready = false, lastError = null;
    const queued = new Set();
    function open() {
      if (dbPromise) return dbPromise;
      if (!indexedDBAvailable()) { reason = 'IndexedDB is not available in this browser context.'; return (dbPromise = Promise.resolve(null)); }
      dbPromise = new Promise(resolve => {
        let settled = false;
        const finish = value => { if (!settled) { settled = true; resolve(value); } };
        const timer = setTimeout(() => { reason = 'Benchmark IndexedDB did not respond in time.'; finish(null); }, 3000);
        try {
          const request = indexedDB.open(databaseName, version);
          request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName); };
          request.onsuccess = () => { clearTimeout(timer); finish(request.result); };
          request.onerror = () => { clearTimeout(timer); reason = request.error?.message || 'Benchmark IndexedDB could not be opened.'; finish(null); };
          request.onblocked = () => { clearTimeout(timer); reason = 'Benchmark IndexedDB is blocked by another tab.'; finish(null); };
        } catch (error) { clearTimeout(timer); reason = error?.message || String(error); finish(null); }
      });
      return dbPromise;
    }
    function transaction(mode, work) {
      return open().then(database => {
        if (!database) return null;
        return new Promise((resolve, reject) => {
          let result = null;
          const tx = database.transaction(storeName, mode);
          tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
          try { const request = work(tx.objectStore(storeName)); if (request) request.onsuccess = () => { result = request.result; }; }
          catch (error) { reject(error); }
        });
      });
    }
    async function hydrate() {
      if (ready) return { ok: !reason, entries: isolatedCache.size };
      try {
        const values = await transaction('readonly', store => store.getAll());
        const keys = await transaction('readonly', store => store.getAllKeys());
        if (!Array.isArray(values) || !Array.isArray(keys)) throw new Error(reason || 'Benchmark durable storage unavailable.');
        keys.forEach((key, index) => { if (typeof values[index] === 'string') isolatedCache.set(String(key), values[index]); });
        ready = true; return { ok: true, entries: isolatedCache.size };
      } catch (error) { reason = error?.message || String(error); ready = true; return { ok: false, reason, entries: 0 }; }
    }
    function readSync(key) { return isolatedCache.get(String(key)) ?? null; }
    function writeSync(key, payload) {
      const write = { key: String(key), cancelled: false }; queued.add(write);
      isolatedCache.set(String(key), String(payload));
      pending = pending.then(() => write.cancelled ? null : transaction('readwrite', store => store.put(String(payload), String(key))))
        .then(result => { if (write.cancelled) return; if (result === null && reason) throw new Error(reason); lastError = null; })
        .catch(error => { lastError = error?.message || String(error); throw error; })
        .finally(() => queued.delete(write));
      return true;
    }
    function removeSync(key) {
      const write = { key: String(key), cancelled: false }; queued.add(write);
      isolatedCache.delete(String(key));
      pending = pending.then(() => write.cancelled ? null : transaction('readwrite', store => store.delete(String(key))))
        .finally(() => queued.delete(write));
      return true;
    }
    function checkpoint(key) {
      key = String(key);
      const hadCache = isolatedCache.has(key), previous = isolatedCache.get(key), earlier = new Set(queued);
      return () => {
        for (const write of queued) if (write.key === key && !earlier.has(write)) write.cancelled = true;
        if (hadCache) isolatedCache.set(key, previous); else isolatedCache.delete(key);
      };
    }
    const flush = () => pending;
    const status = () => ({ hydrated: ready, available: indexedDBAvailable() && !reason, unavailableReason: reason, cachedKeys: [...isolatedCache.keys()], lastWriteError: lastError, databaseName, storeName });
    return Object.freeze({ hydrate, readSync, writeSync, removeSync, flush, status, checkpoint, databaseName, storeName, __isolated: true });
  }

  modules.saveStorageIDB = Object.freeze({
    DB_NAME, DB_VERSION, STORE_NAME, SAVE_KEY,
    hydrate, readSync, writeSync, removeSync, flush, status, findNewerSave, resetForTests, createIsolatedBackend,
    nextSequence, sequenceOf, newerCopy, checkpoint,
    __installed: true
  });
})();
