'use strict';

// #741: canonical CI must exercise the final production composition, not isolatedLegacyIndex.
// Four founding businesses run for 208 weeks with the real index/module wrapper stack. Every week
// checks exact finance validation, finite state, cash-flow identity, and serializability. A fresh
// runtime reload fork is also exercised from the same save. This is an invariant test, not a
// balance/calibration test: founder capital is intentionally large enough to keep all routes alive.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const KEY = 'capitalism_tycoon_web_v1';
const WEEKS = 208;
const FORK_WEEK = 104;
const FORK_WEEKS = 12;
const CONTRIBUTION = 500_000_000;
const PERSONAL_FIXTURE_CASH = 1_500_000_000;
const ROUTES = Object.freeze([
  { businessID:'ramen', seed:0x74110001 },
  { businessID:'conveni', seed:0x74120001 },
  { businessID:'gym', seed:0x74130001 },
  { businessID:'realEstateAgency', seed:0x74140001 }
]);

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function runtime(hostSeed, saved = null) {
  const loaded = loadGame({
    headless:true,
    random:lcg(hostSeed),
    ...(saved ? { localStorageInitial:{ [KEY]:saved } } : {})
  });
  const Engine = loaded.engineModule.TycoonEngine;
  assert.equal(Engine.prototype.advanceWeek.__canonicalNormalizeBoundary, true,
    'full production runtime must include the final canonical week boundary');
  assert.equal(loaded.modules.playerCrisis?.__installed, true, 'full production player-crisis module is installed');
  assert.equal(loaded.modules.playerDebtService?.__installed, true, 'full production debt-service module is installed');
  return { loaded, Engine };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function comparableState(run, engine) {
  const state = clone(engine.g);
  delete state.lastSaveDate;
  const storage = run.loaded.modules.saveStorage;
  if (storage?.compactStateForStorage) {
    const compacted = storage.compactStateForStorage(state, 'normal').state;
    delete compacted.lastSaveDate;
    return compacted;
  }
  return state;
}

function firstDiff(a, b, path = '$') {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return { path, a, b };
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!(key in a) || !(key in b)) return { path:`${path}.${key}`, a:a[key], b:b[key] };
    const diff = firstDiff(a[key], b[key], `${path}.${key}`);
    if (diff) return diff;
  }
  return null;
}

function assertSame(left, right, label) {
  const diff = firstDiff(comparableState(left.run, left.engine), comparableState(right.run, right.engine));
  assert.equal(diff, null, `${label}; first diff=${JSON.stringify(diff)}`);
}

function assertFiniteTree(value, path = '$', seen = new WeakSet()) {
  if (!value || typeof value !== 'object') {
    if (typeof value === 'number') assert(Number.isFinite(value), `${path} is non-finite: ${value}`);
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) assertFiniteTree(child, `${path}.${key}`, seen);
}

function highestTrafficTenant(engine) {
  return engine.g.tenants
    .filter(row => !row.occupiedBy)
    .sort((a,b) => Number(b.traffic||0)-Number(a.traffic||0)
      || Number(a.deposit||0)-Number(b.deposit||0)
      || String(a.id).localeCompare(String(b.id)))[0] || null;
}

function persist(run, engine) {
  assert.equal(engine.save(), true, 'production engine save succeeds');
  const saved = run.loaded.ctx.__localStorageData.get(KEY);
  assert.equal(typeof saved, 'string', 'save payload exists');
  assert(saved.length > 100, 'save payload is non-empty');
  return saved;
}

function validateWeek(pair, label) {
  const { engine, run } = pair;
  const finance = run.loaded.modules.finance;

  // Capture the validation written by the production final boundary before the explicit external
  // validation below can overwrite it.
  const recorded = clone(engine.g.finance?.lastValidation);
  const external = finance.validate(engine.g);
  assert.equal(external.ok, true, `${label}: finance.validate: ${(external.errors||[]).join(' / ')}`);
  assert.deepEqual(recorded, clone(external), `${label}: committed lastValidation must describe final state`);

  const cf = finance.buildStatements(engine.g, 'week').cashFlow;
  assert(Math.abs(Number(cf.openingCash) + Number(cf.netCashChange) - Number(cf.endingCash)) <= 0.1,
    `${label}: weekly cash-flow identity failed`);

  assertFiniteTree(engine.g);
  assert.doesNotThrow(() => JSON.stringify(engine.g), `${label}: state must remain serializable`);
}

