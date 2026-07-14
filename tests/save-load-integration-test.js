const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');
const fixtureText = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const fixture = name => JSON.parse(fixtureText(name));
const clone = value => JSON.parse(JSON.stringify(value));
const assert = (ok, message) => { if (!ok) throw new Error(message); };

function bootWithStorage(entries) {
  const { ctx, engineModule } = loadGame({ localStorageInitial: entries });
  return { ctx, engine: ctx.__ct_engine, SAVE_KEY: engineModule.SAVE_KEY, SAVE_VERSION: engineModule.SAVE_VERSION, TycoonEngine: engineModule.TycoonEngine, migrateSave: engineModule.migrateSave };
}
function setCallsFor(ctx, key) { return ctx.__localStorageHistory.setItem.filter(x => x.key === key); }
function getStored(ctx, key) { return ctx.__localStorageData.get(key); }

{
  const rawObj = fixture('legacy-partial-entities.json');
  rawObj.stores[0].id = 'store-a';
  const raw = JSON.stringify(rawObj);
  const { ctx, engine, SAVE_KEY, SAVE_VERSION } = bootWithStorage({ capitalism_tycoon_web_v1: raw });
  assert(engine.g.companyName === '部分商事' && engine.g.playerName === '部分創業者', 'startup legacy names adopted');
  assert(engine.g.week === 20 && engine.g.companyCash === 22222222 && engine.g.personalCash === 3333333, 'startup legacy core numbers adopted');
  assert(engine.g.stores[0].id === 'store-a', 'startup legacy store ID preserved');
  assert(engine.g.saveVersion === SAVE_VERSION && SAVE_VERSION === 2, 'startup legacy migrated to saveVersion 2');
  assert(getStored(ctx, SAVE_KEY) === raw, 'startup load does not auto-resave before explicit save');
  engine.save();
  assert(setCallsFor(ctx, SAVE_KEY).length === 1, 'explicit save writes migrated state once');
  assert(JSON.parse(getStored(ctx, SAVE_KEY)).saveVersion === 2, 'explicit save persists migrated version');
}

{
  const bad = '{ broken json';
  const { ctx, engine, SAVE_KEY } = bootWithStorage({ capitalism_tycoon_web_v1: bad });
  assert(engine && engine.g && engine._saveBlockedDueToLoadFailure === true, 'corrupt startup falls back without unhandled exception');
  assert(getStored(ctx, SAVE_KEY) === bad, 'corrupt startup preserves original SAVE_KEY bytes');
  assert(setCallsFor(ctx, SAVE_KEY).length === 0, 'corrupt startup does not set SAVE_KEY');
  engine.save();
  assert(getStored(ctx, SAVE_KEY) === bad, 'fallback save is blocked and does not overwrite corrupt save');
  assert(setCallsFor(ctx, SAVE_KEY).length === 0, 'blocked fallback save does not call setItem');
}

{
  const future = fixtureText('future-version-save.json');
  const { ctx, engine, SAVE_KEY } = bootWithStorage({ capitalism_tycoon_web_v1: future });
  assert(engine._saveBlockedDueToLoadFailure === true, 'future startup falls back with save block');
  assert(engine.g.companyName !== '未来商事', 'future startup does not adopt future save');
  assert(getStored(ctx, SAVE_KEY) === future, 'future startup preserves original SAVE_KEY bytes');
  assert(setCallsFor(ctx, SAVE_KEY).length === 0, 'future startup does not overwrite SAVE_KEY');
  engine.save();
  assert(getStored(ctx, SAVE_KEY) === future && setCallsFor(ctx, SAVE_KEY).length === 0, 'future fallback cannot overwrite via save');
}

{
  const { ctx, engine, SAVE_KEY } = bootWithStorage({});
  const slotKey = `${SAVE_KEY}_slot_1`;
  const legacy = fixtureText('legacy-partial-entities.json');
  ctx.localStorage.setItem(slotKey, legacy);
  ctx.__localStorageHistory.setItem.length = 0;
  assert(engine.loadSlot(1) === true, 'normal legacy slot loads');
  assert(engine.g.companyName === '部分商事' && engine.g.stores[0].id === 'store-a', 'normal legacy slot migrated into state');
  assert(JSON.parse(getStored(ctx, SAVE_KEY)).saveVersion === 2, 'normal slot load saves migrated main state');
  assert(getStored(ctx, slotKey) === legacy, 'normal slot source remains unchanged');
}

