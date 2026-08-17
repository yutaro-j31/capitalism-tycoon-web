'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./harness');

let randomCalls=0,seed=4242;
function random(){randomCalls++;seed=(seed*1664525+1013904223)>>>0;return seed/2**32;}
const {modules,ctx}=loadGame({random,isolatedLegacyIndex:true});
const engine=ctx.__ct_engine;
const business=engine.business('ramen');
business.price=900;
const tenant=engine.g.tenants.find(t=>t.businessID==='ramen'&&t.prefID==='tokyo')||engine.g.tenants.find(t=>t.businessID==='ramen');
assert.ok(tenant);
const base={businessID:'ramen',prefID:tenant.prefID,tenantID:tenant.id,status:'open',condition:100,operatingHours:3,capacity:1e9,quality:0,brand:0,lastSales:0,lastProfit:0};
const a={...base,id:'pricing-a',name:'価格A'};
const b={...base,id:'pricing-b',name:'価格B'};
engine.g.stores.push(a,b);

assert.equal(engine.getStorePricingPlan(a.id).effectivePrice,900,'missing override inherits business price');
assert.equal(engine.getStorePricingPlan(a.id).isOverridden,false);
assert.equal(modules.market.storeOffer(engine.g,a).price,900,'legacy market offer uses business price');

let saves=0,changes=0;
const originalSave=engine.save.bind(engine);
engine.save=(...args)=>{saves++;return originalSave(...args);};
engine.addEventListener('change',()=>changes++);
const rngBefore=randomCalls;
const cashBefore=engine.g.companyCash;
assert.equal(engine.setStorePrice(a.id,1050),true);
assert.equal(saves,1,'set saves exactly once');
assert.equal(changes,1,'set emits exactly once');
assert.equal(randomCalls,rngBefore,'set consumes no RNG');
assert.equal(engine.g.companyCash,cashBefore,'price action has no cash effect');
assert.equal(business.price,900,'store override does not mutate business price');
assert.equal(a.priceOverride,1050);
assert.equal(b.priceOverride,undefined,'override is not shared');
assert.equal(engine.getStorePricingPlan(b.id).effectivePrice,900,'other store is unchanged');

business.price=980;
assert.equal(engine.getStorePricingPlan(a.id).effectivePrice,1050,'override stays fixed after global change');
assert.equal(engine.getStorePricingPlan(b.id).effectivePrice,980,'inheriting store follows global change');
assert.equal(engine.resetStorePrice(a.id),true);
assert.equal(saves,2,'reset saves exactly once');
assert.equal(changes,2,'reset emits exactly once');
assert.equal(randomCalls,rngBefore,'reset consumes no RNG');
assert.equal(Object.hasOwn(a,'priceOverride'),false,'reset deletes rather than copies global price');
assert.equal(engine.getStorePricingPlan(a.id).effectivePrice,980);
business.price=1000;
assert.equal(engine.getStorePricingPlan(a.id).effectivePrice,1000,'reset store follows later global changes');
assert.equal(engine.getStorePricingPlan(b.id).effectivePrice,1000);

const snapshot=JSON.stringify(engine.g.stores);
for(const invalid of [NaN,Infinity,-Infinity,0,-1,'1200',null,undefined]){
  assert.equal(engine.setStorePrice(a.id,invalid),false,`invalid price ${String(invalid)} fails`);
  assert.equal(JSON.stringify(engine.g.stores),snapshot,'invalid input is atomic');
}
assert.equal(engine.setStorePrice('missing',1200),false);
assert.equal(engine.resetStorePrice('missing'),false);
assert.equal(JSON.stringify(engine.g.stores),snapshot,'invalid store ID is atomic');
assert.equal(saves,2,'failures do not save');

for(const malformed of [NaN,Infinity,0,-5,'1300']){
  a.priceOverride=malformed;
  assert.equal(modules.market.storeOffer(engine.g,a).price,1000,`malformed ${String(malformed)} falls back safely`);
}
delete a.priceOverride;
assert.equal(engine.setStorePrice(a.id,700),true);
assert.equal(engine.setStorePrice(b.id,1400),true);
const offers=[modules.market.storeOffer(engine.g,a),modules.market.storeOffer(engine.g,b)];
assert.deepEqual(offers.map(o=>o.price),[700,1400],'same business exposes distinct offer prices');
const market=modules.market.calculateMarket(engine.g,[a,b]);
assert.ok(market.stores[a.id].potentialDemand>market.stores[b.id].potentialDemand,'existing price sensitivity allocates more demand to cheaper store');
assert.equal(market.stores[a.id].revenue,market.stores[a.id].unitsSold*700*engine.g.inflation,'cheap store revenue uses effective price');
assert.equal(market.stores[b.id].revenue,market.stores[b.id].unitsSold*1400*engine.g.inflation,'expensive store revenue uses effective price');

engine.save();
let saved=JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
assert.equal(saved.saveVersion,9);
assert.equal(saved.stores.find(s=>s.id===a.id).priceOverride,700);
const beforeOverrideLoad=randomCalls;
let reloaded=modules.engine.TycoonEngine.load();
const overrideLoadCalls=randomCalls-beforeOverrideLoad;
assert.equal(reloaded.getStorePricingPlan(a.id).effectivePrice,700,'override survives save/reload');
delete saved.stores.find(s=>s.id===a.id).priceOverride;
ctx.localStorage.setItem('capitalism_tycoon_web_v1',JSON.stringify(saved));
const beforeLegacyLoad=randomCalls;
reloaded=modules.engine.TycoonEngine.load();
const legacyLoadCalls=randomCalls-beforeLegacyLoad;
assert.equal(reloaded.getStorePricingPlan(a.id).effectivePrice,reloaded.business('ramen').price,'old save without field inherits');
assert.equal(legacyLoadCalls,overrideLoadCalls,'missing override adds no migration RNG consumption');

const app=fs.readFileSync('js/app.js','utf8');
for(const text of ['店舗価格を変更','全社価格に戻す','店舗別価格','全社価格を使用','全社価格:','営業時間','設備強化','改装'])assert.ok(app.includes(text),`UI contains ${text}`);
assert.ok(app.includes("askMoney('店舗価格を変更'"),'existing money input flow is reused');
assert.ok(!app.includes('new MutationObserver'),'UI adds no MutationObserver');
assert.ok(!/store-pricing[^\n]*(?:width|min-width):/.test(app),'pricing UI adds no fixed horizontal width');
console.log('store specific pricing ok');
