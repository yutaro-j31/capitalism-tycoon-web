const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a2c0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { modules } = loadGame({ random });
const { engine, finance, playerCrisis, playerCrisisRestructuring } = modules;

assert.ok(playerCrisisRestructuring?.__installed, 'player crisis restructuring must be registered');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function makeEngine() {
  return new engine.TycoonEngine(engine.createInitialState({ configured: true }));
}
function forceCrisis(game, targetCash = -1_000_000) {
  game.g.week = 4;
  const delta = targetCash - game.g.companyCash;
  game.g.companyCash = targetCash;
  finance.event(game.g, 'otherOperating', Math.abs(delta), {
    cashEffect: delta,
    profitEffect: delta,
    sourceType: 'crisisTestLoss',
    sourceID: `crisis-test-${game.g.week}`,
    operationID: `crisis-test-${game.g.week}`,
    description: '危機再建テスト用損失'
  });
  game.g.playerCrisis.lastEvaluationWeek = 0;
  playerCrisis.evaluate(game.g);
  assert.equal(game.g.playerCrisis.status, 'distressed');
}

const stable = makeEngine();
assert.equal(stable.crisisRestructuringOptions().eligible, false);
assert.equal(stable.executeCrisisDisposition('store', 'missing'), false, 'stable company cannot dispose through crisis API');
assert.equal(stable.g.playerCrisisRestructuring.history.length, 0);

const optionGame = makeEngine();
optionGame.g.productVentures.push(
  { id: 'product-profit', name: '利益プロダクト', valuation: 8_000_000, profit: 100_000, investedCost: 5_000_000 },
  { id: 'product-loss', name: '赤字プロダクト', valuation: 4_000_000, profit: -200_000, investedCost: 5_000_000 }
);
const companyProperty = optionGame.g.properties[0];
companyProperty.owner = 'company';
companyProperty.value = 20_000_000;
const personalProperty = optionGame.g.properties[1];
personalProperty.owner = 'personal';
personalProperty.value = 30_000_000;
forceCrisis(optionGame);
const beforeOptions = JSON.stringify(optionGame.g);
const optionSnapshot = optionGame.crisisRestructuringOptions();
assert.equal(JSON.stringify(optionGame.g), beforeOptions, 'restructuring options must be read-only after normalization');
assert.equal(optionSnapshot.eligible, true);
assert.equal(optionSnapshot.properties.length, 1, 'personal property must not appear in company crisis options');
assert.equal(optionSnapshot.properties[0].id, companyProperty.id);
assert.deepEqual(optionSnapshot.products.map(row => row.id), ['product-loss', 'product-profit'], 'loss-making products must be prioritized deterministically');
assert.ok(optionSnapshot.recommended.length >= 1);
for (const row of optionSnapshot.recommended) {
  assert.ok(Number.isFinite(row.expectedCash));
  assert.ok(Number.isFinite(row.weeklyProfit));
}

const game = makeEngine();
const tenant = game.g.tenants.find(row => row.businessID === 'ramen' && !row.occupiedBy);
assert.ok(tenant, 'ramen tenant required');
assert.equal(game.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '危機整理ラーメン', operatingHours: 3 }), true);
const store = game.g.stores[0];
store.status = 'open';
store.lastProfit = -350_000;
forceCrisis(game);
const candidate = game.crisisRestructuringOptions().stores.find(row => row.id === store.id);
assert.ok(candidate);
const cashBefore = game.g.companyCash;
assert.equal(game.executeCrisisDisposition('store', store.id), true);
assert.equal(game.g.stores.some(row => row.id === store.id), false);
assert.equal(game.g.companyCash - cashBefore, candidate.expectedCash);
const history = game.g.playerCrisisRestructuring.history;
assert.equal(history.length, 1);
assert.equal(history[0].type, 'store');
assert.equal(history[0].targetID, store.id);
assert.equal(history[0].realizedCash, candidate.expectedCash);
assert.ok(history[0].detail.includes('distressed→'));
assert.equal(game.executeCrisisDisposition('store', store.id), false, 'disposed store cannot be executed twice');
const financeResult = finance.validate(game.g);
assert.equal(financeResult.ok, true, financeResult.errors.join(' / '));
assert.deepEqual(findStateIssues(game.g), []);

const restored = new engine.TycoonEngine(JSON.parse(JSON.stringify(game.g)));
assert.equal(restored.g.playerCrisisRestructuring.history.length, 1);
const beforeValidate = JSON.stringify(restored.g);
assert.doesNotThrow(() => playerCrisisRestructuring.validate(restored.g));
assert.equal(JSON.stringify(restored.g), beforeValidate, 'restructuring validation must be read-only');

restored.g.playerCrisisRestructuring.history = Array.from({ length: 60 }, (_, index) => ({
  actionID: `legacy-${index}`,
  operationID: `legacy-operation-${index}`,
  week: index + 1,
  type: 'store',
  targetID: `store-${index}`,
  targetName: `店舗${index}`,
  expectedCash: 1_000_000,
  cashBefore: -1_000_000,
  cashAfter: 0,
  realizedCash: 1_000_000,
  status: 'completed',
  detail: 'legacy'
}));
playerCrisisRestructuring.ensure(restored.g);
assert.equal(restored.g.playerCrisisRestructuring.history.length, playerCrisisRestructuring.HISTORY_LIMIT);
assert.equal(restored.g.playerCrisisRestructuring.history[0].actionID, 'legacy-8');
assert.doesNotThrow(() => playerCrisisRestructuring.validate(restored.g));

console.log('player crisis restructuring tests passed');
