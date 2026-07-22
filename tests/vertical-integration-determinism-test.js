const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function makeEngine(randomImpl) {
  const { modules } = loadGame({ random: randomImpl });
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true;
  engine.g.companyCash = 500_000_000;
  engine.g.week = 24;
  engine.g.stores.push({
    id: 'ramen-vertical', businessID: 'ramen', prefID: 'tokyo', name: '垂直統合店',
    status: 'open', condition: 100, operatingHours: 3, openingWeek: 1, weeksToOpen: 0,
    lastSales: 12_000_000, lastProfit: 2_000_000
  });
  engine.g.verticalIntegrationAssets.push({
    id: 'warehouse', assetID: 'asset-fixed', name: '物流倉庫', businessID: 'all',
    cost: 120_000_000, weeklyCost: 900_000, costReduction: .06, risk: 1, active: true,
    startedWeek: 10, condition: 100
  });
  return { engine, modules };
}

let blockRandom = false;
const guardedRandom = () => {
  if (blockRandom) throw new Error('vertical integration maintenance must not use Math.random');
  return .5;
};
const first = makeEngine(guardedRandom);
const { engine, modules } = first;
blockRandom = true;
assert.doesNotThrow(() => engine.updateSupplyChainWeekly());
const snapshot = JSON.stringify({
  cash: engine.g.companyCash,
  condition: engine.g.verticalIntegrationAssets[0].condition,
  events: engine.g.supplyChainEvents
});

const { engine: replay } = makeEngine(() => .999999);
assert.doesNotThrow(() => replay.updateSupplyChainWeekly());
assert.equal(JSON.stringify({
  cash: replay.g.companyCash,
  condition: replay.g.verticalIntegrationAssets[0].condition,
  events: replay.g.supplyChainEvents
}), snapshot, 'vertical integration maintenance must be deterministic for the same asset and week');
assert.equal(replay.g.saveVersion, modules.engine.SAVE_VERSION);
assert.equal(modules.engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
console.log('vertical integration deterministic maintenance checks passed');
