const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');
const { modules } = loadGame();
const { createInitialState } = modules.engine;
const market = modules.market;

// Founding route rebalance (2026-09): ramen's unitCost/demand were retuned (js/data.js:
// unitCost 300->257, demand 500->538) so standard play reaches a 1B-yen company value in a
// 200-300-week window instead of ~500. That changes absolute yen figures and the margin rate
// (lower unitCost -> higher contributionMarginRate) but not the underlying price/quality/brand
// elasticity this test actually calibrates: every diffRate below is byte-identical to before the
// retune, and every allowed/not-allowed verdict is unchanged. Regenerated via the same scenario()
// function this file already defines.
const EXPECTED = {
  standard_single:{legacy:1068857.22,newSales:1090401.34,diffAmount:21544.13,diffRate:0.020156,unitsSold:1185.2188,variableCost:297602.91,contributionMargin:792798.43,contributionMarginRate:0.727070,marketShare:0.550250,allowed:true},
  advertising:{legacy:1175742.94,newSales:1137847.08,diffAmount:-37895.85,diffRate:-0.032231,unitsSold:1236.7903,variableCost:310552.27,contributionMargin:827294.82,contributionMarginRate:0.727070,marketShare:0.574193,allowed:true},
  quality:{legacy:1159438.34,newSales:1213287.13,diffAmount:53848.80,diffRate:0.046444,unitsSold:1318.7904,variableCost:334374.96,contributionMargin:878912.18,contributionMarginRate:0.724406,marketShare:0.612262,allowed:true},
  brand:{legacy:1282628.66,newSales:1185271.92,diffAmount:-97356.74,diffRate:-0.075904,unitsSold:1288.3390,variableCost:323495.91,contributionMargin:861776.01,contributionMarginRate:0.727070,marketShare:0.598125,allowed:true},
  low_economy:{legacy:908528.63,newSales:926841.14,diffAmount:18312.51,diffRate:0.020156,unitsSold:1007.4360,variableCost:252962.48,contributionMargin:673878.66,contributionMarginRate:0.727070,marketShare:0.550250,allowed:true},
  high_economy:{legacy:1229185.80,newSales:1253961.54,diffAmount:24775.74,diffRate:0.020156,unitsSold:1363.0017,variableCost:342243.35,contributionMargin:911718.19,contributionMarginRate:0.727070,marketShare:0.550250,allowed:true},
  different_pref_two:{legacy:1959211.44,newSales:1906105.73,diffAmount:-53105.71,diffRate:-0.027106,unitsSold:2071.8541,variableCost:520232.87,contributionMargin:1385872.86,contributionMarginRate:0.727070,marketShare:0.533984,allowed:true},
  same_pref_two:{legacy:2137714.43,newSales:1393533.65,diffAmount:-744180.78,diffRate:-0.348120,unitsSold:1514.7105,variableCost:380336.72,contributionMargin:1013196.93,contributionMarginRate:0.727070,marketShare:0.703220,allowed:false}
};

function legacyStoreSales(s, store, rv = .5) {
  const b = s.businesses.find(x => x.id === store.businessID), p = s.prefs.find(x => x.id === store.prefID), a = s.areas.find(x => x.id === p.areaID);
  let demand = b.demand * p.traffic * a.traffic * s.economy * s.season * a.ramenFit * (1 + b.quality / 100) * (1 + b.brand / 90) * (1 + b.dx / 140) * (1 - a.competition * .55) * (.88 + rv * (1.14 - .88));
  return demand * b.price * s.inflation;
}
function store(id, prefID = 'tokyo') { return {id, businessID:'ramen', prefID, status:'open', condition:100, operatingHours:3, quality:18, brand:10}; }
function attachTenant(s, st) { const t = s.tenants.find(x => x.businessID === 'ramen' && x.prefID === st.prefID) || s.tenants.find(x => x.prefID === st.prefID); st.tenantID = t.id; return st; }
function round(n, d = 2) { return Number(n.toFixed(d)); }
function scenario(id, mutate, stores) {
  const s = createInitialState({configured:true});
  s.stores = stores.map(st => attachTenant(s, st));
  if (mutate) mutate(s);
  const legacy = s.stores.reduce((a, st) => a + legacyStoreSales(s, st), 0);
  const batch = market.calculateMarkets(s);
  const rows = Object.values(batch.byStore);
  const newSales = rows.reduce((a, r) => a + r.revenue, 0);
  const variableCost = rows.reduce((a, r) => a + r.variableCost, 0);
  const contributionMargin = rows.reduce((a, r) => a + r.contributionMargin, 0);
  const unitsSold = rows.reduce((a, r) => a + r.unitsSold, 0);
  const potential = Object.values(batch.byMarket).reduce((a, r) => a + r.marketPotential, 0);
  return {id, legacy:round(legacy), newSales:round(newSales), diffAmount:round(newSales - legacy), diffRate:round((newSales - legacy) / legacy, 6), unitsSold:round(unitsSold, 4), variableCost:round(variableCost), contributionMargin:round(contributionMargin), contributionMarginRate:round(contributionMargin / newSales, 6), marketShare:round(unitsSold / potential, 6)};
}
const actual = [
  scenario('standard_single', null, [store('s1')]),
  scenario('advertising', s => { s.businesses.find(b => b.id === 'ramen').brand += 10; }, [store('s1')]),
  scenario('quality', s => { s.businesses.find(b => b.id === 'ramen').quality += 10; }, [store('s1')]),
  scenario('brand', s => { s.businesses.find(b => b.id === 'ramen').brand += 20; }, [store('s1')]),
  scenario('low_economy', s => { s.economy = .85; }, [store('s1')]),
  scenario('high_economy', s => { s.economy = 1.15; }, [store('s1')]),
  scenario('different_pref_two', null, [store('s1', 'tokyo'), store('s2', 'osaka')]),
  scenario('same_pref_two', null, [store('s1', 'tokyo'), store('s2', 'tokyo')])
];
for (const row of actual) {
  assert.deepEqual(row, {id:row.id, ...Object.fromEntries(Object.entries(EXPECTED[row.id]).filter(([k]) => k !== 'allowed'))});
  if (EXPECTED[row.id].allowed) assert(Math.abs(row.diffRate) <= .10, `${row.id} should be within ±10%`);
  else assert(Math.abs(row.diffRate) > .10, `${row.id} should remain an intentional cannibalization difference`);
}
const doc = fs.readFileSync('docs/PHASE1A_BALANCE_REPORT.md', 'utf8');
for (const row of actual) for (const value of [row.legacy, row.newSales, row.diffAmount, row.diffRate, row.unitsSold, row.variableCost, row.contributionMargin, row.contributionMarginRate, row.marketShare]) assert(doc.includes(String(value)), `balance report missing ${row.id} value ${value}`);
for (const banned of ['自動計測', 'legacy helper', 'テストで検証', 'expected', '約']) assert(!doc.includes(banned), `balance report contains banned text: ${banned}`);
console.log('calibration ok');
