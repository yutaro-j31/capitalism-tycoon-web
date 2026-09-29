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
      removeItem: key => localMap.delete(key),
      get length() { return localMap.size; },
      key: index => [...localMap.keys()][index] ?? null
    },
    __capitalismTycoonModules: {},
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(idbSource, context, { filename: 'save-storage-idb.js' });
  return { context, localMap };
}

function prodSave(weeks, companyName) {
  const { loadGame } = require('./harness');
  const game = loadGame({ headless: true });
  const engine = new game.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Boot', companyName, difficulty: 'normal', scenario: 'free' });
  for (let week = 1; week < weeks; week++) engine.advanceWeek(false);
  engine.save();
  return game.ctx.__localStorageData.get(SAVE_KEY);
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

  // The engine app.js boots is the production class (TycoonEngineV9 from save-v9.js), not the
  // base class in engine.js. Its load() must read through the durable store too: #770 changed
  // only the base load(), so the real page kept booting the localStorage copy.
  {
    const { loadGame } = require('./harness');
    const game = loadGame({ headless: true, localStorageInitial: { [SAVE_KEY]: prodSave(5, 'Local Older Co') } });
    const Engine = game.engineModule.TycoonEngine;
    assert.equal(Engine.name, 'TycoonEngineV9', 'precondition: the production engine class is the v9 subclass');
    game.modules.saveStorageIDB.writeSync(SAVE_KEY, prodSave(9, 'Durable Newer Co'));
    const booted = Engine.load();
    assert.equal(booted.g.companyName, 'Durable Newer Co', 'the production engine boots the durable save, not the localStorage copy');
    assert.equal(booted.g.week, 9);
  }

  // #726 owner decision B: boot the newer copy and write it back to the other store.
  // saveSequence decides; without it lastSaveDate, then week. A full tie keeps IndexedDB.
  const bootCase = async (label, local, durablePayload) => {
    const durableMap = new Map(durablePayload === undefined ? [] : [[SAVE_KEY, durablePayload]]);
    const { context: ctx, localMap } = contextFor({ local: local === undefined ? {} : { [SAVE_KEY]: local }, durable: durableMap, withIDB: true });
    const store = ctx.__capitalismTycoonModules.saveStorageIDB;
    await store.hydrate();
    await store.flush();
    const booted = store.readSync(SAVE_KEY);
    assert.equal(localMap.get(SAVE_KEY), booted, `${label}: localStorage holds the booted copy`);
    assert.equal(durableMap.get(SAVE_KEY), booted, `${label}: IndexedDB holds the booted copy`);
    return { booted: JSON.parse(booted), source: store.status().bootSelection[SAVE_KEY].source, store };
  };
  const copy = fields => JSON.stringify({ saveVersion: 9, companyCash: 1, ...fields });

  let result = await bootCase('sequence beats week', copy({ week: 12, saveSequence: 9 }), copy({ week: 18, saveSequence: 5 }));
  assert.equal(result.source, 'localStorage');
  assert.equal(result.booted.saveSequence, 9, 'the higher saveSequence boots even with a lower week');
  assert.equal(result.store.nextSequence(SAVE_KEY), 10, 'the next save continues after the highest sequence seen');
  assert.equal(result.store.nextSequence(SAVE_KEY), 11, 'and keeps counting');

  result = await bootCase('sequence beats clock', copy({ week: 12, saveSequence: 4, lastSaveDate: '2030-01-01T00:00:00.000Z' }), copy({ week: 12, saveSequence: 7, lastSaveDate: '2020-01-01T00:00:00.000Z' }));
  assert.equal(result.source, 'indexeddb', 'a device clock set ahead does not win over a higher sequence');
  assert.equal(result.booted.saveSequence, 7);

  result = await bootCase('old saves: lastSaveDate', copy({ week: 10, lastSaveDate: '2026-09-02T00:00:00.000Z' }), copy({ week: 20, lastSaveDate: '2026-09-01T00:00:00.000Z' }));
  assert.equal(result.source, 'localStorage', 'without saveSequence the later lastSaveDate boots');
  assert.equal(result.booted.week, 10);

  result = await bootCase('old saves: same date, week', copy({ week: 21, lastSaveDate: '2026-09-01T00:00:00.000Z' }), copy({ week: 20, lastSaveDate: '2026-09-01T00:00:00.000Z' }));
  assert.equal(result.source, 'localStorage', 'with the same lastSaveDate the later week boots');

  result = await bootCase('one side without sequence', copy({ week: 10, saveSequence: 3, lastSaveDate: '2026-09-01T00:00:00.000Z' }), copy({ week: 10, lastSaveDate: '2026-09-02T00:00:00.000Z' }));
  assert.equal(result.source, 'indexeddb', 'when either copy lacks saveSequence, lastSaveDate decides');

  result = await bootCase('full tie keeps IndexedDB', copy({ week: 10, saveSequence: 3, companyCash: 111 }), copy({ week: 10, saveSequence: 3, companyCash: 222 }));
  assert.equal(result.source, 'indexeddb');
  assert.equal(result.booted.companyCash, 222);

  result = await bootCase('only localStorage (first run of this build)', copy({ week: 8, saveSequence: 2 }), undefined);
  assert.equal(result.source, 'localStorage', 'a save only in localStorage is copied into IndexedDB');

  result = await bootCase('only IndexedDB (localStorage cleared)', undefined, copy({ week: 8, saveSequence: 2 }));
  assert.equal(result.source, 'indexeddb', 'a save only in IndexedDB is written back to localStorage');

  // The production save stamps saveSequence into the payload only; the live state and a loaded
  // state never carry it, so simulation state and determinism comparisons are unchanged.
  {
    const { loadGame } = require('./harness');
    const game = loadGame({ headless: true });
    const engine = new game.engineModule.TycoonEngine();
    engine.configure({ playerName: 'Seq', companyName: 'Seq Co', difficulty: 'normal', scenario: 'free' });
    engine.save();
    const first = JSON.parse(game.ctx.__localStorageData.get(SAVE_KEY)).saveSequence;
    engine.save();
    const second = JSON.parse(game.ctx.__localStorageData.get(SAVE_KEY)).saveSequence;
    assert.ok(Number.isInteger(first) && first >= 1, 'the saved payload carries saveSequence');
    assert.equal(second, first + 1, 'each save increases saveSequence by one');
    assert.equal('saveSequence' in engine.g, false, 'the live state does not keep saveSequence');
    const reloaded = game.engineModule.TycoonEngine.load();
    assert.equal('saveSequence' in reloaded.g, false, 'a loaded state does not carry saveSequence');
    reloaded.save();
    assert.equal(JSON.parse(game.ctx.__localStorageData.get(SAVE_KEY)).saveSequence, second + 1, 'a reloaded game continues the sequence');
  }

  console.log('save storage IDB authoritative boot tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
