'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const allocation=fs.readFileSync(path.join(__dirname,'../js/inter-subsidiary-synergy-allocation.js'),'utf8');
const performance=fs.readFileSync(path.join(__dirname,'../js/inter-subsidiary-synergy-performance.js'),'utf8');
class Engine{constructor(state){this.g=state;this.normalize();}normalize(){}fail(){return false;}notify(){}runTransaction(work){return work();}}
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${v}円`},finance:{event(){}},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(allocation,context);vm.runInNewContext(performance,context);
const state={week:40,configured:true,selectedTab:'venture',companyCash:100_000_000,personalCash:7_000_000,saveVersion:9,subsidiaries:[{id:'a',name:'物流',status:'active',ownership:.8,valuation:100_000_000,carryingBookValue:40_000_000,weeklyProfit:1_000_000,growth:.2,risk:.2},{id:'b',name:'小売',status:'active',ownership:.7,valuation:80_000_000,carryingBookValue:30_000_000,weeklyProfit:800_000,growth:.18,risk:.3}],interSubsidiarySynergyHistory:[]};
const e=new Engine(state);assert.equal(e.executeInterSubsidiarySynergy('a','b','crossSell'),true);
const row=state.interSubsidiarySynergyHistory[0];assert.equal(row.measured,true);assert.equal(row.weeklyProfitLift,90000);assert.equal(row.annualizedProfitLift,4680000);assert.equal(row.valuationLiftTotal,16000000);
const summary=modules.interSubsidiarySynergyPerformance.summarize(state);assert.equal(summary.length,1);assert.equal(summary[0].invested,20000000);assert.equal(summary[0].annualizedProfitLift,4680000);assert.equal(summary[0].valuationLift,16000000);assert.equal(summary[0].status,'高効率');assert.match(modules.interSubsidiarySynergyPerformance.recommendation(summary),/追加配分/);
const old={interSubsidiarySynergyHistory:[{pairKey:'a::b',aName:'物流',bName:'小売',cost:10000000}]};assert.equal(modules.interSubsidiarySynergyPerformance.summarize(old)[0].status,'計測不足');
assert.match(modules.interSubsidiarySynergyPerformance.renderSection({g:state}),/子会社間シナジー実績/);assert.equal(state.personalCash,7000000);assert.equal(state.saveVersion,9);
const play=fs.readFileSync(path.join(__dirname,'../play.html'),'utf8'),runAll=fs.readFileSync(path.join(__dirname,'run-all.js'),'utf8');assert.match(play,/inter-subsidiary-synergy-performance\.js\?launch=/);assert.match(runAll,/inter-subsidiary-synergy-performance-test\.js/);assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|SAVE_KEY\s*=|saveVersion\s*=/.test(performance));
console.log('Inter-subsidiary synergy performance ROI, legacy history and production wiring tests passed');