const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT } = require('./harness');

let seed = 0x6b2ca11b;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { engineModule, modules } = loadGame({ random });
const strategy = modules.strategyBalance;
assert.ok(strategy?.__installed, 'strategy balance module must be installed');
assert.equal(strategy.VERSION, 1);
assert.equal(engineModule.SAVE_VERSION, 9, 'save version must remain 9');
assert.equal(engineModule.TycoonEngine.prototype.__strategyBalanceInstalled, true);

const expected = {
  cafe:650,
  conveni:1450,
  bakery:760,
  bento:650,
  drugstore:800,
  bookstore:600,
  electronicsMini:170,
  coworking:340,
  cleaning:560,
  cramSchool:32,
  realEstateAgency:7,
  gameStudio:1.5,
  appStudio:1.5,
  webAgency:1.8,
  videoStudio:1.7,
  esportsFacility:400,
  vrExperience:270,
  streamerStudio:110,
  investmentConsulting:10,
  insuranceAgency:12,
  maBroker:1.8
};
assert.deepEqual(Object.keys(strategy.DEMAND_CALIBRATIONS).sort(), Object.keys(expected).sort());

const game = new engineModule.TycoonEngine();
for (const [id, demand] of Object.entries(expected)) assert.ok(Math.abs(game.business(id).demand - demand) < 1e-9, `${id} initial demand mismatch`);
assert.equal(game.g.strategyBalanceVersion, 1);

game.configure({ playerName:'補正監査', companyName:'補正監査', difficulty:'normal', scenario:'standard', founderPrefID:'fukuoka', founderTraitID:'merchant' });
for (const [id, demand] of Object.entries(expected)) assert.ok(Math.abs(game.business(id).demand - demand) < 1e-9, `${id} configured demand mismatch`);
assert.equal(game.g.strategyBalanceVersion, 1);
assert.equal(strategy.apply(game.g), false, 'reapplying current calibration must be idempotent');

const legacy = JSON.parse(JSON.stringify(game.g));
delete legacy.strategyBalanceVersion;
legacy.businesses.find(row => row.id === 'cafe').demand = 374;
legacy.businesses.find(row => row.id === 'webAgency').demand = 30;
const migrated = new engineModule.TycoonEngine(legacy);
assert.ok(Math.abs(migrated.business('cafe').demand - 374 * 650 / 340) < 1e-9, 'legacy cafe upgrades must be ratio-preserved');
assert.ok(Math.abs(migrated.business('webAgency').demand - 30 * 1.8 / 24) < 1e-9, 'legacy agency upgrades must be ratio-preserved');
assert.equal(migrated.g.strategyBalanceVersion, 1);

const reloaded = new engineModule.TycoonEngine(JSON.parse(JSON.stringify(migrated.g)));
assert.ok(Math.abs(reloaded.business('cafe').demand - migrated.business('cafe').demand) < 1e-9, 'calibrated save must not be recalibrated twice');
assert.ok(Math.abs(reloaded.business('webAgency').demand - migrated.business('webAgency').demand) < 1e-9, 'calibrated agency save must remain stable');

reloaded.reset();
for (const [id, demand] of Object.entries(expected)) assert.ok(Math.abs(reloaded.business(id).demand - demand) < 1e-9, `${id} reset demand mismatch`);
assert.equal(reloaded.g.strategyBalanceVersion, 1);

const source = fs.readFileSync(path.join(ROOT, 'js', 'strategy-balance.js'), 'utf8');
assert.equal(/Math\.random\s*\(/.test(source), false, 'strategy calibration must not add runtime randomness');
assert.equal(/capitalism_tycoon_web_v1/.test(fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8')), true, 'save key must remain unchanged');
console.log('strategy balance calibration checks passed');
