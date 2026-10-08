'use strict';

const assert = require('node:assert/strict');
const { createScenario, customPlan, selectAndApprove, snapshot } = require('./ma-acquisition-financing-fixture');

// The authoritative-boot fixture's transaction model, with deterministic put faults/delays.
// Mutate durable bytes only on successful completion, as an IDB transaction does.
function indexedDBFor(durable, control) {
  const db = {
    objectStoreNames: { contains: name => name === 'saves' },
    createObjectStore() {},
    transaction() {
      const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
      const finish = (request, result, mutate, put = false) => {
        const complete = () => queueMicrotask(() => {
          if (put && control.failPut) {
            control.failPut = false;
            tx.error = new Error('injected IndexedDB put failure');
            tx.onabort?.();
            return;
          }
          mutate?.();
          request.result = result;
          request.onsuccess?.();
          queueMicrotask(() => tx.oncomplete?.());
        });
        if (put && control.holdPut) {
          control.holdPut = false;
          control.release = complete;
        } else complete();
      };
      tx.objectStore = () => ({
        getAll() { const r = {}; finish(r, [...durable.values()]); return r; },
        getAllKeys() { const r = {}; finish(r, [...durable.keys()]); return r; },
        put(payload, key) {
          control.attempts.push(String(payload));
          const r = {};
          finish(r, key, () => durable.set(String(key), String(payload)), true);
          return r;
        },
        delete(key) { const r = {}; finish(r, undefined, () => durable.delete(String(key))); return r; }
      });
      return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}

function randomFor(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
async function scenario() {
  const durable = new Map(), control = { attempts: [] };
  const loaded = createScenario({ loadOptions: { headless: true, random: randomFor(934001), indexedDB: indexedDBFor(durable, control) } });
  const backend = loaded.modules.saveStorageIDB, key = loaded.engineModule.SAVE_KEY;
  await backend.hydrate();
  selectAndApprove(loaded, customPlan());
  assert.equal(loaded.game.save(), true);
  await backend.flush();
  return { ...loaded, durable, control, backend, key };
}
function observe(s) {
  return { state: snapshot(s.game), local: s.ctx.__localStorageData.get(s.key), cache: s.backend.readSync(s.key), durable: s.durable.get(s.key) };
}
function economic(g) {
  return { shares: g.sharesOut, treasury: g.treasuryBuybackShares, founder: g.founderShares,
    cash: g.companyCash, debt: g.companyDebt, personal: g.personalCash,
    subsidiaries: g.maSubsidiaries, finance: g.finance, rng: g.simulationRng };
}
async function freshBoot(s, expected) {
  const control = { attempts: [] };
  const fresh = createScenario({ loadOptions: { headless: true, random: randomFor(934001),
    indexedDB: indexedDBFor(s.durable, control), localStorageInitial: Object.fromEntries(s.ctx.__localStorageData) } });
  await fresh.modules.saveStorageIDB.hydrate();
  await fresh.modules.saveStorageIDB.flush();
  const loaded = fresh.engineModule.TycoonEngine.load();
  // The existing load boundary adds optional subsidiary budget/review defaults. Compare the
  // complete economic data after that same normalization, rather than changing those defaults.
  const normalized = new fresh.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected)));
  assert.deepEqual(JSON.parse(JSON.stringify(economic(loaded.g))), JSON.parse(JSON.stringify(economic(normalized.g))));
  return fresh;
}
function failMirrorOnce(s) {
  const original = s.ctx.localStorage.setItem.bind(s.ctx.localStorage);
  let injected = false;
  s.ctx.localStorage.setItem = (key, value) => {
    if (key === s.key && !injected) {
      injected = true;
      throw Object.assign(new Error('injected mirror failure'), { name: 'SecurityError' });
    }
    original(key, value);
  };
  return () => assert.equal(injected, true);
}
async function assertRolledBack(s, before) {
  assert.deepEqual(snapshot(s.game), before.state, 'all live quantities, cash, journals and RNG roll back');
  assert.equal(s.ctx.__localStorageData.get(s.key), before.local, 'exact mirror bytes retained');
  assert.equal(s.backend.readSync(s.key), before.cache, 'synchronous reload cannot see rejected save');
  await s.backend.flush();
  assert.equal(s.durable.get(s.key), before.cache, 'flush contains only the earlier accepted save');
  assert.deepEqual(JSON.parse(JSON.stringify(economic(s.engineModule.TycoonEngine.load().g))), JSON.parse(JSON.stringify(economic(before.state))));
  await freshBoot(s, before.state);
}

