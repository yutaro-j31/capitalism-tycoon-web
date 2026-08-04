const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function seededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function makeGame(seedValue) {
  const { modules } = loadGame({ random: seededRandom(seedValue), isolatedLegacyIndex: true });
  const { engine, finance, market, data } = modules;
  const state = engine.createInitialState({ configured: true });
  const business = state.businesses.find(row => !market.isTargetBusinessID(row.id));
  assert.ok(business, 'a legacy cash-COGS business is required');
  Object.assign(business, {
    price: 123.45,
    unitCost: 45.67,
    fixedCost: 100000.89,
    wage: 20000.78,
    demand: 0.25,
    quality: 0,
    brand: 0,
    efficiency: 0,
    dx: 0,
    storeCost: 0
  });
  const pref = state.prefs[0];
  pref.rent = 30000.67;
  pref.traffic = 1;
  state.companyCash = 1_000_000_000;
  state.companyDebt = 0;
  state.properties = [];
  state.startups = [];
  state.competitors = [];
  state.market = [];
  state.productVentures = [];
  state.subsidiaries = [];
  state.maSubsidiaries = [];
  state.overseasSubsidiaries = [];
  state.sportsTeams = [];
  state.personalInvestments = [];
  state.luxuryAssets = [];
  state.activeMissionIDs = [];
  state.completedMissionIDs = (data.MISSION_DEFS || []).map(row => row.id);
  state.stores = [{
    id: 'integer-store',
    businessID: business.id,
    prefID: pref.id,
    name: '整数円テスト店',
    status: 'open',
    condition: 99.876,
    operatingHours: 3,
    openingWeek: 1,
    weeksToOpen: 0,
    lastSales: 0,
    lastProfit: 0,
    marketResult: null
  }];
  state.finance = finance.defaultFinanceState(state);
  return { game: new engine.TycoonEngine(state), modules, storeID: 'integer-store' };
}

function run(seedValue, weeks) {
  const { game, modules, storeID } = makeGame(seedValue);
  const startingCash = game.g.companyCash;
  const initialAdjustments = game.g.finance.roundingAdjustmentCount || 0;
  let firstWeekRows = null;
  for (let i = 0; i < weeks; i++) {
    assert.equal(game.advanceWeek(false), true);
    const weekRows = game.g.finance.transactions.filter(row => row.week === game.g.week);
    const storeRows = weekRows.filter(row => row.storeID === storeID && [
      'revenue', 'costOfSales', 'rent', 'payroll', 'maintenance'
    ].includes(row.category));
    assert.equal(storeRows.length, 5, `week ${game.g.week} must record five store entries`);
    for (const row of storeRows) {
      assert.equal(Number.isInteger(row.amount), true, `${row.category} amount must be integer yen`);
      assert.equal(Number.isInteger(row.cashEffect), true, `${row.category} cashEffect must be integer yen`);
      assert.equal(Number.isInteger(row.profitEffect), true, `${row.category} profitEffect must be integer yen`);
    }
    const snapshot = game.g.finance.weeklySnapshots.find(row => row.week === game.g.week);
    assert.ok(snapshot, `week ${game.g.week} snapshot is required`);
    assert.ok(Math.abs(snapshot.cashDifference) <= 1e-9, `week ${game.g.week} cashDifference ${snapshot.cashDifference}`);
    if (!firstWeekRows) firstWeekRows = JSON.parse(JSON.stringify(storeRows));
  }
  const store = game.g.stores.find(row => row.id === storeID);
  assert.equal(Number.isInteger(store.lastSales), true);
  assert.equal(Number.isInteger(store.lastProfit), true);
  const adjustmentCount=game.g.finance.roundingAdjustmentCount||0;
  if(adjustmentCount!==initialAdjustments){
    console.log('STAGE1_ROUNDING_DIAGNOSTIC',JSON.stringify({weeks,initialAdjustments,adjustmentCount,history:game.g.finance.roundingAdjustmentHistory||[],lastTransactions:game.g.finance.transactions.slice(-30)},null,2));
  }
  if(weeks===1)assert.equal(adjustmentCount,initialAdjustments,'first store-only week must not need rounding adjustments');
  const validation = modules.finance.validate(game.g);
  assert.equal(validation.ok, true, validation.errors.join(' / '));
  const restored = new modules.engine.TycoonEngine(JSON.parse(JSON.stringify(game.g)));
  const restoredValidation = modules.finance.validate(restored.g);
  assert.equal(restoredValidation.ok, true, restoredValidation.errors.join(' / '));
  return JSON.parse(JSON.stringify({
    cash: game.g.companyCash,
    cashDelta: game.g.companyCash - startingCash,
    storeLastSales: store.lastSales,
    storeLastProfit: store.lastProfit,
    roundingAdjustmentCount: game.g.finance.roundingAdjustmentCount || 0,
    firstWeekRows
  }));
}

const oneWeek = run(0x289001, 1);
assert.equal(oneWeek.roundingAdjustmentCount,0);
const first = run(0x289001, 52);
const second = run(0x289001, 52);
assert.deepEqual(second, first, 'same seed and operations must remain deterministic');
console.log(JSON.stringify(first, null, 2));
console.log('store weekly integer-yen tests passed');
