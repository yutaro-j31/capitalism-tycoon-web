const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

const { ctx, modules, engineModule: engine } = loadGame();
const { competitor } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);
assert.equal(engine.__saveV9Installed, true);
assert.equal(engine.detectSaveVersion({ saveVersion: 9 }).ok, true);
assert.equal(engine.detectSaveVersion({ saveVersion: 10 }).future, true);

const fresh = engine.createInitialState({ configured: true });
competitor.ensure(fresh);
assert.equal(fresh.saveVersion, 9);
assert.equal(fresh.competitorMigrationV9Applied, true);
assert.equal(fresh.competitorLifecycleSchemaVersion, 1);
assert.ok(fresh.competitorStates.length > 0);
assert.ok(fresh.competitorStates.every(company => Number.isFinite(company.creditLimit)));
assert.deepEqual(findStateIssues(fresh), []);

const sourceV8 = clone(fresh);
sourceV8.saveVersion = 8;
delete sourceV8.competitorMigrationV9Applied;
delete sourceV8.competitorLifecycleSchemaVersion;
sourceV8.customMigrationMarker = { keep: 'preserved' };
const firstCompany = sourceV8.competitorStates[0];
firstCompany.cash = 12_345_678;
firstCompany.debt = 4_321_000;
firstCompany.creditScore = 57;
firstCompany.customCompanyMarker = 'keep-company';
const sourceBefore = clone(sourceV8);

const direct = engine.migrateV8ToV9(sourceV8);
assert.equal(direct.ok, true, direct.errors?.join('\n'));
assert.equal(direct.version, 9);
assert.equal(direct.state.saveVersion, 9);
assert.equal(direct.state.competitorMigrationV9Applied, true);
assert.equal(direct.state.competitorLifecycleSchemaVersion, 1);
assert.equal(direct.state.customMigrationMarker.keep, 'preserved');
assert.equal(direct.state.competitorStates[0].cash, 12_345_678);
assert.equal(direct.state.competitorStates[0].debt, 4_321_000);
assert.equal(direct.state.competitorStates[0].customCompanyMarker, 'keep-company');
assert.equal(direct.state.competitorStates[0].competitorID, sourceV8.competitorStates[0].competitorID);
assert.equal(direct.state.competitorStates[0].marketPresence[0].presenceID, sourceV8.competitorStates[0].marketPresence[0].presenceID);
assert.equal(JSON.stringify(sourceV8), JSON.stringify(sourceBefore), 'v8 migration must not mutate input');
assert.deepEqual(findStateIssues(direct.state), []);
assert.doesNotThrow(() => competitor.validate(direct.state));
assert.equal(engine.validateMigratedState(direct.state).ok, true);

const directV9 = engine.migrateV8ToV9(direct.state);
assert.equal(directV9.ok, false, 'direct v8-to-v9 migration should reject an already-v9 save');

const once = engine.migrateSave(sourceV8);
assert.equal(once.ok, true, once.errors?.join('\n'));
const twice = engine.migrateSave(once.state);
assert.equal(twice.ok, true, twice.errors?.join('\n'));
assert.equal(JSON.stringify(twice.state), JSON.stringify(once.state), 'v9 migration must be idempotent');
assert.equal(JSON.stringify(sourceV8), JSON.stringify(sourceBefore), 'general migration must not mutate input');

const future = engine.migrateSave({ ...clone(once.state), saveVersion: 10 });
assert.equal(future.ok, false);
assert.match(future.errors.join('\n'), /新しいsaveVersion 10/);

const instance = new engine.TycoonEngine(sourceV8);
assert.equal(instance.g.saveVersion, 9);
assert.equal(instance.g.competitorMigrationV9Applied, true);
assert.equal(instance.g.competitorStates[0].cash, 12_345_678);
instance.save();
const saved = JSON.parse(ctx.__localStorageData.get(engine.SAVE_KEY));
assert.equal(saved.saveVersion, 9);
assert.equal(saved.competitorMigrationV9Applied, true);

const slotState = clone(sourceV8);
slotState.companyName = 'v8スロット企業';
ctx.localStorage.setItem(`${engine.SAVE_KEY}_slot_2`, JSON.stringify(slotState));
assert.equal(instance.loadSlot(2), true);
assert.equal(instance.g.companyName, 'v8スロット企業');
assert.equal(instance.g.saveVersion, 9);
assert.equal(JSON.parse(ctx.__localStorageData.get(`${engine.SAVE_KEY}_slot_2`)).saveVersion, 8, 'slot source remains unchanged');

const importState = clone(sourceV8);
importState.companyName = 'v8インポート企業';
instance.importSave(JSON.stringify(importState));
assert.equal(instance.g.companyName, 'v8インポート企業');
assert.equal(instance.g.saveVersion, 9);
assert.equal(JSON.parse(ctx.__localStorageData.get(engine.SAVE_KEY)).saveVersion, 9);

const settingsBeforeReset = clone(instance.g.settings);
instance.reset();
assert.equal(instance.g.saveVersion, 9);
assert.equal(instance.g.competitorMigrationV9Applied, true);
assert.deepEqual(instance.g.settings, settingsBeforeReset);
assert.deepEqual(findStateIssues(instance.g), []);

console.log('save version 9 migration tests passed');
