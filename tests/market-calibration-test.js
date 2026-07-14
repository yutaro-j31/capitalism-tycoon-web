const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');
const { modules } = loadGame();
const { createInitialState } = modules.engine;
const market = modules.market;

const EXPECTED = {
  standard_single:{legacy:993361.72,newSales:1013384.15,diffAmount:20022.42,diffRate:0.020156,unitsSold:1101.5045,variableCost:322859.10,contributionMargin:690525.04,contributionMarginRate:0.681405,marketShare:0.550250,allowed:true},
  advertising:{legacy:1092697.90,newSales:1057478.70,diffAmount:-35219.20,diffRate:-0.032231,unitsSold:1149.4334,variableCost:336907.41,contributionMargin:720571.29,contributionMarginRate:0.681405,marketShare:0.574193,allowed:true},
  quality:{legacy:1077544.92,newSales:1127590.27,diffAmount:50045.35,diffRate:0.046444,unitsSold:1225.6416,variableCost:362751.82,contributionMargin:764838.45,contributionMarginRate:0.678295,marketShare:0.612262,allowed:true},
  brand:{legacy:1192034.07,newSales:1101553.83,diffAmount:-90480.24,diffRate:-0.075904,unitsSold:1197.3411,variableCost:350949.52,contributionMargin:750604.31,contributionMarginRate:0.681405,marketShare:0.598125,allowed:true},
  low_economy:{legacy:844357.47,newSales:861376.52,diffAmount:17019.06,diffRate:0.020156,unitsSold:936.2788,variableCost:274430.24,contributionMargin:586946.28,contributionMarginRate:0.681405,marketShare:0.550250,allowed:true},
  high_economy:{legacy:1142365.98,newSales:1165391.77,diffAmount:23025.78,diffRate:0.020156,unitsSold:1266.7302,variableCost:371287.97,contributionMargin:794103.80,contributionMarginRate:0.681405,marketShare:0.550250,allowed:true},
  different_pref_two:{legacy:1820828.47,newSales:1771473.73,diffAmount:-49354.75,diffRate:-0.027106,unitsSold:1925.5149,variableCost:564382.64,contributionMargin:1207091.08,contributionMarginRate:0.681405,marketShare:0.533984,allowed:true},
  same_pref_two:{legacy:1986723.45,newSales:1295105.62,diffAmount:-691617.83,diffRate:-0.348120,unitsSold:1407.7235,variableCost:412614.15,contributionMargin:882491.47,contributionMarginRate:0.681405,marketShare:0.703220,allowed:false}
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
