'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const snapshot = game => JSON.parse(JSON.stringify(game.g));

function randomFor(seed = 934006) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
// Transaction completion, not request success, is the durable-write boundary.
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
      }); return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}
async function scenario(account = 'personal') {
  const durable = new Map(), control = { attempts: [] }, host = { draws: 0 }, random = randomFor();
  const loaded = loadGame({ headless: true, random: () => { host.draws++; return random(); },
    indexedDB: indexedDBFor(durable, control) });
  const backend = loaded.modules.saveStorageIDB, key = loaded.engineModule.SAVE_KEY;
  await backend.hydrate();
  // Valid public-company fixture, not a claim that the IPO command ran.
  const state = loaded.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 12, companyCash: 100000000, companyDebt: 0, publicCompany: true,
    sharesOut: 1000000, founderShares: 600000, treasuryBuybackShares: 0, stockPrice: 100, ticker: 'CPTY' });
  state.market = state.market.filter(x => x.id !== 'CPTY');
  state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100, previous: 100,
    dividendYield: 0, volatility: 0, trend: 0, marketCap: 100000000, per: 20, pbr: 2, issuedShares: 1000000,
    dividendPerShare: 0, shareholders: {}, description: 'fixture', listingMarket: '東証グロース',
    priceHistory: [{ week: 12, price: 100 }] });
  state.personalStocks.CPTY = { qty: 20000, avg: 100 };
  if (account === 'company') { state.departments.investment = true; state.companyStocks.CPTY = { qty: 20000, avg: 100 }; }
  state.finance = loaded.modules.finance.defaultFinanceState(state);
  const game = new loaded.engineModule.TycoonEngine(state);
  assert.equal(loaded.modules.finance.validate(snapshot(game)).ok, true);
  assert.equal(game.save(), true); await backend.flush();
  return { ...loaded, game, durable, control, backend, key, host, account };
}
function observe(s) {
  return { state: snapshot(s.game), mirror: s.ctx.__localStorageData.get(s.key),
    cache: s.backend.readSync(s.key), durable: s.durable.get(s.key), draws: s.host.draws };
}
function economic(state) {
  return { shares: state.sharesOut, founder: state.founderShares, treasury: state.treasuryBuybackShares,
    companyCash: state.companyCash, companyDebt: state.companyDebt, personalCash: state.personalCash,
    personalDebt: state.personalDebt, personal: state.personalStocks, company: state.companyStocks,
    market: state.market, personalPL: state.realizedPersonalStockPL, companyPL: state.realizedCompanyStockPL, finance: state.finance, rng: state.simulationRng };
}
async function freshBoot(s, expected) {
  const fresh = loadGame({ headless: true, random: randomFor(),
    indexedDB: indexedDBFor(s.durable, { attempts: [] }),
    localStorageInitial: Object.fromEntries(s.ctx.__localStorageData) });
  await fresh.modules.saveStorageIDB.hydrate(); await fresh.modules.saveStorageIDB.flush();
  const loaded = fresh.engineModule.TycoonEngine.load();
  const normalized = new fresh.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected)));
  assert.deepEqual(JSON.parse(JSON.stringify(economic(loaded.g))), JSON.parse(JSON.stringify(economic(normalized.g))));
}
async function assertRollback(s, before) {
  assert.deepEqual(snapshot(s.game), before.state, 'complete economic state, histories and RNG restored');
  assert.equal(s.host.draws, before.draws, 'no extra host RNG draws');
  assert.equal(s.ctx.__localStorageData.get(s.key), before.mirror, 'exact prior mirror bytes');
  assert.equal(s.backend.readSync(s.key), before.cache, 'exact prior cache bytes');
  await s.backend.flush();
  assert.equal(s.durable.get(s.key), before.cache, 'flush cannot resurrect a failed stock sale');
  await freshBoot(s, before.state);
}
function invoke(s, entry) {
  if (entry === 'outer') return s.game.runTransaction(() => s.game.sellStock('CPTY', 1000, s.account));
  return s.game.sellStock('CPTY', 1000, s.account);
}
function fault(s, name) {
  const g = s.game;
  if (name === 'mirror') {
    const base = s.ctx.localStorage.setItem.bind(s.ctx.localStorage); let once = true;
    s.ctx.localStorage.setItem = (key, value) => {
      if (key === s.key && once) { once = false; throw Object.assign(new Error('mirror rejected'), { name: 'SecurityError' }); }
      base(key, value);
    }; return () => { s.ctx.localStorage.setItem = base; };
  }
  if (name === 'enqueue-false' || name === 'enqueue-throw') {
    const base = s.backend.writeSync;
    const writeSync = (key, value) => {
      base(key, value); // Exercise cancellation after cache/queue admission too.
      if (name === 'enqueue-throw') throw new Error('enqueue rejected');
      return false;
    };
    s.modules.saveStorageIDB = { ...s.backend, writeSync };
    return () => { s.modules.saveStorageIDB = s.backend; };
  }
  if (name === 'save-throw') {
    const base = g.save;
    g.save = function (...args) {
      const r = base.apply(this, args);
      if (!this.inTransaction()) throw new Error('save accepted then threw');
      return r;
    }; return () => { g.save = base; };
  }
  if (name === 'finance-throw') {
    const base = s.modules.finance.event;
    s.modules.finance.event = function (...args) { base.apply(this, args); throw new Error('finance posted then threw'); };
    return () => { s.modules.finance.event = base; };
  }
  const base = g.emit;
  g.emit = function (type, ...args) {
    if (name === 'saved-throw' ? type === 'saved' : type === undefined || type === 'change') throw new Error('event threw');
    return base.call(this, type, ...args);
  }; return () => { g.emit = base; };
}
async function successful(s, entry = 'direct') {
  const before = observe(s), counts = { saved: 0, change: 0 };
  const quote = s.engineModule.stockOrderQuote(s.game.stock('CPTY'), 1000, 'sell');
  const cashKey = s.account === 'company' ? 'companyCash' : 'personalCash';
  const key = s.account === 'company' ? 'companyStocks' : 'personalStocks';
  const prior = before.state[key].CPTY || { qty: 0, avg: 0 };
  const saved = () => counts.saved++, change = () => counts.change++;
  s.game.addEventListener('saved', saved); s.game.addEventListener('change', change);
  assert.equal(invoke(s, entry), true);
  s.game.removeEventListener('saved', saved); s.game.removeEventListener('change', change);
  const state = s.game.g, lot = state[key].CPTY;
  assert.equal(state[cashKey], before.state[cashKey] + quote.cashAmount);
  assert.equal(lot.qty, prior.qty - quote.filledQty);
  assert.equal(lot.avg, prior.avg);
  const plKey = s.account === 'company' ? 'realizedCompanyStockPL' : 'realizedPersonalStockPL';
  assert.equal(state[plKey], before.state[plKey] + (quote.cashAmount - prior.avg * quote.filledQty));
  assert.equal(s.game.stock('CPTY').price, quote.quoteAfter);
  assert.equal(s.game.stock('CPTY').marketCap, quote.quoteAfter * 1000000);
  for (const name of ['companyDebt', 'personalDebt', 'sharesOut', 'founderShares', 'treasuryBuybackShares', 'stockPrice'])
    assert.equal(state[name], before.state[name], name);
  if (s.account === 'personal') {
    assert.equal(state.companyCash, before.state.companyCash);
    assert.deepEqual(JSON.parse(JSON.stringify(state.companyStocks)), before.state.companyStocks);
    assert.deepEqual(JSON.parse(JSON.stringify(state.finance)), before.state.finance);
  } else {
    assert.equal(state.personalCash, before.state.personalCash);
    assert.deepEqual(JSON.parse(JSON.stringify(state.personalStocks)), before.state.personalStocks);
    assert.equal(state.finance.transactions.length, before.state.finance.transactions.length + 1);
    assert.equal(state.finance.transactions.at(-1).sourceType, 'sellStock');
  }
  assert.equal(s.modules.finance.validate(snapshot(s.game)).ok, true);
  assert.deepEqual(counts, { saved: 1, change: 1 });
  assert.equal(s.host.draws, before.draws);
  assert.deepEqual(JSON.parse(JSON.stringify(state.simulationRng)), before.state.simulationRng);
  await s.backend.flush(); await freshBoot(s, state);
  const completed = observe(s);
  assert.equal(s.game.sellStock('CPTY', 0, s.account), false);
  assert.equal(s.game.sellStock('MISSING', 1000, s.account), false);
  assert.equal(s.game.sellStock('CPTY', state[key].CPTY.qty + 1, s.account), false);
  assert.deepEqual(observe(s), completed, 'invalid repeated commands change no state/storage/RNG');
  return state;
}
(async () => {
  // Installed personal and company sale branches, direct and nested transaction entry.
  for (const account of ['personal', 'company']) for (const entry of ['direct', 'outer']) for (const name of [
    'mirror', 'enqueue-false', 'enqueue-throw', 'save-throw', 'saved-throw', 'change-throw', ...(account === 'company' ? ['finance-throw'] : [])
  ]) {
    const s = await scenario(account), before = observe(s), restore = fault(s, name);
    if (['mirror', 'enqueue-false', 'enqueue-throw'].includes(name)) assert.equal(invoke(s, entry), false, `${entry}/${name}`);
    else assert.throws(() => invoke(s, entry), /threw/, `${entry}/${name}`);
    restore(); await assertRollback(s, before);
    // A later save without retrying stock sale must not promote any failed economic changes.
    const sequence = JSON.parse(before.cache).saveSequence;
    assert.equal(s.game.save(), true); assert.equal(s.game.save(), true); await s.backend.flush();
    assert.ok(JSON.parse(s.backend.readSync(s.key)).saveSequence > sequence);
    await freshBoot(s, before.state);
    await successful(s, entry); // The same failed sale remains retryable once the fault clears.
  }
  // Preserve an earlier accepted, in-flight write; cancel only the failed stock sale's put.
  for (const account of ['personal', 'company']) {
    const s = await scenario(account); s.control.holdPut = true;
    s.game.g.personalCash += 123; assert.equal(s.game.save(), true);
    for (let i = 0; i < 100 && !s.control.release; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof s.control.release, 'function');
    const before = observe(s), attempted = s.control.attempts.length, restore = fault(s, 'change-throw');
    assert.throws(() => s.game.sellStock('CPTY', 1000, s.account), /event threw/); restore();
    assert.deepEqual(snapshot(s.game), before.state); assert.equal(s.backend.readSync(s.key), before.cache);
    s.control.release(); await assertRollback(s, before);
    assert.equal(s.control.attempts.length, attempted, 'rejected queued put never reaches durable transaction');
    assert.equal(s.game.save(), true); await s.backend.flush();
    assert.ok(JSON.parse(s.backend.readSync(s.key)).saveSequence > JSON.parse(before.cache).saveSequence + 1,
      'cancelled attempted sequence is not reused');
    await successful(s);
  }
  // Repeated valid orders are distinct actions; buy/sell and exhausted-lot retries keep existing semantics.
  for (const account of ['personal', 'company']) {
    const s = await scenario(account), key = account === 'company' ? 'companyStocks' : 'personalStocks';
    await successful(s); await successful(s);
    assert.equal(s.game.g[key].CPTY.qty, 18000); assert.equal(s.game.g.founderShares, 600000);
    assert.equal(s.game.buyStock('CPTY', 1000, account), true); await successful(s);
    assert.equal(s.game.g[key].CPTY.qty, 18000);
    const before = observe(s), quote = s.engineModule.stockOrderQuote(s.game.stock('CPTY'), 18000, 'sell');
    const cashKey = account === 'company' ? 'companyCash' : 'personalCash';
    const plKey = account === 'company' ? 'realizedCompanyStockPL' : 'realizedPersonalStockPL';
    assert.equal(s.game.sellStock('CPTY', 18000, account), true);
    assert.equal(s.game.g[key].CPTY, undefined, 'exhausted lot is removed');
    assert.equal(s.game.g[cashKey], before.state[cashKey] + quote.cashAmount);
    assert.equal(s.game.g[plKey], before.state[plKey] + (quote.cashAmount - before.state[key].CPTY.avg * 18000));
    assert.equal(s.modules.finance.validate(snapshot(s.game)).ok, true);
    await s.backend.flush(); await freshBoot(s, s.game.g);
    const completed = observe(s);
    assert.equal(s.game.sellStock('CPTY', 18000, account), false);
    assert.deepEqual(observe(s), completed, 'repeated exhausted-lot sale is refused without economic/storage changes');
  }
  // Same seed and mixed installed buy/sell/reload commands retain weekly replay in both accounts.
  for (const account of ['personal', 'company']) {
    const a = await scenario(account), b = await scenario(account);
    const before = observe(a), restore = fault(a, 'change-throw');
    assert.throws(() => a.game.sellStock('CPTY', 1000, account), /event threw/); restore(); await assertRollback(a, before);
    await successful(a); await successful(b);
    assert.equal(a.game.buyStock('CPTY', 1000, account), true); assert.equal(b.game.buyStock('CPTY', 1000, account), true);
    assert.deepEqual(economic(snapshot(a.game)), economic(snapshot(b.game)));
    assert.notEqual(a.game.advanceWeek(false), false); assert.notEqual(b.game.advanceWeek(false), false);
    await a.backend.flush(); await b.backend.flush();
    assert.deepEqual(economic(snapshot(a.game)), economic(snapshot(b.game)), 'rollback/retry mixed trade weekly deterministic replay');
    assert.equal(a.host.draws, b.host.draws, 'same host RNG consumption after replay');
  }
  console.log('Stock-sale save/rollback atomicity tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
