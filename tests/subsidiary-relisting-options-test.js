'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/subsidiary-relisting-options.js'),'utf8');
class Engine{constructor(state){this.g=state;this.normalize();}normalize(){}fail(message){this.lastError=message;return false;}notify(){}runTransaction(work){return work();}}
const events=[];
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${Math.round(Number(v)||0)}円`},finance:{event:(state,type,amount,meta)=>events.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'subsidiary-relisting-options.js'});
const mod=modules.subsidiaryRelistingOptions;
function state(){return {week:100,configured:true,selectedTab:'venture',companyCash:100_000_000,personalCash:7_000_000,saveVersion:9,subsidiaries:[{id:'sub-1',name:'物流子会社',status:'active',publicCompany:false,ownership:1,valuation:400_000_000,carryingBookValue:180_000_000,subsidiaryCash:20_000_000,weeklyProfit:3_000_000,growth:.24,risk:.18,integrationSynergyRounds:2,delistedWeek:70}],subsidiaryRelistingHistory:[]};}
const a=state(),engine=new Engine(a),beforePersonal=a.personalCash;
const p=engine.subsidiaryRelistingPreview('sub-1','balanced');
assert.equal(p.eligible,true);assert.equal(p.primaryProceeds,37_200_000);assert.equal(p.secondaryProceeds,37_200_000);assert.equal(p.preparationCost,15_000_000);assert.equal(p.primaryRatio,.1);assert.equal(p.secondaryRatio,.1);assert.equal(p.ownershipAfter,.823422);
assert.equal(engine.relistSubsidiary('sub-1','balanced'),true);
const sub=a.subsidiaries[0];assert.equal(a.companyCash,122_200_000);assert.equal(sub.subsidiaryCash,57_200_000);assert.equal(sub.valuation,437_200_000);assert.equal(sub.ownership,.823422);assert.equal(sub.carryingBookValue,162_000_000);assert.equal(sub.publicCompany,true);assert.equal(sub.relistingRounds,1);assert.equal(sub.ipoOfferTerms.lockupUntilWeek,118);assert.equal(a.personalCash,beforePersonal);assert.equal(a.saveVersion,9);
assert.equal(events[0].type,'professionalServices');assert.equal(events[1].type,'investmentSale');assert.equal(events[1].meta.cashEffect,37_200_000);assert.equal(events[1].meta.assetEffect,-18_000_000);assert.equal(events[1].meta.profitEffect,19_200_000);
const b=state(),c=state(),eb=new Engine(b),ec=new Engine(c);eb.relistSubsidiary('sub-1','growth');ec.relistSubsidiary('sub-1','growth');assert.deepEqual(JSON.parse(JSON.stringify(b.subsidiaries[0])),JSON.parse(JSON.stringify(c.subsidiaries[0])));
const ineligible=state();ineligible.subsidiaries[0].integrationSynergyRounds=1;const e2=new Engine(ineligible);assert.equal(e2.relistSubsidiary('sub-1','balanced'),false);assert.match(e2.lastError,/PMI投資2回/);
assert.match(mod.renderSection({g:state()}),/完全子会社の再上場/);assert.match(mod.renderSection({g:state()}),/min-height:44px/);
const play=fs.readFileSync(path.join(__dirname,'../play.html'),'utf8');assert.match(play,/subsidiary-relisting-options\.js\?launch=/);assert.match(play,/再上場戦略モジュールを公開起動順へ追加できませんでした/);
const runAll=fs.readFileSync(path.join(__dirname,'run-all.js'),'utf8');assert.match(runAll,/subsidiary-relisting-options-test\.js/);
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code));assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code));
console.log('Subsidiary relisting strategy, accounting, determinism, loader and iPhone UI tests passed');