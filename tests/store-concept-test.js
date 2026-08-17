'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
function lcg(seed=424){let s=seed>>>0,calls=0;const random=()=>{calls++;s=(s*1664525+1013904223)>>>0;return s/2**32;};random.calls=()=>calls;return random;}
function setup(seed=424){const random=lcg(seed),{modules,ctx}=loadGame({random}),engine=ctx.__ct_engine;engine.g.companyCash=500_000_000;const open=name=>{const tenant=engine.g.tenants.find(t=>!t.occupiedBy);assert.ok(tenant);assert.equal(engine.openStore({tenantID:tenant.id,businessID:'ramen',name,operatingHours:3}),true);const store=engine.g.stores.at(-1);store.status='open';return store;};return {random,modules,engine,open};}
function market(modules,engine,store){return modules.market.calculateMarket(engine.g,[store]).stores[store.id];}

// Legacy fallback and save/reload retain v9 without materializing or requiring concept state.
{
 const {modules,engine,open}=setup(),store=open('旧save店');
 assert.equal(Object.hasOwn(store,'conceptID'),false);
 assert.equal(modules.storeEquipment.conceptOf(store).id,'balanced');
 const saved=engine.exportSave().parts.join('');assert.equal(JSON.parse(saved).saveVersion,9);
 engine.importSave(saved);const loaded=engine.g.stores.find(s=>s.id===store.id);
 assert.equal(modules.storeEquipment.conceptOf(loaded).id,'balanced');
 assert.equal(engine.setStoreConcept(loaded.id,'craft'),true);
 const changed=engine.exportSave().parts.join('');engine.importSave(changed);
 assert.equal(engine.g.stores.find(s=>s.id===store.id).conceptID,'craft');
}

// Per-store isolation, company-only cash cost, ledger attribution, and invalid-action atomicity.
{
 const {modules,engine,open,random}=setup(),a=open('A店'),b=open('B店');
 const cash=engine.g.companyCash,personal=engine.g.personalCash,calls=random.calls(),events=engine.g.finance.transactions.length;
 assert.equal(engine.setStoreConcept(a.id,'turnover'),true);
 assert.equal(a.conceptID,'turnover');assert.equal(modules.storeEquipment.conceptOf(b).id,'balanced');
 assert.equal(engine.g.companyCash,cash-modules.storeEquipment.STORE_CONCEPT_CHANGE_COST);assert.equal(engine.g.personalCash,personal);
 assert.equal(random.calls(),calls,'concept change consumes no RNG');
 const entry=engine.g.finance.transactions.slice(events).find(x=>x.sourceType==='storeConceptChange');
 assert.ok(entry);assert.equal(entry.storeID,a.id);assert.equal(entry.cashEffect,-modules.storeEquipment.STORE_CONCEPT_CHANGE_COST);assert.equal(entry.profitEffect,-modules.storeEquipment.STORE_CONCEPT_CHANGE_COST);
 const snapshot=JSON.stringify({cash:engine.g.companyCash,a:{...a},events:engine.g.finance.transactions});
 assert.equal(engine.setStoreConcept(a.id,'invalid'),false);assert.equal(JSON.stringify({cash:engine.g.companyCash,a:{...a},events:engine.g.finance.transactions}),snapshot);
 engine.g.companyCash=0;assert.equal(engine.setStoreConcept(b.id,'craft'),false);assert.equal(Object.hasOwn(b,'conceptID'),false);
}

// All three choices reach market capacity/quality/repeat and supply recipes; transition is temporary.
{
 const {modules,engine,open}=setup(),store=open('比較店');engine.g.week=20;
 const base=market(modules,engine,store);
 store.conceptID='turnover';store.conceptTransitionUntilWeek=0;const turnover=market(modules,engine,store);
 store.conceptID='craft';const craft=market(modules,engine,store);
 store.conceptID='community';const community=market(modules,engine,store);
 assert.ok(turnover.effectiveCapacity>base.effectiveCapacity);assert.ok(turnover.quality<base.quality);assert.equal(turnover.menuRecipeMultipliers.ramen_packaging,1.15);
 assert.ok(craft.effectiveCapacity<base.effectiveCapacity);assert.ok(craft.quality>base.quality);assert.equal(craft.menuRecipeMultipliers.ramen_soup,1.2);
 assert.ok(community.repeatRate>base.repeatRate);assert.ok(community.novelty<base.novelty);assert.equal(community.menuRecipeMultipliers.ramen_vegetables,1.08);
 store.conceptID='turnover';store.conceptTransitionUntilWeek=22;const transition=market(modules,engine,store);engine.g.week=22;const settled=market(modules,engine,store);assert.ok(transition.effectiveCapacity<settled.effectiveCapacity);
}

// 208-week-equivalent deterministic finite-state probe across every concept and store-local output.
{
 const run=seed=>{const {modules,engine,open,random}=setup(seed),stores=[open('回転'),open('品質'),open('常連')];['turnover','craft','community'].forEach((id,i)=>stores[i].conceptID=id);const before=random.calls(),fingerprint=[];for(let week=1;week<=208;week++){engine.g.week=week;for(const store of stores){const r=market(modules,engine,store);for(const key of ['unitsSold','potentialDemand','effectiveCapacity','revenue','variableCost','repeatRate','quality'])assert.ok(Number.isFinite(r[key]),`${week}:${store.name}:${key}`);if(week%52===0)fingerprint.push([week,store.conceptID,r.unitsSold,r.effectiveCapacity,r.repeatRate,r.menuRecipeMultipliers]);}}assert.equal(random.calls(),before,'208-week concept calculations consume no RNG');return fingerprint;};
 assert.equal(JSON.stringify(run(99)),JSON.stringify(run(99)));
}
console.log('store-concept-test: ok');
