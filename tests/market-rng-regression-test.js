const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
function seq(){let calls=[];const values=[.5,.25,.75,.1,.9,.33,.66,.42];const fn=()=>{const v=values[calls.length%values.length];calls.push(v);return v};fn.calls=calls;return fn;}
const random=seq(); const {ctx}=loadGame({random}); const e=ctx.__ct_engine;
// Keep the Phase 0 deterministic fixture call count: target stores consume the legacy demand RNG slot and condition RNG.
e.configure({playerName:'A',companyName:'B',configured:true});
const t=e.g.tenants.find(t=>t.businessID==='ramen'&&t.prefID==='tokyo'); e.g.stores.push({id:'r1',businessID:'ramen',prefID:'tokyo',status:'open',tenantID:t.id,condition:100,operatingHours:3});
const c=e.g.tenants.find(t=>t.businessID==='cafe'&&t.prefID==='tokyo'); e.g.stores.push({id:'c1',businessID:'cafe',prefID:'tokyo',status:'open',tenantID:c.id,condition:100,operatingHours:3});
const before=random.calls.length; e.advanceWeek(false); const used=random.calls.length-before;
assert(used>=4, `expected at least demand+condition RNG for target and non-target stores, got ${used}`);
assert(e.g.stores.find(s=>s.id==='r1').marketResult);
assert.equal(e.g.stores.find(s=>s.id==='c1').marketResult,null);
const stock=e.g.market[0]; assert(stock.priceHistory.length>=2); assert(Number.isFinite(stock.price));
console.log('rng regression ok');
