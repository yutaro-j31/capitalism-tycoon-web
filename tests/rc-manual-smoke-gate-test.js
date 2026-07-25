'use strict';

const assert = require('node:assert/strict');
const releaseCandidate = require('../release-candidate.json');
const { loadGame } = require('./harness');

const REQUIRED_CHECKS = [
  'fresh-start',
  'json-save-recovery',
  'one-week-advance',
  'four-week-advance',
  'save-export-import',
  'iphone-safe-area-navigation',
  'market-capital-allocation-cards'
];

function seededRandom(seed = 0x5eed189) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function findSerializationIssues(value, path = 'g', ancestors = new Set(), issues = []) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) issues.push(`${path}: non-finite number`);
    return issues;
  }
  if (value == null || typeof value !== 'object') return issues;
  if (ancestors.has(value)) {
    issues.push(`${path}: circular reference`);
    return issues;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findSerializationIssues(entry, `${path}[${index}]`, nextAncestors, issues));
  } else {
    Object.entries(value).forEach(([key, entry]) => {
      findSerializationIssues(entry, `${path}.${key}`, nextAncestors, issues);
    });
  }
  return issues;
}

function assertCleanState(state, label) {
  const issues = findSerializationIssues(state);
  assert.deepEqual(issues, [], `${label}: ${issues.join(' / ')}`);
  assert.doesNotThrow(() => JSON.stringify(state), `${label}: state is not JSON serializable`);
  assert.ok(Number.isFinite(state.companyCash), `${label}: companyCash is not finite`);
  assert.ok(Number.isFinite(state.personalCash), `${label}: personalCash is not finite`);
  assert.ok(Number.isInteger(state.week) && state.week >= 1, `${label}: invalid week ${state.week}`);
  assert.ok(Array.isArray(state.stores), `${label}: stores must be an array`);
  for (const [index, store] of state.stores.entries()) {
    if (Object.hasOwn(store, 'inventory')) {
      assert.ok(Number.isFinite(store.inventory) && store.inventory >= 0,
        `${label}: store[${index}].inventory is invalid`);
    }
  }
}

