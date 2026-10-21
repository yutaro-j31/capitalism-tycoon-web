'use strict';
// P4-AUD-007 D-1 (Q10 minimal): selling a property that carries an off-book p.mortgageBalance must
// not consume other loans' companyDebt / personalDebt, must keep the cash payoff, must post only
// on-book principal as liabilityEffect, and must quarantine ledger states that are not provably S1.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const snap = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const BLOCK = '担保住宅ローンの会計記録を照合できないため';
const UNRELATED = 50_000_000;

function indexedDBFor(durable) {
  const db = {
    objectStoreNames: { contains: name => name === 'saves' }, createObjectStore() {},
    transaction() {
      const tx = {};
      const finish = (request, result, mutate) => queueMicrotask(() => {
        mutate?.(); request.result = result; request.onsuccess?.();
        queueMicrotask(() => tx.oncomplete?.());
      });
      tx.objectStore = () => ({
        getAll() { const r = {}; finish(r, [...durable.values()]); return r; },
        getAllKeys() { const r = {}; finish(r, [...durable.keys()]); return r; },
        put(payload, key) { const r = {}; finish(r, key, () => durable.set(String(key), String(payload))); return r; },
        delete(key) { const r = {}; finish(r, undefined, () => durable.delete(String(key))); return r; }
      });
      return tx;
    }
  };
  return { open() { const r = {}; queueMicrotask(() => { r.result = db; r.onsuccess?.(); }); return r; } };
}

// state: 'S1' (ledger predates the mortgage), 'S2' (finance re-created after it), 'S2s' (S2 for P1,
// then a further S1 mortgage on P2: the ledger difference covers only part of the off-book total),
// 'none' (no off-book mortgage), 'S1+onbook' (S1 plus an on-book market loan on the same property).
async function scenario(owner, state) {
  const durable = new Map();
  const s = loadGame({ headless: true, indexedDB: indexedDBFor(durable) });
  await s.modules.saveStorageIDB.hydrate();
  const { finance } = s.modules;
  const g = s.engineModule.createInitialState({ configured: true });
  Object.assign(g, { week: 20, companyCash: 400_000_000, personalCash: 400_000_000, companyDebt: 0, personalDebt: 0 });
  const base = g.properties[0];
  g.properties = [
    { ...base, id: 'P1', name: 'Mortgage One', owner, value: 300_000_000, marketValue: 300_000_000, purchasePrice: 300_000_000,
      realEstate: { ...(base.realEstate || {}), landBookValue: 100_000_000, buildingBookValue: 150_000_000 } },
    { ...base, id: 'P2', name: 'Mortgage Two', owner, value: 200_000_000, marketValue: 200_000_000, purchasePrice: 200_000_000,
      realEstate: { ...(base.realEstate || {}), landBookValue: 80_000_000, buildingBookValue: 100_000_000 } }
  ];
  for (const p of g.properties) Object.assign(p, { mortgageBalance: 0, mortgageProductID: '', mortgageRemainingWeeks: 0 });
  g.finance = finance.defaultFinanceState(g);
  const e = new s.engineModule.TycoonEngine(g);
  // Real writers: an unrelated bank loan, then the property mortgage.
  assert.equal(e.borrow(UNRELATED, owner), true, 'unrelated bank loan');
  if (state === 'S1+onbook') {
    s.modules.realEstateCompleteCycle.ensure(e.g);
    assert.ok(s.modules.realEstateCompleteCycle.borrow(e.g, 'P1', 20_000_000, { rateType: 'fixed' }), 'on-book market loan');
  }
  if (state !== 'none') assert.ok(e.refinancePropertyMortgage('P1', 'fixed'), 'mortgage P1');
  // S2: a legacy save whose g.finance was (re)created by defaultFinanceState after the mortgage.
  if (state === 'S2' || state === 'S2s') e.g.finance = finance.defaultFinanceState(e.g);
  if (state === 'S2s') { e.g.week++; assert.ok(e.refinancePropertyMortgage('P2', 'fixed'), 'mortgage P2'); }
  assert.equal(e.save(), true); await s.modules.saveStorageIDB.flush();
  return { ...s, e, durable, key: s.engineModule.SAVE_KEY };
}

