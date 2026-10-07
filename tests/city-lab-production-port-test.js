'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./harness');
const {ctx,modules,engineModule}=loadGame({headless:true});
for(const file of ['prototypes/map-canvas-renderer.js','prototypes/map-prefecture-profiles.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const engine=new engineModule.TycoonEngine(engineModule.createInitialState({configured:true,companyName:'Production Port',playerName:'Tester'}));
const g=engine.g,save=JSON.stringify(g),rng=JSON.stringify(g.simulationRng);
ctx.Math=Object.create(Math);ctx.Math.random=()=>{throw new Error('presentation consumed RNG');};
let total=0;const seen=new Set();
for(const pref of g.prefs){
 const local={...g,selectedPref:pref.id},view=modules.mapPhase2Canvas.buildMapViewModel(local,engine),a=modules.cityLabMap.layout(view),b=modules.cityLabMap.layout({...view,entities:[...view.entities].reverse()});
 assert.equal(a.profile.explicit,true,`${pref.id}: production regional profile required`);
 assert.equal(a.profile.prefID,pref.id);
 assert.equal(JSON.stringify(a.buildings.map(x=>[x.id,x.x,x.z,x.kind,x.h])),JSON.stringify(b.buildings.map(x=>[x.id,x.x,x.z,x.kind,x.h])),`${pref.id}: source order must not change locations`);
 assert.equal(new Set(a.buildings.map(x=>x.x+':'+x.z)).size,a.buildings.length,`${pref.id}: buildings share a lot`);
 for(const row of a.buildings){assert.ok(view.entities.includes(row.entity));assert.equal(row.entity.pref,pref.id);assert.equal(row.id,row.entity.id);assert.ok(Number.isFinite(row.h)&&row.h>0);if(row.entity.kind==='store')assert.equal(row.kind,'store');if(row.entity.kind==='office')assert.equal(row.kind,'office');if(row.entity.kind==='tenant')assert.equal(row.kind,'commercial');if(row.entity.kind==='competitor')assert.equal(row.kind,'commercial');seen.add(row.entity.kind);}
 total+=a.buildings.length;
}
assert.ok(total>100,'exercise real state across the entire country');
assert.equal(JSON.stringify(g),save,'map layout must not write any state, balances, ownership or UI selection');
assert.equal(JSON.stringify(g.simulationRng),rng,'map layout must not advance simulation RNG');
const view=modules.mapPhase2Canvas.buildMapViewModel({...g,selectedPref:'tokyo'},engine);
const store={id:'port-store',prefID:'tokyo',tenantID:g.tenants.find(t=>t.prefID==='tokyo').id,businessID:'ramen',name:'本体の店舗',status:'open'};
const ownerFixture={...g,selectedPref:'tokyo',stores:[store],tenants:[{...g.tenants.find(t=>t.prefID==='tokyo'),occupiedBy:'player'}]};
const ownerView=modules.mapPhase2Canvas.buildMapViewModel(ownerFixture,engine);
assert.equal(ownerView.entities.find(x=>x.id==='store:port-store').store,store);
assert.equal(ownerView.entities.filter(x=>x.kind==='tenant').length,0,'occupied lease must not appear as an available site');
assert.equal(modules.cityLabMap.layout(ownerView).buildings.find(x=>x.id==='store:port-store').kind,'store');
const crowded={prefID:'tokyo',entities:Array.from({length:90},(_,i)=>({...view.entities[0],id:'tenant:overflow-'+i,kind:'tenant'}))};
const crowdedLayout=modules.cityLabMap.layout(crowded);
assert.equal(crowdedLayout.buildings.length,56);assert.equal(crowdedLayout.overflow,34);assert.equal(crowded.entities.length,90,'visual cap must not drop canonical listings');
const property=view.entities.find(x=>x.kind==='realestate');assert.ok(property&&property.property,'properties must retain canonical purchase identity');
// The executable adapter plus capability boundary protects against accidentally copying the demo game.
assert.equal(modules.cityLabMap.save,undefined);assert.equal(modules.cityLabMap.nextWeek,undefined);assert.equal(modules.cityLabMap.buy,undefined);
const src=fs.readFileSync('js/city-lab-map.js','utf8');assert.doesNotMatch(src,/localStorage|sessionStorage|Math\.random|\.companyCash\s*[-+]?=|\.personalCash\s*[-+]?=/);
console.log(`City Lab production adapter passed: 47 prefectures, ${total} real entities, deterministic semantic geometry, ownership, overflow and read-only state.`);
