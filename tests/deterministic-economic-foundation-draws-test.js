'use strict';

// #812 module 6/6: deterministic-economic-foundation's keyed noise must be independent across weeks,
// and a new game's macro path must come from that game's persisted simulationRng seed. Existing saves
// keep their already-persisted economicFoundation.seed so reload compatibility remains deterministic.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Engine { constructor(g){ this.g=g; } normalize(){} }
const modules = { engine:{TycoonEngine:Engine}, playerEngineBridge:{getEngine:()=>null} };
const context = { globalThis:null, console };
context.globalThis = context;
context.__capitalismTycoonModules = modules;
vm.runInNewContext(fs.readFileSync('js/deterministic-economic-foundation.js','utf8'), context);
const mod = modules.deterministicEconomicFoundation;

const game = seed => ({
  week:1,
  companyName:'Same Holdings',
  ticker:'SAME',
  simulationRng:{seed,state:seed,draws:0,nextID:1,version:1},
  economy:1,season:1,policyRate:.005,inflation:1,exchangeRate:1,realEstateCycle:1,macroCrisis:null
});

// 1. New games with the same company identity use their own persisted game seed.
{
  const a=game(0x812800), b=game(0x812801), again=game(0x812800);
  mod.ensure(a); mod.ensure(b); mod.ensure(again);
  assert.equal(a.economicFoundation.seed,0x812800);
  assert.equal(b.economicFoundation.seed,0x812801);
  assert.equal(again.economicFoundation.seed,0x812800);
}

// 2. Old saves retain their stored foundation seed even if their simulation stream has another seed.
{
  const legacy=game(0x812802);
  legacy.economicFoundation={seed:0x12345678,lastProcessedWeek:null,phase:'安定',indicators:{},history:[]};
  mod.ensure(legacy);
  assert.equal(legacy.economicFoundation.seed,0x12345678,'persisted legacy foundation seed is immutable');
}

// 3. The weekly keyed draw has no material lag-1 correlation. Main before this fix is about +0.20
// for this exact series; independent deterministic draws should be near zero.
{
  const values=Array.from({length:1560},(_,i)=>mod.unit(0x812800,`cycle-${i+1}`));
  const xs=values.slice(0,-1), ys=values.slice(1);
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length, mx=mean(xs), my=mean(ys);
  let c=0,vx=0,vy=0;
  for(let i=0;i<xs.length;i++){ const dx=xs[i]-mx,dy=ys[i]-my;c+=dx*dy;vx+=dx*dx;vy+=dy*dy; }
  const r=c/Math.sqrt(vx*vy);
  assert.ok(Math.abs(r)<.1,`economic foundation weekly noise lag-1 correlation ${r.toFixed(3)} (independent: 0)`);
}

// 4. Same game seed + same actions is stable; another game seed gets another macro path.
function path(seed){
  const s=game(seed), out=[];
  for(let week=1;week<=104;week++){ s.week=week; const i=mod.step(s); out.push([i.cycle,i.stress,i.exchangeRate,i.commodityIndex]); }
  return out;
}
assert.deepEqual(path(0x812800),path(0x812800),'the same game seed gives the same macro path');
assert.notDeepEqual(path(0x812800),path(0x812801),'another game seed gives another macro path');

console.log('deterministic economic foundation draws tests passed');