const bsDiff = s => s.modules.finance.buildStatements(s.e.g, '52').balanceSheet.balanceDifference;
const loanSum = g => g.finance.loans.filter(l => l.status !== 'repaid').reduce((a, l) => a + Number(l.outstandingPrincipal || 0), 0);
function books(s) {
  const v = s.modules.finance.validate(s.e.g), d = s.modules.finance.debtRollforwardStatus(s.e.g);
  return { ok: v.ok, errors: v.errors, debtOk: d.checks.every(c => c.ok), debtFailed: d.checks.filter(c => !c.ok).map(c => c.code) };
}
function observe(s) {
  return { state: snap(s.e.g), mirror: s.ctx.__localStorageData.get(s.key), cache: s.modules.saveStorageIDB.readSync(s.key), durable: s.durable.get(s.key) };
}

async function freshLoad(s) {
  const fresh = loadGame({ headless: true, indexedDB: indexedDBFor(s.durable) });
  await fresh.modules.saveStorageIDB.hydrate();
  const loaded = fresh.engineModule.TycoonEngine.load();
  assert.ok(loaded, 'durable-only load');
  return { fresh, loaded };
}

async function sold(owner, state) {
  const s = await scenario(owner, state), g = s.e.g, cashKey = owner === 'company' ? 'companyCash' : 'personalCash';
  const p1 = g.properties.find(p => p.id === 'P1'), payoffLegacy = p1.mortgageBalance;
  const market = (g.realEstateMarket?.loans || []).filter(l => l.propertyID === 'P1' && l.status === 'active');
  const onBook = market.reduce((a, l) => a + l.balance, 0), payoff = payoffLegacy + onBook;
  const before = { cash: g[cashKey], otherCash: g[owner === 'company' ? 'personalCash' : 'companyCash'], companyDebt: g.companyDebt,
    personalDebt: g.personalDebt, ledger: g.finance.transactions.length, books: books(s), bs: bsDiff(s), rng: snap(g.simulationRng) };
  const gross = Math.round(300_000_000 * 0.97 * 100) / 100;
  assert.equal(s.e.sellProperty('P1'), true, `${owner} ${state}: sale accepted`);
  // Cash: proceeds in, exactly the payoff out (legacy mortgage + on-book loans), nothing else.
  assert.equal(g[cashKey] - before.cash, gross - payoff, `${owner} ${state}: cash moves by gross - payoff`);
  assert.equal(g[owner === 'company' ? 'personalCash' : 'companyCash'], before.otherCash, 'other owner cash untouched');
  assert.equal(g.properties.find(p => p.id === 'P1').mortgageBalance, 0, 'mortgage paid off');
  // Debt aggregates: only tracked (on-book) principal leaves; the unrelated bank loan survives.
  if (owner === 'company') {
    assert.equal(g.companyDebt, before.companyDebt - onBook, `${state}: companyDebt changes only by on-book principal`);
    assert.ok(g.companyDebt >= UNRELATED, 'unrelated company loan not consumed');
    assert.equal(loanSum(g), g.companyDebt, 'companyDebt matches finance.loans');
    assert.equal(g.personalDebt, before.personalDebt);
  } else {
    assert.equal(g.personalDebt, before.personalDebt, 'personal mortgage never consumes unrelated personalDebt');
    assert.equal(g.personalDebt, UNRELATED);
    assert.equal(g.companyDebt, before.companyDebt);
  }
  // Ledger rows.
  const rows = g.finance.transactions.slice(before.ledger);
  if (owner === 'company') {
    const debtRow = rows.find(r => r.sourceType === 'property-disposition-debt');
    if (payoff > 0) {
      assert.ok(debtRow, 'disposition debt row');
      assert.equal(debtRow.cashEffect, -payoff, 'row pays the full payoff in cash');
      assert.equal(debtRow.liabilityEffect, -onBook, 'liabilityEffect excludes the off-book balance');
      assert.equal(debtRow.profitEffect, 0);
    } else assert.equal(debtRow, undefined, 'unlevered sale posts no debt row');
    const saleRow = rows.find(r => r.category === 'assetSale' && r.cashEffect === gross);
    assert.ok(saleRow, 'asset sale row');
    assert.equal(rows.reduce((a, r) => a + r.cashEffect, 0), gross - payoff, 'ledger cash equals cash movement');
  } else {
    assert.equal(rows.length, 0, 'personal sale posts no company ledger row');
  }
  const after = books(s);
  if (owner === 'company') {
    // S1: the pre-sale BS difference is exactly the off-book mortgage; the payoff closes it.
    assert.equal(before.bs, payoffLegacy, `${state}: S1 difference equals off-book balance`);
    assert.equal(bsDiff(s), 0);
  }
  assert.equal(after.ok, true, `${owner} ${state}: finance.validate after sale ${after.errors.join(' | ')}`);
  assert.equal(after.debtOk, true, `${owner} ${state}: debt rollforward after sale ${after.debtFailed}`);
  if (before.books.ok) assert.equal(after.ok, true, 'valid before -> valid after');
  assert.deepEqual(snap(g.simulationRng), before.rng, 'no RNG consumption');
  // Reload from durable IndexedDB only.
  await s.modules.saveStorageIDB.flush();
  const { fresh, loaded } = await freshLoad(s);
  assert.equal(loaded.g.companyDebt, g.companyDebt); assert.equal(loaded.g.personalDebt, g.personalDebt);
  assert.equal(loaded.g[cashKey], g[cashKey]); assert.equal(loaded.g.saveVersion, 9);
  assert.equal(loaded.g.properties.find(p => p.id === 'P1').mortgageBalance, 0);
  assert.equal(fresh.modules.finance.validate(loaded.g).ok, true, 'reloaded books valid');
  return { g: snap(g), before };
}

