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

// A v9-era legacy store keeps the old prefecture base without cash/deposit history changes.
{
 const {modules,engine}=setup(900),tenant=engine.g.tenants.find(t=>!t.occupiedBy),pref=engine.pref(tenant.prefID);tenant.deposit=987654;
 assert.equal(engine.openStore({tenantID:tenant.id,businessID:'cafe',name:'legacy'}),true);const original=engine.g.stores.at(-1);delete original.contractRent;
 const saved=JSON.parse(JSON.stringify(engine.g)),cash=saved.companyCash,deposit=saved.tenants.find(t=>t.id===tenant.id).deposit;
 const restored=new modules.engine.TycoonEngine(saved),store=restored.g.stores.find(s=>s.id===original.id);
 assert.equal(restored.g.saveVersion,9);assert.equal(store.contractRent,pref.rent);assert.equal(restored.g.companyCash,cash);assert.equal(restored.g.tenants.find(t=>t.id===tenant.id).deposit,deposit);
 const roundTrip=new modules.engine.TycoonEngine(JSON.parse(JSON.stringify(restored.g)));assert.equal(roundTrip.g.stores.find(s=>s.id===store.id).contractRent,pref.rent);
}
console.log('tenant contract rent consistency ok');