function setupRoute(route, index) {
  const run = runtime(74100 + index);
  const engine = new run.Engine();
  engine.configure({
    playerName:`Invariant ${route.businessID}`,
    companyName:`Invariant ${route.businessID} Co`,
    difficulty:'normal',
    scenario:'free'
  });
  run.loaded.modules.simulationRng.reseed(engine.g, route.seed);

  // Personal fixture cash is deliberately outside company accounting. The production founder
  // contribution must transfer exactly between the two cash pools without creating one yen.
  engine.g.personalCash = PERSONAL_FIXTURE_CASH;
  const companyBefore = Number(engine.g.companyCash);
  const personalBefore = Number(engine.g.personalCash);
  const poolBefore = companyBefore + personalBefore;
  const txBefore = engine.g.finance.transactions.length;

  assert.equal(engine.contributeFounderCapital(CONTRIBUTION), true, `${route.businessID}: founder contribution succeeds`);
  assert.equal(engine.g.companyCash, companyBefore + CONTRIBUTION, `${route.businessID}: company receives exact contribution`);
  assert.equal(engine.g.personalCash, personalBefore - CONTRIBUTION, `${route.businessID}: founder pays exact contribution`);
  assert.equal(engine.g.companyCash + engine.g.personalCash, poolBefore, `${route.businessID}: founder transfer conserves combined cash`);

  const contributionRows = engine.g.finance.transactions.slice(txBefore)
    .filter(row => row.sourceType === 'founderCapitalContribution');
  assert.equal(contributionRows.length, 1, `${route.businessID}: exactly one contribution ledger row`);
  assert.equal(contributionRows[0].amount, CONTRIBUTION, `${route.businessID}: exact contribution amount posted`);
  assert.equal(contributionRows[0].cashEffect, CONTRIBUTION, `${route.businessID}: exact contribution cash effect posted`);
  assert.equal(contributionRows[0].equityEffect, CONTRIBUTION, `${route.businessID}: exact contribution equity effect posted`);

  const tenant = highestTrafficTenant(engine);
  assert(tenant, `${route.businessID}: founding tenant exists`);
  const business = engine.business(route.businessID);
  const upfront = Number(business.storeCost) + Number(tenant.deposit);
  const openingCash = Number(engine.g.companyCash);
  const openingTxIndex = engine.g.finance.transactions.length;

  assert.equal(engine.openStore({
    tenantID:tenant.id,
    businessID:route.businessID,
    name:`${route.businessID} invariant 1号店`,
    operatingHours:3
  }), true, `${route.businessID}: initial store opens`);

  assert.equal(engine.g.companyCash, openingCash - upfront, `${route.businessID}: opening consumes exact upfront cash`);
  const openingRows = engine.g.finance.transactions.slice(openingTxIndex);
  const capex = openingRows.find(row => row.sourceType === 'openStore');
  const deposit = openingRows.find(row => row.sourceType === 'openStoreDeposit');
  assert(capex && deposit, `${route.businessID}: capex and deposit ledger rows exist`);
  assert.equal(capex.amount, business.storeCost, `${route.businessID}: capex amount is exact`);
  assert.equal(capex.cashEffect, -business.storeCost, `${route.businessID}: capex cash effect is exact`);
  assert.equal(deposit.amount, tenant.deposit, `${route.businessID}: deposit amount is exact`);
  assert.equal(deposit.cashEffect, -tenant.deposit, `${route.businessID}: deposit cash effect is exact`);

  const setupValidation = run.loaded.modules.finance.validate(engine.g);
  assert.equal(setupValidation.ok, true, `${route.businessID}: setup finance valid: ${(setupValidation.errors||[]).join(' / ')}`);
  assertFiniteTree(engine.g);
  return { run, engine };
}

const results = [];

for (let routeIndex = 0; routeIndex < ROUTES.length; routeIndex++) {
  const route = ROUTES[routeIndex];
  const main = setupRoute(route, routeIndex);
  let fork = null;

  for (let elapsed = 1; elapsed <= WEEKS; elapsed++) {
    assert.equal(main.engine.g.gameOver, false, `${route.businessID}: game must still be active before week ${elapsed}`);
    const beforeWeek = main.engine.g.week;
    assert.notEqual(main.engine.advanceWeek(false), false, `${route.businessID}: week ${elapsed} advances`);
    assert.equal(main.engine.g.week, beforeWeek + 1, `${route.businessID}: week increments exactly once`);
    validateWeek(main, `${route.businessID} week ${elapsed}`);

    if (elapsed === FORK_WEEK) {
      const saved = persist(main.run, main.engine);
      const fresh = runtime(974100 + routeIndex, saved);
      fork = { run:fresh, engine:fresh.Engine.load(), until:elapsed + FORK_WEEKS };
      assert(fork.engine?.g?.configured, `${route.businessID}: fresh runtime reloads configured save`);
      assertSame(main, fork, `${route.businessID} week ${elapsed}: immediate reload fork`);
    } else if (fork && elapsed <= fork.until) {
      assert.notEqual(fork.engine.advanceWeek(false), false, `${route.businessID}: reload fork week ${elapsed} advances`);
      validateWeek(fork, `${route.businessID} reload fork week ${elapsed}`);
      assertSame(main, fork, `${route.businessID} week ${elapsed}: continuous and reload fork`);
      if (elapsed === fork.until) fork = null;
    }
  }

  assert.equal(main.engine.g.gameOver, false, `${route.businessID}: survives invariant horizon`);
  results.push({
    businessID:route.businessID,
    weeks:WEEKS,
    finalWeek:main.engine.g.week,
    finalCash:Math.round(main.engine.g.companyCash),
    finalDebt:Math.round(main.engine.g.companyDebt),
    storeCount:main.engine.g.stores.length,
    financeTransactions:main.engine.g.finance.transactions.length
  });
}

console.log(JSON.stringify({
  fullIndexWeeklyInvariant:'passed',
  weeks:WEEKS,
  routes:results,
  reloadForkWeek:FORK_WEEK,
  reloadForkWeeks:FORK_WEEKS
}, null, 2));
