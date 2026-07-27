'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/subsidiary-integration-synergy.js'),'utf8');
const play=fs.readFileSync(path.join(__dirname,'../play.html'),'utf8');
const runAll=fs.readFileSync(path.join(__dirname,'run-all.js'),'utf8');
class Engine{constructor(state){this.g=state;this.normalize();}normalize(){}fail(message){this.lastError=message;return false;}notify(){}runTransaction(work){return work();}}
const events=[];
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${Math.round(Number(v)||0)}円`},finance:{event:(state,type,amount,meta)=>events.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'subsidiary-integration-synergy.js'});
const mod=modules.subsidiaryIntegrationSynergy;
function state(){return {week:40,configured:true,selectedTab:'venture',companyCash:100_000_000,personalCash:5_000_000,saveVersion:9,subsidiaries:[{id:'sub-1',name:'物流子会社',status:'active',publicCompany:false,ownership:1,valuation:120_000_000,carryingBookValue:60_000_000,weeklyProfit:2_000_000,growth:.2,risk:.25}],subsidiaryIntegrationSynergyHistory:[]};}
const a=state(),engine=new Engine(a),beforePersonal=a.personalCash;
const preview=engine.subsidiaryIntegrationSynergyPreview('sub-1','crossSell');
assert.equal(preview.cost,25_000_000);assert.equal(preview.valuationAfter,140_000_000);assert.equal(preview.weeklyProfitAfter,2_160_000);assert.equal(preview.growthAfter,.24);assert.equal(preview.riskAfter,.24);
assert.equal(engine.investSubsidiaryIntegrationSynergy('sub-1','crossSell'),true);
const sub=a.subsidiaries[0];assert.equal(a.companyCash,75_000_000);assert.equal(sub.carryingBookValue,85_000_000);assert.equal(sub.integrationSynergyInvested,25_000_000);assert.equal(sub.integrationSynergyRounds,1);assert.equal(sub.valuation,140_000_000);assert.equal(sub.weeklyProfit,2_160_000);assert.equal(sub.growth,.24);assert.equal(sub.risk,.24);assert.equal(a.personalCash,beforePersonal);assert.equal(a.saveVersion,9);
assert.equal(events.at(-1).type,'assetPurchase');assert.equal(events.at(-1).meta.cashEffect,-25_000_000);assert.equal(events.at(-1).meta.assetEffect,25_000_000);
assert.equal(engine.investSubsidiaryIntegrationSynergy('sub-1','operations'),false);assert.match(engine.lastError,/残り13週/);
a.week=53;assert.equal(engine.investSubsidiaryIntegrationSynergy('sub-1','operations'),true);
const b=state(),engineB=new Engine(b);engineB.investSubsidiaryIntegrationSynergy('sub-1','crossSell');assert.deepEqual(JSON.parse(JSON.stringify(b.subsidiaries[0])),JSON.parse(JSON.stringify(stateAfterFirst())));
function stateAfterFirst(){const s=state(),e=new Engine(s);e.investSubsidiaryIntegrationSynergy('sub-1','crossSell');return s.subsidiaries[0];}
const ineligible=state();ineligible.subsidiaries[0].publicCompany=true;const e2=new Engine(ineligible);assert.equal(e2.investSubsidiaryIntegrationSynergy('sub-1','operations'),false);
assert.match(mod.renderSection({g:state()}),/完全子会社シナジー投資/);assert.match(mod.renderSection({g:state()}),/min-height:44px/);
assert.match(play,/subsidiary-integration-synergy\.js\?launch=/);assert.match(play,/完全子会社シナジー投資モジュールを公開起動順へ追加できませんでした/);assert.match(runAll,/subsidiary-integration-synergy-test\.js/);
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code));assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code));
console.log('Subsidiary integration synergy accounting, cooldown, determinism, production wiring and UI tests passed');
