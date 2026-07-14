const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {modules}=loadGame();
const {createInitialState}=modules.engine; const market=modules.market;
function make(order){const s=createInitialState({configured:true});const t=s.tenants.find(t=>t.businessID==='ramen'&&t.prefID==='tokyo');const rows=order.map(id=>({id,businessID:'ramen',prefID:'tokyo',status:'open',tenantID:t.id,condition:100,operatingHours:3,quality:18,brand:10}));s.stores=rows;return market.calculateMarkets(s);}
const a=make(['s1','s2']); const b=make(['s2','s1']);
assert.equal(a.byMarket['ramen::tokyo'].marketPotential,b.byMarket['ramen::tokyo'].marketPotential);
assert.equal(a.byMarket['ramen::tokyo'].segments.find(x=>x.id==='standard').shares['no-purchase'], b.byMarket['ramen::tokyo'].segments.find(x=>x.id==='standard').shares['no-purchase']);
assert.equal(a.byStore.s1.unitsSold,b.byStore.s1.unitsSold); assert.equal(a.byStore.s2.unitsSold,b.byStore.s2.unitsSold);
assert.equal(a.businessSummary.ramen.unitsSold,b.businessSummary.ramen.unitsSold);
console.log('order invariance ok');
