'use strict';
// A late-game save was exceeding the device storage quota, and the JSON backup that the
// failure message told the player to use did nothing on iOS. The payload was dominated by
// hundreds of properties and tenants the player had never touched, stored in full every
// week. Untouched records are now reduced to what identifies them and rebuilt by
// normalize() on load; anything the player has interacted with is still stored whole.
const assert = require('node:assert');
const { loadGame } = require('./harness');

// A fixed random value collapses every generated uuid to one string, which merges
// unrelated records. A varying deterministic source keeps them distinct.
function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function createEngine() {
  const loaded = loadGame({ headless: true, random: lcg(7) });
  const engine = new loaded.engineModule.TycoonEngine();
  // Set the opening cash before normalize builds the ledger, otherwise the books start out
  // of step with the balance and every later check would be measuring that instead.
  engine.g.companyCash = 400_000_000;
  engine.g.companyDebt = 0;
  delete engine.g.finance;
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.companyName = 'Storage Co';
  return { loaded, engine };
}

function payloadBytes(loaded, state, profile) {
  return loaded.modules.saveStorage.storagePayload(state, profile).payload.length * 2;
}

// --- untouched records are reduced, touched ones are not -----------------
{
  const { loaded, engine } = createEngine();
  const storage = loaded.modules.saveStorage;

  const owned = engine.g.properties[0];
  owned.owner = 'company';
  const occupied = engine.g.tenants[0];
  occupied.occupiedBy = 'player';

  const compacted = storage.compactStateForStorage(engine.g, 'critical').state;

  const isReduced = record => Object.keys(record).length < Object.keys(engine.g.properties[1]).length;
  const compactedProperties = compacted.properties.filter(isReduced);
  assert.ok(compactedProperties.length > 0, 'untouched properties are reduced');
  assert.equal(
    compactedProperties.length,
    compacted.properties.length - 1,
    'every property except the owned one is reduced'
  );
  const keptProperty = compacted.properties.find(record => record.id === owned.id);
  assert.ok(!isReduced(keptProperty), 'an owned property is stored whole');
  assert.equal(
    Object.keys(keptProperty).length,
    Object.keys(owned).length,
    'an owned property keeps every field'
  );

  // Tenants are deliberately left alone: normalize() rebuilds none of their fields, so
  // reducing one would lose data outright rather than save space safely.
  assert.ok(
    compacted.tenants.every(record => Object.keys(record).length === Object.keys(engine.g.tenants[1]).length),
    'tenants are never reduced, because nothing rebuilds them on load'
  );
  const keptTenant = compacted.tenants.find(record => record.id === occupied.id);
  assert.equal(
    Object.keys(keptTenant).length,
    Object.keys(occupied).length,
    'a tenant keeps every field'
  );
}

// --- a property in progress is never reduced -----------------------------
{
  const { loaded, engine } = createEngine();
  const storage = loaded.modules.saveStorage;
  const inProgress = [
    ['mortgageBalance', 5_000_000],
    ['constructionWeeksRemaining', 4],
    ['redevelopmentStartWeek', 12],
    ['disposalListedWeek', 20],
    ['hqBuilt', true],
    ['buildingLevel', 2],
    ['propertyTaxPaidTotal', 1000],
    ['insurancePremiumPaid', 500]
  ];
  for (const [field, value] of inProgress) {
    const target = engine.g.properties[3];
    const original = target[field];
    target[field] = value;
    const compacted = storage.compactStateForStorage(engine.g, 'critical').state;
    const stored = compacted.properties.find(record => record.id === target.id);
    assert.equal(
      Object.keys(stored).length,
      Object.keys(target).length,
      `a property with ${field} set is stored whole`
    );
    target[field] = original;
  }
}

// --- a reduced record is fully restored on load --------------------------
{
  const { loaded, engine } = createEngine();
  const storage = loaded.modules.saveStorage;
  for (let index = 0; index < 60; index += 1) engine.advanceWeek();

  const before = engine.g.properties.find(record => !record.owner);
  const beforeTenant = engine.g.tenants.find(record => !record.occupiedBy);
  const compacted = storage.compactStateForStorage(engine.g, 'critical').state;

  const restored = new loaded.engineModule.TycoonEngine();
  restored.g = JSON.parse(JSON.stringify(compacted));
  restored.normalize();

  const after = restored.g.properties.find(record => record.id === before.id);
  assert.ok(after, 'the property survives the round trip');
  assert.equal(
    Object.keys(after).length,
    Object.keys(before).length,
    'every property field is rebuilt on load'
  );
  for (const field of Object.keys(before)) {
    assert.deepEqual(after[field], before[field], `property ${field} is restored exactly`);
  }

  const afterTenant = restored.g.tenants.find(record => record.id === beforeTenant.id);
  assert.ok(afterTenant, 'the tenant survives the round trip');
  for (const field of Object.keys(beforeTenant)) {
    assert.deepEqual(afterTenant[field], beforeTenant[field], `tenant ${field} is preserved exactly`);
  }
}

// --- the player's own position is untouched by compaction ----------------
{
  const { loaded, engine } = createEngine();
  const storage = loaded.modules.saveStorage;
  for (let index = 0; index < 60; index += 1) engine.advanceWeek();

  const compacted = storage.compactStateForStorage(engine.g, 'critical').state;
  const restored = new loaded.engineModule.TycoonEngine();
  restored.g = JSON.parse(JSON.stringify(compacted));
  restored.normalize();

  assert.equal(restored.g.week, engine.g.week, 'the week is preserved');
  assert.equal(restored.g.companyCash, engine.g.companyCash, 'company cash is preserved');
  assert.equal(restored.g.personalCash, engine.g.personalCash, 'personal cash is preserved');
  assert.equal(restored.g.stores.length, engine.g.stores.length, 'stores are preserved');
  assert.ok(loaded.modules.finance.validate(restored.g).ok, 'the ledger stays valid after a round trip');
}

// --- compaction actually buys headroom -----------------------------------
{
  const { loaded, engine } = createEngine();
  for (let index = 0; index < 60; index += 1) engine.advanceWeek();

  const uncompacted = JSON.stringify(engine.g).length * 2;
  const stored = payloadBytes(loaded, engine.g, 'critical');
  assert.ok(
    stored < uncompacted * 0.8,
    `the critical profile must be materially smaller than the raw state (${stored} vs ${uncompacted})`
  );

  const normal = payloadBytes(loaded, engine.g, 'normal');
  const emergency = payloadBytes(loaded, engine.g, 'emergency');
  assert.ok(emergency < normal, 'the emergency profile is smaller than normal');
  assert.ok(stored < emergency, 'the critical profile is the smallest');
}

// --- the backup export survives a missing share API ----------------------
{
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.ok(source.includes('function exportSaveFile'), 'the backup export is a named function');
  assert.ok(
    source.includes('document.body.appendChild(anchor)'),
    'the download anchor is attached to the document, which iOS Safari requires'
  );
  assert.ok(source.includes('navigator.share'), 'the share sheet is tried first');
  assert.ok(source.includes("window.open(url,'_blank')"), 'a final fallback opens the file');
  assert.ok(
    !source.includes("a.download=`capitalism-tycoon-week-${engine.g.week}.json`;a.click()"),
    'the detached-anchor download that silently failed on iOS is gone'
  );
}

console.log('save storage compaction tests passed');