async function quarantined(owner, state) {
  const s = await scenario(owner, state), pre = books(s), before = observe(s), toasts = [];
  s.e.addEventListener('notify', event => toasts.push(event.detail));
  if (state === 'S2') assert.equal(pre.ok, true, 'S2 validates before the sale');
  // Direct sale, listing, and canonical settlement are all refused without economic mutation.
  assert.equal(s.e.sellProperty('P1'), false, `${state}: direct sale quarantined`);
  assert.equal(toasts.length, 1); assert.match(toasts[0].message, new RegExp(BLOCK), 'player-facing reason');
  assert.equal(toasts[0].severity, 'warning');
  assert.deepEqual(snap(s.e.g), before.state, `${state}: whole state unchanged`);
  assert.equal(s.e.listPropertyForDisposal('P1', 'quick'), false, `${state}: listing quarantined`);
  assert.equal(toasts.length, 2); assert.match(toasts[1].message, new RegExp(BLOCK));
  assert.equal(s.e.settlePropertyDisposition({ propertyID: 'P1', grossSalePrice: 290_000_000, fees: 0, idempotencyKey: `q-${state}` }), false);
  if (state === 'S2s') assert.equal(s.e.sellProperty('P2'), false, 'S2s: the other mortgaged property is also uncertain');
  assert.deepEqual(snap(s.e.g), before.state, `${state}: still unchanged`);
  assert.equal(s.e.g.companyDebt, UNRELATED);
  assert.equal(s.ctx.__localStorageData.get(s.key), before.mirror, 'mirror unchanged');
  await s.modules.saveStorageIDB.flush();
  assert.equal(s.durable.get(s.key), before.durable, 'durable unchanged');
  assert.deepEqual(books(s), pre, `${state}: validation result unchanged`);
  // A delayed listing created before the ledger became uncertain also stays put.
  const p1 = s.e.g.properties.find(p => p.id === 'P1');
  Object.assign(p1, { disposalMethodID: 'quick', disposalListedWeek: 19, disposalTargetWeek: 20, disposalExpectedPrice: 280_000_000 });
  const listed = snap(s.e.g);
  assert.equal(s.modules.realEstatePropertyDisposals.processWeek(s.e).length, 0, "quarantined delayed sale settles nothing");
  const after = snap(s.e.g); delete after.propertyDisposalHistory; delete listed.propertyDisposalHistory;
  delete after.lastPropertyDisposalProcessedWeek; delete listed.lastPropertyDisposalProcessedWeek;
  assert.deepEqual(after.properties, listed.properties, 'listed property retained');
  assert.equal(s.e.g.companyCash, listed.companyCash);
}

