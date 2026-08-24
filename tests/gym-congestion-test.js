'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

const EPSILON = 1e-12;
const business = { price: 7800, quality: 40, efficiency: 12.5 };
const makeStore = (members, extra = {}) => ({ id: 'gym-congestion', businessID: 'gym', status: 'open', level: 1, condition: 85, gymMembership: { members, totals: {} }, ...extra });
const moduleFor = () => loadGame({}).modules.gymMembershipModel;

// Exact 80%-threshold curve: capacity is 500 at efficiency 12.5 and equipment level 1.
{
  const mod = moduleFor();
  assert.equal(mod.capacityFor(makeStore(0), business), 500);
  for (const [occupancy, expected] of [[0, 0], [.79, 0], [.8, 0], [.85, .0045], [.9, .009], [.95, .0135], [1, .018]]) {
    const crowding = mod.crowdingFor(makeStore(500 * occupancy), business);
    assert.ok(Math.abs(crowding.occupancy - occupancy) < EPSILON);
    assert.ok(Math.abs(crowding.extraChurnRate - expected) < EPSILON, `crowding curve at ${occupancy}`);
  }
}

// Below and at 80%, total churn exactly matches the legacy formula; above it is monotonic and bounded.
{
  const mod = moduleFor(), totals = [];
  for (const occupancy of [.6, .8, .9, 1]) {
    const store = makeStore(500 * occupancy);
    const breakdown = mod.churnBreakdownFor(business, store, .7);
    if (occupancy <= .8) assert.equal(breakdown.total, mod.legacyChurnRateFor(business, store));
    assert.ok(breakdown.total <= .13);
    assert.ok(Math.abs(['base', 'quality', 'condition', 'competition', 'crowding'].reduce((sum, key) => sum + breakdown[key], 0) - breakdown.total) < EPSILON);
    totals.push(breakdown.total);
  }
  assert.ok(totals[0] === totals[1] && totals[1] < totals[2] && totals[2] < totals[3]);
}

// Existing equipment and efficiency investments relieve congestion at the same member count.
{
  const mod = moduleFor(), members = 500;
  const level1 = makeStore(members, { level: 1 }), level8 = makeStore(members, { level: 8 }), efficient = { ...business, efficiency: 100 };
  const baseline = mod.crowdingFor(level1, business), equipment = mod.crowdingFor(level8, business), efficiency = mod.crowdingFor(level1, efficient);
  assert.ok(mod.capacityFor(level8, business) > mod.capacityFor(level1, business));
  assert.ok(equipment.occupancy < baseline.occupancy && equipment.extraChurnRate < baseline.extraChurnRate);
  assert.ok(mod.capacityFor(level1, efficient) > mod.capacityFor(level1, business));
  assert.ok(efficiency.occupancy < baseline.occupancy && efficiency.extraChurnRate < baseline.extraChurnRate);
  console.log(`GYM_CONGESTION_INVESTMENT ${JSON.stringify({baseline:{capacity:mod.capacityFor(level1,business),...baseline,totalChurn:mod.churnRateFor(business,level1,.5)},equipment:{capacity:mod.capacityFor(level8,business),...equipment,totalChurn:mod.churnRateFor(business,level8,.5)},efficiency:{capacity:mod.capacityFor(level1,efficient),...efficiency,totalChurn:mod.churnRateFor(efficient,level1,.5)}})}`);
}

// Churn reason allocation remains exact, deterministic, and includes crowding.
{
  const mod = moduleFor(), store = makeStore(500), g = { week: 1, stores: [store] };
  mod.processStore(g, store, business, 0, 1, .6);
  const row = store.gymMembership.lastWeek;
  assert.equal(Object.values(row.churnedByReason).reduce((sum, value) => sum + value, 0), row.churned);
  assert.ok(row.churnedByReason.crowding > 0);
  const breakdown = mod.churnBreakdownFor(business, makeStore(500), .6);
  assert.deepEqual(mod.allocateChurnedByReason(37, breakdown), mod.allocateChurnedByReason(37, breakdown));
}

