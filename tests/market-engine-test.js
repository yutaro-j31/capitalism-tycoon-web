const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { modules } = loadGame();
const { createInitialState } = modules.engine;
const market = modules.market;
assert.equal(market.validateSegments(), true);
function state(){ const s=createInitialState({configured:true}); const t=s.tenants.find(t=>t.businessID==='ramen'&&t.prefID==='tokyo'); t.occupiedBy='player'; s.stores.push({id:'s1',businessID:'ramen',prefID:'tokyo',name:'A',status:'open',tenantID:t.id,condition:100,operatingHours:3,quality:18,brand:10,lastSales:0,lastProfit:0}); return s; }
let s=state(); let base=market.calculateMarkets(s).byStore.s1; assert(base.unitsSold>0); assert(base.effectiveCapacity>0); assert(base.marketShare>=0&&base.marketShare<=1);
s.businesses.find(b=>b.id==='ramen').price*=1.4; let high=market.calculateMarkets(s).byStore.s1; assert(high.potentialDemand<base.potentialDemand);
s=state(); s.businesses.find(b=>b.id==='ramen').quality+=40; let quality=market.calculateMarkets(s).byStore.s1; assert(quality.segmentShares.quality>base.segmentShares.quality);
s=state(); s.businesses.find(b=>b.id==='ramen').brand+=55; let brand=market.calculateMarkets(s).byStore.s1; assert(brand.segmentShares.brand>base.segmentShares.brand);
s=state(); s.stores[0].capacity=10; let capped=market.calculateMarkets(s).byStore.s1; assert.equal(capped.unitsSold,10); assert(capped.lostDemand>0);
s=state(); const a=JSON.stringify(market.calculateMarkets(s)); const b=JSON.stringify(market.calculateMarkets(s)); assert.equal(a,b);
console.log('market engine ok');
