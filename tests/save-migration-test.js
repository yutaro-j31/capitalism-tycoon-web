const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');
const { engineModule } = loadGame();
const { SAVE_VERSION, migrateSave, TycoonEngine } = engineModule;
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const assert = (ok, message) => { if (!ok) throw new Error(message); };

{
  const raw = fixture('legacy-unversioned-minimal.json');
  const before = clone(raw);
  const result = migrateSave(raw);
  assert(result.ok, `legacy minimal should migrate: ${result.errors}`);
  const g = result.state;
  assert(g.saveVersion === SAVE_VERSION, 'legacy migrated to current version');
  assert(g.companyName === '旧商事' && g.playerName === '旧創業者', 'names preserved');
  assert(g.week === 12 && g.companyCash === 12345678 && g.personalCash === 7654321, 'core numbers preserved');
  assert(Array.isArray(g.properties) && Array.isArray(g.productVentures), 'missing top-level arrays filled');
  assert(JSON.stringify(raw) === JSON.stringify(before), 'legacy fixture input not mutated');
}

{
  const raw = fixture('legacy-partial-entities.json');
  const before = clone(raw);
  const result = migrateSave(raw);
  assert(result.ok, `partial entities should migrate: ${result.errors}`);
  const g = result.state;
  const store = g.stores[0];
  assert(store.id === 'store-a' && store.name === '欠落店舗' && store.quality === 0 && store.customKeep === 'keep', 'store values and unknown prop preserved');
  assert(store.status && 'lastSales' in store && 'operatingHours' in store, 'store internals filled');
  const product = g.productVentures[0];
  assert(product.id === 'prod-a' && product.valuation === 0 && 'weeklyRevenue' in product && 'users' in product, 'product internals filled');
  assert(g.subsidiaries[0].id === 'sub-a' && 'weeklyProfit' in g.subsidiaries[0], 'subsidiary internals filled');
  assert(g.companyStocks.stock_1.qty === 0 && g.companyStocks.stock_1.brokerNote === 'keep', 'company stock holding filled without overwriting zero/unknown');
  assert(g.personalStocks.stock_2.qty === 5 && g.personalStocks.stock_2.avg === 0, 'personal stock holding filled');
  assert(g.angelInvestments[0].id === 'angel-a' && 'multiple' in g.angelInvestments[0], 'angel investment filled');
  assert(g.peDeals[0].id === 'pe-a' && 'currentValuation' in g.peDeals[0], 'PE deal filled');
  assert(g.personalRealEstateHoldings[0].id === 'pre-a' && 'currentValue' in g.personalRealEstateHoldings[0], 'personal real estate filled');
  assert(g.keyPersonnel[0].id === 'key-a' && 'motivation' in g.keyPersonnel[0], 'key personnel filled');
  assert(JSON.stringify(raw) === JSON.stringify(before), 'partial fixture input not mutated');
}

{
  const raw = fixture('current-version-save.json');
  const beforeOrder = raw.stores.map(x => x.id).join(',');
  const result = migrateSave(raw);
  assert(result.ok, `current save should migrate: ${result.errors}`);
  const g = result.state;
  assert(g.saveVersion === SAVE_VERSION, 'current version stays current');
  assert(g.companyCash === raw.companyCash && g.personalCash === raw.personalCash && g.week === raw.week, 'current core numbers preserved');
  assert(g.stores.map(x => x.id).join(',') === beforeOrder, 'array order preserved');
  assert(g.stores[0].id === raw.stores[0].id && g.productVentures[0].id === raw.productVentures[0].id, 'IDs preserved');
}

{
  const raw = fixture('legacy-corrupted-types.json');
  const before = clone(raw);
  const result = migrateSave(raw);
  assert(!result.ok, 'corrupted types should be a clear migration error');
  assert(result.errors.join('\n').match(/stores|week|settings|有限数|配列|オブジェクト/), 'corrupted error should be specific');
  assert(JSON.stringify(raw) === JSON.stringify(before), 'corrupted input not mutated');
}

{
  const raw = fixture('future-version-save.json');
  const result = migrateSave(raw);
  assert(!result.ok, 'future version should not migrate');
  assert(result.errors.join('\n').includes('新しいsaveVersion'), 'future version reports clear error');
}

{
  const once = migrateSave(fixture('legacy-partial-entities.json'));
  assert(once.ok, once.errors.join('\n'));
  const twice = migrateSave(once.state);
  assert(twice.ok, twice.errors.join('\n'));
  assert(JSON.stringify(once.state) === JSON.stringify(twice.state), 'migration is idempotent');
  assert(twice.state.stores.length === once.state.stores.length, 'idempotency does not add stores');
  assert(twice.state.companyCash === once.state.companyCash, 'idempotency does not change cash');
  assert(twice.state.news.length === once.state.news.length && twice.state.history.length === once.state.history.length && twice.state.reports.length === once.state.reports.length, 'idempotency does not grow logs');
}

{
  const raw = fixture('legacy-partial-entities.json');
  const migrated = migrateSave(raw);
  assert(migrated.ok, migrated.errors.join('\n'));
  const e = new TycoonEngine(migrated.state);
  e.normalize();
  const roundTrip = JSON.parse(JSON.stringify(e.g));
  const migratedAgain = migrateSave(roundTrip);
  assert(migratedAgain.ok, migratedAgain.errors.join('\n'));
  const g = migratedAgain.state;
  assert(g.companyName === '部分商事' && g.companyCash === 22222222 && g.stores[0].id === 'store-a', 'save round trip preserves important fields');
}

console.log('save migration checks passed');