// Start-of-week lag: same-week signups do not recursively create crowding churn.
{
  const mod = moduleFor(), store = makeStore(0), g = { week: 1, stores: [store] };
  mod.processStore(g, store, business, 5000, 1, 0);
  const first = store.gymMembership.lastWeek;
  assert.equal(first.occupancyBefore, 0);
  assert.equal(first.crowdingChurnRate, 0);
  assert.equal(first.members, first.capacity);
  assert.ok(first.lostSignups > 0, 'existing capacity/lost-signups contract remains active');
  g.week++;
  mod.processStore(g, store, business, 0, 1, 0);
  const second = store.gymMembership.lastWeek;
  assert.equal(second.occupancyBefore, 1);
  assert.ok(Math.abs(second.crowdingChurnRate - .018) < EPSILON);
  assert.ok(second.churnedByReason.crowding > 0);
}

// Old saves gain a zero crowding reason; new bounded last-week fields survive a real save/load.
{
  const { modules, ctx } = loadGame({});
  const mod = modules.gymMembershipModel;
  const legacy = makeStore(100, { gymMembership: { members: 100, totals: { churnedByReason: { base: 4 } }, lastWeek: { capacity: 500 } } });
  mod.ensureStore(legacy);
  assert.equal(legacy.gymMembership.totals.churnedByReason.crowding, 0);
  assert.doesNotThrow(() => mod.crowdingFor(legacy, business));
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  const tenant = engine.g.tenants.find(row => !row.occupiedBy);
  const store = makeStore(500, { id: 'saved-gym', prefID: tenant.prefID, tenantID: tenant.id });
  engine.g.stores.push(store);
  mod.processStore(engine.g, store, business, 0, 1, .4);
  const before = JSON.stringify(store.gymMembership.lastWeek);
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  const after = reloaded.g.stores.find(row => row.id === store.id).gymMembership.lastWeek;
  assert.equal(JSON.stringify(after), before);
  for (const key of ['occupancyBefore', 'occupancyAfter', 'crowdingChurnRate']) assert.ok(Number.isFinite(after[key]));
}

// No RNG consumption and identical inputs produce identical outputs.
{
  let calls = 0, seed = 12345;
  const random = () => { calls++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const { modules } = loadGame({ random });
  const mod = modules.gymMembershipModel;
  const beforeCalls = calls;
  const run = () => { const store = makeStore(450); return { result: mod.processStore({ week: 7, stores: [store] }, store, business, 25, 1, .3), state: store.gymMembership }; };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.equal(calls, beforeCalls);
}

// Balance probe at identical quality/condition/competition/price/demand.
{
  const mod = moduleFor(), rows = [];
  for (const occupancy of [.6, .8, .9, 1]) {
    const store = makeStore(500 * occupancy), g = { week: 10, stores: [store] };
    const result = mod.processStore(g, store, business, 20, 1, .5), row = store.gymMembership.lastWeek;
    rows.push({occupancy,weeklyChurnRate:mod.churnRateFor(business,makeStore(500*occupancy),.5),churned:row.churned,membersAfter:row.members,signups:row.signups,lostSignups:row.lostSignups,sales:result.sales,contribution:result.sales-result.variable});
  }
  assert.ok(rows.at(-1).membersAfter > 0 && rows.at(-1).contribution > 0, 'a full gym must not collapse in one week');
  console.log(`GYM_CONGESTION_BALANCE ${JSON.stringify(rows)}`);
}

// Minimal UI wiring: current occupancy, crowded-store count, reason, and existing relief controls only.
{
  const app = fs.readFileSync('js/app.js', 'utf8');
  for (const text of ['混雑率', '混雑店舗', "reasonSum('crowding')", '混雑は設備強化・効率化で定員を増やすと改善できます']) assert.ok(app.includes(text));
  assert.doesNotMatch(app, /data-action="gym-congestion"/);
}

console.log('gym congestion tests passed');
