'use strict';

// Issue #731 (P0-06) PR5: full-production long-run proof.
// The same save and the same action sequence must remain identical for 120+ weeks even when one
// branch is repeatedly saved/reloaded in fresh runtimes whose host randomness, time, UUID and sort
// implementation differ from the uninterrupted branch.

const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadGame } = require('./harness');

const KEY = 'capitalism_tycoon_web_v1';
const WEEKS = 120;
const RELOAD_EVERY = 20;

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

const INSERTION_SORT = `Array.prototype.sort = function(cmp){
  cmp = cmp || ((x, y) => String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0);
  for (let i = 1; i < this.length; i++) {
    const v = this[i]; let j = i - 1;
    while (j >= 0 && cmp(this[j], v) > 0) { this[j + 1] = this[j]; j--; }
    this[j + 1] = v;
  }
  return this;
};`;

function runtime(hostSeed, saved, alternateSort = false) {
  const loaded = loadGame({
    headless: true,
    random: lcg(hostSeed),
    ...(saved ? { localStorageInitial: { [KEY]: saved } } : {})
  });
  vm.runInContext(`Date.now = () => ${hostSeed * 1000003}; crypto.randomUUID = () => 'host-${hostSeed}';`, loaded.ctx);
  if (alternateSort) vm.runInContext(INSERTION_SORT, loaded.ctx);
  return { loaded, Engine: loaded.engineModule.TycoonEngine };
}

function serializableState(engine) {
  const copy = JSON.parse(JSON.stringify(engine.g));
  delete copy.lastSaveDate; // wall-clock metadata, explicitly outside simulation state.
  return copy;
}

function firstDiff(a, b, path = '

function persistedSave(run, engine) {
  engine.save();
  const saved = run.loaded.ctx.__localStorageData.get(KEY);
  assert.equal(typeof saved, 'string', 'engine.save() persisted the canonical save payload');
  assert(saved.length > 100, 'persisted save is non-empty');
  return saved;
}

function loadSaved(hostSeed, saved, alternateSort) {
  const run = runtime(hostSeed, saved, alternateSort);
  const engine = run.Engine.load();
  assert(engine?.g?.configured, 'fresh runtime loaded the configured save');
  return { run, engine };
}

function firstFreeTenant(engine) {
  return engine.g.tenants.find(t => !t.occupiedBy);
}

function openStore(engine, businessID, name) {
  const tenant = firstFreeTenant(engine);
  assert(tenant, `${name}: a free tenant is available`);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID, name, operatingHours: 3 }), true, `${name}: store opens`);
}

function prepareCanonicalSave() {
  const run = runtime(731);
  const engine = new run.Engine();
  engine.configure({ playerName: 'Determinism', companyName: 'Determinism Co', difficulty: 'normal', scenario: 'free' });

  // From this point the save stream, not host entropy, defines the future.
  run.loaded.modules.simulationRng.reseed(engine.g, 0x731731);
  engine.g.companyCash = 8_000_000_000;
  engine.g.personalCash = 1_000_000_000;
  engine.g.hasHeadOffice = true;
  engine.g.officeCapacity = 32;
  engine.g.departmentStaff = { ...(engine.g.departmentStaff || {}), accounting: 6, hr: 4, product: 5, investment: 4 };
  engine.g.socialMediaHeat = .95;
  engine.g.lastInboundBuyoutOfferWeek = 0;
  engine.g.lastProductOfferGenerationWeek = 0;

  // Keep the setup canonical: do not synthesize a partial IPO/listing or product object by hand.
  // Public-company earnings are still exercised through runEarningsEventsIfNeeded(true), while the
  // private-company path keeps every ownership/market field internally consistent across reloads.
  openStore(engine, 'ramen', '決定論ラーメン');
  openStore(engine, 'conveni', '決定論コンビニ');
  openStore(engine, 'gym', '決定論ジム');

  engine.normalize();
  return persistedSave(run, engine);
}

function scriptedActions(engine, step) {
  if (step === 3) engine.startMediaAction('social');
  if (step === 8) engine.hireKeyPerson();
  if (step === 16 && engine.g.keyPersonnel[0]) engine.trainKeyPerson(engine.g.keyPersonnel[0].id);
  if (step === 24) engine.refreshStartupDealFlow();
  if (step === 32) engine.refreshInvestorOffers();
  if (step === 40) engine.generateMATargets(true);
  if (step === 48) engine.proposeInternalVenture();
  if (step === 56) openStore(engine, 'ramen', '決定論ラーメン2');
  if (step === 64) engine.runEarningsEventsIfNeeded(true);
  if (step === 72) engine.refreshStartupDealFlow();
  if (step === 80) engine.generateMATargets(true);
  if (step === 88 && engine.g.keyPersonnel[0]) engine.retainKeyPerson(engine.g.keyPersonnel[0].id);
  if (step === 96) engine.startMediaAction('ir');
  if (step === 104) engine.refreshInvestorOffers();
  if (step === 112) engine.runEarningsEventsIfNeeded(true);
}

