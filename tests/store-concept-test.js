'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
function lcg(seed=424){let s=seed>>>0,calls=0;const random=()=>{calls++;s=(s*1664525+1013904223)>>>0;return s/2**32;};random.calls=()=>calls;return random;}
function setup(seed=424){const random=lcg(seed),{modules,ctx}=loadGame({random}),engine=ctx.__ct_engine;engine.g.companyCash=500_000_000;const open=name=>{const tenant=engine.g.tenants.find(t=>!t.occupiedBy);assert.ok(tenant);assert.equal(engine.openStore({tenantID:tenant.id,businessID:'ramen',name,operatingHours:3}),true);const store=engine.g.stores.at(-1);store.status='open';return store;};return {random,modules,engine,open};}
function market(modules,engine,store){return modules.market.calculateMarket(engine.g,[store]).stores[store.id];}
function supplyProbe(conceptID,materialID){const {modules,engine,open}=setup(2424),store=open(`供給-${conceptID}`);engine.g.week=20;store.conceptID=conceptID;store.conceptTransitionUntilWeek=0;const result=market(modules,engine,store);modules.supply.ensureStore(engine.g,store);modules.supply.createDeterministicInitialLots(engine.g,store);const consumed=modules.supply.consume(engine.g,store.id,10,result.menuRecipeMultipliers),material=consumed.materials.find(row=>row.materialID===materialID);assert.ok(material,`${conceptID}:${materialID} consumption row`);for(const row of Object.values(engine.g.inventoryByStoreID[store.id].materials)){row.quantity=0;row.lots=[];}engine.g.purchaseOrders=[];engine.g.supplyResultsByStoreID[store.id]=undefined;engine.g.marketResultsByStoreID[store.id]={...result,unitsSold:100,menuRecipeMultipliers:result.menuRecipeMultipliers};modules.supply.autoOrder(engine.g);const order=engine.g.purchaseOrders.find(row=>row.storeID===store.id&&row.materialID===materialID&&String(row.operationID).startsWith(`auto-${engine.g.week}-${store.id}-`));assert.ok(order,`${conceptID}:${materialID} auto procurement order`);return {consumedQuantity:material.quantity,orderedQuantity:order.orderedQuantity};}

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

// Market recipe multipliers must reach actual inventory consumption and automatic procurement quantities.
{
 const balancedSoup=supplyProbe('balanced','ramen_soup'),craftSoup=supplyProbe('craft','ramen_soup');
 assert.equal(balancedSoup.consumedQuantity,10);assert.equal(craftSoup.consumedQuantity,12);
 assert.ok(craftSoup.orderedQuantity>balancedSoup.orderedQuantity,`craft soup order ${craftSoup.orderedQuantity} must exceed balanced ${balancedSoup.orderedQuantity}`);
 const balancedPackaging=supplyProbe('balanced','ramen_packaging'),turnoverPackaging=supplyProbe('turnover','ramen_packaging');
 assert.equal(balancedPackaging.consumedQuantity,10);assert.equal(turnoverPackaging.consumedQuantity,11.5);
 assert.ok(turnoverPackaging.orderedQuantity>balancedPackaging.orderedQuantity,`turnover packaging order ${turnoverPackaging.orderedQuantity} must exceed balanced ${balancedPackaging.orderedQuantity}`);
}

// 208-week-equivalent deterministic finite-state probe across every concept and store-local output.
{
 const run=seed=>{const {modules,engine,open,random}=setup(seed),stores=[open('回転'),open('品質'),open('常連')];['turnover','craft','community'].forEach((id,i)=>stores[i].conceptID=id);const before=random.calls(),fingerprint=[];for(let week=1;week<=208;week++){engine.g.week=week;for(const store of stores){const r=market(modules,engine,store);for(const key of ['unitsSold','potentialDemand','effectiveCapacity','revenue','variableCost','repeatRate','quality'])assert.ok(Number.isFinite(r[key]),`${week}:${store.name}:${key}`);if(week%52===0)fingerprint.push([week,store.conceptID,r.unitsSold,r.effectiveCapacity,r.repeatRate,r.menuRecipeMultipliers]);}}assert.equal(random.calls(),before,'208-week concept calculations consume no RNG');return fingerprint;};
 assert.equal(JSON.stringify(run(99)),JSON.stringify(run(99)));
}

// Real engine progression must survive 208 advanceWeek calls with concept + market + supply + accounting active.
{
 const {modules,engine,open}=setup(8424);engine.g.finance=modules.finance.defaultFinanceState({companyCash:engine.g.companyCash,companyDebt:engine.g.companyDebt,week:engine.g.week});const store=open('長期品質店');store.conceptID='craft';store.conceptTransitionUntilWeek=0;const startWeek=engine.g.week;
 for(let i=0;i<208;i++){assert.notEqual(engine.advanceWeek(false),false,`advanceWeek ${i+1}`);assert.equal(engine.g.gameOver,false,`unexpected game over at week ${engine.g.week}: ${engine.g.gameOverReason}`);const live=engine.g.stores.find(row=>row.id===store.id);assert.ok(live);assert.equal(live.conceptID,'craft');const result=engine.g.supplyResultsByStoreID[store.id]||engine.g.marketResultsByStoreID[store.id];if(result)for(const key of ['unitsSold','revenue','variableCost','repeatRate'])assert.ok(Number.isFinite(Number(result[key])),`${engine.g.week}:${key}`);}
 assert.equal(engine.g.week,startWeek+208);const financeValidation=modules.finance.validate(engine.g),supplyValidation=modules.supply.validate(engine.g);assert.equal(financeValidation.ok,true,financeValidation.errors.join('\n'));assert.equal(supplyValidation.ok,true,supplyValidation.errors.join('\n'));
}
console.log('store-concept-test: ok');
