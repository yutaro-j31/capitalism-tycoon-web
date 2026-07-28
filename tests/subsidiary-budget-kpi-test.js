'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Engine{constructor(state){this.g=state;}normalize(){}runTransaction(fn){return fn();}fail(){return false;}notify(){}}
const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null},groupHoldingGovernance:{__installed:true}};
const context={globalThis:{__capitalismTycoonModules:modules},console,queueMicrotask:fn=>fn()};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/subsidiary-budget-kpi.js'),'utf8'),context);
const api=modules.subsidiaryBudgetKpi;
assert.ok(api&&api.__installed);
const state={configured:true,week:10,companyCash:1000000,maSubsidiaries:[{id:'a',name:'成長社',status:'active',groupMandate:'成長投資',valuation:100000000,weeklyProfit:400000,growthRate:.15,risk:.2},{id:'b',name:'再建社',status:'active',groupMandate:'再建',valuation:50000000,weeklyProfit:-100000,growthRate:-.05,risk:.7}]};
api.ensure(state);assert.equal(api.plan(state),true);assert.equal(api.plan(state),false);assert.equal(state.maSubsidiaries[0].groupBudgetPlan.priority,'growth');assert.equal(state.maSubsidiaries[1].groupBudgetPlan.priority,'profit');assert.ok(state.maSubsidiaries[0].groupBudgetPlan.budget>0);assert.ok(state.maSubsidiaries[1].groupBudgetPlan.riskTarget<.7);
const roundTrip=JSON.parse(JSON.stringify(state));api.ensure(roundTrip);assert.deepEqual(api.summarize(roundTrip).rows,api.summarize(state).rows);
for(let week=11;week<100;week++){state.week=week;api.plan(state);}assert.ok(state.subsidiaryBudgetKpi.history.length<=60);
assert.equal(state.companyCash,1000000);assert.ok(!('personalCash' in state));
console.log('subsidiary budget KPI tests passed');