const seedSave = prepareCanonicalSave();
let left = loadSaved(101, seedSave, false);
let right = loadSaved(909, seedSave, true);

assertSame(left.engine, right.engine, 'same save loads identically before long-run play');
const initialDraws = left.engine.g.simulationRng.draws;
const checkpoints = [];

for (let step = 1; step <= WEEKS; step++) {
  scriptedActions(left.engine, step);
  scriptedActions(right.engine, step);

  assert.notEqual(left.engine.advanceWeek(false), false, `left week ${step} advances`);
  assert.notEqual(right.engine.advanceWeek(false), false, `right week ${step} advances`);
  assertSame(left.engine, right.engine, `week ${step}: uninterrupted and reload branch diverged`);

  if (step % RELOAD_EVERY === 0 && step < WEEKS) {
    const beforeReload = serializableState(right.engine);
    const saved = persistedSave(right.run, right.engine);
    right = loadSaved(909 + step, saved, step % 40 === 0);
    const afterReload = serializableState(right.engine);
    const reloadDiff = firstDiff(afterReload, beforeReload);
    assert.equal(reloadDiff, null, `week ${step}: save/reload is state-preserving; first diff=${JSON.stringify(reloadDiff)}`);
    assertSame(left.engine, right.engine, `week ${step}: fresh runtime reload stays on the same fork`);
    checkpoints.push({ step, draws: right.engine.g.simulationRng.draws, nextID: right.engine.g.simulationRng.nextID });
  }
}

assert(left.engine.g.simulationRng.draws > initialDraws + 500, 'long-run exercised the persisted RNG stream extensively');
assert.equal(left.engine.g.simulationRng.draws, right.engine.g.simulationRng.draws, 'both forks consumed the same RNG draws');
assert.equal(left.engine.g.simulationRng.nextID, right.engine.g.simulationRng.nextID, 'both forks allocated the same deterministic IDs');
assertSame(left.engine, right.engine, '120-week final production states are identical');

console.log(JSON.stringify({
  deterministicLongRun: 'passed',
  weeks: WEEKS,
  reloadEvery: RELOAD_EVERY,
  reloads: checkpoints.length,
  initialDraws,
  finalDraws: left.engine.g.simulationRng.draws,
  finalNextID: left.engine.g.simulationRng.nextID,
  checkpoints
}, null, 2));
) {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return { path, a, b };
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!(key in a) || !(key in b)) return { path: `${path}.${key}`, a: a[key], b: b[key] };
    const diff = firstDiff(a[key], b[key], `${path}.${key}`);
    if (diff) return diff;
  }
  return null;
}
function assertSame(a, b, label) {
  const left = serializableState(a), right = serializableState(b), diff = firstDiff(left, right);
  assert.equal(diff, null, `${label}; first diff=${JSON.stringify(diff)}`);
}

function persistedSave(run, engine) {
  engine.save();
  const saved = run.loaded.ctx.__localStorageData.get(KEY);
  assert.equal(typeof saved, 'string', 'engine.save() persisted the canonical save payload');
  assert(saved.length > 100, 'persisted save is non-empty');
  return saved;
}

function loadSaved(hostSeed, saved, alternateSort) {
  const run = runtime(hostSeed, saved, alternateSort);
  const engine = run.Engine.load();
  assert(engine?.g?.configured, 'fresh runtime loaded the configured save');
  return { run, engine };
}

function firstFreeTenant(engine) {
  return engine.g.tenants.find(t => !t.occupiedBy);
}

function openStore(engine, businessID, name) {
  const tenant = firstFreeTenant(engine);
  assert(tenant, `${name}: a free tenant is available`);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID, name, operatingHours: 3 }), true, `${name}: store opens`);
}