async function main() {
  assert.equal(releaseCandidate.version, '2.0.0-rc.1');
  assert.equal(releaseCandidate.save.key, 'capitalism_tycoon_web_v1');
  assert.equal(releaseCandidate.save.version, 9);
  for (const check of REQUIRED_CHECKS) {
    assert.ok(releaseCandidate.manualSmokeChecks.includes(check), `missing RC smoke check: ${check}`);
  }

  // A seeded generator keeps the real market/week path reproducible while
  // still producing distinct UUID inputs in the browser harness.
  const { ctx, engineModule } = loadGame({ random: seededRandom() });
  const { TycoonEngine, SAVE_KEY, SAVE_VERSION } = engineModule;
  assert.equal(SAVE_KEY, releaseCandidate.save.key);
  assert.equal(SAVE_VERSION, releaseCandidate.save.version);

  const engine = new TycoonEngine();
  engine.configure({
    playerName: 'RC Tester',
    companyName: 'RC Smoke Co',
    difficulty: 'easy',
    scenario: 'free',
    founderPrefID: 'fukuoka',
    founderTraitID: 'merchant'
  });
  assert.equal(engine.g.configured, true, 'fresh start did not configure');
  assert.equal(engine.g.week, 1, 'fresh start week mismatch');
  assertCleanState(engine.g, 'fresh start state issues');

  // Exercise the real setup/store path without coupling the gate to one
  // tenant's balance calibration. Prefer Fukuoka and then the lowest cost.
  const businesses = new Map(engine.g.businesses.map(row => [row.id, row]));
  const candidates = engine.g.tenants
    .filter(row => !row.occupiedBy && businesses.has(row.businessID))
    .map(tenant => {
      const business = businesses.get(tenant.businessID);
      return {
        tenant,
        business,
        openingCost: Number(business.storeCost || 0) + Number(tenant.deposit || 0)
      };
    })
    .filter(row => Number.isFinite(row.openingCost) && row.openingCost >= 0)
    .sort((a, b) => {
      const prefRank = Number(b.tenant.prefID === 'fukuoka') - Number(a.tenant.prefID === 'fukuoka');
      if (prefRank) return prefRank;
      if (a.openingCost !== b.openingCost) return a.openingCost - b.openingCost;
      return String(a.tenant.stableKey || a.tenant.id).localeCompare(String(b.tenant.stableKey || b.tenant.id));
    });
  const opening = candidates.find(row => row.openingCost <= engine.g.companyCash);
  assert.ok(opening,
    `easy start has no affordable RC store: cash=${engine.g.companyCash}, cheapest=${candidates[0]?.openingCost ?? 'none'}`);
  assert.equal(engine.openStore({
    tenantID: opening.tenant.id,
    businessID: opening.business.id,
    name: `RC ${opening.tenant.prefID === 'fukuoka' ? '福岡' : '試験'}店`
  }), true, 'store opening failed');
  assert.equal(engine.g.stores.length, 1, 'store was not added');
  assertCleanState(engine.g, 'post-opening state issues');

  const startWeek = engine.g.week;
  for (let step = 1; step <= 4; step++) {
    assert.equal(engine.advanceWeek(true), true, `week advance failed at step ${step}`);
    assert.equal(engine.g.week, startWeek + step, `week mismatch at step ${step}`);
    assertCleanState(engine.g, `state issues after week step ${step}`);
  }

  assert.equal(engine.save(), true, 'localStorage save failed');
  const stored = ctx.localStorage.getItem(SAVE_KEY);
  assert.ok(stored, 'localStorage save missing');
  const storedState = JSON.parse(stored);
  assert.equal(storedState.saveVersion, SAVE_VERSION, 'stored saveVersion mismatch');
  assert.equal(storedState.week, engine.g.week, 'stored week mismatch');
  assert.equal(storedState.companyCash, engine.g.companyCash, 'stored companyCash mismatch');
  assert.equal(storedState.personalCash, engine.g.personalCash, 'stored personalCash mismatch');
  assertCleanState(storedState, 'stored state issues');

  const reloaded = TycoonEngine.load();
  assert.equal(reloaded.g.week, engine.g.week, 'reload week mismatch');
  assert.equal(reloaded.g.companyCash, engine.g.companyCash, 'reload companyCash mismatch');
  assert.equal(reloaded.g.personalCash, engine.g.personalCash, 'reload personalCash mismatch');
  assert.equal(reloaded.g.stores.length, engine.g.stores.length, 'reload stores mismatch');
  assertCleanState(reloaded.g, 'reloaded state issues');

  const exportText = await engine.exportSave().text();
  const imported = new TycoonEngine();
  imported.importSave(exportText);
  assert.equal(imported.g.saveVersion, SAVE_VERSION, 'import saveVersion mismatch');
  assert.equal(imported.g.week, engine.g.week, 'import week mismatch');
  assert.equal(imported.g.companyCash, engine.g.companyCash, 'import companyCash mismatch');
  assert.equal(imported.g.personalCash, engine.g.personalCash, 'import personalCash mismatch');
  assert.equal(imported.g.stores.length, engine.g.stores.length, 'import stores mismatch');
  assertCleanState(imported.g, 'imported state issues');

  console.log(JSON.stringify({
    release: releaseCandidate.version,
    saveVersion: SAVE_VERSION,
    difficulty: engine.g.difficulty,
    openingPrefID: opening.tenant.prefID,
    openingBusinessID: opening.business.id,
    openingCost: opening.openingCost,
    finalWeek: engine.g.week,
    stores: engine.g.stores.length,
    localStorageBytes: stored.length * 2,
    checks: REQUIRED_CHECKS
  }, null, 2));
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