async function faults() {
  for (const fault of ['save-false', 'save-throw', 'post-save-throw', 'finance-throw']) {
    const s = await scenario('company', 'S1'), baseline = observe(s), save = s.e.save, realEvent = s.modules.finance.event;
    let reached = false;
    if (fault === 'finance-throw') s.modules.finance.event = function (g, category, ...rest) {
      if (category === 'debtRepayment') { reached = true; throw new Error('injected debt post failure'); }
      return realEvent.call(this, g, category, ...rest);
    };
    else s.e.save = function (...args) {
      reached = true;
      if (fault === 'save-false') return false;
      if (fault === 'save-throw') throw new Error('injected save throw');
      save.apply(this, args); throw new Error('injected post-save throw');
    };
    try {
      if (fault === 'save-false') assert.equal(s.e.sellProperty('P1'), false);
      else assert.throws(() => s.e.sellProperty('P1'), /injected/);
    } finally { s.e.save = save; s.modules.finance.event = realEvent; }
    assert.equal(reached, true, `${fault} exercised`);
    assert.deepEqual(snap(s.e.g), baseline.state, `${fault}: live state rolled back`);
    assert.equal(s.e.g.companyDebt, UNRELATED);
    assert.equal(s.ctx.__localStorageData.get(s.key), baseline.mirror, `${fault}: mirror unchanged`);
    await s.modules.saveStorageIDB.flush();
    assert.equal(s.durable.get(s.key), baseline.durable, `${fault}: durable unchanged`);
  }
}

async function main() {
  // S1 company, S1 with an additional on-book loan on the same property, personal (off-book, any state).
  const first = await sold('company', 'S1');
  const again = await sold('company', 'S1');
  for (const run of [first, again]) delete run.g.lastSaveDate; // wall-clock save stamp only
  assert.deepEqual(again.g, first.g, 'deterministic: identical runs give identical state');
  await sold('company', 'S1+onbook');
  await sold('company', 'none');
  await sold('personal', 'S1');
  await sold('personal', 'S2');
  await sold('personal', 'S2s');
  // Delayed-sale path through the weekly settler in S1.
  {
    const s = await scenario('company', 'S1');
    assert.ok(s.e.listPropertyForDisposal('P1', 'quick'));
    s.e.g.week += 1;
    const rows = s.modules.realEstatePropertyDisposals.processWeek(s.e);
    assert.equal(rows.length, 1);
    assert.equal(s.e.g.companyDebt, UNRELATED, 'delayed sale keeps the unrelated loan');
    assert.equal(books(s).ok, true, books(s).errors.join(' | '));
  }
  // S2 and S2s cannot be proven S1-consistent: quarantine (no equity restatement without Owner Q2).
  await quarantined('company', 'S2');
  await quarantined('company', 'S2s');
  await faults();
  console.log('P4-AUD-007 D-1 mortgage disposal debt: S1/S2/S2s, personal, faults, reload, determinism PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