(async () => {
  // Actual financed M&A: non-quota mirror failure must not reach cache or durable queue.
  {
    const s = await scenario(), before = observe(s), attempts = s.control.attempts.length;
    const injected = failMirrorOnce(s);
    assert.equal(s.game.closeMADeal(s.deal.id), false);
    injected();
    await assertRolledBack(s, before);
    assert.equal(s.control.attempts.length, attempts, 'no rejected IDB put was enqueued');
    assert.equal(s.game.closeMADeal(s.deal.id), true, 'normal M&A works after storage fault');
    await s.backend.flush();
    assert.equal(s.game.g.sharesOut, 1020000);
    assert.equal(s.game.g.maSubsidiaries.length, 1);
    assert.equal(s.modules.finance.validate(s.game.g).ok, true);
    assert.equal(s.game.g.personalCash, before.state.personalCash);
    assert.equal(s.game.save(), true);
    await s.backend.flush();
    await freshBoot(s, s.game.g);
  }

  // Save was accepted, then the same synchronous economic command rolls back.
  // Cancel its pending put without cancelling an earlier accepted save still in flight.
  for (const earlierPending of [false, true]) {
    const s = await scenario();
    if (earlierPending) {
      s.control.holdPut = true;
      s.game.g.news.unshift('earlier accepted save');
      assert.equal(s.game.save(), true);
      for (let i = 0; i < 30 && !s.control.release; i++) await Promise.resolve();
      assert.equal(typeof s.control.release, 'function', 'earlier IDB transaction is in flight');
    }
    const before = observe(s), attempts = s.control.attempts.length;
    const emit = s.game.emit;
    s.game.emit = function (type, ...args) {
      if (type === undefined) throw new Error('injected post-save command failure');
      return emit.call(this, type, ...args);
    };
    assert.equal(s.game.closeMADeal(s.deal.id), false);
    s.game.emit = emit;
    s.control.release?.();
    await assertRolledBack(s, before);
    assert.equal(s.control.attempts.length, attempts, 'cancelled M&A never starts its put');
    const sequence = JSON.parse(before.cache).saveSequence;
    assert.equal(s.game.save(), true);
    await s.backend.flush();
    assert.ok(JSON.parse(s.backend.readSync(s.key)).saveSequence > sequence + 1, 'rollback never reuses attempted sequence');
    await freshBoot(s, s.game.g);
  }

  // Synchronous enqueue rejection/throw: restore a mirror already written, and cancel any
  // put a backend added before throwing. Exercise the installed M&A save path in both cases.
  for (const mode of ['reject', 'throw-after-enqueue']) {
    const s = await scenario(), before = observe(s), attempts = s.control.attempts.length;
    s.modules.saveStorageIDB = { ...s.backend, writeSync(key, payload) {
      if (mode === 'reject') return false;
      s.backend.writeSync(key, payload);
      throw new Error('injected enqueue failure');
    } };
    assert.equal(s.game.closeMADeal(s.deal.id), false);
    s.modules.saveStorageIDB = s.backend;
    await assertRolledBack(s, before);
    assert.equal(s.control.attempts.length, attempts);
    assert.equal(s.game.closeMADeal(s.deal.id), true);
    await s.backend.flush();
    await freshBoot(s, JSON.parse(s.backend.readSync(s.key)));
  }

  // Import is another consumer of the same checkpoint; no compensating old-save put should
  // leave the rejected imported state transiently durable before the restore reaches the queue.
  {
    const s = await scenario(), before = observe(s), emit = s.game.emit;
    s.game.emit = function (type, ...args) {
      if (type === 'saved') throw new Error('injected import post-save failure');
      return emit.call(this, type, ...args);
    };
    const imported = JSON.parse(JSON.stringify(s.game.g));
    imported.week++;
    assert.throws(() => s.game.importSave(JSON.stringify(imported)), /injected import/);
    s.game.emit = emit;
    await assertRolledBack(s, before);
    assert.equal(s.game.save(), true);
    await s.backend.flush();
  }

  // Shared transaction boundary: a real P2 buyback must reject a failed final save.
  {
    const s = await scenario();
    s.game.shareholderReturnCapacity();
    assert.equal(s.game.save(), true);
    await s.backend.flush();
    const before = observe(s), injected = failMirrorOnce(s);
    assert.equal(s.game.buybackOwnShares(1000000), false);
    injected();
    await assertRolledBack(s, before);
    assert.equal(s.game.buybackOwnShares(1000000), true);
    await s.backend.flush();
    assert.equal(s.game.g.treasuryBuybackShares, 1000);
    assert.equal(s.modules.finance.validate(s.game.g).ok, true);
  }

  // The canonical weekly boundary also includes final persistence, not just the work callback.
  {
    const s = await scenario(), before = observe(s), injected = failMirrorOnce(s);
    assert.equal(s.game.advanceWeek(false), false);
    injected();
    await assertRolledBack(s, before);
    assert.equal(s.game.advanceWeek(false), true);
    await s.backend.flush();
    await freshBoot(s, s.game.g);
  }

  // A rolled-back transaction cannot leave a pending save deletion behind either.
  {
    const s = await scenario(), before = observe(s);
    assert.throws(() => s.game.runTransaction(() => {
      s.backend.removeSync(s.key);
      throw new Error('injected rollback after queued deletion');
    }), /queued deletion/);
    await assertRolledBack(s, before);
  }

  // Asynchronous IDB errors retain existing enqueue-success/flush/status semantics.
  // The accepted M&A is in the mirror and cache; fresh hydration uses its higher sequence.
  {
    const s = await scenario(), oldDurable = s.durable.get(s.key);
    s.control.failPut = true;
    assert.equal(s.game.closeMADeal(s.deal.id), true);
    const accepted = s.backend.readSync(s.key);
    await s.backend.flush();
    assert.match(s.backend.status().lastWriteError, /injected IndexedDB/);
    assert.equal(s.durable.get(s.key), oldDurable, 'aborted IDB transaction preserves prior bytes');
    assert.equal(s.ctx.__localStorageData.get(s.key), accepted);
    assert.equal(s.backend.readSync(s.key), accepted, 'accepted state is still reloadable');
    await freshBoot(s, JSON.parse(accepted));
    assert.equal(s.durable.get(s.key), accepted, 'boot repairs a stale replica from the accepted newer mirror');
    assert.equal(s.game.save(), true);
    await s.backend.flush();
    assert.equal(s.backend.status().lastWriteError, null);
    assert.equal(s.durable.get(s.key), s.ctx.__localStorageData.get(s.key));
  }

  // Quota fallback still accepts an IDB-only save; consecutive saves remain ordered.
  {
    const s = await scenario(), mirror = s.ctx.__localStorageData.get(s.key);
    s.ctx.localStorage.setItem = () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); };
    assert.equal(s.game.closeMADeal(s.deal.id), true);
    assert.equal(s.game.save(), true);
    const first = JSON.parse(s.backend.readSync(s.key)).saveSequence;
    assert.equal(s.game.save(), true);
    assert.equal(JSON.parse(s.backend.readSync(s.key)).saveSequence, first + 1);
    await s.backend.flush();
    assert.equal(s.ctx.__localStorageData.get(s.key), mirror);
    assert.equal(s.durable.get(s.key), s.backend.readSync(s.key));
    await freshBoot(s, s.game.g);
  }

  console.log('save storage commit atomicity tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
