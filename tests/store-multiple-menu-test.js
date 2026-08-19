'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./harness');
let calls=0,seed=9876;const random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const {modules,ctx}=loadGame({random,isolatedLegacyIndex:true});const engine=ctx.__ct_engine,business=engine.business('ramen');business.price=1000;
// This file exercises store-equipment.js's own menu mechanics (pricing, market integration,
// save/reload, recipe multipliers), not menu-research.js's R&D gate -- pre-unlock every
// catalog item so addStoreMenuItem behaves as it did before menu-research.js existed,
// the same way an old save with items already unlocked would.
engine.g.menuResearch={unlockedIDs:modules.storeEquipment.MENU_CATALOG.map(x=>x.id),pending:null};
const tenant=engine.g.tenants.find(t=>t.businessID==='ramen')||engine.g.tenants[0];
const base={businessID:'ramen',prefID:tenant.prefID,tenantID:tenant.id,status:'open',condition:100,operatingHours:3,capacity:1000,quality:0,brand:0,lastSales:0,lastProfit:0};
const a={...base,id:'menu-a',name:'メニューA'},b={...base,id:'menu-b',name:'メニューB'};engine.g.stores.push(a,b);
let plan=engine.getStoreMenuPlan(a.id);assert.equal(plan.items.map(x=>x.id).join(','),'classic');assert.equal(plan.items[0].effectivePrice,1000);assert.equal(Object.hasOwn(a,'menuItems'),false,'read path does not mutate legacy store');
const classicOffer=modules.market.storeOffer(engine.g,a);assert.equal(classicOffer.price,1000);assert.equal(classicOffer.capacity,1000);
const beforeMarket=modules.market.calculateMarket(engine.g,[a,b]);
let saves=0,changes=0;const save=engine.save.bind(engine);engine.save=(...x)=>{saves++;return save(...x);};engine.addEventListener('change',()=>changes++);const rng=calls;
assert.equal(engine.addStoreMenuItem(a.id,'chashu'),true);assert.equal(saves,1);assert.equal(changes,1);assert.equal(calls,rng);assert.equal(Object.hasOwn(b,'menuItems'),false);
const snapshot=JSON.stringify(a.menuItems);for(const id of ['chashu','unknown','classic'])assert.equal(engine.addStoreMenuItem(a.id,id),false);assert.equal(JSON.stringify(a.menuItems),snapshot);assert.equal(saves,1);
plan=engine.getStoreMenuPlan(a.id);assert.equal(plan.items.find(x=>x.id==='chashu').effectivePrice,1350);
a.priceOverride=1100;assert.equal(engine.getStoreMenuPlan(a.id).items.find(x=>x.id==='chashu').effectivePrice,1485);
assert.equal(engine.setStoreMenuItemPrice(a.id,'chashu',1500),true);assert.equal(engine.getStoreMenuPlan(a.id).items.find(x=>x.id==='chashu').effectivePrice,1500);
a.priceOverride=1200;assert.equal(engine.getStoreMenuPlan(a.id).items.find(x=>x.id==='chashu').effectivePrice,1500);
assert.equal(engine.resetStoreMenuItemPrice(a.id,'chashu'),true);assert.equal(engine.getStoreMenuPlan(a.id).items.find(x=>x.id==='chashu').effectivePrice,1620);
const atomic=JSON.stringify(a.menuItems);for(const bad of [NaN,Infinity,-Infinity,0,-1,'1200',null,undefined])assert.equal(engine.setStoreMenuItemPrice(a.id,'chashu',bad),false);assert.equal(JSON.stringify(a.menuItems),atomic);
for(const id of ['value','vegetable','spicy'])assert.equal(engine.addStoreMenuItem(a.id,id),true);assert.equal(calls,rng,'all menu actions are deterministic');
const market=modules.market.calculateMarket(engine.g,[a,b]),result=market.stores[a.id];assert.equal(Object.keys(market.stores).length,2,'one result per store');assert.ok(result.effectiveCapacity<=1000&&result.effectiveCapacity>=900,'shared capacity is not multiplied');assert.equal(result.activeMenuCount,5);assert.ok(Math.abs(result.menuMix.reduce((n,x)=>n+x.share,0)-1)<1e-9);assert.ok(Math.abs(result.menuMix.reduce((n,x)=>n+x.units,0)-result.unitsSold)<1e-7);assert.ok(Math.abs(result.menuMix.reduce((n,x)=>n+x.units*x.effectivePrice,0)*engine.g.inflation-result.revenue)<1e-7,'revenue reconciles to menu mix');
assert.ok(result.menuRecipeMultipliers.ramen_toppings!==1);assert.ok(result.menuRecipeMultipliers.ramen_vegetables!==1);assert.ok(result.menuRecipeMultipliers.ramen_soup>1);
assert.equal(modules.supply.recipeRate(modules.supply.MATERIALS.find(x=>x.id==='ramen_toppings')), .7);assert.ok(modules.supply.recipeRate(modules.supply.MATERIALS.find(x=>x.id==='ramen_toppings'),result.menuRecipeMultipliers)!==.7);
engine.save();const saved=JSON.parse(ctx.localStorage.getItem(modules.engine.SAVE_KEY));assert.equal(saved.saveVersion,9);assert.equal(saved.stores.find(x=>x.id===a.id).menuItems.length,5);const loaded=modules.engine.TycoonEngine.load();assert.equal(loaded.getStoreMenuPlan(a.id).items.length,5);
a.menuItems=[null,{menuID:'unknown'},{menuID:'value',priceOverride:'800'},{menuID:'value',priceOverride:700},{menuID:'spicy',priceOverride:Infinity}];plan=engine.getStoreMenuPlan(a.id);assert.equal(plan.items.map(x=>x.id).join(','),'classic,value,spicy');assert.equal(plan.items.find(x=>x.id==='value').isOverridden,false,'first deterministic duplicate wins and malformed price falls back');assert.ok(plan.items.every(x=>Number.isFinite(x.effectivePrice)));
const rngAfterLoad=calls;assert.equal(engine.removeStoreMenuItem(a.id,'classic'),false);assert.equal(engine.removeStoreMenuItem(a.id,'value'),true);assert.equal(calls,rngAfterLoad);
b.menuItems=[{menuID:'classic'}];const cr=modules.market.calculateMarket(engine.g,[b]).stores[b.id];delete b.menuItems;const lr=modules.market.calculateMarket(engine.g,[b]).stores[b.id];assert.equal(JSON.stringify(cr),JSON.stringify(lr),'classic-only result matches legacy');
const app=fs.readFileSync('js/app.js','utf8');for(const text of ['メニュー構成','販売構成','標準価格に戻す','メニューから外す',"askMoney('メニュー価格を変更'"])assert.ok(app.includes(text));assert.ok(!app.includes('new MutationObserver'));
console.log('store multiple menu tests passed');