{
  const { ctx, engine, SAVE_KEY } = bootWithStorage({});
  const beforeState = clone(engine.g);
  const beforeMain = getStored(ctx, SAVE_KEY);
  const slotKey = `${SAVE_KEY}_slot_2`;
  const badSlot = fixtureText('legacy-corrupted-types.json');
  ctx.localStorage.setItem(slotKey, badSlot);
  ctx.__localStorageHistory.setItem.length = 0;
  assert(engine.loadSlot(2) === false, 'bad slot returns failure');
  assert(JSON.stringify(engine.g) === JSON.stringify(beforeState), 'bad slot does not change engine state');
  assert(getStored(ctx, slotKey) === badSlot, 'bad slot source remains unchanged');
  assert(getStored(ctx, SAVE_KEY) === beforeMain, 'bad slot does not change main save');
  assert(setCallsFor(ctx, SAVE_KEY).length === 0 && setCallsFor(ctx, slotKey).length === 0, 'bad slot does not call setItem for main or slot');
}

{
  const { ctx, engine, SAVE_KEY } = bootWithStorage({});
  const legacy = fixtureText('legacy-unversioned-minimal.json');
  engine.importSave(legacy);
  assert(engine.g.companyName === '旧商事' && engine.g.saveVersion === 2, 'legacy JSON import migrates and adopts');
  assert(JSON.parse(getStored(ctx, SAVE_KEY)).companyName === '旧商事', 'legacy JSON import saves migrated main state');
}

for (const [label, text] of [['corrupt', fixtureText('legacy-corrupted-types.json')], ['future', fixtureText('future-version-save.json')], ['invalid-json', '{ no']]) {
  const { ctx, engine, SAVE_KEY } = bootWithStorage({});
  const beforeState = clone(engine.g);
  const beforeMain = getStored(ctx, SAVE_KEY);
  ctx.__localStorageHistory.setItem.length = 0;
  let threw = false;
  try { engine.importSave(text); } catch (error) { threw = true; }
  assert(threw, `${label} import throws to caller`);
  assert(JSON.stringify(engine.g) === JSON.stringify(beforeState), `${label} import does not change state`);
  assert(getStored(ctx, SAVE_KEY) === beforeMain, `${label} import does not change main save`);
  assert(setCallsFor(ctx, SAVE_KEY).length === 0, `${label} import does not set SAVE_KEY`);
}

{
  const raw = fixture('legacy-missing-ids.json');
  const before = clone(raw);
  const { migrateSave } = bootWithStorage({});
  const result = migrateSave(raw);
  assert(result.ok, `missing IDs should migrate: ${result.errors}`);
  assert(result.state.stores[0].id === 'legacy-store-1', 'missing store ID gets deterministic legacy ID');
  assert(result.state.stores[0].businessID === 'ramen' && result.state.stores[0].prefID === 'tokyo', 'store references preserved');
  assert(result.state.productVentures[0].id === 'product-existing', 'existing product ID preserved');
  assert(result.state.subsidiaries[0].id === 'sub-existing', 'existing subsidiary ID preserved');
  assert(result.state.personalInvestments[0].id === 'investment-existing', 'existing investment ID preserved');
  assert(JSON.stringify(raw) === JSON.stringify(before), 'missing-ID fixture not mutated');
}

{
  const raw = fixture('legacy-duplicate-ids.json');
  const before = clone(raw);
  const { migrateSave } = bootWithStorage({});
  const result = migrateSave(raw);
  assert(!result.ok, 'duplicate IDs should be a migration error');
  assert(result.errors.join('\n').includes('重複ID'), 'duplicate ID error is explicit');
  assert(JSON.stringify(raw) === JSON.stringify(before), 'duplicate-ID fixture not mutated');
}

console.log('save/load integration checks passed');
