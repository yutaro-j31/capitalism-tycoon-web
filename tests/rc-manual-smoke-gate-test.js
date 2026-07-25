'use strict';

const assert = require('node:assert/strict');
const releaseCandidate = require('../release-candidate.json');
const { loadGame, findStateIssues } = require('./harness');

const REQUIRED_CHECKS = [
  'fresh-start',
  'json-save-recovery',
  'one-week-advance',
  'four-week-advance',
  'save-export-import',
  'iphone-safe-area-navigation',
  'market-capital-allocation-cards'
];

async function main() {
  assert.equal(releaseCandidate.version, '2.0.0-rc.1');
  assert.equal(releaseCandidate.save.key, 'capitalism_tycoon_web_v1');
  assert.equal(releaseCandidate.save.version, 9);
  for (const check of REQUIRED_CHECKS) {
    assert.ok(releaseCandidate.manualSmokeChecks.includes(check), `missing RC smoke check: ${check}`);
  }

  const { ctx, engineModule } = loadGame();
  const { TycoonEngine, SAVE_KEY, SAVE_VERSION } = engineModule;
  assert.equal(SAVE_KEY, releaseCandidate.save.key);
  assert.equal(SAVE_VERSION, releaseCandidate.save.version);

  // Exercise the real setup/store path without coupling this release gate to a
  // single tenant's balance calibration. Prefer Fukuoka, then select the
  // cheapest affordable opening deterministically. Dedicated balance suites
  // remain responsible for difficulty-specific opening-capital calibration.
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

  const startWeek = engine.g.week;
  assert.equal(engine.advanceWeek(true), true, 'one-week advance failed');
  assert.equal(engine.g.week, startWeek + 1, 'one-week advance mismatch');
  for (let i = 0; i < 3; i++) assert.equal(engine.advanceWeek(true), true, `four-week advance failed at step ${i + 2}`);
  assert.equal(engine.g.week, startWeek + 4, 'four-week advance mismatch');
  assert.equal(findStateIssues(engine.g).length, 0, 'state issues after four-week advance');

  assert.equal(engine.save(), true, 'localStorage save failed');
  const stored = ctx.localStorage.getItem(SAVE_KEY);
  assert.ok(stored, 'localStorage save missing');
  const storedState = JSON.parse(stored);
  assert.equal(storedState.saveVersion, SAVE_VERSION, 'stored saveVersion mismatch');
  assert.equal(storedState.week, engine.g.week, 'stored week mismatch');
  assert.equal(storedState.companyCash, engine.g.companyCash, 'stored companyCash mismatch');
  assert.equal(storedState.personalCash, engine.g.personalCash, 'stored personalCash mismatch');

  const reloaded = TycoonEngine.load();
  assert.equal(reloaded.g.week, engine.g.week, 'reload week mismatch');
  assert.equal(reloaded.g.companyCash, engine.g.companyCash, 'reload companyCash mismatch');
  assert.equal(reloaded.g.personalCash, engine.g.personalCash, 'reload personalCash mismatch');
  assert.equal(reloaded.g.stores.length, engine.g.stores.length, 'reload stores mismatch');

  const exportText = await engine.exportSave().text();
  const imported = new TycoonEngine();
  imported.importSave(exportText);
  assert.equal(imported.g.saveVersion, SAVE_VERSION, 'import saveVersion mismatch');
  assert.equal(imported.g.week, engine.g.week, 'import week mismatch');
  assert.equal(imported.g.companyCash, engine.g.companyCash, 'import companyCash mismatch');
  assert.equal(imported.g.personalCash, engine.g.personalCash, 'import personalCash mismatch');
  assert.equal(imported.g.stores.length, engine.g.stores.length, 'import stores mismatch');
  assert.equal(findStateIssues(imported.g).length, 0, 'imported state issues');

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