function prepareCanonicalSave() {
  const run = runtime(731);
  const engine = new run.Engine();
  engine.configure({ playerName: 'Determinism', companyName: 'Determinism Co', difficulty: 'normal', scenario: 'free' });

  // From this point the save stream, not host entropy, defines the future.
  run.loaded.modules.simulationRng.reseed(engine.g, 0x731731);
  engine.g.companyCash = 8_000_000_000;
  engine.g.personalCash = 1_000_000_000;
  engine.g.hasHeadOffice = true;
  engine.g.officeCapacity = 32;
  engine.g.departmentStaff = { ...(engine.g.departmentStaff || {}), accounting: 6, hr: 4, product: 5, investment: 4 };
  engine.g.socialMediaHeat = .95;
  engine.g.publicCompany = true;
  engine.g.founderOwnershipRatio = .72;
  engine.g.lastInboundBuyoutOfferWeek = 0;
  engine.g.lastProductOfferGenerationWeek = 0;

  const own = {
    id: 'SELF-731', name: engine.g.companyName, price: 1000, previous: 1000,
    issuedShares: Number(engine.g.sharesOut || 1_000_000), marketCap: Number(engine.g.sharesOut || 1_000_000) * 1000
  };
  engine.g.ticker = own.id;
  engine.g.stockPrice = own.price;
  engine.g.ipoPrice = own.price;
  engine.g.market = [own, ...(engine.g.market || []).filter(x => x.id !== own.id && x.name !== own.name)];

  openStore(engine, 'ramen', '決定論ラーメン');
  openStore(engine, 'conveni', '決定論コンビニ');
  openStore(engine, 'gym', '決定論ジム');

  engine.g.productVentures.push({
    id: 'det-product', name: 'Deterministic SaaS', category: 'SaaS', status: 'released',
    valuation: 80_000_000, profit: 1_500_000, quality: 60, awareness: .4
  });

  engine.normalize();
  return persistedSave(run, engine);
}

function scriptedActions(engine, step) {
  if (step === 3) engine.startMediaAction('social');
  if (step === 8) engine.hireKeyPerson();
  if (step === 16 && engine.g.keyPersonnel[0]) engine.trainKeyPerson(engine.g.keyPersonnel[0].id);
  if (step === 24) engine.refreshStartupDealFlow();
  if (step === 32) engine.refreshInvestorOffers();
  if (step === 40) engine.generateMATargets(true);
  if (step === 48) engine.proposeInternalVenture();
  if (step === 56) openStore(engine, 'ramen', '決定論ラーメン2');
  if (step === 64) engine.runEarningsEventsIfNeeded(true);
  if (step === 72) engine.refreshStartupDealFlow();
  if (step === 80) engine.generateMATargets(true);
  if (step === 88 && engine.g.keyPersonnel[0]) engine.retainKeyPerson(engine.g.keyPersonnel[0].id);
  if (step === 96) engine.startMediaAction('ir');
  if (step === 104) engine.refreshInvestorOffers();
  if (step === 112) engine.runEarningsEventsIfNeeded(true);
}

const seedSave = prepareCanonicalSave();
let left = loadSaved(101, seedSave, false);
let right = loadSaved(909, seedSave, true);

assertSame(left.engine, right.engine, 'same save loads identically before long-run play');
const initialDraws = left.engine.g.simulationRng.draws;
const checkpoints = [];

for (let step = 1; step <= WEEKS; step++) {
  scriptedActions(left.engine, step);
  scriptedActions(right.engine, step);

  assert.notEqual(left.engine.advanceWeek(false), false, `left week ${step} advances`);
  assert.notEqual(right.engine.advanceWeek(false), false, `right week ${step} advances`);
  assertSame(left.engine, right.engine, `week ${step}: uninterrupted and reload branch diverged`);

  if (step % RELOAD_EVERY === 0 && step < WEEKS) {
    const beforeReload = serializableState(right.engine);
    const saved = persistedSave(right.run, right.engine);
    right = loadSaved(909 + step, saved, step % 40 === 0);
    assert.equal(JSON.stringify(serializableState(right.engine)), JSON.stringify(beforeReload), `week ${step}: save/reload is state-preserving`);
    assertSame(left.engine, right.engine, `week ${step}: fresh runtime reload stays on the same fork`);
    checkpoints.push({ step, draws: right.engine.g.simulationRng.draws, nextID: right.engine.g.simulationRng.nextID });
  }
}

assert(left.engine.g.simulationRng.draws > initialDraws + 500, 'long-run exercised the persisted RNG stream extensively');
assert.equal(left.engine.g.simulationRng.draws, right.engine.g.simulationRng.draws, 'both forks consumed the same RNG draws');
assert.equal(left.engine.g.simulationRng.nextID, right.engine.g.simulationRng.nextID, 'both forks allocated the same deterministic IDs');
assertSame(left.engine, right.engine, '120-week final production states are identical');

console.log(JSON.stringify({
  deterministicLongRun: 'passed',
  weeks: WEEKS,
  reloadEvery: RELOAD_EVERY,
  reloads: checkpoints.length,
  initialDraws,
  finalDraws: left.engine.g.simulationRng.draws,
  finalNextID: left.engine.g.simulationRng.nextID,
  checkpoints
}, null, 2));
