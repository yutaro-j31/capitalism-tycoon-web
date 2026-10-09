'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadGame } = require('./harness');
const { prepareIPO, economic } = require('./fixtures/parent-ipo-atomicity');
const clone = value => JSON.parse(JSON.stringify(value));
function randomFor() {
  let seed = 0x19be5702;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
// Model completion at the transaction boundary; a held put represents an earlier accepted save.
function indexedDBFor(durable, control) {
  const db = {
    objectStoreNames: { contains: name => name === 'saves' }, createObjectStore() {},
    transaction() {
      const tx = {};
      const finish = (request, result, mutate, put = false) => {
        const complete = () => queueMicrotask(() => {
          mutate?.(); request.result = result; request.onsuccess?.();
          queueMicrotask(() => tx.oncomplete?.());
        });
        if (put && control.holdPut) { control.holdPut = false; control.release = complete; }
        else complete();
      };
      tx.objectStore = () => ({
        getAll() { const r = {}; finish(r, [...durable.values()]); return r; },
        getAllKeys() { const r = {}; finish(r, [...durable.keys()]); return r; },
        put(payload, key) {
          control.attempts.push(String(payload)); const r = {};
          finish(r, key, () => durable.set(String(key), String(payload)), true); return r;
        },
        delete(key) { const r = {}; finish(r, undefined, () => durable.delete(String(key))); return r; }
      });
      return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}
async function setup() {
  const durable = new Map(), control = { attempts: [] };
  const s = loadGame({ headless: true, random: randomFor(), indexedDB: indexedDBFor(durable, control) });
  assert.equal(s.engineModule.TycoonEngine.prototype.__peNetworkSourcingInstalled, true,
    'exercise the final DOMContentLoaded wrapper, not isolatedLegacyIndex');
  const game = prepareIPO(s.modules), backend = s.modules.saveStorageIDB, key = s.engineModule.SAVE_KEY;
  await backend.hydrate(); assert.equal(game.save(), true); await backend.flush();
  return { ...s, game, backend, key, durable, control };
}
async function assertLoaded(s, expected) {
  const normalized = new s.engineModule.TycoonEngine(clone(expected));
  assert.deepEqual(economic(s.engineModule.TycoonEngine.load().g), economic(normalized.g), 'production reload');
  // No mirror: a new VM must hydrate from durable IDB alone.
  const fresh = loadGame({ headless: true, random: randomFor(), indexedDB: indexedDBFor(s.durable, { attempts: [] }) });
  await fresh.modules.saveStorageIDB.hydrate();
  assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g), economic(normalized.g), 'fresh durable-only hydration');
  await fresh.modules.saveStorageIDB.flush();
}
function inject(s, name) {
  const g = s.game, save = g.save, emit = g.emit, setItem = s.ctx.localStorage.setItem;
  const array = vm.runInContext('Array.prototype', s.ctx), push = array.push;
  let hits = 0;
  if (name === 'save-false') g.save = () => { hits++; return false; };
  if (name === 'mirror') s.ctx.localStorage.setItem = function (k, value) {
    if (k === s.key) { hits++; throw Object.assign(new Error('IPO mirror rejected'), { name: 'SecurityError' }); }
    return setItem.call(this, k, value);
  };
  if (name === 'enqueue-false' || name === 'enqueue-throw') s.modules.saveStorageIDB = {
    ...s.backend, writeSync(k, value) {
      s.backend.writeSync(k, value); hits++;
      if (name === 'enqueue-throw') throw new Error('IPO enqueue threw after admission');
      return false;
    }
  };
  if (name === 'save-throw') g.save = function (...args) {
    const r = save.apply(this, args);
    if (!this.inTransaction()) { hits++; throw new Error('IPO save accepted then threw'); }
    return r;
  };
  if (name === 'saved' || name === 'change') g.emit = function (type, ...args) {
    if (type === name && !this.inTransaction()) { hits++; throw new Error(`IPO ${name} threw`); }
    return emit.call(this, type, ...args);
  };
  if (name === 'pe-exit' || name === 'network') array.push = function (...args) {
    const target = this === (name === 'pe-exit' ? g.g.peFirm.trackRecord.exits : g.g.peNetwork.nodes);
    const r = push.apply(this, args);
    if (target) { hits++; throw new Error(`IPO ${name} appended then threw`); }
    return r;
  };
  return { hits: () => hits, restore() {
    g.save = save; g.emit = emit; s.ctx.localStorage.setItem = setItem;
    s.modules.saveStorageIDB = s.backend; array.push = push;
  } };
}
async function rejected(name, pending = false, outer = false) {
  const s = await setup();
  if (pending) {
    s.control.holdPut = true; assert.equal(s.game.save(), true);
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(typeof s.control.release, 'function');
  }
  const before = clone(s.game.g), bytes = s.backend.readSync(s.key), durable = s.durable.get(s.key);
  const puts = s.control.attempts.length, fault = inject(s, name);
  let result, error;
  try {
    result = outer ? s.game.runTransaction(() => s.game.executeIPO('東証グロース')) : s.game.executeIPO('東証グロース');
  } catch (e) { error = e; } finally { fault.restore(); }
  assert.ok(fault.hits() > 0, `${name}: injection reached`);
  if (['save-false', 'mirror', 'enqueue-false', 'enqueue-throw'].includes(name)) {
    assert.equal(result, false); assert.equal(error, undefined);
  } else assert.match(error?.message || '', /IPO .*threw/);
  assert.deepEqual(clone(s.game.g), before, `${name}: full live snapshot restored`);
  assert.equal(s.ctx.__localStorageData.get(s.key), bytes, `${name}: exact mirror`);
  assert.equal(s.backend.readSync(s.key), bytes, `${name}: exact cache and saveSequence`);
  assert.equal(s.durable.get(s.key), durable, `${name}: no synchronous durable mutation`);
  s.control.release?.(); await s.backend.flush();
  assert.equal(s.durable.get(s.key), bytes, `${name}: flush preserves prior accepted candidate`);
  assert.equal(s.control.attempts.length, puts, `${name}: rejected put never starts`);
  await assertLoaded(s, before);
  const seq = JSON.parse(bytes).saveSequence;
  assert.equal(s.game.save(), true); await s.backend.flush();
  assert.ok(JSON.parse(s.durable.get(s.key)).saveSequence > seq, 'sequence gaps never rewound');
  await assertLoaded(s, s.game.g); assert.equal(s.game.g.publicCompany, false);
  if (name === 'network' && !pending && !outer) {
    const untouched = await setup();
    assert.equal(s.game.executeIPO('東証グロース'), true);
    assert.equal(untouched.game.executeIPO('東証グロース'), true);
    assert.deepEqual(economic(s.game.g), economic(untouched.game.g), 'retry after rollback preserves original IPO result and RNG');
    await s.backend.flush(); await assertLoaded(s, s.game.g);
  }
  console.log(`parent IPO ${name}${pending ? ' / prior pending put' : ''}${outer ? ' / nested' : ''} PASS`);
}
async function normal() {
  const a = await setup(), b = await setup(), before = clone(a.game.g);
  const price = Math.max(100, a.game.companyValue() / before.sharesOut);
  const primary = Math.max(1, Math.round(before.sharesOut * .2));
  const secondary = Math.max(1, Math.round(before.founderShares * .05));
  const events = [];
  for (const type of ['saved', 'change']) a.game.addEventListener(type, () => events.push(type));
  assert.equal(a.game.executeIPO('東証グロース'), true);
  assert.equal(b.game.executeIPO('東証グロース'), true);
  const g = a.game.g;
  assert.deepEqual(events, ['change', 'saved', 'change'], 'existing base change then one committed saved/change');
  assert.equal(g.sharesOut, before.sharesOut + primary); assert.equal(g.founderShares, before.founderShares - secondary);
  const reward = g.finance.transactions.filter(t => t.sourceType === 'missionReward' && !before.finance.transactions.some(x => x.id === t.id))
    .reduce((n, t) => n + t.cashEffect, 0);
  assert.equal(reward, 10000000, 'existing IPO mission reward');
  assert.equal(g.companyCash, before.companyCash + price * primary * .955 + reward);
  assert.equal(g.personalCash, before.personalCash + price * secondary * .955);
  assert.equal(g.finance.balances.capitalSurplus, before.finance.balances.capitalSurplus + price * primary * .955);
  assert.equal(g.founderOwnershipRatio, g.founderShares / g.sharesOut);
  assert.equal(g.peFirm.trackRecord.exits.length, before.peFirm.trackRecord.exits.length + 1);
  assert.equal(g.peFirm.trackRecord.exits.at(-1).realizedAmount, price * secondary * .955);
  assert.equal(g.peNetwork.nodes.length, before.peNetwork.nodes.length + 1);
  assert.equal(a.modules.finance.validate(g).ok, true);
  assert.deepEqual(economic(g), economic(b.game.g), 'same seed/actions preserve complete economic result and RNG');
  assert.equal(g.saveVersion, 9); assert.equal(a.key, 'capitalism_tycoon_web_v1');
  await a.backend.flush();
  assert.equal(a.durable.get(a.key), a.backend.readSync(a.key));
  assert.equal(a.durable.get(a.key), a.ctx.__localStorageData.get(a.key));
  assert.deepEqual(economic(JSON.parse(a.durable.get(a.key))), economic(g), 'normal commit includes PE exit AND underwriter node');
  await assertLoaded(a, g);
  const completed = clone(g), savedBytes = a.backend.readSync(a.key);
  assert.equal(a.game.executeIPO('東証グロース'), false, 'duplicate IPO is rejected');
  assert.deepEqual(clone(g), completed, 'duplicate does not add cash, shares, reward, PE exit or node');
  assert.equal(a.backend.readSync(a.key), savedBytes);
  console.log('parent IPO normal persistence/reload/deterministic replay PASS');
}
(async () => {
  // Run the confirmed IPO-ATOMICITY-001 first so pristine main produces an attributable RED.
  await rejected('network');
  for (const name of ['save-false', 'mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved', 'change', 'pe-exit']) await rejected(name);
  await rejected('change', true); await rejected('network', true); await rejected('network', false, true);
  await normal();
  console.log('Parent IPO save atomicity PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
