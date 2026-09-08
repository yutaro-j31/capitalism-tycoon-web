'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

const lcg=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const setup=(seed=42)=>{const loaded=loadGame({random:lcg(seed)}),engine=new loaded.modules.engine.TycoonEngine();engine.g.configured=true;engine.g.companyCash=1_000_000_000;engine.g.finance=loaded.modules.finance.defaultFinanceState(engine.g);return {...loaded,engine};};
const rentRow=(engine,store)=>engine.g.finance.transactions.findLast(row=>row.sourceType==='weekly-store-rent'&&row.storeID===store.id);
const openAndTrade=(engine,tenant,businessID='cafe',hours=3)=>{assert.equal(engine.openStore({tenantID:tenant.id,businessID,name:'契約家賃検証店',operatingHours:hours}),true);const store=engine.g.stores.at(-1);store.status='open';store.openingWeek=engine.g.week;store.weeksToOpen=0;engine.advanceWeek(false);return store;};

// New leases use one immutable source from quote through P/L and the finance ledger.
{
 const {engine}=setup(),tenant=engine.g.tenants.find(t=>!t.occupiedBy&&t.businessID==='cafe'),pref=engine.pref(tenant.prefID);
 const quoted=tenant.rent,estimate=engine.estimateStoreOpening({tenantID:tenant.id,businessID:'cafe',operatingHours:3});
 assert.equal(estimate.breakdown.rent,quoted);assert.equal(tenant.deposit,quoted*8);
 assert.equal(engine.openStore({tenantID:tenant.id,businessID:'cafe',name:'snapshot',operatingHours:3}),true);
 const store=engine.g.stores.at(-1);assert.equal(store.contractRent,quoted);
 pref.rent=quoted*9;tenant.rent=quoted*7;store.status='open';store.openingWeek=engine.g.week;store.weeksToOpen=0;engine.advanceWeek(false);
 assert.equal(store.contractRent,quoted);assert.equal(rentRow(engine,store).amount,quoted);
 assert.equal(engine.g.finance.transactions.filter(row=>row.sourceType==='weekly-store-rent'&&row.storeID===store.id).length,1);
}

// Contract rent does not inherit operating-hours, inflation, or crisis multipliers.
{
 const rents=[];
 for(const hours of [1,3,4]){const {engine}=setup(100+hours),tenant=engine.g.tenants.find(t=>!t.occupiedBy);tenant.rent=123456;tenant.deposit=tenant.rent*8;engine.g.inflation=2.4;engine.g.macroCrisis={salesMultiplier:.5,costMultiplier:3};const store=openAndTrade(engine,tenant,'cafe',hours);rents.push(rentRow(engine,store).amount);}
 assert.deepEqual(rents,[123456,123456,123456]);
}

// Every currently foundable physical store path shares the same weekly rent posting.
for(const businessID of ['ramen','conveni','gym','realEstateAgency']){
 const {engine}=setup(500),tenant=engine.g.tenants.find(t=>!t.occupiedBy);tenant.rent=76543;tenant.deposit=tenant.rent*8;
 const estimate=engine.estimateStoreOpening({tenantID:tenant.id,businessID,operatingHours:3});const store=openAndTrade(engine,tenant,businessID,3);
 assert.equal(estimate.breakdown.rent,76543,`${businessID}: estimate`);assert.equal(store.contractRent,76543,`${businessID}: snapshot`);assert.equal(rentRow(engine,store).amount,76543,`${businessID}: ledger`);
}

// A v9-era legacy store snapshots the exact effective rent that the old weekly
// posting would have charged, without rewriting any historical or cash state.
for(const row of [
 {label:'normal hours',inflation:1,hours:3,crisis:1,expected:100000},
 {label:'24 hours',inflation:1.10,hours:4,crisis:1,expected:136400},
 {label:'short hours during crisis',inflation:1.05,hours:2,crisis:1.20,expected:100800}
]){
 const {modules,engine}=setup(900+row.hours),tenant=engine.g.tenants.find(t=>!t.occupiedBy),pref=engine.pref(tenant.prefID);
 pref.rent=100000;tenant.deposit=987654;
 assert.equal(engine.openStore({tenantID:tenant.id,businessID:'cafe',name:`legacy-${row.label}`,operatingHours:row.hours}),true);
 const original=engine.g.stores.at(-1);delete original.contractRent;engine.g.inflation=row.inflation;
 engine.g.macroCrisis=row.crisis===1?null:{kind:'migration fixture',weeks:20,salesMultiplier:1,costMultiplier:row.crisis};
 engine.g.reports=[{week:0,profit:12345}];engine.g.history=[{week:0,cash:67890}];
 engine.g.finance.transactions.push({id:'legacy-ledger-row',week:0,type:'expense',amount:1});
 const saved=JSON.parse(JSON.stringify(engine.g));
 const before={cash:saved.companyCash,deposit:saved.tenants.find(t=>t.id===tenant.id).deposit,reports:saved.reports,history:saved.history,ledger:saved.finance.transactions};
 const restored=new modules.engine.TycoonEngine(saved),store=restored.g.stores.find(s=>s.id===original.id);
 assert.equal(restored.g.saveVersion,9,`${row.label}: save version`);assert.equal(store.contractRent,row.expected,`${row.label}: legacy effective rent`);
 assert.equal(restored.g.companyCash,before.cash,`${row.label}: cash`);assert.equal(restored.g.tenants.find(t=>t.id===tenant.id).deposit,before.deposit,`${row.label}: deposit`);
 assert.equal(JSON.stringify(restored.g.reports),JSON.stringify(before.reports),`${row.label}: P/L history`);assert.equal(JSON.stringify(restored.g.history),JSON.stringify(before.history),`${row.label}: history`);assert.equal(JSON.stringify(restored.g.finance.transactions),JSON.stringify(before.ledger),`${row.label}: ledger history`);
 const roundTrip=new modules.engine.TycoonEngine(JSON.parse(JSON.stringify(restored.g)));let roundTripStore=roundTrip.g.stores.find(s=>s.id===store.id);
 roundTrip.g.inflation=9;roundTrip.g.macroCrisis={kind:'changed',weeks:20,salesMultiplier:1,costMultiplier:7};roundTripStore.operatingHours=4;roundTrip.normalize();roundTripStore=roundTrip.g.stores.find(s=>s.id===store.id);
 assert.equal(roundTripStore.contractRent,row.expected,`${row.label}: idempotent reload and normalize`);
 roundTripStore.status='open';roundTripStore.openingWeek=roundTrip.g.week;roundTripStore.weeksToOpen=0;roundTrip.advanceWeek(false);
 assert.equal(rentRow(roundTrip,roundTripStore).amount,row.expected,`${row.label}: first migrated weekly posting`);
}
console.log('tenant contract rent consistency ok');
