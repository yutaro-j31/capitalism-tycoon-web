const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT } = require('./harness');

function seededRandom(seed = 1) { let s = seed >>> 0, calls = 0; const fn = () => { calls++; s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; fn.calls = () => calls; return fn; }

{
  const { engineModule } = loadGame();
  const { createInitialState, TycoonEngine, migrateSave, SAVE_VERSION } = engineModule;
  const state = createInitialState({ configured: true });
  assert.equal(state.saveVersion, SAVE_VERSION);
  for (const s of state.market) {
    assert(Array.isArray(s.priceHistory), `${s.id} has history`);
    assert(s.priceHistory.length >= 1, `${s.id} history seeded`);
    assert(s.priceHistory.every(r => Number.isFinite(r.week) && Number.isFinite(r.price) && r.price > 0), `${s.id} safe rows`);
  }
  const e = new TycoonEngine(state);
  const before = new Map(e.g.market.map(s => [s.id, s.priceHistory.length]));
  e.advanceWeek(false);
  for (const s of e.g.market) {
    assert.equal(s.priceHistory.length, before.get(s.id) + 1, `${s.id} one row per week`);
    assert.equal(s.priceHistory.at(-1).week, e.g.week, `${s.id} latest week`);
    assert.equal(s.priceHistory.at(-1).price, s.price, `${s.id} latest price`);
    assert.equal(new Set(s.priceHistory.map(r => r.week)).size, s.priceHistory.length, `${s.id} no duplicate weeks`);
  }
  const afterWeek = e.g.market.map(s => s.priceHistory.length).join(',');
  e.buyStock(e.g.market[0].id, 1, 'personal');
  e.sellStock(e.g.market[0].id, 1, 'personal');
  assert.equal(e.g.market.map(s => s.priceHistory.length).join(','), afterWeek, 'trades do not append history');
  for (let i = 0; i < 270; i++) e.advanceWeek(false);
  assert(e.g.market.every(s => s.priceHistory.length <= 260), 'history capped at 260');

  const legacy = JSON.parse(JSON.stringify(state));
  legacy.saveVersion = 2;
  legacy.market = legacy.market.map(s => { const { priceHistory, ...rest } = s; return rest; });
  legacy.personalStocks[legacy.market[0].id] = { qty: 12, avg: 3456 };
  const migrated = migrateSave(legacy);
  assert(migrated.ok, migrated.errors.join('\n'));
  assert.equal(migrated.state.saveVersion, SAVE_VERSION);
  assert.equal(migrated.state.personalStocks[legacy.market[0].id].qty, 12);
  assert.equal(migrated.state.personalStocks[legacy.market[0].id].avg, 3456);
  for (const s of migrated.state.market) assert(s.priceHistory.length >= 1 && s.priceHistory.length <= 2, `${s.id} minimal migrated history`);
  assert(migrateSave(migrated.state).ok, 'migration idempotent');
}

{
  const baseline = seededRandom(7);
  const changed = seededRandom(7);
  const { engineModule: a } = loadGame({ random: baseline });
  const { engineModule: b } = loadGame({ random: changed });
  const ea = new a.TycoonEngine(a.createInitialState({ configured: true }));
  const eb = new b.TycoonEngine(b.createInitialState({ configured: true }));
  ea.advanceWeek(false); eb.advanceWeek(false);
  assert.equal(baseline.calls(), changed.calls(), 'random call count stable across identical stock-history run');
  assert.deepEqual(ea.g.market.map(s => ({ id:s.id, price:s.price, previous:s.previous, marketCap:s.marketCap, per:s.per, pbr:s.pbr })), eb.g.market.map(s => ({ id:s.id, price:s.price, previous:s.previous, marketCap:s.marketCap, per:s.per, pbr:s.pbr })));
}

{
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  assert(app.includes('id="stock-price-chart"'), 'stock chart canvas exists');
  assert(app.includes('data-action="select-stock"'), 'stock selection action exists');
  assert(app.includes('stock-chart-range'), 'range action exists');
  for (const label of ['13週','26週','52週','全期間']) assert(app.includes(label), `${label} range exists`);
  assert(css.includes('.market-row.selected'), 'selected row CSS exists');
  assert(css.includes('@media(max-width:720px)') && css.includes('.stock-detail-card'), 'mobile stock CSS exists');
}
console.log('stock chart tests passed');
