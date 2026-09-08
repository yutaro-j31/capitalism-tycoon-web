'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const {loadGame}=require('./harness');
let calls=0,seed=190826041;const {modules,ctx}=loadGame({random:()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32}}),engine=ctx.__ct_engine,evaluate=modules.tenantSiteSuitability.evaluateTenantSuitability,pref=engine.pref('tokyo');
const base={traffic:pref.traffic,size:'M',businessID:'cafe'};
calls=0;assert.deepEqual(evaluate(base,'ramen',pref),evaluate(base,'ramen',pref));assert.equal(calls,0,'evaluator consumes no RNG');
assert.deepEqual(evaluate(base,'ramen',pref),evaluate({...base,businessID:'appStudio'},'ramen',pref),'legacy metadata is ignored');
for(const id of ['ramen','conveni'])assert.ok(evaluate({...base,traffic:pref.traffic*1.2},id,pref).multiplier>=evaluate({...base,traffic:pref.traffic*.8},id,pref).multiplier);
const gym=s=>evaluate({...base,size:s},'gym',pref).multiplier;assert.ok(gym('L')>gym('M')&&gym('M')>gym('S'));
assert.equal(evaluate({...base,size:'?'},'gym',pref).sizeComponent,1);assert.deepEqual(evaluate(null,'gym',pref),modules.tenantSiteSuitability.neutral());
for(const traffic of [NaN,Infinity,-1,undefined])assert.equal(evaluate({...base,traffic},'ramen',pref).trafficComponent,1);
for(const id of Object.keys(modules.tenantSiteSuitability.CONFIG))for(const traffic of [-1e9,0,1e9]){const x=evaluate({...base,traffic},id,pref);assert.ok(x.multiplier>=.9&&x.multiplier<=1.1);}
assert.equal(evaluate({traffic:pref.traffic*1.15,size:'L'},'ramen',pref).grade,'A');assert.equal(evaluate(base,'ramen',pref).grade,'B');assert.equal(evaluate({traffic:0,size:'S'},'conveni',pref).grade,'C');
const tenant=engine.g.tenants.find(t=>t.prefID==='tokyo'),estimate=engine.estimateStoreOpening({tenantID:tenant.id,businessID:'gym'});assert.deepEqual(estimate.siteSuitability,evaluate(tenant,'gym',pref));
const source=fs.readFileSync('js/tenant-site-suitability.js','utf8');assert.doesNotMatch(source,/tenant\.businessID|Math\.random|Date\.now/);
const businesses=['ramen','conveni','gym','realEstateAgency'],rows=[];for(const t of engine.g.tenants)for(const id of businesses)rows.push({...evaluate(t,id,engine.pref(t.prefID)),id,name:t.name});assert.equal(rows.length,47*8*4);assert.equal(rows.filter(x=>!Number.isFinite(x.multiplier)||x.multiplier<.9||x.multiplier>1.1).length,0);
const sorted=rows.map(x=>x.multiplier).sort((a,b)=>a-b),q=p=>sorted[Math.floor((sorted.length-1)*p)],grades=g=>rows.filter(x=>x.grade===g).length;console.log('SUITABILITY_MATRIX',JSON.stringify({count:rows.length,min:q(0),p10:q(.1),median:q(.5),p90:q(.9),max:q(1),A:grades('A'),B:grades('B'),C:grades('C'),byBusiness:Object.fromEntries(businesses.map(id=>{const r=rows.filter(x=>x.id===id),v=r.map(x=>x.multiplier).sort((a,b)=>a-b);return[id,{min:v[0],p10:v[Math.floor((v.length-1)*.1)],median:v[Math.floor((v.length-1)*.5)],p90:v[Math.floor((v.length-1)*.9)],max:v.at(-1),A:r.filter(x=>x.grade==='A').length,B:r.filter(x=>x.grade==='B').length,C:r.filter(x=>x.grade==='C').length}]}))}));
console.log('tenant site suitability tests passed');
