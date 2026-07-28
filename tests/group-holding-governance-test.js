'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Engine{constructor(state){this.g=state;}normalize(){}updateSubsidiaries(){}runTransaction(fn){return fn();}fail(){return false;}notify(){}}
const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules},console,queueMicrotask:fn=>fn()};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/group-holding-governance.js'),'utf8'),context);
const api=modules.groupHoldingGovernance;
assert.ok(api&&api.__installed);
const state={configured:true,week:10,companyCash:1000000,maSubsidiaries:[{id:'a',name:'成長社',status:'active',valuation:100000000,weeklyProfit:400000,growthRate:.15,risk:.2,pmiHealth:80},{id:'b',name:'再建社',status:'active',valuation:50000000,weeklyProfit:-100000,growthRate:-.05,risk:.7,pmiHealth:35}]};
api.ensure(state);assert.equal(state.groupHoldingGovernance.policy,'balanced');assert.equal(api.summarize(state).subsidiaries,2);
const engine=new Engine(state);engine.normalize();assert.equal(engine.setGroupHoldingPolicy('growth'),true);assert.equal(engine.runGroupHoldingReview(),true);assert.equal(engine.runGroupHoldingReview(),false);assert.equal(state.maSubsidiaries[0].groupMandate,'成長投資');assert.equal(state.maSubsidiaries[1].groupMandate,'リスク削減');
const roundTrip=JSON.parse(JSON.stringify(state));api.ensure(roundTrip);assert.deepEqual(api.summarize(roundTrip).rows,api.summarize(state).rows);
state.week=11;engine.setGroupHoldingPolicy('turnaround');assert.equal(engine.runGroupHoldingReview(),true);assert.equal(state.maSubsidiaries[1].groupMandate,'再建');
for(let week=12;week<100;week++){state.week=week;engine.runGroupHoldingReview();}assert.ok(state.groupHoldingGovernance.history.length<=60);
assert.equal(state.companyCash,1000000);assert.ok(!('personalCash' in state));
console.log('group holding governance tests passed');