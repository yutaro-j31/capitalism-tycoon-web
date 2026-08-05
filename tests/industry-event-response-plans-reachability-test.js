'use strict';
const assert = require('node:assert');
const { loadGame } = require('./harness');

function makeRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function createEngine(seed, name) {
  const loaded = loadGame({ headless:true, random:makeRandom(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({
    playerName:'Audit Player', companyName:name, difficulty:'normal', scenario:'free',
    founderPrefID:'fukuoka', founderTraitID:'merchant'
  });
  engine.g.companyCash = 200_000_000;
  engine.g.companyDebt = 0;
  delete engine.g.finance;
  engine.normalize();
  const tenant = engine.g.tenants.find(row => row.prefID === 'fukuoka' && row.businessID === 'ramen' && !row.occupiedBy);
  assert(tenant, 'normal Fukuoka ramen tenant is available');
  assert.equal(engine.openStore({ tenantID:tenant.id, businessID:'ramen', name:'Response Plan Ramen' }), true, 'normal gameplay opens an operating ramen store');
  assert.equal(engine.g.stores.length, 1, 'fixture contains one real operating store');
  assert(loaded.modules.finance.validate(engine.g).ok, JSON.stringify(loaded.modules.finance.validate(engine.g)));
  return { loaded, engine };
}

function advanceToFirstEvent(seed, name) {
  const ctx = createEngine(seed, name);
  while (!ctx.engine.g.activeIndustryEvent && ctx.engine.g.week <= 208) {
    assert.notEqual(ctx.engine.advanceWeek(false), false, 'normal weekly progression must continue');
  }
  assert(ctx.engine.g.activeIndustryEvent, 'normal play reaches an industry event within 208 weeks');
  return ctx;
}

function pickFinite(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function measuredOutcome(seed, planType) {
  const { loaded, engine } = advanceToFirstEvent(seed, planType || 'no-plan-control');
  const eventId = engine.g.activeIndustryEvent.id;
  const business = engine.g.businesses.find(row => row.id === 'ramen');
  const store = engine.g.stores[0];
  const beforeCash = engine.g.companyCash;
  const baseDemand = Number(business.demand);
  let appliedDemand = baseDemand;
  let appliedUnitCost = Number(business.unitCost);
  let cost = 0;
  if (planType) {
    cost = engine.getIndustryEventResponsePlanCost(planType);
    assert.equal(engine.activateIndustryEventResponsePlan(planType), true, `${planType} is selectable during a naturally active event`);
    assert.equal(engine.g.activeIndustryEventResponsePlan.type, planType);
    assert.equal(engine.activateIndustryEventResponsePlan(planType), false, 'one plan per event prevents duplicate selection');
    assert.equal(beforeCash - engine.g.companyCash, cost, 'activation cash outflow equals quoted plan cost');
    loaded.modules.industryEventResponsePlans.withPlan(engine, () => {
      appliedDemand = Number(business.demand);
      appliedUnitCost = Number(business.unitCost);
    });
    assert(loaded.modules.finance.validate(engine.g).ok, JSON.stringify(loaded.modules.finance.validate(engine.g)));
  }
  const cashBeforeWeek = engine.g.companyCash;
  assert.notEqual(engine.advanceWeek(false), false, 'post-selection week advances normally');
  const operatingCashDelta = engine.g.companyCash - cashBeforeWeek;
  const adjustedFinalCash = engine.g.companyCash + cost;
  const marketResult = engine.g.marketResultsByStoreID?.[store.id] || store.marketResult || {};
  const supplyResult = engine.g.supplyResultsByStoreID?.[store.id] || {};
  const customers = pickFinite(marketResult, ['customers','customerCount','visitors','units','quantity','demandUnits']);
  const demandInput = pickFinite(marketResult, ['demand','effectiveDemand','demandScore','demandMultiplier','marketDemand']);
  const sales = pickFinite(marketResult, ['sales','revenue','grossSales']) ?? Number(store.lastSales || 0);
  const grossCost = pickFinite(marketResult, ['cost','costOfSales','variableCost','cogs'])
    ?? pickFinite(supplyResult, ['cost','procurementCost','usedCost'])
    ?? Math.max(0, sales - Number(store.lastProfit || 0));
  const profit = pickFinite(marketResult, ['profit','operatingProfit']) ?? Number(store.lastProfit || 0);
  const trace = {
    planType:planType || 'control', eventId, eventWeek:engine.g.week - 1,
    baseDemand, appliedDemand, appliedUnitCost, demandInput, customers, sales, grossCost, profit, operatingCashDelta
  };
  console.log(`response-plan-trace ${JSON.stringify(trace)}`);
  return {
    ...trace,
    cost,
    adjustedFinalCash,
    storeCount:engine.g.stores.length,
    financeValid:loaded.modules.finance.validate(engine.g).ok,
    planValid:loaded.modules.industryEventResponsePlans.validate(engine.g).ok
  };
}

function runLifecycle(seed, weeks=208) {
  const { loaded, engine } = createEngine(seed, 'Response Plan Reachability Co');
  const planOrder = ['demandDefense', 'supplyHedge', 'technologyInvestment'];
  const selected = [];
  const starts = [];
  let lastEventId = null;

  for (let i = 0; i < weeks; i += 1) {
    assert.notEqual(engine.advanceWeek(false), false, `week ${engine.g.week} must advance`);
    const eventId = engine.g.activeIndustryEvent?.id || null;
    if (eventId && eventId !== lastEventId) {
      starts.push({ week:engine.g.week, eventId });
      if (selected.length < planOrder.length) {
        const type = planOrder[selected.length];
        const before = engine.g.companyCash;
        const quoted = engine.getIndustryEventResponsePlanCost(type);
        assert.equal(engine.activateIndustryEventResponsePlan(type), true, `${type} can be selected in normal play`);
        assert.equal(before - engine.g.companyCash, quoted, `${type} is charged exactly once`);
        selected.push({ week:engine.g.week, eventId, type, cost:quoted });
      }
    }
    lastEventId = eventId;
  }

  assert.equal(selected.length, 3, 'all three response plans are reachable within 208 weeks');
  const history = engine.g.industryEventResponsePlanHistory || [];
  const activations = history.filter(row => row?.type === 'activated');
  const expirations = history.filter(row => row?.type === 'expired');
  console.log(`response-plan-lifecycle-diagnosis ${JSON.stringify({
    requestedWeeks:weeks,
    finalWeek:engine.g.week,
    starts,
    selected,
    history,
    activeIndustryEvent:engine.g.activeIndustryEvent || null,
    activePlan:engine.g.activeIndustryEventResponsePlan || null,
    activationCount:activations.length,
    expirationCount:expirations.length
  })}`);
  assert.equal(activations.length, 3, 'three plan activations are recorded');
  assert(expirations.length >= 3, 'plans automatically expire when their events end or change');
  assert.equal(engine.g.activeIndustryEventResponsePlan, null, 'final expired event leaves no stale active plan');
  assert(history.length <= loaded.modules.industryEventResponsePlans.HISTORY_LIMIT, 'response-plan history remains bounded');
  assert(loaded.modules.finance.validate(engine.g).ok, JSON.stringify(loaded.modules.finance.validate(engine.g)));
  assert(loaded.modules.industryEventResponsePlans.validate(engine.g).ok, JSON.stringify(loaded.modules.industryEventResponsePlans.validate(engine.g)));

  const restored = new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(engine.g)));
  restored.normalize();
  assert(loaded.modules.finance.validate(restored.g).ok, 'save-shaped reload remains finance-valid');
  assert(loaded.modules.industryEventResponsePlans.validate(restored.g).ok, 'save-shaped reload retains a valid response-plan state');

  return { starts, selected, activationCount:activations.length, expirationCount:expirations.length, finalWeek:engine.g.week, historyLength:history.length };
}

const seed = 0x8c200319;
const control = measuredOutcome(seed, null);
const demand = measuredOutcome(seed, 'demandDefense');
const supply = measuredOutcome(seed, 'supplyHedge');
const technology = measuredOutcome(seed, 'technologyInvestment');

for (const result of [demand, supply, technology]) {
  assert.equal(result.eventId, control.eventId, 'plan and control observe the same deterministic event');
  assert.equal(result.eventWeek, control.eventWeek, 'plan and control reach the event on the same week');
  assert(result.financeValid && result.planValid, `${result.planType} remains accounting- and state-valid`);
  assert.equal(result.storeCount, 1, 'plan comparison uses an actual operating store');
  assert.notEqual(result.adjustedFinalCash, control.adjustedFinalCash, `${result.planType} changes the real weekly cash outcome after removing activation cost`);
}
assert(demand.appliedDemand > demand.baseDemand, 'demand defense changes business demand before weekly sales calculation');
assert(supply.appliedUnitCost < supply.baseDemand || supply.grossCost !== control.grossCost, 'supply hedge changes effective cost input or realized cost');

const full = runLifecycle(seed, 208);
const deterministicA = runLifecycle(seed, 80);
const deterministicB = runLifecycle(seed, 80);
assert.deepEqual(deterministicA, deterministicB, 'response-plan reachability and lifecycle are deterministic for the same seed');

console.log(`industry-event-response-plans-reachability-test: ok (plans=${full.selected.map(row => `${row.week}:${row.type}`).join(', ')}; effects=${[demand,supply,technology].map(row => `${row.planType}:${row.adjustedFinalCash-control.adjustedFinalCash}`).join(', ')})`);
