'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/inter-subsidiary-synergy-allocation.js'),'utf8');
class Engine{constructor(state){this.g=state;this.normalize();}normalize(){}fail(message){this.lastError=message;return false;}notify(){}runTransaction(work){return work();}}
const events=[];
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${Math.round(Number(v)||0)}円`},finance:{event:(state,type,amount,meta)=>events.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'inter-subsidiary-synergy-allocation.js'});
const mod=modules.interSubsidiarySynergyAllocation;
function state(){return {week:80,configured:true,selectedTab:'venture',companyCash:200_000_000,personalCash:5_000_000,saveVersion:9,subsidiaries:[{id:'a',name:'物流',status:'active',publicCompany:true,ownership:.65,valuation:120_000_000,carryingBookValue:60_000_000,weeklyProfit:2_000_000,growth:.2,risk:.25},{id:'b',name:'小売',status:'active',publicCompany:false,ownership:1,valuation:180_000_000,carryingBookValue:90_000_000,weeklyProfit:3_000_000,growth:.25,risk:.2}],interSubsidiarySynergyHistory:[]};}
const s=state(),engine=new Engine(s),beforePersonal=s.personalCash;
const p=engine.interSubsidiarySynergyPreview('a','b','crossSell');
assert.equal(p.cost,20_000_000);assert.equal(p.allocationA,10_000_000);assert.equal(p.allocationB,10_000_000);assert.equal(p.a.weeklyProfitAfter,2_100_000);assert.equal(p.b.weeklyProfitAfter,3_150_000);assert.equal(p.a.growthAfter,.22);assert.equal(p.b.growthAfter,.27);
assert.equal(engine.executeInterSubsidiarySynergy('a','b','crossSell'),true);
assert.equal(s.companyCash,180_000_000);assert.equal(s.subsidiaries[0].carryingBookValue,70_000_000);assert.equal(s.subsidiaries[1].carryingBookValue,100_000_000);assert.equal(s.subsidiaries[0].valuation,128_000_000);assert.equal(s.subsidiaries[1].valuation,188_000_000);assert.equal(s.personalCash,beforePersonal);assert.equal(s.saveVersion,9);
const ev=events.at(-1);assert.equal(ev.type,'assetPurchase');assert.equal(ev.amount,20_000_000);assert.equal(ev.meta.cashEffect,-20_000_000);assert.equal(ev.meta.assetEffect,20_000_000);assert.equal(s.subsidiaries[0].interSubsidiarySynergyInvested+s.subsidiaries[1].interSubsidiarySynergyInvested,20_000_000);
assert.equal(engine.executeInterSubsidiarySynergy('b','a','procurement'),false);assert.match(engine.lastError,/残り26週/);
s.week=106;assert.equal(engine.executeInterSubsidiarySynergy('b','a','procurement'),true);
const deterministicA=state(),deterministicB=state(),eA=new Engine(deterministicA),eB=new Engine(deterministicB);eA.executeInterSubsidiarySynergy('a','b','platform');eB.executeInterSubsidiarySynergy('b','a','platform');assert.deepEqual(JSON.parse(JSON.stringify(deterministicA.subsidiaries)),JSON.parse(JSON.stringify(deterministicB.subsidiaries)));
const low=state();low.subsidiaries[0].ownership=.19;const lowEngine=new Engine(low);assert.equal(lowEngine.executeInterSubsidiarySynergy('a','b','crossSell'),false);
const html=mod.renderSection({g:state()});assert.match(html,/子会社間シナジー配分/);assert.match(html,/min-height:44px/);assert.match(html,/二重計上しません/);
const play=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(play,/inter-subsidiary-synergy-allocation\.js"/);
const runAll=fs.readFileSync(path.join(__dirname,'run-all.js'),'utf8');assert.match(runAll,/inter-subsidiary-synergy-allocation-test\.js/);
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code));assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code));
console.log('Inter-subsidiary synergy allocation accounting, cooldown, determinism, production wiring and iPhone UI tests passed');
